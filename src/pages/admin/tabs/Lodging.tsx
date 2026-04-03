import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Check } from "lucide-react";
import { useAutosaveStatus } from "@/hooks/useAutosaveStatus";
import AdminStickyFooter from "@/components/admin/AdminStickyFooter";

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
  payment_mode: string | null;
  payment_method: string | null;
  payment_completed_date: string | null;
  brandon_notes: string | null;
  invoice_1_sent: boolean | null;
  invoice_2_sent: boolean | null;
  invoice_final_sent: boolean | null;
}

function statusOf(room: Room, assignments: Assignment[]) {
  const a = assignments.find(x => x.room_id === room.id);
  if (!a) return "unassigned";
  if (a.payment_completed_date) return "paid";
  if (a.assigned_guest_name) return "assigned";
  return "unassigned";
}

const STATUS_STYLES: Record<string, string> = {
  unassigned: "bg-muted border-border text-muted-foreground",
  assigned: "bg-sage/15 border-sage/30 text-sage-dark",
  paid: "bg-forest/15 border-forest/30 text-forest-dark",
};

export default function LodgingTab({ eventId, onNavigateNext }: { eventId: string; onNavigateNext?: () => void }) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Room | null>(null);
  const [draft, setDraft] = useState<Assignment | null>(null);
  const [saving, setSaving] = useState(false);
  const { status, trackSave } = useAutosaveStatus();

  useEffect(() => { fetchAll(); }, [eventId]);

  const fetchAll = async () => {
    const [{ data: rData }, { data: aData }] = await Promise.all([
      supabase.from("lodging_rooms").select("*").order("sort_order", { ascending: true }),
      supabase.from("lodging_assignments").select("*").eq("event_id", eventId),
    ]);
    if (rData) setRooms(rData);
    if (aData) setAssignments(aData);
    setLoading(false);
  };

  const openRoom = (room: Room) => {
    setSelected(room);
    const existing = assignments.find(a => a.room_id === room.id);
    setDraft(existing ?? {
      id: "",
      room_id: room.id,
      event_id: eventId,
      assigned_guest_name: null,
      assigned_guest_email: null,
      host_pays: false,
      payment_mode: null,
      payment_method: null,
      payment_completed_date: null,
      brandon_notes: null,
      invoice_1_sent: false,
      invoice_2_sent: false,
      invoice_final_sent: false,
    });
  };

  const saveAssignment = async () => {
    if (!draft || !selected) return;
    setSaving(true);
    await trackSave(async () => {
      const existing = assignments.find(a => a.room_id === selected.id);
      const payload = { ...draft, event_id: eventId, room_id: selected.id };
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _id, ...withoutId } = payload;

      if (existing) {
        const { data } = await supabase.from("lodging_assignments").update(withoutId).eq("id", existing.id).select().single();
        if (data) setAssignments(prev => prev.map(a => a.id === existing.id ? data : a));
      } else {
        const { data } = await supabase.from("lodging_assignments").insert(withoutId).select().single();
        if (data) setAssignments(prev => [...prev, data]);
      }
    });
    setSaving(false);
    setSelected(null);
  };

  const assigned = assignments.filter(a => a.assigned_guest_name).length;
  const paid = assignments.filter(a => a.payment_completed_date).length;

  if (loading) return <div className="py-12 flex justify-center"><div className="w-6 h-6 rounded-full border-2 border-sage/30 border-t-sage animate-spin" /></div>;

  return (
    <div className="space-y-6 pb-24 animate-fade-up relative">
      {/* Summary */}
      <div className="flex flex-wrap gap-6">
        <div className="text-center">
          <p className="font-display text-3xl font-light text-foreground">{rooms.length}</p>
          <p className="font-body text-xs text-muted-foreground">Total rooms</p>
        </div>
        <div className="text-center">
          <p className="font-display text-3xl font-light text-sage-dark">{assigned}</p>
          <p className="font-body text-xs text-muted-foreground">Assigned</p>
        </div>
        <div className="text-center">
          <p className="font-display text-3xl font-light text-forest-dark">{paid}</p>
          <p className="font-body text-xs text-muted-foreground">Payment complete</p>
        </div>
        <div className="text-center">
          <p className="font-display text-3xl font-light text-muted-foreground">{rooms.length - assigned}</p>
          <p className="font-body text-xs text-muted-foreground">Unassigned</p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs font-body text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-muted border border-border inline-block" />Unassigned</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-sage/15 border border-sage/30 inline-block" />Assigned</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-forest/15 border border-forest/30 inline-block" />Payment complete</span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {rooms.map(room => {
          const rstatus = statusOf(room, assignments);
          const assignment = assignments.find(a => a.room_id === room.id);
          return (
            <button
              key={room.id}
              onClick={() => openRoom(room)}
              className={`rounded-xl border p-3 text-left hover:shadow-sm transition-all ${STATUS_STYLES[rstatus]}`}
            >
              <p className="font-body text-xs font-medium truncate">{room.room_name}</p>
              <p className="font-body text-[10px] capitalize mt-0.5 opacity-70">{room.room_type.replace(/_/g, " ")}</p>
              {assignment?.assigned_guest_name && (
                <p className="font-body text-[10px] mt-1 truncate opacity-80">{assignment.assigned_guest_name}</p>
              )}
              {room.nightly_rate && (
                <p className="font-body text-[10px] mt-1 opacity-60">${room.nightly_rate}/night</p>
              )}
            </button>
          );
        })}
      </div>

      {/* Drawer */}
      {selected && draft && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <p className="font-display text-lg font-light text-foreground">{selected.room_name}</p>
                <p className="font-body text-xs text-muted-foreground capitalize">{selected.room_type.replace(/_/g, " ")}{selected.nightly_rate ? ` · $${selected.nightly_rate}/night` : ""}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground">
                <X size={18} />
              </button>
            </div>

            <div className="px-5 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
              {([
                { label: "Guest Name", field: "assigned_guest_name" as keyof Assignment, type: "text", placeholder: "Full name" },
                { label: "Guest Email", field: "assigned_guest_email" as keyof Assignment, type: "email", placeholder: "email@example.com" },
              ]).map(({ label, field, type, placeholder }) => (
                <div key={field}>
                  <p className="font-body text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
                  <input
                    type={type}
                    value={(draft[field] as string) || ""}
                    onChange={e => setDraft(d => d ? { ...d, [field]: e.target.value || null } : d)}
                    placeholder={placeholder}
                    className="w-full border border-border rounded-md px-3 py-2 font-body text-sm bg-background focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                  />
                </div>
              ))}

              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-body text-sm text-foreground">Who pays for this room?</p>
                  <p className="font-body text-xs text-muted-foreground">{draft.host_pays ? "Couple (host) pays" : "Guest pays directly"}</p>
                </div>
                <button
                  onClick={() => setDraft(d => d ? { ...d, host_pays: !d.host_pays } : d)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${draft.host_pays ? "bg-sage" : "bg-muted border border-border"}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${draft.host_pays ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>

              <div>
                <p className="font-body text-xs text-muted-foreground uppercase tracking-wider mb-1">Payment Method</p>
                <input
                  value={draft.payment_method || ""}
                  onChange={e => setDraft(d => d ? { ...d, payment_method: e.target.value || null } : d)}
                  placeholder="e.g. Venmo, check, credit card"
                  className="w-full border border-border rounded-md px-3 py-2 font-body text-sm bg-background focus:outline-none focus:border-primary/50"
                />
              </div>

              <div>
                <p className="font-body text-xs text-muted-foreground uppercase tracking-wider mb-1">Payment Complete Date</p>
                <input
                  type="date"
                  value={draft.payment_completed_date || ""}
                  onChange={e => setDraft(d => d ? { ...d, payment_completed_date: e.target.value || null } : d)}
                  className="w-full border border-border rounded-md px-3 py-2 font-body text-sm bg-background focus:outline-none focus:border-primary/50"
                />
              </div>

              <div className="space-y-2">
                <p className="font-body text-xs text-muted-foreground uppercase tracking-wider">Invoices</p>
                {([
                  { field: "invoice_1_sent" as keyof Assignment, label: "Invoice 1 sent" },
                  { field: "invoice_2_sent" as keyof Assignment, label: "Invoice 2 sent" },
                  { field: "invoice_final_sent" as keyof Assignment, label: "Final invoice sent" },
                ]).map(({ field, label }) => (
                  <label key={field} className="flex items-center gap-3 cursor-pointer">
                    <div
                      onClick={() => setDraft(d => d ? { ...d, [field]: !d[field] } : d)}
                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${draft[field] ? "bg-sage border-sage" : "border-border bg-background"}`}
                    >
                      {draft[field] && <Check size={9} className="text-white" />}
                    </div>
                    <span className="font-body text-sm text-foreground">{label}</span>
                  </label>
                ))}
              </div>

              <div>
                <p className="font-body text-xs text-muted-foreground uppercase tracking-wider mb-1">Notes</p>
                <textarea
                  value={draft.brandon_notes || ""}
                  onChange={e => setDraft(d => d ? { ...d, brandon_notes: e.target.value || null } : d)}
                  rows={2}
                  placeholder="Internal notes…"
                  className="w-full border border-border rounded-md px-3 py-2 font-body text-sm bg-background focus:outline-none focus:border-primary/50 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 px-5 py-4 border-t border-border">
              <button onClick={() => setSelected(null)} className="flex-1 py-2.5 rounded-xl border border-border font-body text-sm text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </button>
              <button
                onClick={saveAssignment}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-sage text-white font-body text-sm hover:bg-sage/90 transition-colors disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Assignment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
