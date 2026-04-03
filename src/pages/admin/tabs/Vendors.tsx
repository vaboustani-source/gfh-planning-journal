import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus } from "lucide-react";
import { useAutosaveStatus } from "@/hooks/useAutosaveStatus";
import AdminStickyFooter from "@/components/admin/AdminStickyFooter";
import { VendorCard, Vendor, VENDOR_GROUPS } from "@/components/vendor/VendorCard";

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

      {VENDOR_GROUPS.map(group => {
        const groupVendors = vendors.filter(v => group.categories.includes(v.category));
        if (groupVendors.length === 0) return null;
        return (
          <div key={group.label}>
            <p className="font-display text-base font-light text-foreground border-b border-border pb-2 mb-3">{group.label}</p>
            <div className="space-y-2">
              {groupVendors.map(v => (
                <VendorCard key={v.id} vendor={v} eventId={eventId} isAdmin
                  onUpdate={updateVendor} onDelete={deleteVendor}
                  onSaveStart={markSaving} onSaveEnd={markSaved} />
              ))}
            </div>
          </div>
        );
      })}

      {vendors.filter(v => !VENDOR_GROUPS.some(g => g.categories.includes(v.category))).length > 0 && (
        <div>
          <p className="font-display text-base font-light text-foreground border-b border-border pb-2 mb-3">Other</p>
          <div className="space-y-2">
            {vendors.filter(v => !VENDOR_GROUPS.some(g => g.categories.includes(v.category))).map(v => (
              <VendorCard key={v.id} vendor={v} eventId={eventId} isAdmin
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
