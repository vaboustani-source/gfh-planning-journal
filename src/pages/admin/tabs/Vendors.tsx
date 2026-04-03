import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, ChevronDown, ChevronUp, Check, X, Building2 } from "lucide-react";
import VendorFileUpload from "@/components/admin/VendorFileUpload";
import { useAutosaveStatus } from "@/hooks/useAutosaveStatus";
import AdminStickyFooter from "@/components/admin/AdminStickyFooter";

interface Vendor {
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
}

const STATUS_OPTIONS = ["pending", "confirmed", "done"];
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-muted text-muted-foreground border-border",
  confirmed: "bg-sage/15 text-sage border-sage/30",
  done: "bg-sage/20 text-sage border-sage/40",
};

const FRIENDLY_CATEGORY: Record<string, string> = {
  venue: "Venue",
  caterer: "Caterer",
  photographer: "Photographer",
  videographer: "Videographer",
  hair: "Hair Stylist",
  makeup: "Makeup Artist",
  officiant: "Officiant",
  ceremony_music: "Ceremony Music",
  dj_band: "DJ / Band",
  florals: "Florals",
  rentals: "Rentals",
  photo_booth: "Photo Booth",
  fireworks: "Fireworks",
  invitations: "Invitations",
  hotel: "Hotel",
  shuttle: "Shuttle Service",
  planner: "Planner",
  cake: "Cake",
  other: "Other",
};

interface VendorGroup {
  label: string;
  categories: string[];
}

const VENDOR_GROUPS: VendorGroup[] = [
  { label: "Venue & Catering", categories: ["venue", "caterer"] },
  { label: "Memory Capture", categories: ["photographer", "videographer"] },
  { label: "Beauty", categories: ["hair", "makeup"] },
  { label: "Ceremony", categories: ["officiant", "ceremony_music", "dj_band"] },
  { label: "Florals & Decor", categories: ["florals", "rentals", "photo_booth", "fireworks"] },
  { label: "Printed & Graphic", categories: ["invitations"] },
  { label: "Guest Logistics", categories: ["hotel", "shuttle"] },
  { label: "Additional", categories: ["planner", "cake", "other"] },
];

const GF_CATEGORIES = ["venue", "caterer"];

function isGilbertsvilleRow(v: Vendor) {
  return GF_CATEGORIES.includes(v.category) && v.business_name === "Gilbertsville Farmhouse";
}

