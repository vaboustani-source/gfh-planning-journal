import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Copy, Link2, Loader2, Share2, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import MoodboardCard from "./MoodboardCard";
import PinterestBoardEmbed from "./PinterestBoardEmbed";
import {
  MAX_UPLOAD_BYTES, MOODBOARD_CATEGORIES, isImageFile, normalizePinterestBoard, uploadMoodboardImage,
  type MoodboardItem,
} from "@/lib/moodboard";

type Settings = { pinterest_board_url: string | null; share_token: string | null };

async function functionError(error: unknown): Promise<string> {
  const ctx = (error as { context?: unknown })?.context;
  if (ctx instanceof Response) {
    try { const body = await ctx.clone().json(); if (body?.error) return body.error; } catch { /* not JSON */ }
  }
  return (error as Error)?.message ?? "Something went wrong";
}

/**
 * The wedding's mood board. `couple` mode is the portal page; `staff` mode (admin
 * wedding tab) adds team notes, favorites and the vendor share link.
 */
export default function MoodBoard({ eventId, mode }: { eventId: string; mode: "couple" | "staff" }) {
  const [items, setItems] = useState<MoodboardItem[]>([]);
  const [settings, setSettings] = useState<Settings>({ pinterest_board_url: null, share_token: null });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [link, setLink] = useState("");
  const [addingLink, setAddingLink] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [boardDraft, setBoardDraft] = useState("");
  const [editingBoard, setEditingBoard] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const [{ data: rows }, { data: s }] = await Promise.all([
      supabase.from("moodboard_items").select("*").eq("event_id", eventId).order("created_at", { ascending: false }),
      supabase.from("moodboard_settings").select("pinterest_board_url, share_token").eq("event_id", eventId).maybeSingle(),
    ]);
    setItems((rows ?? []) as MoodboardItem[]);
    if (s) setSettings(s);
    setLoading(false);
  }, [eventId]);

  useEffect(() => { void load(); }, [load]);

  const newItemCategory = filter !== "all" && filter !== "favorites" ? filter : "other";

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length, favorites: items.filter(i => i.approved).length };
    items.forEach(i => { c[i.category] = (c[i.category] ?? 0) + 1; });
    return c;
  }, [items]);

  const shown = items.filter(i =>
    filter === "all" ? true : filter === "favorites" ? i.approved : i.category === filter);

  /* ── Adding ─────────────────────────────── */

  const uploadFiles = async (files: File[]) => {
    const images = files.filter(isImageFile);
    const tooBig = images.filter(f => f.size > MAX_UPLOAD_BYTES);
    if (images.length < files.length) toast.error("Only photos can go on the mood board.");
    if (tooBig.length) toast.error(`${tooBig.length} photo${tooBig.length > 1 ? "s are" : " is"} over 15 MB and was skipped.`);
    const ok = images.filter(f => f.size <= MAX_UPLOAD_BYTES);
    if (!ok.length) return;
    setUploading(n => n + ok.length);
    await Promise.all(ok.map(async file => {
      try {
        const path = await uploadMoodboardImage(eventId, file);
        const { data, error } = await supabase.from("moodboard_items")
          .insert({ event_id: eventId, kind: "photo", provider: "upload", image_path: path, category: newItemCategory })
          .select("*").single();
        if (error) throw error;
        setItems(prev => [data as MoodboardItem, ...prev]);
      } catch (e) {
        toast.error(`Couldn't add ${file.name}: ${(e as Error).message}`);
      } finally {
        setUploading(n => n - 1);
      }
    }));
  };

  const addLink = async () => {
    const url = link.trim();
    if (!url) return;
    if (normalizePinterestBoard(url) && !/\/pin\//.test(url)) {
      // Looks like a whole board, not a single pin.
      await saveBoard(url);
      setLink("");
      return;
    }
    setAddingLink(true);
    const { data, error } = await supabase.functions.invoke("moodboard-link", {
      body: { event_id: eventId, url, category: newItemCategory },
    });
    setAddingLink(false);
    if (error || data?.error) {
      toast.error(data?.error ?? (await functionError(error)));
      return;
    }
    setItems(prev => [data.item as MoodboardItem, ...prev]);
    setLink("");
    if (!data.image_found) {
      toast("Saved. We couldn't grab a picture from that link, so add a screenshot to the card.");
    }
  };

  /* ── Editing ────────────────────────────── */

  const update = async (id: string, patch: Partial<MoodboardItem>) => {
    const prev = items;
    setItems(list => list.map(i => (i.id === id ? { ...i, ...patch } : i)));
    const { error } = await supabase.from("moodboard_items").update(patch).eq("id", id);
    if (error) {
      setItems(prev);
      toast.error(error.message);
    }
  };

  const remove = async (item: MoodboardItem) => {
    setItems(list => list.filter(i => i.id !== item.id));
    const { error } = await supabase.from("moodboard_items").delete().eq("id", item.id);
    if (error) {
      toast.error(error.message);
      void load();
      return;
    }
    if (item.image_path) await supabase.storage.from("moodboard").remove([item.image_path]);
  };

  const attachImage = async (item: MoodboardItem, file: File) => {
    if (!isImageFile(file) || file.size > MAX_UPLOAD_BYTES) {
      toast.error("Please choose a photo under 15 MB.");
      return;
    }
    try {
      const path = await uploadMoodboardImage(eventId, file);
      await update(item.id, { image_path: path });
      if (item.image_path) await supabase.storage.from("moodboard").remove([item.image_path]);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  /* ── Pinterest board + share link ───────── */

  const saveSettings = async (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    const { error } = await supabase.from("moodboard_settings")
      .upsert({ event_id: eventId, pinterest_board_url: next.pinterest_board_url, ...(mode === "staff" ? { share_token: next.share_token } : {}) },
        { onConflict: "event_id" });
    if (error) {
      toast.error(error.message);
      return false;
    }
    setSettings(next);
    return true;
  };

  const saveBoard = async (raw: string) => {
    if (!raw.trim()) {
      if (await saveSettings({ pinterest_board_url: null })) setEditingBoard(false);
      return;
    }
    const url = normalizePinterestBoard(raw);
    if (!url) {
      toast.error(/pin\.it/i.test(raw)
        ? "Short pin.it links can't be read. Open the board on pinterest.com and copy the address from there."
        : "That doesn't look like a Pinterest board link. It should look like pinterest.com/yourname/board-name.");
      return;
    }
    if (await saveSettings({ pinterest_board_url: url })) {
      setEditingBoard(false);
      toast.success("Pinterest board connected.");
    }
  };

  const shareUrl = settings.share_token ? `${window.location.origin}/moodboard/${settings.share_token}` : null;
  const createShare = async () => {
    if (await saveSettings({ share_token: crypto.randomUUID() })) toast.success("Share link created.");
  };
  const copyShare = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied. Anyone with it can view the board.");
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Add inspiration */}
      <div className="rounded-xl bg-card border border-border p-5 space-y-4">
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); void uploadFiles(Array.from(e.dataTransfer.files)); }}
          onClick={() => fileRef.current?.click()}
          className={`cursor-pointer rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
            dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/30"
          }`}
        >
          {uploading > 0 ? (
            <p className="inline-flex items-center gap-2 font-body text-sm text-foreground">
              <Loader2 size={16} className="animate-spin" /> Adding {uploading} photo{uploading > 1 ? "s" : ""}…
            </p>
          ) : (
            <>
              <Upload size={20} className="mx-auto mb-2 text-muted-foreground" />
              <p className="font-body text-sm text-foreground">Add photos</p>
              <p className="font-body text-xs text-muted-foreground mt-0.5">
                Screenshots from Instagram or TikTok, saved photos, anything. Choose several at once.
              </p>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={e => { void uploadFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }}
          />
        </div>

        <div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={link}
                onChange={e => setLink(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") void addLink(); }}
                placeholder="Paste a Pinterest, Instagram or TikTok link"
                className="w-full rounded-lg border border-border bg-background pl-8 pr-3 py-2 font-body text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              />
            </div>
            <button
              onClick={() => void addLink()}
              disabled={!link.trim() || addingLink}
              className="rounded-lg bg-primary px-4 py-2 font-body text-sm text-primary-foreground hover:opacity-90 disabled:opacity-40 inline-flex items-center gap-1.5"
            >
              {addingLink && <Loader2 size={14} className="animate-spin" />} Add
            </button>
          </div>
          {newItemCategory !== "other" && (
            <p className="font-body text-[11px] text-muted-foreground mt-1.5">New items go into {MOODBOARD_CATEGORIES.find(c => c.key === newItemCategory)?.label}.</p>
          )}
        </div>
      </div>

      {/* Pinterest board */}
      <div className="rounded-xl bg-card border border-border p-5">
        <div className="flex items-center justify-between gap-3 mb-1">
          <p className="font-display text-lg font-light text-foreground">Pinterest board</p>
          {settings.pinterest_board_url && !editingBoard && (
            <div className="flex items-center gap-3">
              <a href={settings.pinterest_board_url} target="_blank" rel="noopener noreferrer" className="font-body text-xs text-muted-foreground hover:text-foreground">Open on Pinterest</a>
              <button onClick={() => { setBoardDraft(settings.pinterest_board_url ?? ""); setEditingBoard(true); }} className="font-body text-xs text-muted-foreground hover:text-foreground underline">Change</button>
            </div>
          )}
        </div>
        {settings.pinterest_board_url && !editingBoard ? (
          <>
            <PinterestBoardEmbed url={settings.pinterest_board_url} />
            <p className="font-body text-[11px] text-muted-foreground mt-2">Nothing showing? The board needs to be public on Pinterest.</p>
          </>
        ) : (
          <>
            <p className="font-body text-xs text-muted-foreground mb-3">
              Already pinning? Paste your board's link and it shows here for the team. The board has to be public.
            </p>
            <div className="flex gap-2">
              <input
                value={boardDraft}
                onChange={e => setBoardDraft(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") void saveBoard(boardDraft); }}
                placeholder="pinterest.com/yourname/our-wedding"
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 font-body text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              />
              <button onClick={() => void saveBoard(boardDraft)} className="rounded-lg border border-border px-4 py-2 font-body text-sm text-foreground hover:border-primary/40">
                {editingBoard && !boardDraft.trim() ? "Remove" : "Connect"}
              </button>
              {editingBoard && (
                <button onClick={() => setEditingBoard(false)} className="px-2 text-muted-foreground hover:text-foreground" title="Cancel"><X size={16} /></button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Vendor share link (staff) */}
      {mode === "staff" && (
        <div className="rounded-xl bg-card border border-border p-5 flex flex-col sm:flex-row sm:items-center gap-3">
          <Share2 size={18} className="text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-body text-sm text-foreground">Share with vendors</p>
            <p className="font-body text-xs text-muted-foreground truncate">
              {shareUrl ?? "A view-only link for the florist, designer or baker. Team notes stay private."}
            </p>
          </div>
          {shareUrl ? (
            <div className="flex gap-2">
              <button onClick={() => void copyShare()} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 font-body text-xs text-primary-foreground hover:opacity-90"><Copy size={13} /> Copy link</button>
              <button onClick={() => { if (confirm("Turn off this link? Anyone who has it will lose access.")) void saveSettings({ share_token: null }); }} className="rounded-lg border border-border px-3 py-2 font-body text-xs text-muted-foreground hover:text-foreground">Turn off</button>
            </div>
          ) : (
            <button onClick={() => void createShare()} className="rounded-lg border border-border px-3 py-2 font-body text-xs text-foreground hover:border-primary/40">Create link</button>
          )}
        </div>
      )}

      {/* Filters */}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {[{ key: "all", label: "All" }, ...(counts.favorites ? [{ key: "favorites", label: "Team favorites" }] : []), ...MOODBOARD_CATEGORIES]
            .filter(c => c.key === "all" || c.key === "favorites" || counts[c.key])
            .map(c => (
              <button
                key={c.key}
                onClick={() => setFilter(c.key)}
                className={`rounded-full border px-3 py-1 font-body text-xs transition-colors ${
                  filter === c.key ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
                }`}
              >
                {c.label} <span className="opacity-60">{counts[c.key] ?? 0}</span>
              </button>
            ))}
        </div>
      )}

      {/* Board */}
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center">
          <p className="font-display text-xl font-light text-foreground mb-1">Nothing here yet</p>
          <p className="font-body text-sm text-muted-foreground">
            {mode === "couple"
              ? "Start with a few photos or links that feel like your weekend. There are no wrong answers."
              : "The couple hasn't added any inspiration yet."}
          </p>
        </div>
      ) : shown.length === 0 ? (
        <p className="font-body text-sm text-muted-foreground">Nothing in this category yet.</p>
      ) : (
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
          {shown.map(item => (
            <MoodboardCard
              key={item.id}
              item={item}
              mode={mode}
              onUpdate={patch => void update(item.id, patch)}
              onDelete={() => void remove(item)}
              onAttachImage={file => attachImage(item, file)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
