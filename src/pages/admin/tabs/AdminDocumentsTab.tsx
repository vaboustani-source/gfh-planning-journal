import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Download, Trash2, FileText, Image as ImageIcon, File, CloudUpload, Archive, ExternalLink } from "lucide-react";
import AdminStickyFooter from "@/components/admin/AdminStickyFooter";
import { VENDOR_DOC_CATEGORIES } from "@/components/admin/VendorFileUpload";
import { FRIENDLY_CATEGORY } from "@/components/vendor/VendorCard";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { toast } from "sonner";

interface Doc {
  id: string;
  file_name: string;
  file_url: string;
  document_type: string | null;
  description: string | null;
  uploaded_at: string | null;
  uploaded_by: string | null;
  vendor_id: string | null;
  vendor_name?: string | null;
  vendor_category?: string | null;
  signedUrl?: string;
}

const DOC_GROUPS: { key: string; label: string; types: string[] }[] = [
  { key: "vendor_contract", label: "Contracts", types: ["vendor_contract"] },
  { key: "coi", label: "COI", types: ["coi"] },
  { key: "insurance", label: "Insurance", types: ["insurance"] },
  { key: "invoice", label: "Invoices", types: ["invoice"] },
  { key: "permit", label: "Permits", types: ["permit"] },
  { key: "couple_upload", label: "Couple Uploads", types: ["couple_upload"] },
  { key: "menu", label: "Menus", types: ["menu"] },
  { key: "timeline", label: "Timelines", types: ["timeline"] },
  { key: "other", label: "Other", types: ["other", ""] },
];

const ALL_CATEGORIES = [
  ...VENDOR_DOC_CATEGORIES,
  { value: "couple_upload", label: "Couple Upload" },
  { value: "menu", label: "Menu" },
  { value: "timeline", label: "Timeline" },
];

function getDocIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return <FileText size={16} className="text-sage" />;
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext || "")) return <ImageIcon size={16} className="text-sage" />;
  return <File size={16} className="text-muted-foreground" />;
}

