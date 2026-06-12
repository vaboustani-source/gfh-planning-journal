import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Share2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAutosaveStatus } from "@/hooks/useAutosaveStatus";
import AdminStickyFooter from "@/components/admin/AdminStickyFooter";
import { CoiRequirementsPanel } from "@/components/vendor/CoiRequirementsPanel";
import { VendorCard, Vendor, VENDOR_GROUPS, STANDARD_VENDOR_CATEGORIES } from "@/components/vendor/VendorCard";
import { BrowsePreferredDrawer } from "@/components/admin/BrowsePreferredDrawer";
import { PreferredVendor } from "@/components/admin/PreferredVendorCard";
import { SocialExportModal } from "@/components/admin/SocialExportModal";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableVendorCard({
  vendor, eventId, onUpdate, onDelete, onSaveStart, onSaveEnd, onBrowsePreferred,
}: {
  vendor: Vendor;
  eventId: string;
  onUpdate: (id: string, fields: Partial<Vendor>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSaveStart: () => void;
  onSaveEnd: () => void;
  onBrowsePreferred: (vendorId: string, category: string) => void;
}) {
  const isGF = ["venue", "caterer"].includes(vendor.category) && vendor.business_name === "Gilbertsville Farmhouse";
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: vendor.id, disabled: isGF });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <VendorCard
        vendor={vendor}
        eventId={eventId}
        isAdmin
        onUpdate={onUpdate}
        onDelete={onDelete}
        onSaveStart={onSaveStart}
        onSaveEnd={onSaveEnd}
        showDragHandle
        dragHandleProps={listeners}
        onBrowsePreferred={(category) => onBrowsePreferred(vendor.id, category)}
        clearOnly={STANDARD_VENDOR_CATEGORIES.has(vendor.category)}
      />
    </div>
  );
}

