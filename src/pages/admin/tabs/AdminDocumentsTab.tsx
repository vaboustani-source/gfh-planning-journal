import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Upload, Download, Trash2, FileText, Image as ImageIcon, File } from "lucide-react";
import AdminStickyFooter from "@/components/admin/AdminStickyFooter";

interface Doc {
  id: string;
  file_name: string;
  file_url: string;
  document_type: string | null;
  uploaded_at: string | null;
  uploaded_by: string | null;
  uploaderName?: string;
}

const DOC_GROUPS: { key: string; label: string; types: string[] }[] = [
  { key: "vendor", label: "Vendor Contracts", types: ["vendor_contract"] },
  { key: "couple", label: "Couple Uploads", types: ["couple_upload"] },
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

export default function AdminDocumentsTab({ eventId, onNavigateNext }: { eventId: string; onNavigateNext: () => void }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState("other");

  useEffect(() => {
    fetchDocs();
  }, [eventId]);

  const fetchDocs = async () => {
    const { data } = await supabase
      .from("documents")
      .select("*")
      .eq("event_id", eventId)
      .order("uploaded_at", { ascending: false });
    if (data) setDocs(data);
    setLoading(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    const filePath = `${eventId}/admin/${Date.now()}_${file.name}`;
    const { error: upErr } = await supabase.storage.from("vendor-contracts").upload(filePath, file);
    if (upErr) { setUploading(false); return; }

    const { data: urlData } = supabase.storage.from("vendor-contracts").getPublicUrl(filePath);
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from("documents").insert({
      event_id: eventId,
      file_name: file.name,
      file_url: urlData.publicUrl,
      document_type: uploadType,
      uploaded_by: user?.id || null,
    });

    await fetchDocs();
    setUploading(false);
    e.target.value = "";
  };

  const deleteDoc = async (doc: Doc) => {
    // Extract path from URL for storage delete
    const pathMatch = doc.file_url.match(/vendor-contracts\/(.+)$/);
    if (pathMatch) {
      await supabase.storage.from("vendor-contracts").remove([pathMatch[1]]);
    }
    await supabase.from("documents").delete().eq("id", doc.id);
    setDocs(prev => prev.filter(d => d.id !== doc.id));
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
        <p className="font-display text-lg font-light text-foreground mb-3">Upload Document</p>
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground block mb-1">Type</label>
            <select
              value={uploadType}
              onChange={e => setUploadType(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 font-body text-sm"
            >
              <option value="vendor_contract">Vendor Contract</option>
              <option value="couple_upload">Couple Upload</option>
              <option value="insurance">Insurance / COI</option>
              <option value="menu">Menu</option>
              <option value="timeline">Timeline</option>
              <option value="other">Other</option>
            </select>
          </div>
          <label className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-body text-sm text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer">
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading ? "Uploading…" : "Choose File"}
            <input type="file" className="hidden" onChange={handleUpload} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" />
          </label>
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
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    >
                      <Download size={14} />
                    </a>
                    <button
                      onClick={() => deleteDoc(doc)}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
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

      <AdminStickyFooter onSaveAndContinue={onNavigateNext} />
    </div>
  );
}
