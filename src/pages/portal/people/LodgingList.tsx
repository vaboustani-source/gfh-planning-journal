import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePortalData } from "@/hooks/usePortalData";
import { Save, Check, Loader2, ChevronDown, Lock } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { LODGING_SECTIONS, type LodgingSection, type SectionPaymentMode } from "@/lib/lodgingConfig";

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
  assigned_guest_name: string;
  assigned_guest_email: string;
  host_pays: boolean;
}

export function LodgingList() {
  const { eventId } = usePortalData();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    hearth_village: true, farmhouse: true, grove: true, victoria: true,
  });
  const [sectionModes, setSectionModes] = useState<Record<string, SectionPaymentMode>>({
    hearth_village: "mixed", farmhouse: "mixed", grove: "mixed", victoria: "mixed",
  });

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      const [{ data: rData }, { data: aData }] = await Promise.all([
        supabase.from("lodging_rooms").select("id, room_name, room_type, nightly_rate, sort_order").order("sort_order", { ascending: true }),
        supabase.from("lodging_assignments").select("id, room_id, assigned_guest_name, assigned_guest_email, host_pays").eq("event_id", eventId),
      ]);
      const allRooms = rData || [];
      let allAssignments = aData || [];
      setRooms(allRooms);

      // Auto-create placeholder rows for any rooms missing an assignment
      const assignedRoomIds = new Set(allAssignments.map(a => a.room_id));
      const missingRooms = allRooms.filter(r => !assignedRoomIds.has(r.id));
      if (missingRooms.length > 0) {
        const placeholders = missingRooms.map(r => ({
          event_id: eventId,
          room_id: r.id,
          assigned_guest_name: null,
          assigned_guest_email: null,
          host_pays: false,
        }));
        const { data: inserted } = await supabase
          .from("lodging_assignments")
          .insert(placeholders)
          .select("id, room_id, assigned_guest_name, assigned_guest_email, host_pays");
        if (inserted) {
          allAssignments = [...allAssignments, ...inserted];
        }
      }

      setAssignments(allAssignments.map(a => ({
        id: a.id,
        room_id: a.room_id,
        assigned_guest_name: a.assigned_guest_name ?? "",
        assigned_guest_email: a.assigned_guest_email ?? "",
        host_pays: a.host_pays ?? false,
      })));

      // Derive section modes from existing data
      const modes: Record<string, SectionPaymentMode> = {};
      for (const sec of LODGING_SECTIONS) {
        const secRoomIds = allRooms.filter(r => r.room_type === sec.roomType).map(r => r.id);
        const secAssignments = allAssignments.filter(a => a.room_id && secRoomIds.includes(a.room_id));
        const allHost = secAssignments.length > 0 && secAssignments.every(a => a.host_pays);
        const allGuest = secAssignments.length > 0 && secAssignments.every(a => !a.host_pays);
        modes[sec.key] = allHost ? "host" : allGuest ? "guest" : "mixed";
      }
      setSectionModes(modes);
      setLoading(false);
    })();
  }, [eventId]);

  const getAssignment = (roomId: string) => assignments.find(a => a.room_id === roomId);

  const updateField = useCallback((roomId: string, field: keyof Assignment, value: string | boolean) => {
    setAssignments(prev => {
      const existing = prev.find(a => a.room_id === roomId);
      if (existing) {
        return prev.map(a => a.room_id === roomId ? { ...a, [field]: value } : a);
      }
      return [...prev, { id: "", room_id: roomId, assigned_guest_name: "", assigned_guest_email: "", host_pays: false, [field]: value }];
    });
    setSaved(false);
  }, []);

  const handleSectionModeChange = (sectionKey: string, mode: SectionPaymentMode, sectionRoomIds: string[]) => {
    setSectionModes(prev => ({ ...prev, [sectionKey]: mode }));
    if (mode === "host" || mode === "guest") {
      const hostPays = mode === "host";
      setAssignments(prev => {
        const updated = [...prev];
        for (const rid of sectionRoomIds) {
          const idx = updated.findIndex(a => a.room_id === rid);
          if (idx >= 0) updated[idx] = { ...updated[idx], host_pays: hostPays };
        }
        return updated;
      });
    }
    setSaved(false);
  };

  const handleSave = async () => {
    if (!eventId) return;
    setSaving(true);
    const toSave = assignments.filter(a => a.room_id);
    await Promise.all(toSave.map(a => {
      const payload = {
        assigned_guest_name: a.assigned_guest_name || null,
        assigned_guest_email: a.assigned_guest_email || null,
        host_pays: a.host_pays,
      };
      if (a.id) {
        return supabase.from("lodging_assignments").update(payload).eq("id", a.id);
      }
      return supabase.from("lodging_assignments").insert({ ...payload, room_id: a.room_id, event_id: eventId });
    }));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleBlurSave = async (roomId: string) => {
    if (!eventId) return;
    const a = assignments.find(x => x.room_id === roomId);
    if (!a) return;
    const payload = {
      assigned_guest_name: a.assigned_guest_name || null,
      assigned_guest_email: a.assigned_guest_email || null,
      host_pays: a.host_pays,
    };
    if (a.id) {
      await supabase.from("lodging_assignments").update(payload).eq("id", a.id);
    } else {
      const { data } = await supabase.from("lodging_assignments").insert({ ...payload, room_id: roomId, event_id: eventId }).select().single();
      if (data) {
        setAssignments(prev => prev.map(x => x.room_id === roomId ? { ...x, id: data.id } : x));
      }
    }
  };

  const totalAssigned = assignments.filter(a => a.assigned_guest_name?.trim()).length;
  const totalGuestRooms = rooms.filter(r => !LODGING_SECTIONS.find(s => s.coupleRoomName && rooms.find(rm => rm.room_type === s.roomType && rm.room_name === s.coupleRoomName)?.id === r.id)).length;

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 pb-32">
      {/* Info box */}
      <div className="rounded-xl bg-sage/8 border border-sage/20 px-5 py-4">
        <p className="font-body text-sm text-foreground leading-relaxed">
          You're welcome to assign specific rooms to your guests, or simply let us know how many guests will be staying in each area and we'll handle the room assignments. Either way works perfectly.
        </p>
      </div>

      {/* Global summary */}
      <div className="rounded-xl bg-card border border-border px-5 py-4">
        <p className="font-body text-sm text-foreground font-medium">
          {totalAssigned} of {totalGuestRooms} guest rooms assigned
        </p>
      </div>

      {/* Sections */}
      {LODGING_SECTIONS.map(section => {
        const sectionRooms = rooms.filter(r => r.room_type === section.roomType);
        const coupleRoom = section.coupleRoomName ? sectionRooms.find(r => r.room_name === section.coupleRoomName) : null;
        const guestRooms = coupleRoom ? sectionRooms.filter(r => r.id !== coupleRoom.id) : sectionRooms;
        const sectionAssigned = guestRooms.filter(r => getAssignment(r.id)?.assigned_guest_name?.trim()).length;
        const mode = sectionModes[section.key];
        const guestRoomIds = guestRooms.map(r => r.id);

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
                  {/* Section payment mode */}
                  <div className="px-5 py-3 bg-muted/20 border-b border-border">
                    <p className="font-body text-xs text-muted-foreground uppercase tracking-widest mb-2">Payment for this section</p>
                    <div className="flex flex-wrap gap-2">
                      {([
                        { value: "host" as const, label: "We're covering all rooms" },
                        { value: "guest" as const, label: "Guests pay directly" },
                        { value: "mixed" as const, label: "Mixed — set each room" },
                      ]).map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => handleSectionModeChange(section.key, opt.value, guestRoomIds)}
                          className={`px-3 py-1.5 rounded-lg font-body text-xs transition-colors ${mode === opt.value ? "bg-primary text-primary-foreground" : "bg-background border border-border text-muted-foreground hover:text-foreground"}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Couple suite callout */}
                  {coupleRoom && (
                    <div className="px-5 py-3 bg-sage/6 border-b border-sage/15">
                      <p className="font-body text-xs text-sage-dark italic mb-2">
                        {coupleRoom.room_name} is your suite — it's already reserved for you as the couple.
                      </p>
                      <div className="flex items-center gap-2">
                        <Lock size={13} className="text-sage-dark" />
                        <span className="font-display text-sm text-foreground">{coupleRoom.room_name}</span>
                        <span className="ml-auto px-2 py-0.5 rounded-full bg-sage/20 text-sage-dark font-body text-[10px] uppercase tracking-wider font-medium">
                          Your Suite
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Room rows */}
                  {guestRooms.map((room, idx) => {
                    const a = getAssignment(room.id);
                    const isAssigned = !!a?.assigned_guest_name?.trim();

                    return (
                      <div key={room.id} className={`px-5 py-4 ${idx < guestRooms.length - 1 ? "border-b border-border" : ""}`}>
                        <div className="flex items-center justify-between mb-3">
                          <p className="font-display text-sm font-light text-foreground">{room.room_name}</p>
                          {!isAssigned && (
                            <span className="font-body text-[10px] text-muted-foreground/60 italic">Available</span>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <input
                            type="text"
                            value={a?.assigned_guest_name ?? ""}
                            onChange={e => updateField(room.id, "assigned_guest_name", e.target.value)}
                            onBlur={() => handleBlurSave(room.id)}
                            placeholder="Guest name"
                            maxLength={120}
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 font-body text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                          />
                          <input
                            type="email"
                            value={a?.assigned_guest_email ?? ""}
                            onChange={e => updateField(room.id, "assigned_guest_email", e.target.value)}
                            onBlur={() => handleBlurSave(room.id)}
                            placeholder="Guest email"
                            maxLength={255}
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 font-body text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                          />
                        </div>
                        {mode === "mixed" && (
                          <div className="flex items-center justify-between mt-3">
                            <p className="font-body text-xs text-muted-foreground">
                              {a?.host_pays ? "You're covering this room" : "Guest pays directly"}
                            </p>
                            <div className="flex rounded-lg border border-border overflow-hidden text-xs font-body shrink-0">
                              <button
                                onClick={() => { updateField(room.id, "host_pays", false); }}
                                className={`px-3 py-1.5 transition-colors ${!a?.host_pays ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}
                              >
                                Guest
                              </button>
                              <button
                                onClick={() => { updateField(room.id, "host_pays", true); }}
                                className={`px-3 py-1.5 transition-colors ${a?.host_pays ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}
                              >
                                Host
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 font-body text-sm font-medium text-primary-foreground hover:bg-sage-dark transition-colors disabled:opacity-60"
      >
        {saving ? (
          <><Loader2 size={15} className="animate-spin" /> Saving…</>
        ) : saved ? (
          <><Check size={15} /> Saved!</>
        ) : (
          <><Save size={15} /> Save Guest List</>
        )}
      </button>
    </div>
  );
}
