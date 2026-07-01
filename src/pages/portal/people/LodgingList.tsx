import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePortalData } from "@/hooks/usePortalData";
import { useAuth } from "@/hooks/useAuth";
import { Check, Loader2, ChevronDown, Lock, Upload, Map as MapIcon } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { LODGING_SECTIONS, type SectionPaymentMode } from "@/lib/lodgingConfig";
import { canEdit } from "@/lib/permissions";
import { toast } from "sonner";

const db = supabase as any;

interface LodgingSectionRow {
  id: string;
  section_key: string;
  name: string;
  map_image_url: string | null;
}


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

interface GuestOption {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  rsvp_status: string;
  lodging_preference: string | null;
}

type SaveStatus = "idle" | "saving" | "saved";

const guestName = (guest: GuestOption) => `${guest.first_name} ${guest.last_name}`.trim();

export function LodgingList() {
  const { eventId } = usePortalData();
  const { profile } = useAuth();
  const isAdmin = canEdit(profile?.role, "our_people");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [guests, setGuests] = useState<GuestOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    hearth_village: true, farmhouse: true, grove: true, victoria: true,
  });
  const [sectionModes, setSectionModes] = useState<Record<string, SectionPaymentMode>>({
    hearth_village: "mixed", farmhouse: "mixed", grove: "mixed", victoria: "mixed",
  });
  const [sectionRows, setSectionRows] = useState<Record<string, LodgingSectionRow>>({});
  const [mapUrls, setMapUrls] = useState<Record<string, string>>({});
  const [mapOpen, setMapOpen] = useState<Record<string, boolean>>({});
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);


  // Refs to avoid stale closures and prevent refetch during edits
  const assignmentsRef = useRef<Assignment[]>([]);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pendingCount = useRef(0);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { assignmentsRef.current = assignments; }, [assignments]);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    (async () => {
      const [{ data: rData }, { data: aData }, { data: gData }] = await Promise.all([
        supabase.from("lodging_rooms").select("id, room_name, room_type, nightly_rate, sort_order").order("sort_order", { ascending: true }),
        supabase.from("lodging_assignments").select("id, room_id, assigned_guest_name, assigned_guest_email, host_pays").eq("event_id", eventId),
        db.from("guests").select("id, first_name, last_name, email, rsvp_status, lodging_preference").eq("event_id", eventId).order("last_name").order("first_name"),
      ]);
      if (cancelled) return;
      const allRooms = rData || [];
      let allAssignments = aData || [];
      setRooms(allRooms);
      setGuests((gData ?? []) as GuestOption[]);

      const assignedRoomIds = new Set(allAssignments.map(a => a.room_id));
      const missingRooms = allRooms.filter(r => !assignedRoomIds.has(r.id));
      if (missingRooms.length > 0) {
        const placeholders = missingRooms.map(r => ({
          event_id: eventId, room_id: r.id,
          assigned_guest_name: null, assigned_guest_email: null, host_pays: false,
        }));
        const { data: inserted } = await supabase
          .from("lodging_assignments").insert(placeholders)
          .select("id, room_id, assigned_guest_name, assigned_guest_email, host_pays");
        if (inserted) allAssignments = [...allAssignments, ...inserted];
      }

      setAssignments(allAssignments.map(a => ({
        id: a.id,
        room_id: a.room_id,
        assigned_guest_name: a.assigned_guest_name ?? "",
        assigned_guest_email: a.assigned_guest_email ?? "",
        host_pays: a.host_pays ?? false,
      })));

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
    return () => { cancelled = true; };
  }, [eventId]);

  // Load lodging_sections rows and signed URLs for any uploaded maps
  const loadSections = useCallback(async () => {
    const { data } = await db.from("lodging_sections").select("id, section_key, name, map_image_url");
    const rows = (data ?? []) as LodgingSectionRow[];
    const byKey: Record<string, LodgingSectionRow> = {};
    rows.forEach(r => { byKey[r.section_key] = r; });
    setSectionRows(byKey);

    const urls: Record<string, string> = {};
    await Promise.all(rows.map(async r => {
      if (!r.map_image_url) return;
      const { data: signed } = await supabase.storage.from("lodging-maps").createSignedUrl(r.map_image_url, 60 * 60 * 24);
      if (signed?.signedUrl) urls[r.section_key] = signed.signedUrl;
    }));
    setMapUrls(urls);
  }, []);

  useEffect(() => { loadSections(); }, [loadSections]);

  const toggleMap = useCallback((key: string) => {
    setMapOpen(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleMapUpload = useCallback(async (sectionKey: string, sectionName: string, file: File) => {
    if (!isAdmin) return;
    const row = sectionRows[sectionKey];
    if (!row) return;
    setUploadingKey(sectionKey);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${sectionKey}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("lodging-maps").upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      const { error: updErr } = await db.from("lodging_sections").update({ map_image_url: path }).eq("id", row.id);
      if (updErr) throw updErr;

      const wasReplace = !!row.map_image_url;
      await db.from("change_history").insert({
        table_name: "lodging_sections",
        record_id: row.id,
        action: `${wasReplace ? "Replaced" : "Uploaded"} map for ${sectionName}`,
        changed_by: profile?.id ?? null,
      });

      const { data: signed } = await supabase.storage.from("lodging-maps").createSignedUrl(path, 60 * 60 * 24);
      setSectionRows(prev => ({ ...prev, [sectionKey]: { ...row, map_image_url: path } }));
      if (signed?.signedUrl) setMapUrls(prev => ({ ...prev, [sectionKey]: signed.signedUrl }));
      setMapOpen(prev => ({ ...prev, [sectionKey]: true }));
      toast.success(`${wasReplace ? "Map replaced" : "Map uploaded"}`);
    } catch (e: any) {
      toast.error(e?.message || "Couldn't upload map");
    } finally {
      setUploadingKey(null);
    }
  }, [isAdmin, sectionRows, profile?.id]);



  const flashSaved = useCallback(() => {
    setSaveStatus("saved");
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaveStatus("idle"), 1500);
  }, []);

  const applyAssignments = useCallback((updater: (prev: Assignment[]) => Assignment[]) => {
    const next = updater(assignmentsRef.current);
    assignmentsRef.current = next;
    setAssignments(next);
  }, []);

  const persistRow = useCallback(async (roomId: string, revertOnFail?: () => void) => {
    if (!eventId) return;
    const a = assignmentsRef.current.find(x => x.room_id === roomId);
    if (!a) return;
    const payload = {
      assigned_guest_name: a.assigned_guest_name || null,
      assigned_guest_email: a.assigned_guest_email || null,
      host_pays: a.host_pays,
    };
    pendingCount.current += 1;
    setSaveStatus("saving");
    try {
      if (a.id) {
        const { error } = await supabase.from("lodging_assignments").update(payload).eq("id", a.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("lodging_assignments")
          .insert({ ...payload, room_id: roomId, event_id: eventId })
          .select().single();
        if (error) throw error;
        if (data) applyAssignments(prev => prev.map(x => x.room_id === roomId ? { ...x, id: data.id } : x));
      }
    } catch (e) {
      revertOnFail?.();
      toast.error("Couldn't save — please try again");
    } finally {
      pendingCount.current = Math.max(0, pendingCount.current - 1);
      if (pendingCount.current === 0) flashSaved();
    }
  }, [applyAssignments, eventId, flashSaved]);

  const scheduleSave = useCallback((roomId: string, delay = 500) => {
    setSaveStatus("saving");
    if (saveTimers.current[roomId]) clearTimeout(saveTimers.current[roomId]);
    saveTimers.current[roomId] = setTimeout(() => {
      delete saveTimers.current[roomId];
      persistRow(roomId);
    }, delay);
  }, [persistRow]);

  const updateText = useCallback((roomId: string, field: "assigned_guest_name" | "assigned_guest_email", value: string) => {
    applyAssignments(prev => {
      const exists = prev.find(a => a.room_id === roomId);
      if (exists) return prev.map(a => a.room_id === roomId ? { ...a, [field]: value } : a);
      return [...prev, { id: "", room_id: roomId, assigned_guest_name: "", assigned_guest_email: "", host_pays: false, [field]: value }];
    });
    scheduleSave(roomId, 500);
  }, [applyAssignments, scheduleSave]);

  const updateGuestName = useCallback((roomId: string, value: string) => {
    const match = guests.find(g => guestName(g).toLowerCase() === value.trim().toLowerCase());
    applyAssignments(prev => {
      const exists = prev.find(a => a.room_id === roomId);
      if (exists) {
        return prev.map(a => a.room_id === roomId ? {
          ...a,
          assigned_guest_name: value,
          assigned_guest_email: match?.email ?? a.assigned_guest_email,
        } : a);
      }
      return [{ id: "", room_id: roomId, assigned_guest_name: value, assigned_guest_email: match?.email ?? "", host_pays: false }, ...prev];
    });
    scheduleSave(roomId, 500);
  }, [applyAssignments, guests, scheduleSave]);

  const setHostPays = useCallback((roomId: string, hostPays: boolean) => {
    const prevVal = assignmentsRef.current.find(a => a.room_id === roomId)?.host_pays ?? false;
    if (prevVal === hostPays) return;
    applyAssignments(prev => {
      const exists = prev.find(a => a.room_id === roomId);
      if (exists) return prev.map(a => a.room_id === roomId ? { ...a, host_pays: hostPays } : a);
      return [...prev, { id: "", room_id: roomId, assigned_guest_name: "", assigned_guest_email: "", host_pays: hostPays }];
    });
    // Cancel any pending debounced save for this row, save immediately
    if (saveTimers.current[roomId]) { clearTimeout(saveTimers.current[roomId]); delete saveTimers.current[roomId]; }
    persistRow(roomId, () => {
      applyAssignments(prev => prev.map(a => a.room_id === roomId ? { ...a, host_pays: prevVal } : a));
    });
  }, [applyAssignments, persistRow]);

  const handleSectionModeChange = useCallback((sectionKey: string, mode: SectionPaymentMode, sectionRoomIds: string[]) => {
    setSectionModes(prev => ({ ...prev, [sectionKey]: mode }));
    if (mode === "host" || mode === "guest") {
      const hostPays = mode === "host";
      for (const rid of sectionRoomIds) setHostPays(rid, hostPays);
    }
  }, [setHostPays]);

  const getAssignment = (roomId: string) => assignments.find(a => a.room_id === roomId);

  const totalAssigned = assignments.filter(a => a.assigned_guest_name?.trim()).length;
  const totalGuestRooms = rooms.filter(r => !LODGING_SECTIONS.find(s => s.coupleRoomName && rooms.find(rm => rm.room_type === s.roomType && rm.room_name === s.coupleRoomName)?.id === r.id)).length;
  const stillNeedsRoom = useMemo(() => {
    const assigned = new Set(assignments.flatMap(a => [a.assigned_guest_email?.trim().toLowerCase(), a.assigned_guest_name?.trim().toLowerCase()].filter(Boolean)));
    return guests.filter(g => {
      if (g.rsvp_status !== "confirmed" || g.lodging_preference !== "on_site") return false;
      return !assigned.has((g.email ?? "").trim().toLowerCase()) && !assigned.has(guestName(g).toLowerCase());
    }).length;
  }, [assignments, guests]);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 pb-32">
      <div className="rounded-xl bg-sage/8 border border-sage/20 px-5 py-4">
        <p className="font-body text-sm text-foreground leading-relaxed">
          You're welcome to assign specific rooms to your guests, or simply let us know how many guests will be staying in each area and we'll handle the room assignments. Either way works perfectly.
        </p>
      </div>

      <div className="rounded-xl bg-card border border-border px-5 py-4 flex items-center justify-between">
        <div>
          <p className="font-body text-sm text-foreground font-medium">
            {totalAssigned} of {totalGuestRooms} guest rooms assigned
          </p>
          <p className="font-body text-xs text-muted-foreground mt-1">
            Still needs a room: {stillNeedsRoom} confirmed on-site guest{stillNeedsRoom === 1 ? "" : "s"}
          </p>
        </div>
        <div className="font-body text-xs text-muted-foreground h-4 min-w-[70px] text-right" aria-live="polite">
          {saveStatus === "saving" && (<span className="inline-flex items-center gap-1.5"><Loader2 size={11} className="animate-spin" /> Saving…</span>)}
          {saveStatus === "saved" && (<span className="inline-flex items-center gap-1.5 text-sage-dark"><Check size={11} /> Saved</span>)}
        </div>
      </div>

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
                  {mapUrls[section.key] && (
                    <div className="px-5 py-3 border-b border-border flex flex-wrap items-center gap-4">
                      <button
                        type="button"
                        onClick={() => toggleMap(section.key)}
                        className="inline-flex items-center gap-1.5 font-body text-xs text-sage-dark hover:text-foreground transition-colors underline underline-offset-4 decoration-sage/40 hover:decoration-foreground/60"
                        aria-expanded={!!mapOpen[section.key]}
                      >
                        <MapIcon size={12} />
                        {mapOpen[section.key] ? "Hide map" : "View map"}
                      </button>
                    </div>
                  )}
                  <div
                    className={`overflow-hidden transition-all duration-300 ease-out ${mapUrls[section.key] && mapOpen[section.key] ? "max-h-[2400px] opacity-100" : "max-h-0 opacity-0"}`}
                  >
                    {mapUrls[section.key] && (
                      <div className="px-5 py-4 border-b border-border bg-muted/10">
                        <img
                          src={mapUrls[section.key]}
                          alt={`${section.title} property map`}
                          className="w-full h-auto rounded-lg border border-border"
                        />
                      </div>
                    )}
                  </div>

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
                          type="button"
                          onClick={() => handleSectionModeChange(section.key, opt.value, guestRoomIds)}
                          className={`px-3 py-1.5 rounded-lg font-body text-xs transition-colors ${mode === opt.value ? "bg-primary text-primary-foreground" : "bg-background border border-border text-muted-foreground hover:text-foreground"}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

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
                          <div>
                            <input
                              type="text"
                              list={`guest-options-${room.id}`}
                              value={a?.assigned_guest_name ?? ""}
                              onChange={e => updateGuestName(room.id, e.target.value)}
                              placeholder="Guest name"
                              maxLength={120}
                              autoComplete="off"
                              className="w-full rounded-lg border border-border bg-background px-3 py-2 font-body text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                            />
                            <datalist id={`guest-options-${room.id}`}>
                              {guests.map(guest => <option key={guest.id} value={guestName(guest)} />)}
                            </datalist>
                          </div>
                          <input
                            type="email"
                            value={a?.assigned_guest_email ?? ""}
                            onChange={e => updateText(room.id, "assigned_guest_email", e.target.value)}
                            placeholder="Guest email"
                            maxLength={255}
                            autoComplete="off"
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 font-body text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                          />
                        </div>
                        {mode === "mixed" && (
                          <div className="flex items-center justify-between gap-3 mt-3">
                            <p className="font-body text-xs text-muted-foreground">
                              {a?.host_pays ? "You're covering this room" : "Guest pays directly"}
                            </p>
                            <div className="inline-grid grid-cols-2 items-stretch rounded-lg border border-border bg-background p-0.5 text-xs font-body shrink-0 min-w-[112px]">
                              <button
                                type="button"
                                onClick={() => setHostPays(room.id, false)}
                                className={`h-7 rounded-md px-3 leading-none transition-colors ${!a?.host_pays ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                              >
                                Guest
                              </button>
                              <button
                                type="button"
                                onClick={() => setHostPays(room.id, true)}
                                className={`h-7 rounded-md px-3 leading-none transition-colors ${a?.host_pays ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
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
    </div>
  );
}
