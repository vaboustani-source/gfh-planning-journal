import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Image as ImageIcon, X, Trash2, Upload, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DECOR_CATEGORIES, getCategoryLabel } from "@/lib/decorCategories";

interface CatalogItem {
  id: string;
  category: string;
  title: string;
  description: string | null;
  price_per_unit: number;
  price_label: string | null;
  photo_url: string | null;
  available: boolean | null;
  sort_order: number | null;
}

const BUCKET = "decor-catalog";

export default function DecorCatalog() {
  const navigate = useNavigate();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [editing, setEditing] = useState<CatalogItem | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase
      .from("decor_catalog")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("title", { ascending: true });
    if (data) setItems(data as CatalogItem[]);
    setLoading(false);
  };

  const filtered = useMemo(
    () => filter === "all" ? items : items.filter(i => i.category === filter),
    [items, filter]
  );

  const startNew = () => {
    setEditing({
      id: "", category: "tables_seating", title: "", description: "",
      price_per_unit: 0, price_label: "per item", photo_url: null,
      available: true, sort_order: 0,
    });
  };

  const handleSaved = (saved: CatalogItem) => {
    setItems(prev => {
      const exists = prev.find(p => p.id === saved.id);
      if (exists) return prev.map(p => p.id === saved.id ? saved : p);
      return [...prev, saved];
    });
    setEditing(null);
  };

  const handleDeleted = (id: string) => {
    setItems(prev => prev.filter(p => p.id !== id));
    setEditing(null);
  };

  const toggleAvailable = async (item: CatalogItem) => {
    const next = !item.available;
    await supabase.from("decor_catalog").update({ available: next }).eq("id", item.id);
    setItems(prev => prev.map(p => p.id === item.id ? { ...p, available: next } : p));
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/90 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 h-14 flex items-center gap-4">
          <button
            onClick={() => navigate("/admin")}
            className="flex items-center gap-2 font-body text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={15} /> Dashboard
          </button>
          <div className="h-4 w-px bg-border" />
          <p className="font-display text-lg font-light text-foreground">Décor Rentals</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-8 pb-24">
        <div className="flex items-end justify-between mb-6 animate-fade-up">
          <div>
            <p className="font-body text-xs tracking-widest uppercase text-muted-foreground mb-2">Coordinator inventory</p>
            <h1 className="font-display text-4xl font-light text-foreground mb-1">Décor Rentals</h1>
            <p className="font-body text-sm text-muted-foreground">GFH rental inventory</p>
          </div>
          <button
            onClick={startNew}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-body text-sm hover:opacity-90 transition-opacity"
          >
            <Plus size={14} /> Add Item
          </button>
        </div>

        {/* Category filter tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-none -mx-1 px-1">
          {[{ key: "all", label: "All" }, ...DECOR_CATEGORIES].map(c => (
            <button
              key={c.key}
              onClick={() => setFilter(c.key)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full font-body text-xs transition-colors border ${
                filter === c.key
                  ? "bg-sage text-primary-foreground border-sage"
                  : "bg-card text-muted-foreground border-border hover:border-sage/40"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-12 flex justify-center"><div className="w-6 h-6 rounded-full border-2 border-sage/30 border-t-sage animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 rounded-xl border border-dashed border-border">
            <ImageIcon size={28} className="text-muted-foreground mx-auto mb-3" />
            <p className="font-display text-xl italic text-foreground">No items yet</p>
            <p className="font-body text-sm text-muted-foreground mt-1">Add your first rental item to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(item => (
              <CatalogCard
                key={item.id}
                item={item}
                onEdit={() => setEditing(item)}
                onToggleAvailable={() => toggleAvailable(item)}
              />
            ))}
          </div>
        )}
      </main>

      {editing && (
        <EditPanel
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}

function CatalogCard({ item, onEdit, onToggleAvailable }: {
  item: CatalogItem;
  onEdit: () => void;
  onToggleAvailable: () => void;
}) {
  return (
    <div className="rounded-xl bg-card border border-border shadow-soft overflow-hidden flex flex-col">
      <button onClick={onEdit} className="relative h-[200px] bg-muted overflow-hidden text-left">
        {item.photo_url ? (
          <img src={item.photo_url} alt={item.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-sage/10 to-cream">
            <ImageIcon size={32} className="text-muted-foreground/40" />
          </div>
        )}
        {!item.available && (
          <span className="absolute top-3 left-3 rounded-full bg-background/90 px-2.5 py-1 font-body text-[10px] tracking-widest uppercase text-muted-foreground">
            Unavailable
          </span>
        )}
      </button>
      <div className="p-4 flex-1 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <p className="font-display text-base text-foreground leading-tight">{item.title || "Untitled"}</p>
          <button onClick={onEdit} className="text-muted-foreground hover:text-foreground shrink-0">
            <Pencil size={13} />
          </button>
        </div>
        <span className="self-start rounded-full bg-sage/10 px-2 py-0.5 font-body text-[10px] tracking-wide text-sage">
          {getCategoryLabel(item.category)}
        </span>
        <p className="font-body text-sm text-foreground tabular-nums">
          ${Number(item.price_per_unit).toFixed(0)} <span className="text-muted-foreground text-xs">{item.price_label || "per item"}</span>
        </p>
        {item.description && (
          <p className="font-body text-xs text-muted-foreground line-clamp-2">{item.description}</p>
        )}
        <label className="flex items-center gap-2 mt-1 cursor-pointer">
          <input
            type="checkbox"
            checked={!!item.available}
            onChange={onToggleAvailable}
            className="rounded border-border accent-sage"
          />
          <span className="font-body text-[11px] text-muted-foreground">Available to couples</span>
        </label>
      </div>
    </div>
  );
}

function EditPanel({ initial, onClose, onSaved, onDeleted }: {
  initial: CatalogItem;
  onClose: () => void;
  onSaved: (item: CatalogItem) => void;
  onDeleted: (id: string) => void;
}) {
  const isNew = !initial.id;
  const [form, setForm] = useState<CatalogItem>(initial);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof CatalogItem>(k: K, v: CatalogItem[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const uploadPhoto = async (file: File) => {
    setUploading(true);
    try {
      const id = form.id || crypto.randomUUID();
      const ext = file.name.split(".").pop() || "jpg";
      const path = `decor-catalog/${id}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const url = `${pub.publicUrl}?t=${Date.now()}`;
      setForm(prev => ({ ...prev, id, photo_url: url }));
    } catch (e) {
      console.error(e);
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) uploadPhoto(f);
  };

  const save = async () => {
    if (!form.title.trim()) { alert("Title is required"); return; }
    setSaving(true);
    try {
      if (isNew) {
        const insertPayload = {
          ...(form.id ? { id: form.id } : {}),
          category: form.category,
          title: form.title,
          description: form.description,
          price_per_unit: form.price_per_unit || 0,
          price_label: form.price_label || "per item",
          photo_url: form.photo_url,
          available: form.available ?? true,
          sort_order: form.sort_order ?? 0,
        };
        const { data, error } = await supabase.from("decor_catalog").insert(insertPayload).select().single();
        if (error) throw error;
        onSaved(data as CatalogItem);
      } else {
        const { data, error } = await supabase.from("decor_catalog").update({
          category: form.category,
          title: form.title,
          description: form.description,
          price_per_unit: form.price_per_unit || 0,
          price_label: form.price_label || "per item",
          photo_url: form.photo_url,
          available: form.available ?? true,
        }).eq("id", form.id).select().single();
        if (error) throw error;
        onSaved(data as CatalogItem);
      }
    } catch (e: any) {
      console.error(e);
      alert("Save failed: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    await supabase.from("decor_catalog").delete().eq("id", form.id);
    onDeleted(form.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-[480px] h-full bg-background shadow-2xl overflow-y-auto animate-slide-in-right">
        <div className="sticky top-0 bg-card border-b border-border px-5 py-3 flex items-center justify-between">
          <p className="font-display text-lg font-light">{isNew ? "Add Décor Item" : "Edit Item"}</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Photo */}
          <div>
            <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">Photo</label>
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className="mt-2 rounded-xl border-2 border-dashed border-border hover:border-sage/40 transition-colors cursor-pointer overflow-hidden bg-muted/30"
            >
              {form.photo_url ? (
                <img src={form.photo_url} alt="" className="w-full h-48 object-cover" />
              ) : (
                <div className="h-48 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Upload size={22} />
                  <p className="font-body text-xs">Click or drop image to upload</p>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); }}
            />
            {uploading && <p className="font-body text-xs text-muted-foreground mt-1">Uploading…</p>}
          </div>

          <Field label="Title*">
            <input
              value={form.title}
              onChange={e => set("title", e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 font-body text-sm bg-background focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
            />
          </Field>

          <Field label="Category*">
            <select
              value={form.category}
              onChange={e => set("category", e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 font-body text-sm bg-background focus:outline-none focus:border-primary/50"
            >
              {DECOR_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </Field>

          <Field label="Description">
            <textarea
              value={form.description ?? ""}
              onChange={e => set("description", e.target.value)}
              rows={3}
              className="w-full border border-border rounded-md px-3 py-2 font-body text-sm bg-background focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 resize-none"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Price per unit">
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-body text-xs text-muted-foreground">$</span>
                <input
                  type="number"
                  value={form.price_per_unit ?? 0}
                  onChange={e => set("price_per_unit", parseFloat(e.target.value) || 0)}
                  className="w-full border border-border rounded-md pl-6 pr-2 py-2 font-body text-sm bg-background focus:outline-none focus:border-primary/50"
                />
              </div>
            </Field>
            <Field label="Price label">
              <input
                value={form.price_label ?? ""}
                onChange={e => set("price_label", e.target.value)}
                placeholder="per item"
                className="w-full border border-border rounded-md px-3 py-2 font-body text-sm bg-background focus:outline-none focus:border-primary/50"
              />
            </Field>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!form.available}
              onChange={e => set("available", e.target.checked)}
              className="rounded border-border accent-sage"
            />
            <span className="font-body text-sm text-foreground">Available to couples</span>
          </label>

          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-body text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg border border-border font-body text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>

          {!isNew && (
            <div className="pt-4 border-t border-border">
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-2 font-body text-xs text-destructive hover:underline"
                >
                  <Trash2 size={12} /> Delete this item
                </button>
              ) : (
                <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3 space-y-2">
                  <p className="font-body text-xs text-destructive">Delete permanently?</p>
                  <div className="flex gap-2">
                    <button onClick={remove} className="px-3 py-1.5 rounded-md bg-destructive text-destructive-foreground font-body text-xs">Yes, delete</button>
                    <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 rounded-md border border-border font-body text-xs">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground block mb-2">{label}</label>
      {children}
    </div>
  );
}
