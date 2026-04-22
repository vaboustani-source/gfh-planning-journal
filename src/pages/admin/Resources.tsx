import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, CloudUpload, Trash2, Eye, EyeOff, FileText, Download, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

interface Resource {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  file_url: string | null;
  file_name: string | null;
  visible: boolean;
  sort_order: number;
  created_at: string;
}

const CATEGORIES = ["Venue Maps", "Table Layouts", "Day-of Guides", "FAQs", "Other"];

export default function Resources() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draftMeta, setDraftMeta] = useState<{ title: string; description: string; category: string } | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ title: string; description: string; category: string }>({ title: "", description: "", category: "Other" });

  const fetchItems = async () => {
    const { data } = await supabase
      .from("gfh_resources")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (data) setItems(data as Resource[]);
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, []);

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) { toast.error("File too large — 20MB max"); return; }
    setPendingFile(f);
    setDraftMeta({ title: f.name.replace(/\.[^.]+$/, ""), description: "", category: "Other" });
    e.target.value = "";
  };

  const cancelPending = () => { setPendingFile(null); setDraftMeta(null); };

  const saveResource = async () => {
    if (!pendingFile || !draftMeta) return;
    if (!draftMeta.title.trim()) { toast.error("Title required"); return; }
    setUploading(true);
    const path = `resources/${Date.now()}_${pendingFile.name}`;
    const { error: upErr } = await supabase.storage.from("event-documents").upload(path, pendingFile);
    if (upErr) { toast.error(`Upload failed: ${upErr.message}`); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("event-documents").getPublicUrl(path);
    const { error: insErr } = await supabase.from("gfh_resources").insert({
      title: draftMeta.title.trim(),
      description: draftMeta.description.trim() || null,
      category: draftMeta.category,
      file_url: urlData.publicUrl,
      file_name: pendingFile.name,
      visible: true,
    });
    if (insErr) { toast.error(insErr.message); setUploading(false); return; }
    toast.success("Resource added");
    setPendingFile(null);
    setDraftMeta(null);
    setUploading(false);
    fetchItems();
  };

  const toggleVisible = async (r: Resource) => {
    setItems(prev => prev.map(i => i.id === r.id ? { ...i, visible: !i.visible } : i));
    await supabase.from("gfh_resources").update({ visible: !r.visible }).eq("id", r.id);
  };

  const deleteResource = async (r: Resource) => {
    if (!confirm(`Delete "${r.title}"?`)) return;
    if (r.file_url) {
      const m = r.file_url.match(/event-documents\/(.+?)(?:\?|$)/);
      if (m) await supabase.storage.from("event-documents").remove([decodeURIComponent(m[1])]);
    }
    await supabase.from("gfh_resources").delete().eq("id", r.id);
    setItems(prev => prev.filter(i => i.id !== r.id));
    toast.success("Deleted");
  };

  const startEdit = (r: Resource) => {
    setEditingId(r.id);
    setEditDraft({ title: r.title, description: r.description || "", category: r.category || "Other" });
  };

  const saveEdit = async (id: string) => {
    await supabase.from("gfh_resources").update({
      title: editDraft.title.trim(),
      description: editDraft.description.trim() || null,
      category: editDraft.category,
    }).eq("id", id);
    setItems(prev => prev.map(i => i.id === id ? { ...i, title: editDraft.title.trim(), description: editDraft.description.trim() || null, category: editDraft.category } : i));
    setEditingId(null);
    toast.success("Saved");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
          <button onClick={() => navigate("/admin")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={18} />
          </button>
          <h1 className="font-display text-xl font-light text-foreground">From Gilbertsville Farmhouse — Resources</h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        <div>
          <p className="font-body text-sm text-muted-foreground">Documents here appear in every couple's portal under "From Gilbertsville Farmhouse." Use this for table layouts, venue maps, day-of guides, FAQs.</p>
        </div>

        {/* Upload zone */}
        <div className="rounded-xl bg-card border border-border p-5 shadow-sm">
          {!pendingFile ? (
            <>
              <input ref={fileInputRef} type="file" className="hidden" onChange={onPickFile} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full rounded-xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-muted/20 p-8 text-center transition-colors"
              >
                <CloudUpload size={28} className="text-muted-foreground mx-auto mb-2" />
                <p className="font-body text-sm text-foreground">Click to upload a new resource</p>
                <p className="font-body text-[11px] text-muted-foreground mt-1">PDF, JPG, PNG, DOC up to 20MB</p>
              </button>
            </>
          ) : (
            <div className="space-y-3">
              <p className="font-body text-xs tracking-widest uppercase text-muted-foreground">New Resource</p>
              <p className="font-body text-xs text-muted-foreground">{pendingFile.name}</p>
              <input
                type="text" placeholder="Title"
                value={draftMeta?.title || ""}
                onChange={e => setDraftMeta(d => d ? { ...d, title: e.target.value } : d)}
                className="w-full border border-border rounded-md px-3 py-2 font-body text-sm bg-background"
              />
              <input
                type="text" placeholder="Description (optional)"
                value={draftMeta?.description || ""}
                onChange={e => setDraftMeta(d => d ? { ...d, description: e.target.value } : d)}
                className="w-full border border-border rounded-md px-3 py-2 font-body text-sm bg-background"
              />
              <select
                value={draftMeta?.category || "Other"}
                onChange={e => setDraftMeta(d => d ? { ...d, category: e.target.value } : d)}
                className="w-full border border-border rounded-md px-3 py-2 font-body text-sm bg-background"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="flex gap-2 justify-end">
                <button onClick={cancelPending} disabled={uploading} className="px-4 py-2 rounded-md border border-border font-body text-sm hover:bg-muted/50">Cancel</button>
                <button onClick={saveResource} disabled={uploading} className="px-4 py-2 rounded-md bg-primary text-primary-foreground font-body text-sm hover:opacity-90 disabled:opacity-50">
                  {uploading ? <Loader2 size={14} className="animate-spin inline" /> : "Save Resource"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <FileText size={28} className="text-muted-foreground mx-auto mb-3" />
            <p className="font-display text-xl italic text-foreground">No resources yet</p>
          </div>
        ) : (
          <div className="rounded-xl bg-card border border-border shadow-sm overflow-hidden">
            {items.map((r, i) => (
              <div key={r.id} className={`px-5 py-4 ${i < items.length - 1 ? "border-b border-border" : ""} ${!r.visible ? "opacity-50" : ""}`}>
                {editingId === r.id ? (
                  <div className="space-y-2">
                    <input type="text" value={editDraft.title} onChange={e => setEditDraft(d => ({ ...d, title: e.target.value }))} className="w-full border border-border rounded-md px-2 py-1 font-body text-sm bg-background" />
                    <input type="text" value={editDraft.description} onChange={e => setEditDraft(d => ({ ...d, description: e.target.value }))} placeholder="Description" className="w-full border border-border rounded-md px-2 py-1 font-body text-xs bg-background" />
                    <select value={editDraft.category} onChange={e => setEditDraft(d => ({ ...d, category: e.target.value }))} className="border border-border rounded-md px-2 py-1 font-body text-xs bg-background">
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => setEditingId(null)} className="p-1.5 rounded-md text-muted-foreground hover:bg-muted/50"><X size={14} /></button>
                      <button onClick={() => saveEdit(r.id)} className="p-1.5 rounded-md text-primary hover:bg-primary/10"><Check size={14} /></button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <FileText size={16} className="text-sage shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-body text-sm font-medium text-foreground">{r.title}</p>
                        {r.category && <span className="text-[10px] tracking-wider uppercase px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{r.category}</span>}
                      </div>
                      {r.description && <p className="font-body text-xs text-muted-foreground mt-0.5">{r.description}</p>}
                      <p className="font-body text-[10px] text-muted-foreground mt-0.5">{r.file_name}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <a href={r.file_url || "#"} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50" title="Download">
                        <Download size={14} />
                      </a>
                      <button onClick={() => toggleVisible(r)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50" title={r.visible ? "Hide from couples" : "Show to couples"}>
                        {r.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                      <button onClick={() => startEdit(r)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50" title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => deleteResource(r)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
