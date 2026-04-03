import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, Trash2, Lock, Eye } from "lucide-react";
import AdminStickyFooter from "@/components/admin/AdminStickyFooter";

interface CoupleNote {
  id: string;
  title: string | null;
  body: string | null;
  created_at: string | null;
  shared_with_brandon: boolean;
}

interface BrandonNote {
  id: string;
  title: string;
  body: string;
  created_at: string | null;
}

export default function AdminNotesTab({ eventId, onNavigateNext }: { eventId: string; onNavigateNext: () => void }) {
  const [coupleNotes, setCoupleNotes] = useState<CoupleNote[]>([]);
  const [brandonNotes, setBrandonNotes] = useState<BrandonNote[]>([]);
  const [loading, setLoading] = useState(true);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    Promise.all([
      supabase.from("couple_notes").select("id, title, body, created_at, shared_with_brandon").eq("event_id", eventId).eq("shared_with_brandon", true).order("created_at", { ascending: false }),
      // Brandon's internal notes — stored as couple_notes with created_by = admin user, shared_with_brandon = false
      // We'll use a separate convention: notes where shared_with_brandon is false AND created by an admin
      supabase.from("couple_notes").select("id, title, body, created_at, shared_with_brandon, created_by").eq("event_id", eventId).eq("shared_with_brandon", false).order("created_at", { ascending: false }),
    ]).then(([{ data: shared }, { data: internal }]) => {
      if (shared) setCoupleNotes(shared.map(n => ({ ...n, shared_with_brandon: n.shared_with_brandon ?? false })));
      // Filter to only admin-created notes by checking if user role is admin
      // For now show all non-shared notes as Brandon's internal
      if (internal) setBrandonNotes(internal.map(n => ({ id: n.id, title: n.title ?? "", body: n.body ?? "", created_at: n.created_at })));
      setLoading(false);
    });
  }, [eventId]);

  const addBrandonNote = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("couple_notes")
      .insert({ event_id: eventId, created_by: user.id, title: "", body: "", shared_with_brandon: false })
      .select("id, title, body, created_at")
      .single();
    if (data) setBrandonNotes(prev => [{ id: data.id, title: data.title ?? "", body: data.body ?? "", created_at: data.created_at }, ...prev]);
  };

  const updateBrandonNote = (id: string, field: string, value: string) => {
    setBrandonNotes(prev => prev.map(n => n.id === id ? { ...n, [field]: value } : n));
    if (debounceTimers.current[id]) clearTimeout(debounceTimers.current[id]);
    debounceTimers.current[id] = setTimeout(() => {
      supabase.from("couple_notes").update({ [field]: value, updated_at: new Date().toISOString() }).eq("id", id).then(() => {});
    }, 800);
  };

  const deleteBrandonNote = async (id: string) => {
    setBrandonNotes(prev => prev.filter(n => n.id !== id));
    await supabase.from("couple_notes").delete().eq("id", id);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-10">
      {/* Shared by couple */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Eye size={16} className="text-sage" />
          <p className="font-display text-xl font-light text-foreground">Shared by Couple</p>
        </div>
        <p className="font-body text-xs text-muted-foreground mb-4">
          These notes were shared with you by the couple. You cannot edit them.
        </p>
        {coupleNotes.length === 0 ? (
          <div className="rounded-xl bg-muted/30 border border-border p-6 text-center">
            <p className="font-body text-sm text-muted-foreground italic">No shared notes yet — the couple hasn't shared any notes with you.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {coupleNotes.map(note => (
              <div key={note.id} className="rounded-xl bg-card border border-border p-5 shadow-soft">
                <p className="font-display text-lg font-light text-foreground mb-1">{note.title || "Untitled"}</p>
                <p className="font-body text-sm text-foreground whitespace-pre-wrap">{note.body}</p>
                {note.created_at && (
                  <p className="font-body text-[10px] text-muted-foreground mt-3">
                    {new Date(note.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Brandon's internal notes */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Lock size={16} className="text-muted-foreground" />
          <p className="font-display text-xl font-light text-foreground">Brandon's Internal Notes</p>
        </div>
        <p className="font-body text-xs text-muted-foreground mb-4">
          These notes are private — the couple will never see them.
        </p>

        <button
          onClick={addBrandonNote}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 font-body text-sm text-primary-foreground hover:bg-primary/90 transition-colors mb-4"
        >
          <Plus size={14} /> Add Note
        </button>

        {brandonNotes.length === 0 ? (
          <div className="rounded-xl bg-muted/30 border border-border p-6 text-center">
            <p className="font-body text-sm text-muted-foreground italic">No internal notes yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {brandonNotes.map(note => (
              <div key={note.id} className="rounded-xl bg-card border border-border shadow-soft overflow-hidden">
                <div className="px-5 pt-4 pb-2">
                  <input
                    type="text"
                    value={note.title}
                    onChange={e => updateBrandonNote(note.id, "title", e.target.value)}
                    placeholder="Note title…"
                    className="w-full font-display text-lg font-light text-foreground bg-transparent outline-none placeholder:text-muted-foreground/40"
                  />
                </div>
                <div className="px-5 pb-4">
                  <textarea
                    value={note.body}
                    onChange={e => updateBrandonNote(note.id, "body", e.target.value)}
                    placeholder="Write your notes here…"
                    rows={3}
                    className="w-full font-body text-sm text-foreground bg-transparent outline-none placeholder:text-muted-foreground/40 resize-none leading-relaxed"
                  />
                </div>
                <div className="px-5 py-3 border-t border-border flex items-center justify-between">
                  <span className="font-body text-[10px] text-muted-foreground">
                    {note.created_at ? new Date(note.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
                  </span>
                  <button onClick={() => deleteBrandonNote(note.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <AdminStickyFooter status="idle" onSave={() => {}} onSaveAndContinue={onNavigateNext} />
    </div>
  );
}
