import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Paperclip, Upload, FileText, Image as ImageIcon, Trash2, Download, Loader2, X } from "lucide-react";

interface VendorDoc {
  id: string;
  file_name: string;
  file_url: string;
  document_type: string | null;
  uploaded_at: string | null;
}

const ACCEPT = ".pdf,.jpg,.jpeg,.png";
const MAX_SIZE = 20 * 1024 * 1024; // 20MB

function isPdf(name: string) {
  return name.toLowerCase().endsWith(".pdf");
}

function getPublicUrl(path: string) {
  return supabase.storage.from("vendor-contracts").getPublicUrl(path).data.publicUrl;
}

export default function VendorFileUpload({
  eventId,
  vendorId,
  canUpload = true,
  canDelete = true,
  onFileCountChange,
}: {
  eventId: string;
  vendorId: string;
  canUpload?: boolean;
  canDelete?: boolean;
  onFileCountChange?: (count: number) => void;
}) {
  const [docs, setDocs] = useState<VendorDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchDocs = useCallback(async () => {
    const { data } = await supabase
      .from("documents")
      .select("id, file_name, file_url, document_type, uploaded_at")
      .eq("event_id", eventId)
      .eq("document_type", "vendor_contract")
      .like("file_url", `%${vendorId}%`)
      .order("uploaded_at", { ascending: false });
    const results = data ?? [];
    setDocs(results);
    onFileCountChange?.(results.length);
    setLoading(false);
  }, [eventId, vendorId, onFileCountChange]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const uploadFile = async (file: File) => {
    if (file.size > MAX_SIZE) {
      alert("File too large. Maximum 20MB.");
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "jpg", "jpeg", "png"].includes(ext || "")) {
      alert("Only PDF, JPG, and PNG files are accepted.");
      return;
    }

    setUploading(true);
    setProgress(10);

    const path = `${eventId}/${vendorId}/${Date.now()}_${file.name}`;
    setProgress(30);

    const { error: uploadError } = await supabase.storage
      .from("vendor-contracts")
      .upload(path, file, { upsert: false });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      alert("Upload failed. Please try again.");
      setUploading(false);
      setProgress(0);
      return;
    }

    setProgress(70);
    const publicUrl = getPublicUrl(path);

    const { data: user } = await supabase.auth.getUser();

    await supabase.from("documents").insert({
      event_id: eventId,
      uploaded_by: user?.user?.id ?? null,
      file_name: file.name,
      file_url: publicUrl,
      document_type: "vendor_contract",
    });

    setProgress(90);

    // Auto-set contract_uploaded on vendor
    await supabase.from("vendors").update({ contract_uploaded: true }).eq("id", vendorId);

    setProgress(100);
    await fetchDocs();
    setUploading(false);
    setProgress(0);
  };

  const deleteFile = async (doc: VendorDoc) => {
    // Extract storage path from public URL
    const urlParts = doc.file_url.split("/vendor-contracts/");
    const storagePath = urlParts[1] ? decodeURIComponent(urlParts[1]) : null;

    await supabase.from("documents").delete().eq("id", doc.id);

    if (storagePath) {
      await supabase.storage.from("vendor-contracts").remove([storagePath]);
    }

    const remaining = docs.filter(d => d.id !== doc.id);
    setDocs(remaining);
    onFileCountChange?.(remaining.length);

    // If no files left, unset contract_uploaded
    if (remaining.length === 0) {
      await supabase.from("vendors").update({ contract_uploaded: false }).eq("id", vendorId);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (!canUpload) return;
    const files = Array.from(e.dataTransfer.files);
    files.forEach(uploadFile);
  };

  if (loading) {
    return <div className="py-2"><Loader2 size={14} className="animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-3">
      {/* Upload zone */}
      {canUpload && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`relative rounded-lg border-2 border-dashed px-4 py-5 text-center cursor-pointer transition-colors ${
            dragOver
              ? "border-primary bg-sage/10"
              : "border-border hover:border-primary/40"
          }`}
        >
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="hidden"
            onChange={e => {
              const files = Array.from(e.target.files || []);
              files.forEach(uploadFile);
              e.target.value = "";
            }}
          />
          <Paperclip size={18} className="mx-auto text-muted-foreground mb-1.5" />
          <p className="font-body text-xs text-muted-foreground">
            Drop contract or images here, or click to browse
          </p>
          <p className="font-body text-[10px] text-muted-foreground/60 mt-0.5">
            PDF, JPG, PNG up to 20MB
          </p>
        </div>
      )}

      {/* Upload progress */}
      {uploading && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Loader2 size={12} className="animate-spin text-primary" />
            <span className="font-body text-xs text-muted-foreground">Uploading…</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* File list */}
      {docs.length > 0 && (
        <div className="space-y-2">
          {docs.map(doc => (
            <div key={doc.id} className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
              {/* Icon */}
              {isPdf(doc.file_name) ? (
                <div className="w-9 h-9 rounded-lg bg-sage/15 flex items-center justify-center shrink-0">
                  <FileText size={16} className="text-primary" />
                </div>
              ) : (
                <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 border border-border">
                  <img src={doc.file_url} alt={doc.file_name} className="w-full h-full object-cover" />
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-body text-xs text-foreground truncate">{doc.file_name}</p>
                {doc.uploaded_at && (
                  <p className="font-body text-[10px] text-muted-foreground">
                    {new Date(doc.uploaded_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                  className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                  <Download size={13} />
                </a>
                {canDelete && (
                  <button
                    onClick={() => deleteFile(doc)}
                    className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
