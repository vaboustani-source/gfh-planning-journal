import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePortalData } from "@/hooks/usePortalData";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Download, Trash2, FileText, Image as ImageIcon, File, CloudUpload } from "lucide-react";
import PortalStickyFooter from "@/components/portal/PortalStickyFooter";

interface Doc {
  id: string;
  file_name: string;
  file_url: string;
  document_type: string | null;
  uploaded_at: string | null;
  uploaded_by: string | null;
}

const DOC_GROUPS: { key: string; label: string; types: string[] }[] = [
  { key: "vendor", label: "Vendor Contracts", types: ["vendor_contract"] },
  { key: "couple", label: "Your Uploads", types: ["couple_upload"] },
  { key: "insurance", label: "Insurance", types: ["insurance", "coi"] },
  { key: "menus", label: "Menus", types: ["menu"] },
  { key: "timelines", label: "Timelines", types: ["timeline"] },
  { key: "other", label: "Other", types: ["other", ""] },
];

function getDocIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return <FileText size={16} className="text-sage" />;
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext || "")) return <ImageIcon size={16} className="text-sage" />;
  return <File size={16} className="text-muted-foreground" />;
}

export default function Documents() {
  const { eventId } = usePortalData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (eventId) fetchDocs();
  }, [eventId]);

  const fetchDocs = async () => {
    const { data } = await supabase
      .from("documents")
      .select("*")
      .eq("event_id", eventId!)
      .order("uploaded_at", { ascending: false });
    if (data) setDocs(data);
    setLoading(false);
  };

  const uploadFile = async (file: globalThis.File) => {
    if (!file || file.size > 20 * 1024 * 1024) return;
    setUploading(true);
    setUploadProgress(10);

    const filePath = `${eventId}/couple/${Date.now()}_${file.name}`;
    setUploadProgress(30);
    const { error } = await supabase.storage.from("vendor-contracts").upload(filePath, file);
    if (error) { setUploading(false); setUploadProgress(0); return; }

    setUploadProgress(70);
    const { data: urlData } = supabase.storage.from("vendor-contracts").getPublicUrl(filePath);

    await supabase.from("documents").insert({
      event_id: eventId,
      file_name: file.name,
      file_url: urlData.publicUrl,
      document_type: "couple_upload",
      uploaded_by: user?.id || null,
    });

    setUploadProgress(100);
    await fetchDocs();
    setTimeout(() => { setUploading(false); setUploadProgress(0); }, 400);
  };

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
  }, [eventId]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragOver(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragOver(false); }, []);

  const deleteDoc = async (doc: Doc) => {
    const pathMatch = doc.file_url.match(/vendor-contracts\/(.+)$/);
    if (pathMatch) await supabase.storage.from("vendor-contracts").remove([pathMatch[1]]);
    await supabase.from("documents").delete().eq("id", doc.id);
    setDocs(prev => prev.filter(d => d.id !== doc.id));
  };

  const groupedDocs = DOC_GROUPS.map(group => ({
    ...group,
    docs: docs.filter(d => {
      const type = d.document_type || "other";
      return group.types.includes(type) || (group.key === "other" && !DOC_GROUPS.slice(0, -1).some(g => g.types.includes(type)));
    }),
  })).filter(g => g.docs.length > 0);

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>;

  return (
    <div className="max-w-3xl mx-auto px-5 py-10 space-y-8">
      <div>
        <h1 className="font-display text-2xl font-light text-foreground">Documents</h1>
        <p className="font-body text-sm text-muted-foreground mt-1">View shared documents and upload your own files.</p>
      </div>

      {/* Upload zone */}
      <div className="rounded-xl bg-card border border-border p-5 shadow-soft">
        <p className="font-display text-lg font-light text-foreground mb-3">Upload a File</p>
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
          <div className="rounded-xl bg-card border border-border shadow-soft overflow-hidden">
            {group.docs.map((doc, i) => (
              <div key={doc.id} className={`flex items-center justify-between px-5 py-3 ${i < group.docs.length - 1 ? "border-b border-border" : ""}`}>
                <div className="flex items-center gap-3 min-w-0">
                  {getDocIcon(doc.file_name)}
                  <div className="min-w-0">
                    <p className="font-body text-sm text-foreground truncate">{doc.file_name}</p>
                    <p className="font-body text-[10px] text-muted-foreground">
                      {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                    <Download size={14} />
                  </a>
                  {doc.uploaded_by === user?.id && (
                    <button onClick={() => deleteDoc(doc)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {docs.length === 0 && (
        <div className="text-center py-12">
          <FileText size={28} className="text-muted-foreground mx-auto mb-3" />
          <p className="font-display text-xl italic text-foreground">No documents yet</p>
          <p className="font-body text-sm text-muted-foreground mt-1">Documents shared by your planner will appear here.</p>
        </div>
      )}

      <PortalStickyFooter onContinue={() => navigate("/portal/today")} nextOnly />
    </div>
  );
}
