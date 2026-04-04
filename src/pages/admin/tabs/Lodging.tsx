import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Check, Loader2, ChevronDown, Lock } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAutosaveStatus } from "@/hooks/useAutosaveStatus";
import AdminStickyFooter from "@/components/admin/AdminStickyFooter";
import { LODGING_SECTIONS } from "@/lib/lodgingConfig";

interface Room {
  id: string;
  room_name: string;
  room_type: string;
  nightly_rate: number | null;
  sort_order: number | null;
}

interface Assignment {
  id: string;
  room_id: string | null;
  event_id: string | null;
  assigned_guest_name: string | null;
  assigned_guest_email: string | null;
  host_pays: boolean | null;
  payment_method: string | null;
  payment_completed_date: string | null;
  brandon_notes: string | null;
  invoice_1_sent: boolean | null;
  invoice_2_sent: boolean | null;
  invoice_final_sent: boolean | null;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  unassigned: { label: "Available", cls: "text-muted-foreground/60 italic" },
  assigned: { label: "Assigned", cls: "text-sage-dark" },
  paid: { label: "Paid", cls: "text-forest-dark font-medium" },
};

function getStatus(a?: Assignment) {
  if (!a || !a.assigned_guest_name?.trim()) return "unassigned";
  if (a.payment_completed_date) return "paid";
  return "assigned";
}