export default function VendorsTab({ eventId, onNavigateNext }: { eventId: string; onNavigateNext?: () => void }) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [browseFor, setBrowseFor] = useState<{ vendorId: string; category: string } | null>(null);
  const [socialModalOpen, setSocialModalOpen] = useState(false);
  const { status, markSaving, markSaved } = useAutosaveStatus();
  const seeded = useRef(false);
  const [coiBulkOpen, setCoiBulkOpen] = useState(false);
  const [coiBulkProgress, setCoiBulkProgress] = useState<{ sent: number; total: number; current?: string } | null>(null);

  const eligibleForCoi = (v: Vendor) =>
    !!v.email && !!v.business_name && !(["venue", "caterer"].includes(v.category) && v.business_name === "Gilbertsville Farmhouse");

  const sendCoiToAll = async () => {
    const targets = vendors.filter(eligibleForCoi);
    if (targets.length === 0) {
      toast.error("No vendors with an email on file yet");
      return;
    }
    setCoiBulkProgress({ sent: 0, total: targets.length });
    let failures = 0;
    for (let i = 0; i < targets.length; i++) {
      const v = targets[i];
      setCoiBulkProgress({ sent: i, total: targets.length, current: v.business_name || "" });
      try {
        const { data, error } = await supabase.functions.invoke("send-coi-request", { body: { vendor_id: v.id } });
        if (error || (data as any)?.error) throw new Error(error?.message || (data as any)?.error);
        setVendors(prev => prev.map(x => x.id === v.id ? { ...x, coi_requested: true, coi_requested_at: new Date().toISOString() } as Vendor : x));
      } catch (e) {
        failures++;
        console.error("[coi bulk]", v.business_name, e);
      }
    }
    setCoiBulkProgress({ sent: targets.length, total: targets.length });
    if (failures === 0) toast.success(`COI requests sent to ${targets.length} vendor${targets.length === 1 ? "" : "s"}`);
    else toast.error(`Sent ${targets.length - failures} of ${targets.length}. ${failures} failed.`);
    setTimeout(() => { setCoiBulkOpen(false); setCoiBulkProgress(null); }, 800);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => { loadVendors(); }, [eventId]);

  const loadVendors = async () => {
    // Always make sure the full standard role template exists for this event.
    if (!seeded.current) {
      seeded.current = true;
      await (supabase as any).rpc("ensure_standard_vendor_roles", { p_event_id: eventId });
    }
    const { data } = await supabase.from("vendors").select("*").eq("event_id", eventId).order("sort_order", { ascending: true, nullsFirst: false }).order("created_at", { ascending: true });
    if (data) setVendors(data);
    setLoading(false);
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
    const target = vendors.find(v => v.id === id);
    if (!target) return;
    // Standard template slots are cleared (kept visible). Only admin-added
    // extras outside the standard role list are fully removed.
    if (STANDARD_VENDOR_CATEGORIES.has(target.category)) {
      const cleared: Partial<Vendor> = {
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
    } else {
      await supabase.from("vendors").delete().eq("id", id);
      setVendors(prev => prev.filter(v => v.id !== id));
    }
  };

  const sortGroupVendors = (groupVendors: Vendor[]) => {
    // Pin GF rows to the top
    const gf = groupVendors.filter(v => ["venue", "caterer"].includes(v.category) && v.business_name === "Gilbertsville Farmhouse");
    const rest = groupVendors.filter(v => !gf.some(g => g.id === v.id));
    return [...gf, ...rest];
  };

  const handleDragEnd = async (event: DragEndEvent, groupCategories: string[]) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const groupVendors = sortGroupVendors(vendors.filter(v => groupCategories.includes(v.category)));
    const oldIndex = groupVendors.findIndex(v => v.id === active.id);
    const newIndex = groupVendors.findIndex(v => v.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    // Don't allow moving into GF positions
    const gfCount = groupVendors.filter(v => ["venue", "caterer"].includes(v.category) && v.business_name === "Gilbertsville Farmhouse").length;
    if (newIndex < gfCount) return;

    const reordered = [...groupVendors];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    // Update sort_order for all items in this group
    const updates = reordered.map((v, i) => ({ id: v.id, sort_order: i }));

    setVendors(prev => {
      const otherVendors = prev.filter(v => !groupCategories.includes(v.category));
      const updatedGroup = reordered.map((v, i) => ({ ...v, sort_order: i }));
      return [...otherVendors, ...updatedGroup];
    });

    markSaving();
    await Promise.all(updates.map(u => supabase.from("vendors").update({ sort_order: u.sort_order } as any).eq("id", u.id)));
    markSaved();
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
        <div className="flex items-center gap-2">
          <button onClick={() => setSocialModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-background text-foreground font-body text-sm hover:bg-muted/50 transition-colors">
            <Share2 size={14} /> Export for Social
          </button>
          <button onClick={addVendor} disabled={adding}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-body text-sm hover:opacity-90 transition-opacity disabled:opacity-50">
            <Plus size={14} /> Add Vendor
          </button>
        </div>
      </div>

      {VENDOR_GROUPS.map(group => {
        const groupVendors = sortGroupVendors(vendors.filter(v => group.categories.includes(v.category)));
        if (groupVendors.length === 0) return null;
        return (
          <div key={group.label}>
            <p className="font-display text-base font-light text-foreground border-b border-border pb-2 mb-3">{group.label}</p>
            <DndContext sensors={sensors} collisionDetection={closestCenter}
              onDragEnd={(e) => handleDragEnd(e, group.categories)}>
              <SortableContext items={groupVendors.map(v => v.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {groupVendors.map(v => (
                    <SortableVendorCard key={v.id} vendor={v} eventId={eventId}
                      onUpdate={updateVendor} onDelete={deleteVendor}
                      onSaveStart={markSaving} onSaveEnd={markSaved}
                      onBrowsePreferred={(vendorId, category) => setBrowseFor({ vendorId, category })} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
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
                onSaveStart={markSaving} onSaveEnd={markSaved}
                onBrowsePreferred={(category) => setBrowseFor({ vendorId: v.id, category })} />
            ))}
          </div>
        </div>
      )}

      <BrowsePreferredDrawer
        open={!!browseFor}
        onClose={() => setBrowseFor(null)}
        eventCategory={browseFor?.category || ""}
        onAdd={async (pv: PreferredVendor) => {
          if (!browseFor) return;
          markSaving();
          await updateVendor(browseFor.vendorId, {
            business_name: pv.name,
            contact_name: pv.contact_name,
            phone: pv.phone,
            email: pv.email,
            instagram: pv.instagram,
            brandon_notes: pv.notes,
          });
          markSaved();
        }}
      />

      <SocialExportModal
        open={socialModalOpen}
        onClose={() => setSocialModalOpen(false)}
        vendors={vendors}
      />

      <AdminStickyFooter status={status} onSave={() => {}} onSaveAndContinue={() => onNavigateNext?.()} />
    </div>
  );
}
