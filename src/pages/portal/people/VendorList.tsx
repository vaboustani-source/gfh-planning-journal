import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePortalData } from "@/hooks/usePortalData";
import { VendorCard, Vendor, VENDOR_GROUPS } from "@/components/vendor/VendorCard";

export function VendorList() {
  const { eventId } = usePortalData();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) return;
    supabase
      .from("vendors")
      .select("id, category, business_name, contact_name, phone, email, instagram, status, contract_uploaded, coi_received, info_emailed, vendor_meals, brandon_notes")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) setVendors(data);
        setLoading(false);
      });
  }, [eventId]);

  const updateVendor = async (id: string, fields: Partial<Vendor>) => {
    const safeFields: Partial<Vendor> = {};
    const allowedKeys: (keyof Vendor)[] = ["business_name", "contact_name", "phone", "email", "instagram"];
    for (const key of allowedKeys) {
      if (key in fields) (safeFields as any)[key] = fields[key];
    }
    await supabase.from("vendors").update(safeFields).eq("id", id);
    setVendors(prev => prev.map(v => v.id === id ? { ...v, ...safeFields } : v));
  };

  const deleteVendor = async (id: string) => {
    // Couples don't remove vendor roles — they just clear the slot's fill,
    // leaving the category blank so it can be filled in later.
    const cleared = {
      business_name: null,
      contact_name: null,
      phone: null,
      email: null,
      instagram: null,
      status: "pending",
      contract_uploaded: false,
      coi_received: false,
      info_emailed: false,
      vendor_meals: 0,
      brandon_notes: null,
    };
    await supabase.from("vendors").update(cleared).eq("id", id);
    setVendors(prev => prev.map(v => v.id === id ? { ...v, ...cleared } : v));
  };

  if (loading) {
    return <div className="space-y-2 mt-4">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>;
  }

  if (vendors.length === 0) {
    return <p className="font-body text-sm text-muted-foreground mt-4">Your vendor list will appear here once your coordinator sets things up.</p>;
  }

  return (
    <div className="space-y-6 mt-4">
      {VENDOR_GROUPS.map(group => {
        const groupVendors = vendors.filter(v => group.categories.includes(v.category));
        if (groupVendors.length === 0) return null;
        return (
          <div key={group.label}>
            <p className="font-display text-sm font-light text-foreground border-b border-border pb-1.5 mb-2.5">
              {group.label}
            </p>
            <div className="space-y-2">
              {groupVendors.map(v => (
                <VendorCard key={v.id} vendor={v} eventId={eventId!} isAdmin={false}
                   onUpdate={updateVendor} onDelete={deleteVendor} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
