import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Paperclip, FileText, Image as ImageIcon, Trash2, Loader2, ExternalLink } from "lucide-react";

interface VendorDoc {
  id: string;
  file_name: string;
  file_url: string;
  document_type: string | null;
  description: string | null;
  uploaded_at: string | null;
  signedUrl?: string;
}

const ACCEPT = ".pdf,.jpg,.jpeg,.png";
const MAX_SIZE = 20 * 1024 * 1024; // 20MB

// Vendor-document categories (admin only)
export const VENDOR_DOC_CATEGORIES = [
  { value: "vendor_contract", label: "Contract" },
  { value: "coi", label: "COI" },
  { value: "insurance", label: "Insurance" },
  { value: "invoice", label: "Invoice" },
  { value: "permit", label: "Permit" },
  { value: "other", label: "Other" },
] as const;

function isPdf(name: string) {
  return name.toLowerCase().endsWith(".pdf");
}

function extractStoragePath(fileUrl: string): string | null {
  const match = fileUrl.match(/vendor-contracts\/(.+?)(?:\?|$)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export default function VendorFileUpload({
  eventId,
  vendorId,
  isAdmin = true,
  canUpload = true,
  canDelete = true,
  onFileCountChange,
}: {
  eventId: string;
  vendorId: string;
  isAdmin?: boolean;
  canUpload?: boolean;
  canDelete?: boolean;
  onFileCountChange?: (count: number) => void;
}) {
  const [docs, setDocs] = useState<VendorDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  // Local edit drafts for description text
  const [descDraft, setDescDraft] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchDocs = useCallback(async () => {
    const { data } = await supabase
      .from("documents")
      .select("id, file_name, file_url, document_type, description, uploaded_at")
      .eq("event_id", eventId)
      .eq("vendor_id", vendorId)
      .order("uploaded_at", { ascending: false });
    const rows = data ?? [];
    // generate signed URLs so links open inline
    const withUrls: VendorDoc[] = await Promise.all(
      rows.map(async (d: any) => {
        const path = extractStoragePath(d.file_url);
        if (path) {
          const { data: signed } = await supabase.storage
            .from("vendor-contracts")
            .createSignedUrl(path, 3600);
          return { ...d, signedUrl: signed?.signedUrl || d.file_url };
        }
        return { ...d, signedUrl: d.file_url };
      })
    );
    setDocs(withUrls);
    onFileCountChange?.(withUrls.length);
    setDescDraft(Object.fromEntries(withUrls.map(d => [d.id, d.description || ""])));
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
    const { data: urlData } = supabase.storage.from("vendor-contracts").getPublicUrl(path);

    const { data: user } = await supabase.auth.getUser();

    // Default category: admins → vendor_contract; couples → couple_upload
    const defaultType = isAdmin ? "vendor_contract" : "couple_upload";

    await supabase.from("documents").insert({
      event_id: eventId,
      vendor_id: vendorId,
      uploaded_by: user?.user?.id ?? null,
      file_name: file.name,
      file_url: urlData.publicUrl,
      document_type: defaultType,
      description: null,
    });

    setProgress(90);

    // Auto-set contract_uploaded on vendor when admin uploads a contract
    if (isAdmin) {
      await supabase.from("vendors").update({ contract_uploaded: true }).eq("id", vendorId);
    }

    setProgress(100);
    await fetchDocs();
    setUploading(false);
    setProgress(0);
  };

  const deleteFile = async (doc: VendorDoc) => {
    const storagePath = extractStoragePath(doc.file_url);
    await supabase.from("documents").delete().eq("id", doc.id);
    if (storagePath) {
      await supabase.storage.from("vendor-contracts").remove([storagePath]);
    }

    const remaining = docs.filter(d => d.id !== doc.id);
    setDocs(remaining);
    onFileCountChange?.(remaining.length);

    if (isAdmin && remaining.length === 0) {
      await supabase.from("vendors").update({ contract_uploaded: false }).eq("id", vendorId);
    }
  };

  const saveDescription = async (docId: string) => {
    const value = descDraft[docId] ?? "";
    const current = docs.find(d => d.id === docId);
    if (current?.description === value || (current?.description == null && value === "")) return;
    await supabase.from("documents").update({ description: value || null }).eq("id", docId);
    setDocs(prev => prev.map(d => d.id === docId ? { ...d, description: value } : d));
  };

  const updateCategory = async (docId: string, value: string) => {
    await supabase.from("documents").update({ document_type: value }).eq("id", docId);
    setDocs(prev => prev.map(d => d.id === docId ? { ...d, document_type: value } : d));
    // keep coi_received in sync for admin convenience
    if (isAdmin && value === "coi") {
      await supabase.from("vendors").update({ coi_received: true }).eq("id", vendorId);
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
            Drop a file here, or click to browse
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
            <div key={doc.id} className="rounded-lg border border-border bg-background p-3 space-y-2.5">
              {/* Top row: icon, link, delete */}
              <div className="flex items-center gap-3">
                {isPdf(doc.file_name) ? (
                  <div className="w-9 h-9 rounded-lg bg-sage/15 flex items-center justify-center shrink-0">
                    <FileText size={16} className="text-primary" />
                  </div>
                ) : (
                  <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 border border-border">
                    <img src={doc.signedUrl || doc.file_url} alt={doc.file_name} className="w-full h-full object-cover" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <a
                    href={doc.signedUrl || doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-body text-xs font-medium text-primary hover:underline truncate max-w-full"
                  >
                    <span className="truncate">{doc.file_name}</span>
                    <ExternalLink size={11} className="shrink-0" />
                  </a>
                  {doc.uploaded_at && (
                    <p className="font-body text-[10px] text-muted-foreground">
                      {new Date(doc.uploaded_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  )}
                </div>

                {canDelete && (
                  <button
                    onClick={() => deleteFile(doc)}
                    className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>

              {/* Description input — visible to both admin & couple */}
              <div>
                <label className="font-body text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
                  What is this document?
                </label>
                <input
                  type="text"
                  value={descDraft[doc.id] ?? ""}
                  onChange={e => setDescDraft(prev => ({ ...prev, [doc.id]: e.target.value }))}
                  onBlur={() => saveDescription(doc.id)}
                  placeholder="e.g. Signed contract, May 2026"
                  className="w-full border border-border rounded-md px-2.5 py-1.5 font-body text-xs bg-background focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                />
              </div>

              {/* Category dropdown — admin only */}
              {isAdmin && (
                <div>
                  <label className="font-body text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
                    Category
                  </label>
                  <select
                    value={doc.document_type || "other"}
                    onChange={e => updateCategory(doc.id, e.target.value)}
                    className="w-full border border-border rounded-md px-2.5 py-1.5 font-body text-xs bg-background focus:outline-none focus:border-primary/50"
                  >
                    {VENDOR_DOC_CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
