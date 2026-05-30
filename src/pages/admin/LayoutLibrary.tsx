import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, X, Image as ImageIcon, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "layout-library";
const db = supabase as any;

interface Layout {
  id: string;
  guest_count_min: number;
  guest_count_max: number;
  label: string;
  image_url: string | null;
  table_config_description: string | null;
  is_active: boolean | null;
  sort_order: number | null;
}

export default function LayoutLibrary() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Layout[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Layout | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await db.from("layout_library").select("*").order("sort_order");
    if (data) setItems(data as Layout[]);
    setLoading(false);
  };

  const onSaved = (saved: Layout) => {
    setItems(prev => prev.map(p => p.id === saved.id ? saved : p));
    setEditing(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/90 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 h-14 flex items-center gap-4">
          <button onClick={() => navigate("/admin")} className="flex items-center gap-2 font-body text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={15} /> Dashboard
          </button>
          <div className="h-4 w-px bg-border" />
          <p className="font-display text-lg font-light text-foreground">Table Layouts</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-8 pb-24">
        <div className="mb-8 animate-fade-up">
          <p className="font-body text-xs tracking-widest uppercase text-muted-foreground mb-2">Coordinator library</p>
          <h1 className="font-display text-4xl font-light text-foreground mb-1">Chandelier Barn — Table Layouts</h1>
          <p className="font-body text-sm text-muted-foreground">One layout for every guest-count interval. Upload an image once and it appears across every event.</p>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center"><div className="w-6 h-6 rounded-full border-2 border-sage/30 border-t-sage animate-spin" /></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {items.map(item => (
              <LayoutCard key={item.id} item={item} onEdit={() => setEditing(item)} />
            ))}
          </div>
        )}
      </main>

      {editing && (
        <EditPanel initial={editing} onClose={() => setEditing(null)} onSaved={onSaved} />
      )}
    </div>
  );
}

function LayoutCard({ item, onEdit }: { item: Layout; onEdit: () => void }) {
  const hasImage = !!item.image_url;
  return (
    <button
      onClick={onEdit}
      className={`group rounded-xl overflow-hidden bg-card shadow-soft text-left transition-all hover:shadow-elevated ${
        hasImage ? "border border-border" : "border-2 border-dashed border-border hover:border-sage/50"
      }`}
    >
      <div className="relative aspect-[4/3] bg-muted overflow-hidden">
        {hasImage ? (
          <>
            <img src={item.image_url!} alt={item.label} className="w-full h-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
              <p className="font-display text-lg font-light text-white">{item.label}</p>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground bg-gradient-to-br from-sage/5 to-cream">
            <Upload size={28} className="opacity-50" />
            <p className="font-body text-xs">Upload Layout</p>
            <p className="font-display text-lg font-light text-foreground mt-1">{item.label}</p>
          </div>
        )}
        {!item.is_active && (
          <span className="absolute top-3 left-3 rounded-full bg-background/90 px-2.5 py-1 font-body text-[10px] tracking-widest uppercase text-muted-foreground">
            Hidden
          </span>
        )}
        <span className="absolute top-3 right-3 rounded-full bg-background/90 px-2 py-1 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
          <Pencil size={12} />
        </span>
      </div>
      {item.table_config_description && (
        <div className="p-3">
          <p className="font-body text-xs text-muted-foreground line-clamp-2">{item.table_config_description}</p>
        </div>
      )}
    </button>
  );
}

function EditPanel({ initial, onClose, onSaved }: { initial: Layout; onClose: () => void; onSaved: (l: Layout) => void }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadImage = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `layouts/${form.id}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const url = `${pub.publicUrl}?t=${Date.now()}`;
      setForm(prev => ({ ...prev, image_url: url }));
    } catch (e: any) {
      alert("Upload failed: " + e.message);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const { data, error } = await db.from("layout_library").update({
        image_url: form.image_url,
        table_config_description: form.table_config_description,
        is_active: form.is_active,
      }).eq("id", form.id).select().single();
      if (error) throw error;
      onSaved(data as Layout);
    } catch (e: any) {
      alert("Save failed: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-[540px] h-full bg-background shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border px-5 py-3 flex items-center justify-between z-10">
          <p className="font-display text-lg font-light">{form.label}</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-5">
          <div>
            <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">Layout Image</label>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) uploadImage(f); }}
              className="mt-2 rounded-xl border-2 border-dashed border-border hover:border-sage/50 transition-colors cursor-pointer overflow-hidden bg-muted/30"
            >
              {form.image_url ? (
                <img src={form.image_url} alt="" className="w-full max-h-72 object-contain bg-white" />
              ) : (
                <div className="h-56 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Upload size={24} />
                  <p className="font-body text-xs">Drag image here or click to upload</p>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f); }} />
            {uploading && <p className="font-body text-xs text-muted-foreground mt-1">Uploading…</p>}
          </div>

          <div>
            <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground block mb-2">Table Configuration</label>
            <textarea
              value={form.table_config_description ?? ""}
              onChange={e => setForm(p => ({ ...p, table_config_description: e.target.value }))}
              rows={3}
              placeholder="e.g. Six 8-person farm tables + 1 sweetheart table"
              className="w-full border border-border rounded-md px-3 py-2 font-body text-sm bg-background focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 resize-none"
            />
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={!!form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} className="rounded border-border accent-sage mt-0.5" />
            <span className="font-body text-sm text-foreground">Active (available for selection)</span>
          </label>

          <div className="flex items-center gap-2 pt-2">
            <button onClick={save} disabled={saving} className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-body text-sm hover:opacity-90 disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={onClose} className="px-4 py-2.5 rounded-lg border border-border font-body text-sm text-muted-foreground hover:text-foreground">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