function extractStoragePath(fileUrl: string): string | null {
  const match = fileUrl.match(/vendor-contracts\/(.+?)(?:\?|$)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function sourceLabel(doc: Doc): string {
  if (doc.vendor_id && doc.vendor_name) return `Vendor: ${doc.vendor_name}`;
  if (doc.vendor_id && doc.vendor_category) return `Vendor: ${FRIENDLY_CATEGORY[doc.vendor_category] || doc.vendor_category}`;
  return "Uploaded directly";
}

export default function AdminDocumentsTab({ eventId, onNavigateNext }: { eventId: string; onNavigateNext: () => void }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadType, setUploadType] = useState("other");
  const [dragOver, setDragOver] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);
  const [descDraft, setDescDraft] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocs = useCallback(async () => {
    const { data } = await supabase
      .from("documents")
      .select("id, file_name, file_url, document_type, description, uploaded_at, uploaded_by, vendor_id, vendors(business_name, category)")
      .eq("event_id", eventId)
      .order("uploaded_at", { ascending: false });
    if (data) {
      const withUrls = await Promise.all(
        data.map(async (doc: any) => {
          const path = extractStoragePath(doc.file_url);
          const base = {
            ...doc,
            vendor_name: doc.vendors?.business_name || null,
            vendor_category: doc.vendors?.category || null,
          };
          if (path) {
            const { data: signed } = await supabase.storage
              .from("vendor-contracts")
              .createSignedUrl(path, 3600);
            return { ...base, signedUrl: signed?.signedUrl || doc.file_url };
          }
          return { ...base, signedUrl: doc.file_url };
        })
      );
      setDocs(withUrls);
      setDescDraft(Object.fromEntries(withUrls.map((d: Doc) => [d.id, d.description || ""])));
    }
    setLoading(false);
  }, [eventId]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const uploadFile = useCallback(async (file: globalThis.File) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error("File too large — 20MB max");
      return;
    }
    setUploading(true);
    setUploadProgress(10);

    const filePath = `${eventId}/admin/${Date.now()}_${file.name}`;
    setUploadProgress(30);
    const { error: upErr } = await supabase.storage.from("vendor-contracts").upload(filePath, file);
    if (upErr) {
      toast.error("Upload failed — please try again");
      setUploading(false);
      setUploadProgress(0);
      return;
    }

    setUploadProgress(70);
    const { data: urlData } = supabase.storage.from("vendor-contracts").getPublicUrl(filePath);
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from("documents").insert({
      event_id: eventId,
      file_name: file.name,
      file_url: urlData.publicUrl,
      document_type: uploadType,
      uploaded_by: user?.id || null,
    });

    setUploadProgress(100);
    toast.success("File uploaded");
    await fetchDocs();
    setTimeout(() => { setUploading(false); setUploadProgress(0); }, 400);
  }, [eventId, uploadType, fetchDocs]);

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadFile(file);
    e.target.value = "";
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await uploadFile(file);
  }, [uploadFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragOver(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragOver(false); }, []);

  const deleteDoc = async (doc: Doc) => {
    const path = extractStoragePath(doc.file_url);
    if (path) await supabase.storage.from("vendor-contracts").remove([path]);
    await supabase.from("documents").delete().eq("id", doc.id);
    setDocs(prev => prev.filter(d => d.id !== doc.id));
    toast.success("Document deleted");
  };

  const saveDescription = async (id: string) => {
    const value = descDraft[id] ?? "";
    const current = docs.find(d => d.id === id);
    if (current?.description === value || (current?.description == null && value === "")) return;
    await supabase.from("documents").update({ description: value || null }).eq("id", id);
    setDocs(prev => prev.map(d => d.id === id ? { ...d, description: value } : d));
  };

  const updateCategory = async (id: string, value: string) => {
    await supabase.from("documents").update({ document_type: value }).eq("id", id);
    setDocs(prev => prev.map(d => d.id === id ? { ...d, document_type: value } : d));
  };

  const downloadAllZip = async () => {
    if (docs.length === 0 || zipping) return;
    setZipping(true);
    setZipProgress(0);
    const zip = new JSZip();
    for (let i = 0; i < docs.length; i++) {
      try {
        const url = docs[i].signedUrl || docs[i].file_url;
        const res = await fetch(url);
        const blob = await res.blob();
        zip.file(docs[i].file_name, blob);
      } catch { /* skip */ }
      setZipProgress(Math.round(((i + 1) / docs.length) * 80));
    }
    setZipProgress(90);
    const content = await zip.generateAsync({ type: "blob" });
    setZipProgress(100);
    saveAs(content, `event_documents.zip`);
    setTimeout(() => { setZipping(false); setZipProgress(0); }, 500);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>;

  const groupedDocs = DOC_GROUPS.map(group => ({
    ...group,
    docs: docs.filter(d => {
      const type = d.document_type || "other";
      return group.types.includes(type) || (group.key === "other" && !DOC_GROUPS.slice(0, -1).some(g => g.types.includes(type)));
    }),
  })).filter(g => g.docs.length > 0 || g.key === "other");

  return (
    <div className="space-y-8">
      {/* Upload section */}
      <div className="rounded-xl bg-card border border-border p-5 shadow-soft">
        <div className="flex items-center justify-between mb-3">
          <p className="font-display text-lg font-light text-foreground">Upload Document</p>
          {docs.length > 0 && (
            <button
              onClick={downloadAllZip}
              disabled={zipping}
              className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 font-body text-xs font-medium text-foreground hover:bg-muted/50 transition-colors disabled:opacity-60"
            >
              {zipping ? (<><Loader2 size={14} className="animate-spin" />Zipping {zipProgress}%</>) : (<><Archive size={14} />Download All (.zip)</>)}
            </button>
          )}
        </div>

        <div className="mb-3">
          <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground block mb-1">Category</label>
          <select
            value={uploadType}
            onChange={e => setUploadType(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 font-body text-sm text-foreground"
          >
            {ALL_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`relative rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
            dragOver ? "border-sage bg-sage/5" : "border-border hover:border-muted-foreground/40 hover:bg-muted/20"
          }`}
        >
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileInput} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" />
          {uploading ? (
            <div className="space-y-3">
              <Loader2 size={28} className="animate-spin text-sage mx-auto" />
              <p className="font-body text-sm text-foreground">Uploading…</p>
              <div className="w-48 mx-auto h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-sage rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          ) : (
            <>
              <CloudUpload size={32} className="text-muted-foreground mx-auto mb-2" />
              <p className="font-body text-sm text-foreground">Drop files here or click to browse</p>
              <p className="font-body text-[11px] text-muted-foreground mt-1">PDF, JPG, PNG up to 20MB</p>
            </>
          )}
        </div>
      </div>

      {/* Grouped docs */}
      {groupedDocs.map(group => (
        <section key={group.key}>
          <p className="font-body text-[10px] tracking-widest uppercase text-muted-foreground mb-3">{group.label}</p>
          {group.docs.length === 0 ? (
            <p className="font-body text-sm text-muted-foreground italic">No documents in this category.</p>
          ) : (
            <div className="rounded-xl bg-card border border-border shadow-soft overflow-hidden">
              <div className="hidden md:grid grid-cols-[2fr_1.5fr_1.3fr_1fr_auto] gap-3 px-5 py-2.5 bg-muted/30 border-b border-border font-body text-[10px] uppercase tracking-wider text-muted-foreground">
                <div>File</div>
                <div>Description</div>
                <div>Source</div>
                <div>Category</div>
                <div></div>
              </div>
              {group.docs.map((doc, i) => (
                <div key={doc.id} className={`grid grid-cols-1 md:grid-cols-[2fr_1.5fr_1.3fr_1fr_auto] gap-3 items-center px-5 py-3 ${i < group.docs.length - 1 ? "border-b border-border" : ""}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    {getDocIcon(doc.file_name)}
                    <div className="min-w-0">
                      <a href={doc.signedUrl || doc.file_url} target="_blank" rel="noopener noreferrer"
                         className="inline-flex items-center gap-1 font-body text-sm text-primary hover:underline truncate max-w-full">
                        <span className="truncate">{doc.file_name}</span>
                        <ExternalLink size={11} className="shrink-0" />
                      </a>
                      <p className="font-body text-[10px] text-muted-foreground">
                        {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
                      </p>
                    </div>
                  </div>

                  <div>
                    <input type="text" value={descDraft[doc.id] ?? ""}
                      onChange={e => setDescDraft(prev => ({ ...prev, [doc.id]: e.target.value }))}
                      onBlur={() => saveDescription(doc.id)}
                      placeholder="What is this?"
                      className="w-full border border-border rounded-md px-2 py-1 font-body text-xs bg-background focus:outline-none focus:border-primary/50" />
                  </div>

                  <div className="font-body text-xs text-muted-foreground truncate" title={sourceLabel(doc)}>
                    {sourceLabel(doc)}
                  </div>

                  <div>
                    <select value={doc.document_type || "other"} onChange={e => updateCategory(doc.id, e.target.value)}
                      className="w-full border border-border rounded-md px-2 py-1 font-body text-xs bg-background focus:outline-none focus:border-primary/50">
                      {ALL_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>

                  <div className="flex items-center gap-1 justify-end">
                    <a href={doc.signedUrl || doc.file_url} target="_blank" rel="noopener noreferrer" download
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                      <Download size={14} />
                    </a>
                    <button onClick={() => deleteDoc(doc)}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ))}

      {docs.length === 0 && (
        <div className="text-center py-12">
          <FileText size={28} className="text-muted-foreground mx-auto mb-3" />
          <p className="font-display text-xl italic text-foreground">No documents yet</p>
          <p className="font-body text-sm text-muted-foreground mt-1">Upload contracts, menus, timelines, and other files for this event.</p>
        </div>
      )}

      <AdminStickyFooter status="idle" onSave={() => {}} onSaveAndContinue={onNavigateNext} />
    </div>
  );
}