export default function LodgingTab({ eventId, onNavigateNext }: { eventId: string; onNavigateNext?: () => void }) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    hearth_village: true, farmhouse: true, grove: true, victoria: true,
  });
  const { status, debouncedSave } = useAutosaveStatus();

  useEffect(() => {
    fetchAll();
  }, [eventId]);

  const fetchAll = async () => {
    const [{ data: rData }, { data: aData }] = await Promise.all([
      supabase.from("lodging_rooms").select("*").order("sort_order", { ascending: true }),
      supabase.from("lodging_assignments").select("*").eq("event_id", eventId),
    ]);
    if (rData) setRooms(rData);
    if (aData) setAssignments(aData);
    setLoading(false);
  };

  const getAssignment = (roomId: string) => assignments.find(a => a.room_id === roomId);

  const updateField = useCallback((roomId: string, field: keyof Assignment, value: string | boolean | null) => {
    setAssignments(prev => {
      const existing = prev.find(a => a.room_id === roomId);
      if (existing) {
        return prev.map(a => a.room_id === roomId ? { ...a, [field]: value } : a);
      }
      return [...prev, {
        id: "", room_id: roomId, event_id: eventId,
        assigned_guest_name: null, assigned_guest_email: null, host_pays: false,
        payment_method: null, payment_completed_date: null, brandon_notes: null,
        invoice_1_sent: false, invoice_2_sent: false, invoice_final_sent: false,
        [field]: value,
      }];
    });
  }, [eventId]);

  const saveRoom = useCallback((roomId: string) => {
    debouncedSave(`room-${roomId}`, async () => {
      const a = assignments.find(x => x.room_id === roomId);
      if (!a) return;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, ...payload } = { ...a, event_id: eventId, room_id: roomId };
      if (a.id) {
        const { data } = await supabase.from("lodging_assignments").update(payload).eq("id", a.id).select().single();
        if (data) setAssignments(prev => prev.map(x => x.room_id === roomId ? data : x));
      } else {
        const { data } = await supabase.from("lodging_assignments").insert(payload).select().single();
        if (data) setAssignments(prev => prev.map(x => x.room_id === roomId ? data : x));
      }
    });
  }, [assignments, debouncedSave, eventId]);

  const handleFieldChange = (roomId: string, field: keyof Assignment, value: string | boolean | null) => {
    updateField(roomId, field, value);
    // We need to debounce save after state update, so schedule on next tick
    setTimeout(() => saveRoom(roomId), 0);
  };

  const totalAssigned = assignments.filter(a => a.assigned_guest_name?.trim()).length;
  const totalPaid = assignments.filter(a => a.payment_completed_date).length;

  if (loading) return <div className="py-12 flex justify-center"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6 pb-32 animate-fade-up relative">
      {/* Summary */}
      <div className="flex flex-wrap gap-6">
        <div className="text-center">
          <p className="font-display text-3xl font-light text-foreground">{rooms.length}</p>
          <p className="font-body text-xs text-muted-foreground">Total rooms</p>
        </div>
        <div className="text-center">
          <p className="font-display text-3xl font-light text-sage-dark">{totalAssigned}</p>
          <p className="font-body text-xs text-muted-foreground">Assigned</p>
        </div>
        <div className="text-center">
          <p className="font-display text-3xl font-light text-forest-dark">{totalPaid}</p>
          <p className="font-body text-xs text-muted-foreground">Paid</p>
        </div>
        <div className="text-center">
          <p className="font-display text-3xl font-light text-muted-foreground">{rooms.length - totalAssigned}</p>
          <p className="font-body text-xs text-muted-foreground">Unassigned</p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs font-body text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-muted border border-border inline-block" />Available</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-sage/15 border border-sage/30 inline-block" />Assigned</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-forest/15 border border-forest/30 inline-block" />Paid</span>
      </div>

      {/* Sections */}
      {LODGING_SECTIONS.map(section => {
        const sectionRooms = rooms.filter(r => r.room_type === section.roomType);
        const coupleRoom = section.coupleRoomName ? sectionRooms.find(r => r.room_name === section.coupleRoomName) : null;
        const guestRooms = coupleRoom ? sectionRooms.filter(r => r.id !== coupleRoom.id) : sectionRooms;
        const sectionAssigned = guestRooms.filter(r => getAssignment(r.id)?.assigned_guest_name?.trim()).length;

        return (
          <Collapsible
            key={section.key}
            open={openSections[section.key]}
            onOpenChange={v => setOpenSections(p => ({ ...p, [section.key]: v }))}
          >
            <div className="rounded-xl border border-border bg-card shadow-soft overflow-hidden">
              <CollapsibleTrigger className="w-full px-5 py-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                <div className="text-left">
                  <p className="font-display text-xl font-light text-foreground">{section.title}</p>
                  <p className="font-body text-xs text-muted-foreground mt-0.5">
                    {section.subtitle} · {sectionRooms.length} rooms
                  </p>
                  <p className="font-body text-xs text-sage-dark mt-1">
                    {sectionAssigned} of {guestRooms.length} assigned
                  </p>
                </div>
                <ChevronDown size={18} className={`text-muted-foreground transition-transform ${openSections[section.key] ? "rotate-180" : ""}`} />
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="border-t border-border">
                  {/* Couple suite */}
                  {coupleRoom && (
                    <div className="px-5 py-3 bg-sage/6 border-b border-sage/15 flex items-center gap-2">
                      <Lock size={13} className="text-sage-dark" />
                      <span className="font-display text-sm text-foreground">{coupleRoom.room_name}</span>
                      <span className="ml-auto px-2 py-0.5 rounded-full bg-sage/20 text-sage-dark font-body text-[10px] uppercase tracking-wider font-medium">
                        Couple Suite
                      </span>
                    </div>
                  )}

                  {/* Room rows */}
                  {guestRooms.map((room, idx) => {
                    const a = getAssignment(room.id);
                    const roomStatus = getStatus(a);
                    const badge = STATUS_BADGE[roomStatus];

                    return (
                      <div key={room.id} className={`px-5 py-4 ${idx < guestRooms.length - 1 ? "border-b border-border" : ""}`}>
                        <div className="flex items-center justify-between mb-3">
                          <p className="font-display text-sm font-light text-foreground">{room.room_name}</p>
                          <span className={`font-body text-[10px] ${badge.cls}`}>{badge.label}</span>
                        </div>

                        {/* Core fields */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                          <div className="space-y-1">
                            <label className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">Guest Name</label>
                            <input
                              type="text"
                              value={a?.assigned_guest_name ?? ""}
                              onChange={e => handleFieldChange(room.id, "assigned_guest_name", e.target.value || null)}
                              placeholder="Full name"
                              className="w-full rounded-lg border border-border bg-background px-3 py-2 font-body text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">Guest Email</label>
                            <input
                              type="email"
                              value={a?.assigned_guest_email ?? ""}
                              onChange={e => handleFieldChange(room.id, "assigned_guest_email", e.target.value || null)}
                              placeholder="email@example.com"
                              className="w-full rounded-lg border border-border bg-background px-3 py-2 font-body text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                            />
                          </div>
                        </div>

                        {/* Admin fields */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                          <div className="flex items-center justify-between sm:col-span-1">
                            <div>
                              <p className="font-body text-xs text-foreground">Who pays?</p>
                              <p className="font-body text-[10px] text-muted-foreground">{a?.host_pays ? "Host" : "Guest"}</p>
                            </div>
                            <button
                              onClick={() => handleFieldChange(room.id, "host_pays", !(a?.host_pays))}
                              className={`relative w-11 h-6 rounded-full transition-colors ${a?.host_pays ? "bg-sage" : "bg-muted border border-border"}`}
                            >
                              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${a?.host_pays ? "translate-x-5" : "translate-x-0.5"}`} />
                            </button>
                          </div>
                          <div className="space-y-1">
                            <label className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">Payment Method</label>
                            <input
                              type="text"
                              value={a?.payment_method ?? ""}
                              onChange={e => handleFieldChange(room.id, "payment_method", e.target.value || null)}
                              placeholder="Venmo, check, etc."
                              className="w-full rounded-lg border border-border bg-background px-3 py-2 font-body text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">Payment Complete</label>
                            <input
                              type="date"
                              value={a?.payment_completed_date ?? ""}
                              onChange={e => handleFieldChange(room.id, "payment_completed_date", e.target.value || null)}
                              className="w-full rounded-lg border border-border bg-background px-3 py-2 font-body text-sm text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                            />
                          </div>
                        </div>

                        {/* Invoice toggles */}
                        <div className="flex flex-wrap gap-4 mb-3">
                          {([
                            { field: "invoice_1_sent" as const, label: "Invoice 1" },
                            { field: "invoice_2_sent" as const, label: "Invoice 2" },
                            { field: "invoice_final_sent" as const, label: "Final" },
                          ]).map(inv => (
                            <label key={inv.field} className="flex items-center gap-2 cursor-pointer">
                              <div
                                onClick={() => handleFieldChange(room.id, inv.field, !(a?.[inv.field]))}
                                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${a?.[inv.field] ? "bg-sage border-sage" : "border-border bg-background"}`}
                              >
                                {a?.[inv.field] && <Check size={9} className="text-white" />}
                              </div>
                              <span className="font-body text-xs text-foreground">{inv.label}</span>
                            </label>
                          ))}
                        </div>

                        {/* Notes */}
                        <div className="space-y-1">
                          <label className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">Internal Notes</label>
                          <textarea
                            value={a?.brandon_notes ?? ""}
                            onChange={e => handleFieldChange(room.id, "brandon_notes", e.target.value || null)}
                            rows={1}
                            placeholder="Notes…"
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 font-body text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 resize-none transition-colors"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}

      <AdminStickyFooter status={status} onSave={() => {}} onSaveAndContinue={() => onNavigateNext?.()} />
    </div>
  );
}
