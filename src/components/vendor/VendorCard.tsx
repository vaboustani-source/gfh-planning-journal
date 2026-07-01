import { useState, useEffect, useRef, useCallback } from "react";
import { Building2, Instagram, FileCheck2, ChevronDown, ChevronUp, Pencil, Check, X, Save, Trash2, GripVertical, ShieldCheck, MailCheck } from "lucide-react";
import VendorFileUpload from "@/components/admin/VendorFileUpload";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Vendor {
  id: string;
  category: string;
  business_name: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  instagram: string | null;
  status: string | null;
  contract_uploaded: boolean | null;
  coi_received: boolean | null;
  info_emailed: boolean | null;
  vendor_meals: number | null;
  brandon_notes: string | null;
  coi_requested?: boolean | null;
  coi_requested_at?: string | null;
  checkin_sent?: boolean | null;
  checkin_sent_at?: string | null;
}

export const FRIENDLY_CATEGORY: Record<string, string> = {
  venue: "Venue", caterer: "Caterer",
  planner: "Wedding Planner / Designer",
  photographer: "Photographer", videographer: "Videographer",
  hair: "Hair Stylist", makeup: "Makeup Artist",
  florals: "Florist", rentals: "Décor / Rentals",
  officiant: "Officiant", ceremony_music: "Ceremony Music",
  dj_band: "DJ / Band", photo_booth: "Photo Booth / Installation",
  fireworks: "Fireworks", shuttle: "Shuttle / Transportation",
  cake: "Cake / Dessert", invitations: "Invitations / Stationery",
  hotel: "Hotel", other: "Other",
};

export interface VendorGroup { label: string; categories: string[] }
export const VENDOR_GROUPS: VendorGroup[] = [
  { label: "Venue & Catering", categories: ["venue", "caterer"] },
  { label: "Planning & Design", categories: ["planner"] },
  { label: "Memory Capture", categories: ["photographer", "videographer"] },
  { label: "Beauty", categories: ["hair", "makeup"] },
  { label: "Florals & Decor", categories: ["florals", "rentals"] },
  { label: "Ceremony", categories: ["officiant", "ceremony_music"] },
  { label: "Music & Entertainment", categories: ["dj_band", "photo_booth"] },
  { label: "Extras", categories: ["fireworks", "shuttle", "cake", "invitations"] },
];

export const STANDARD_VENDOR_CATEGORIES = new Set([
  "venue","caterer","planner","photographer","videographer",
  "hair","makeup","florals","rentals","officiant","ceremony_music",
  "dj_band","photo_booth","fireworks","shuttle","cake","invitations",
]);

const STATUS_OPTIONS = ["pending", "confirmed", "done"];
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-muted text-muted-foreground border-border",
  confirmed: "bg-sage/15 text-sage border-sage/30",
  done: "bg-sage/20 text-sage border-sage/40",
};

function isGilbertsvilleRow(v: Vendor) {
  return ["venue", "caterer"].includes(v.category) && v.business_name === "Gilbertsville Farmhouse";
}