/* ── Vendor Row ── */
function VendorRow({ vendor, onUpdate, onDelete, onSaveStart, onSaveEnd }: {
  vendor: Vendor;
  onUpdate: (id: string, fields: Partial<Vendor>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSaveStart: () => void;
  onSaveEnd: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(vendor);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const isGF = isGilbertsvilleRow(vendor);

  useEffect(() => { setDraft(vendor); }, [vendor]);

  const debouncedSave = useCallback((updatedDraft: Vendor) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      onSaveStart();
      await onUpdate(vendor.id, updatedDraft);
      onSaveEnd();
    }, 800);
  }, [vendor.id, onUpdate, onSaveStart, onSaveEnd]);

  const updateField = (field: keyof Vendor, value: unknown) => {
    if (isGF) return;
    const next = { ...draft, [field]: value };
    setDraft(next);
    debouncedSave(next);
  };

  const immediateSave = async (field: keyof Vendor, value: unknown) => {
    if (isGF && field !== "vendor_meals" && field !== "brandon_notes") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const next = { ...draft, [field]: value };
    setDraft(next);
    onSaveStart();
    await onUpdate(vendor.id, next);
    onSaveEnd();
  };

  const inputCls = (readOnly?: boolean) =>
    `w-full border border-border rounded-md px-2.5 py-1.5 font-body text-xs transition-colors focus:outline-none ${
      readOnly
        ? "bg-muted/30 text-muted-foreground cursor-default"
        : "bg-background text-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
    }`;

  return (
    <div className={`rounded-xl border bg-card overflow-hidden ${isGF ? "border-sage/25" : "border-border"}`}>
      <div className="p-4 flex items-start gap-3">
        {/* GF badge or category label */}
        <div className="shrink-0 w-20">
          {isGF ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-sage/15 border border-sage/30 px-2 py-0.5 font-body text-[10px] text-sage font-medium">
              <Building2 size={9} /> GF
            </span>
          ) : null}
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
          <select
            value={draft.status || "pending"}
            onChange={e => immediateSave("status", e.target.value)}
            disabled={isGF}
            className={`rounded-full border px-2.5 py-0.5 font-body text-xs capitalize focus:outline-none ${STATUS_COLORS[draft.status || "pending"]}`}
          >
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {!isGF && (
            <button onClick={() => onDelete(vendor.id)} className="text-muted-foreground hover:text-destructive">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border px-4 py-4 bg-muted/20 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="font-body text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Instagram</p>
              <input value={draft.instagram || ""} onChange={e => updateField("instagram", e.target.value)}
                placeholder="@handle" readOnly={isGF} className={inputCls(isGF)} />
            </div>
            <div>
              <p className="font-body text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Vendor Meals</p>
              <input type="number" value={draft.vendor_meals ?? 0}
                onChange={e => updateField("vendor_meals", parseInt(e.target.value) || 0)}
                className={inputCls(false)} />
            </div>
          </div>

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

          <div>
            <p className="font-body text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Brandon's Notes</p>
            <textarea value={draft.brandon_notes || ""} onChange={e => updateField("brandon_notes", e.target.value)}
              rows={2} placeholder="Internal notes…"
              className="w-full border border-border rounded-md px-3 py-2 font-body text-xs bg-background focus:outline-none focus:border-primary/50 resize-none" />
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main Tab ── */
export default function VendorsTab({ eventId, onNavigateNext }: { eventId: string; onNavigateNext?: () => void }) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const { status, markSaving, markSaved } = useAutosaveStatus();
  const seeded = useRef(false);

  useEffect(() => { loadVendors(); }, [eventId]);

  const loadVendors = async () => {
    const { data } = await supabase.from("vendors").select("*").eq("event_id", eventId).order("created_at", { ascending: true });
    if (data && data.length > 0) {
      setVendors(data);
      setLoading(false);
    } else if (!seeded.current) {
      seeded.current = true;
      await supabase.rpc("seed_vendors", { p_event_id: eventId });
      const { data: seededData } = await supabase.from("vendors").select("*").eq("event_id", eventId).order("created_at", { ascending: true });
      if (seededData) setVendors(seededData);
      setLoading(false);
    } else {
      setLoading(false);
    }
  };

  const addVendor = async () => {
    setAdding(true);
    const { data } = await supabase.from("vendors").insert({
      event_id: eventId,
      category: "other",
      status: "pending",
    }).select().single();
    if (data) setVendors(prev => [...prev, data]);
    setAdding(false);
  };

  const updateVendor = async (id: string, fields: Partial<Vendor>) => {
    await supabase.from("vendors").update(fields).eq("id", id);
    setVendors(prev => prev.map(v => v.id === id ? { ...v, ...fields } : v));
  };

  const deleteVendor = async (id: string) => {
    await supabase.from("vendors").delete().eq("id", id);
    setVendors(prev => prev.filter(v => v.id !== id));
  };

  if (loading) return <div className="py-12 flex justify-center"><div className="w-6 h-6 rounded-full border-2 border-sage/30 border-t-sage animate-spin" /></div>;

  const byStatus = {
    confirmed: vendors.filter(v => v.status === "confirmed").length,
    done: vendors.filter(v => v.status === "done").length,
    pending: vendors.filter(v => v.status === "pending" || !v.status).length,
  };

  return (
    <div className="space-y-6 pb-24 animate-fade-up relative">
      {/* Summary bar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-4">
          <span className="font-body text-sm text-muted-foreground">{vendors.length} vendors</span>
          <span className="font-body text-sm text-sage">{byStatus.done + byStatus.confirmed} confirmed</span>
          <span className="font-body text-sm text-muted-foreground">{byStatus.pending} pending</span>
        </div>
        <button onClick={addVendor} disabled={adding}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-body text-sm hover:opacity-90 transition-opacity disabled:opacity-50">
          <Plus size={14} /> Add Vendor
        </button>
      </div>

      {/* Grouped vendor list */}
      {VENDOR_GROUPS.map(group => {
        const groupVendors = vendors.filter(v => group.categories.includes(v.category));
        if (groupVendors.length === 0) return null;

        return (
          <div key={group.label}>
            <p className="font-display text-base font-light text-foreground border-b border-border pb-2 mb-3">
              {group.label}
            </p>
            <div className="space-y-2">
              {groupVendors.map(v => (
                <VendorRow key={v.id} vendor={v}
                  onUpdate={updateVendor} onDelete={deleteVendor}
                  onSaveStart={markSaving} onSaveEnd={markSaved} />
              ))}
            </div>
          </div>
        );
      })}

      {/* Ungrouped vendors (safety net) */}
      {vendors.filter(v => !VENDOR_GROUPS.some(g => g.categories.includes(v.category))).length > 0 && (
        <div>
          <p className="font-display text-base font-light text-foreground border-b border-border pb-2 mb-3">Other</p>
          <div className="space-y-2">
            {vendors.filter(v => !VENDOR_GROUPS.some(g => g.categories.includes(v.category))).map(v => (
              <VendorRow key={v.id} vendor={v}
                onUpdate={updateVendor} onDelete={deleteVendor}
                onSaveStart={markSaving} onSaveEnd={markSaved} />
            ))}
          </div>
        </div>
      )}

      <AdminStickyFooter status={status} onSave={() => {}} onSaveAndContinue={() => onNavigateNext?.()} />
    </div>
  );
}
