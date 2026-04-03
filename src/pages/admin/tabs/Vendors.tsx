import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, ChevronDown, ChevronUp, Check, X } from "lucide-react";
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

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-muted text-muted-foreground border-border",
  confirmed: "bg-sage/15 text-sage border-sage/30",
  done: "bg-forest/15 text-forest-dark border-forest/30",
};

const CATEGORIES = ["photographer", "videographer", "florist", "dj", "band", "officiant", "caterer", "cake", "hair_makeup", "transportation", "lighting", "other"];

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

  const debouncedSave = useCallback((updatedDraft: Vendor) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      onSaveStart();
      await onUpdate(vendor.id, updatedDraft);
      onSaveEnd();
    }, 800);
  }, [vendor.id, onUpdate, onSaveStart, onSaveEnd]);

  const updateField = (field: keyof Vendor, value: unknown) => {
    const next = { ...draft, [field]: value };
    setDraft(next);
    debouncedSave(next);
  };

  const immediateSave = async (field: keyof Vendor, value: unknown) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const next = { ...draft, [field]: value };
    setDraft(next);
    onSaveStart();
    await onUpdate(vendor.id, next);
    onSaveEnd();
  };

  const Field = ({ field, placeholder }: { field: keyof Vendor; placeholder?: string }) => (
    <input
      value={(draft[field] as string) || ""}
      onChange={e => updateField(field, e.target.value)}
      placeholder={placeholder}
      className="w-full border border-border rounded-md px-2.5 py-1.5 font-body text-xs bg-background focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
    />
  );

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="p-4 flex items-start gap-3">
        <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <select
            value={draft.category}
            onChange={e => immediateSave("category", e.target.value)}
            className="border border-border rounded-md px-2.5 py-1.5 font-body text-xs bg-background focus:outline-none capitalize"
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
          </select>
          <Field field="business_name" placeholder="Business name" />
          <Field field="contact_name" placeholder="Contact name" />
          <Field field="phone" placeholder="Phone" />
          <Field field="email" placeholder="Email" />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <select
            value={draft.status || "pending"}
            onChange={e => immediateSave("status", e.target.value)}
            className={`rounded-full border px-2.5 py-0.5 font-body text-xs capitalize focus:outline-none ${STATUS_COLORS[draft.status || "pending"]}`}
          >
            {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button onClick={() => onDelete(vendor.id)} className="text-muted-foreground hover:text-destructive">
            <X size={14} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border px-4 py-4 bg-muted/20 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="font-body text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Instagram</p>
              <Field field="instagram" placeholder="@handle" />
            </div>
            <div>
              <p className="font-body text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Vendor Meals</p>
              <input
                type="number"
                value={draft.vendor_meals ?? 0}
                onChange={e => updateField("vendor_meals", parseInt(e.target.value) || 0)}
                className="w-full border border-border rounded-md px-2.5 py-1.5 font-body text-xs bg-background focus:outline-none focus:border-primary/50"
              />
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
            <textarea
              value={draft.brandon_notes || ""}
              onChange={e => updateField("brandon_notes", e.target.value)}
              rows={2}
              placeholder="Internal notes…"
              className="w-full border border-border rounded-md px-3 py-2 font-body text-xs bg-background focus:outline-none focus:border-primary/50 resize-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function VendorsTab({ eventId, onNavigateNext }: { eventId: string; onNavigateNext?: () => void }) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const { status, markSaving, markSaved } = useAutosaveStatus();

  useEffect(() => { fetchVendors(); }, [eventId]);

  const fetchVendors = async () => {
    const { data } = await supabase.from("vendors").select("*").eq("event_id", eventId).order("created_at", { ascending: true });
    if (data) setVendors(data);
    setLoading(false);
  };

  const addVendor = async () => {
    setAdding(true);
    const { data } = await supabase.from("vendors").insert({
      event_id: eventId,
      category: "photographer",
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
    pending: vendors.filter(v => v.status === "pending" || !v.status).length,
  };

  return (
    <div className="space-y-5 pb-24 animate-fade-up relative">
      <div className="flex items-center justify-between">
        <div className="flex gap-4">
          <span className="font-body text-sm text-muted-foreground">{vendors.length} vendor{vendors.length !== 1 ? "s" : ""}</span>
          <span className="font-body text-sm text-sage">{byStatus.confirmed} confirmed</span>
          <span className="font-body text-sm text-muted-foreground">{byStatus.pending} pending</span>
        </div>
        <button
          onClick={addVendor}
          disabled={adding}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-body text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <Plus size={14} />
          Add Vendor
        </button>
      </div>

      {vendors.length === 0 ? (
        <div className="text-center py-16">
          <p className="font-body text-muted-foreground mb-4">No vendors added yet.</p>
          <button onClick={addVendor} className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-body text-sm hover:opacity-90">
            Add First Vendor
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {vendors.map(v => (
            <VendorRow
              key={v.id}
              vendor={v}
              onUpdate={updateVendor}
              onDelete={deleteVendor}
              onSaveStart={markSaving}
              onSaveEnd={markSaved}
            />
          ))}
        </div>
      )}
      <AdminStickyFooter status={status} onSave={() => {}} onSaveAndContinue={() => onNavigateNext?.()} />
    </div>
  );
}