interface VendorCardProps {
  vendor: Vendor;
  eventId: string;
  isAdmin: boolean;
  initialEditMode?: boolean;
  onUpdate: (id: string, fields: Partial<Vendor>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onSaveStart?: () => void;
  onSaveEnd?: () => void;
  dragHandleProps?: Record<string, any>;
  showDragHandle?: boolean;
  /** Admin-only: handler for "Browse Preferred" button (shown on empty slots) */
  onBrowsePreferred?: (category: string) => void;
  /** When true, the delete action clears the slot rather than removing the row. */
  clearOnly?: boolean;
}

export function VendorCard({
  vendor, eventId, isAdmin, initialEditMode = false,
  onUpdate, onDelete, onSaveStart, onSaveEnd,
  dragHandleProps, showDragHandle = false,
  onBrowsePreferred, clearOnly = false,
}: VendorCardProps) {
  const isGF = isGilbertsvilleRow(vendor);
  const hasContent = !!vendor.business_name;
  const [editing, setEditing] = useState(initialEditMode && !isGF);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(vendor);
  const [fileCount, setFileCount] = useState(0);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [coiConfirmOpen, setCoiConfirmOpen] = useState(false);
  const [coiSending, setCoiSending] = useState(false);
  const [checkinConfirmOpen, setCheckinConfirmOpen] = useState(false);
  const [checkinSending, setCheckinSending] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();


  useEffect(() => { setDraft(vendor); }, [vendor]);

  const canRequestCoi = !isGF && !!vendor.business_name && !!vendor.email;
  const showCoiButton = !isGF && !!vendor.business_name; // shown disabled when no email

  const sendCoiRequest = async () => {
    setCoiSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-coi-request", {
        body: { vendor_id: vendor.id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("COI request sent");
      // Update local field so the pill appears immediately.
      await onUpdate(vendor.id, {
        coi_requested: true,
        coi_requested_at: new Date().toISOString(),
      } as Partial<Vendor>);
      setCoiConfirmOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Could not send COI request");
    } finally {
      setCoiSending(false);
    }
  };

  const coiRequestedLabel = vendor.coi_requested && vendor.coi_requested_at
    ? `COI requested ${new Date(vendor.coi_requested_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
    : vendor.coi_requested ? "COI requested" : null;

  const canSendCheckin = !isGF && !!vendor.business_name && !!vendor.email;
  const showCheckinButton = !isGF && !!vendor.business_name;

  const sendCheckin = async () => {
    setCheckinSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-vendor-checkin", {
        body: { vendor_id: vendor.id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Check-in sent");
      await onUpdate(vendor.id, {
        checkin_sent: true,
        checkin_sent_at: new Date().toISOString(),
      } as Partial<Vendor>);
      setCheckinConfirmOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Could not send check-in");
    } finally {
      setCheckinSending(false);
    }
  };

  const checkinSentLabel = vendor.checkin_sent && vendor.checkin_sent_at
    ? `Check-in sent · ${new Date(vendor.checkin_sent_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
    : vendor.checkin_sent ? "Check-in sent" : null;


  const saveAndClose = async () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onSaveStart?.();
    await onUpdate(vendor.id, draft);
    onSaveEnd?.();
    setEditing(false);
  };

  const updateField = (field: keyof Vendor, value: unknown) => {
    if (isGF && !["vendor_meals", "brandon_notes"].includes(field)) return;
    const next = { ...draft, [field]: value };
    setDraft(next);
  };

  const immediateSave = async (field: keyof Vendor, value: unknown) => {
    if (isGF && !["vendor_meals", "brandon_notes"].includes(field)) return;
    const next = { ...draft, [field]: value };
    setDraft(next);
    onSaveStart?.();
    await onUpdate(vendor.id, next);
    onSaveEnd?.();
  };

  const inputCls = (readOnly?: boolean) =>
    `w-full border border-border rounded-md px-2.5 py-1.5 font-body text-xs transition-colors focus:outline-none ${
      readOnly
        ? "bg-muted/30 text-muted-foreground cursor-default"
        : "bg-background text-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
    }`;

  // ─── VIEW MODE ───
  if (!editing) {
    return (
      <div className={`rounded-xl border overflow-hidden ${isGF ? "border-sage/40 bg-card" : "border-border bg-card"}`}>
        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Drag handle */}
            {showDragHandle && !isGF && (
              <div {...dragHandleProps} className="flex items-center pt-1 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors">
                <GripVertical size={16} />
              </div>
            )}
            {showDragHandle && isGF && (
              <div className="flex items-center pt-1 text-transparent">
                <GripVertical size={16} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <p className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">
                  {FRIENDLY_CATEGORY[vendor.category] || vendor.category}
                </p>
                {isGF && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-sage/15 border border-sage/30 px-2 py-0.5 font-body text-[10px] text-sage font-medium">
                    <Building2 size={8} /> GF
                  </span>
                )}
                {fileCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-sage/15 border border-sage/30 px-2 py-0.5 font-body text-[10px] text-primary font-medium">
                    <FileCheck2 size={8} /> Contract on file
                  </span>
                )}
                {isAdmin && vendor.status && (
                  <span className={`inline-flex rounded-full border px-2 py-0.5 font-body text-[10px] capitalize ${STATUS_COLORS[vendor.status || "pending"]}`}>
                    {vendor.status}
                  </span>
                )}
                {coiRequestedLabel && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-sage/10 border border-sage/30 px-2 py-0.5 font-body text-[10px] text-sage">
                    <ShieldCheck size={8} /> {coiRequestedLabel}
                  </span>
                )}
                {checkinSentLabel && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-sage/10 border border-sage/30 px-2 py-0.5 font-body text-[10px] text-sage">
                    <MailCheck size={8} /> {checkinSentLabel}
                  </span>
                )}
              </div>
              {vendor.business_name ? (
                <p className="font-body text-sm font-medium text-foreground">{vendor.business_name}</p>
              ) : (
                <p className="font-body text-sm italic text-muted-foreground">Not yet confirmed</p>
              )}
              <div className="flex items-center gap-4 mt-1 flex-wrap">
                {vendor.contact_name && (
                  <p className="font-body text-xs text-muted-foreground">{vendor.contact_name}</p>
                )}
                {vendor.instagram && (
                  <a href={`https://instagram.com/${vendor.instagram.replace("@", "")}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                    <Instagram size={12} />
                    <span className="font-body text-[11px]">@{vendor.instagram.replace("@", "")}</span>
                  </a>
                )}
                {isAdmin && vendor.phone && (
                  <p className="font-body text-[11px] text-muted-foreground">{vendor.phone}</p>
                )}
                {isAdmin && vendor.email && (
                  <p className="font-body text-[11px] text-muted-foreground">{vendor.email}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* Browse Preferred — admin only, on empty (non-GF) slots */}
              {isAdmin && !isGF && !hasContent && onBrowsePreferred && (
                <button onClick={() => onBrowsePreferred(vendor.category)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-sage/40 text-sage hover:bg-sage/10 transition-colors font-body text-xs">
                  Browse Preferred
                </button>
              )}
              {!isGF && (
                <button onClick={() => setEditing(true)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors font-body text-xs">
                  <Pencil size={12} /> Edit
                </button>
              )}
              {showCoiButton && (
                <button
                  onClick={() => canRequestCoi && setCoiConfirmOpen(true)}
                  disabled={!canRequestCoi}
                  title={canRequestCoi ? "Email the Certificate of Insurance requirements to this vendor" : "Add an email address first"}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-sage/40 text-sage hover:bg-sage/10 transition-colors font-body text-xs disabled:opacity-50 disabled:hover:bg-transparent disabled:cursor-not-allowed">
                  <ShieldCheck size={12} /> Request COI
                </button>
              )}
              {/* Delete button — not for GF rows */}
              {!isGF && onDelete && !confirmingDelete && (
                <button onClick={() => setConfirmingDelete(true)}
                  className="p-1.5 rounded-md text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors">
                  <Trash2 size={13} />
                </button>
              )}
              <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground">
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>
          </div>
          {/* Inline delete confirmation */}
          {confirmingDelete && (
            <div className="mt-3 flex items-center gap-3 p-2.5 rounded-lg bg-destructive/5 border border-destructive/20">
              <p className="font-body text-xs text-foreground flex-1">
                {clearOnly
                  ? "Clear this vendor? The slot stays so you can fill it in later."
                  : "Remove this vendor?"}
              </p>
              <button onClick={() => { onDelete?.(vendor.id); setConfirmingDelete(false); }}
                className="px-3 py-1 rounded-md bg-destructive text-destructive-foreground font-body text-xs hover:opacity-90 transition-opacity">
                {clearOnly ? "Yes, clear" : "Yes, remove"}
              </button>
              <button onClick={() => setConfirmingDelete(false)}
                className="px-3 py-1 rounded-md border border-border font-body text-xs text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </button>
            </div>
          )}
        </div>
        {expanded && (
          <div className="border-t border-border px-4 py-3 bg-muted/20">
            <VendorFileUpload
              eventId={eventId}
              vendorId={vendor.id}
              isAdmin={isAdmin}
              canUpload={true}
              canDelete={true}
              onFileCountChange={setFileCount}
            />
            {fileCount === 0 && (
              <p className="font-body text-xs text-muted-foreground text-center py-2">No files uploaded yet.</p>
            )}
          </div>
        )}
        {coiConfirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !coiSending && setCoiConfirmOpen(false)}>
            <div className="bg-card rounded-xl border border-border shadow-lg max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start gap-3 mb-3">
                <div className="rounded-full bg-sage/15 p-2 text-sage shrink-0"><ShieldCheck size={18} /></div>
                <div>
                  <h3 className="font-display text-lg font-light text-foreground">Send COI requirements?</h3>
                  <p className="font-body text-sm text-muted-foreground mt-1">
                    We will email the Certificate of Insurance requirements to <span className="text-foreground font-medium">{vendor.email}</span>{vendor.business_name ? <> at <span className="text-foreground font-medium">{vendor.business_name}</span></> : null}. They can forward it straight to their insurance agent.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 mt-5">
                <button onClick={() => setCoiConfirmOpen(false)} disabled={coiSending}
                  className="px-4 py-2 rounded-md border border-border text-muted-foreground hover:text-foreground font-body text-sm transition-colors disabled:opacity-50">
                  Cancel
                </button>
                <button onClick={sendCoiRequest} disabled={coiSending}
                  className="px-4 py-2 rounded-md bg-sage text-white font-body text-sm hover:opacity-90 transition-opacity disabled:opacity-50">
                  {coiSending ? "Sending..." : "Send request"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── EDIT MODE ───
  return (
    <div className={`rounded-xl border bg-card overflow-hidden ${isGF ? "border-sage/40" : "border-border"}`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-20">
            {isGF && (
              <span className="inline-flex items-center gap-1 rounded-full bg-sage/15 border border-sage/30 px-2 py-0.5 font-body text-[10px] text-sage font-medium">
                <Building2 size={9} /> GF
              </span>
            )}
            <p className="font-body text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
              {FRIENDLY_CATEGORY[draft.category] || draft.category}
            </p>
          </div>

          <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <input value={draft.business_name || ""} onChange={e => updateField("business_name", e.target.value)}
              placeholder="Business name" readOnly={isGF} className={inputCls(isGF)} />
            <input value={draft.contact_name || ""} onChange={e => updateField("contact_name", e.target.value)}
              placeholder="Contact name" readOnly={isGF} className={inputCls(isGF)} />
            <input value={draft.phone || ""} onChange={e => updateField("phone", e.target.value)}
              placeholder="Phone" readOnly={isGF} className={inputCls(isGF)} />
            <input value={draft.email || ""} onChange={e => updateField("email", e.target.value)}
              placeholder="Email" readOnly={isGF} className={inputCls(isGF)} />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isAdmin && (
              <select
                value={draft.status || "pending"}
                onChange={e => immediateSave("status", e.target.value)}
                disabled={isGF}
                className={`rounded-full border px-2.5 py-0.5 font-body text-xs capitalize focus:outline-none ${STATUS_COLORS[draft.status || "pending"]}`}
              >
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            <button onClick={saveAndClose}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-sage text-white hover:opacity-90 transition-opacity font-body text-xs">
              <Save size={12} /> Save
            </button>
            {!isGF && (
              <button onClick={saveAndClose} title="Close" className="text-muted-foreground hover:text-foreground">
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expanded details always visible in edit mode */}
      <div className="border-t border-border px-4 py-4 bg-muted/20 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="font-body text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Instagram</p>
            <input value={draft.instagram || ""} onChange={e => updateField("instagram", e.target.value)}
              placeholder="@handle" readOnly={isGF} className={inputCls(isGF)} />
          </div>
          {isAdmin && (
            <div>
              <p className="font-body text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Vendor Meals</p>
              <input type="number" value={draft.vendor_meals ?? 0}
                onChange={e => updateField("vendor_meals", parseInt(e.target.value) || 0)}
                className={inputCls(false)} />
            </div>
          )}
        </div>

        {isAdmin && (
          <div className="flex flex-wrap gap-5">
            {([
              { field: "contract_uploaded" as keyof Vendor, label: "Contract uploaded" },
              { field: "coi_received" as keyof Vendor, label: "COI received" },
              { field: "info_emailed" as keyof Vendor, label: "Info emailed" },
            ]).map(({ field, label }) => (
              <label key={field} className="flex items-center gap-2 cursor-pointer">
                <div
                  onClick={() => immediateSave(field, !draft[field])}
                  className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                    draft[field] ? "bg-sage border-sage" : "border-border bg-background"
                  }`}
                >
                  {draft[field] && <Check size={9} className="text-white" />}
                </div>
                <span className="font-body text-xs text-foreground">{label}</span>
              </label>
            ))}
          </div>
        )}

        {isAdmin && (
          <div>
            <p className="font-body text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Brandon's Notes</p>
            <textarea value={draft.brandon_notes || ""} onChange={e => updateField("brandon_notes", e.target.value)}
              rows={2} placeholder="Internal notes…"
              className="w-full border border-border rounded-md px-3 py-2 font-body text-xs bg-background focus:outline-none focus:border-primary/50 resize-none" />
          </div>
        )}

        {!isAdmin && (
          <div>
            <p className="font-body text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Notes</p>
            <textarea value={draft.brandon_notes || ""} onChange={e => updateField("brandon_notes", e.target.value)}
              rows={2} placeholder="Your notes about this vendor…"
              className="w-full border border-border rounded-md px-3 py-2 font-body text-xs bg-background focus:outline-none focus:border-primary/50 resize-none" />
          </div>
        )}

        {/* File uploads */}
        <div>
          <p className="font-body text-[10px] text-muted-foreground uppercase tracking-wider mb-2">{isAdmin ? "Contracts & Files" : "Documents & Files"}</p>
          <VendorFileUpload
            eventId={eventId}
            vendorId={vendor.id}
            isAdmin={isAdmin}
            canUpload={true}
            canDelete={true}
            onFileCountChange={(count) => {
              setFileCount(count);
              if (isAdmin && (count > 0) !== !!draft.contract_uploaded) {
                setDraft(prev => ({ ...prev, contract_uploaded: count > 0 }));
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
