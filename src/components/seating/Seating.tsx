import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Armchair, Upload, Printer, Search, X, ChevronDown, ChevronUp,
  Accessibility, HandHelping, Baby, Image as ImageIcon, Replace, AlertTriangle,
} from "lucide-react";

const db = supabase as any;

const TABLE_COLORS = [
  "#2C3E2D", "#5A7150", "#8B6F3C", "#C9A84C", "#6B7A8F",
  "#94633E", "#3F5A6B", "#7A8B5A", "#A47148", "#4E5D52",
];

interface SeatingConfig {
  event_id: string;
  layout_image_url: string | null;
  table_count: number;
  seating_mode: "table_only" | "individual_seats";
}

interface SeatingTable {
  id: string;
  event_id: string;
  table_number: number | null;
  label: string | null;
  seat_count: number;
  color: string;
  sort_order: number | null;
}

interface Guest {
  id: string;
  first_name: string;
  last_name: string;
  relationship: string | null;
  dietary_restrictions: string[] | null;
  needs_wheelchair: boolean;
  needs_assistance: boolean;
}

interface Assignment {
  id: string;
  event_id: string;
  guest_id: string | null;
  table_id: string | null;
  seat_number: number | null;
  guest_name: string | null;
}

const isChild = (g: Guest) => {
  const r = (g.relationship ?? "").toLowerCase();
  return r.includes("child") || r.includes("kid") || r.includes("baby") || r.includes("infant");
};
const fullName = (g: Guest) => `${g.first_name ?? ""} ${g.last_name ?? ""}`.trim();

export default function Seating({ eventId }: { eventId: string }) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";

  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<SeatingConfig | null>(null);
  const [tables, setTables] = useState<SeatingTable[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [floorPlanOpen, setFloorPlanOpen] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(true);
  const [reduceWarn, setReduceWarn] = useState<{ target: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [cfg, tbls, gs, asgs] = await Promise.all([
      db.from("seating_config").select("*").eq("event_id", eventId).maybeSingle(),
      db.from("seating_tables").select("*").eq("event_id", eventId).order("table_number"),
      db.from("guests").select("id,first_name,last_name,relationship,dietary_restrictions,needs_wheelchair,needs_assistance").eq("event_id", eventId).order("last_name").order("first_name"),
      db.from("seating_assignments").select("id,event_id,guest_id,table_id,seat_number,guest_name").eq("event_id", eventId),
    ]);
    setConfig((cfg.data as SeatingConfig) ?? null);
    setTables((tbls.data as SeatingTable[]) ?? []);
    setGuests((gs.data as Guest[]) ?? []);
    setAssignments((asgs.data as Assignment[]) ?? []);
    setLoading(false);
  }, [eventId]);

  useEffect(() => { void load(); }, [load]);

  const seatedGuestIds = useMemo(
    () => new Set(assignments.filter(a => a.guest_id && a.table_id).map(a => a.guest_id!)),
    [assignments]
  );

  const unseated = useMemo(() => {
    const q = search.trim().toLowerCase();
    return guests
      .filter(g => !seatedGuestIds.has(g.id))
      .filter(g => !q || fullName(g).toLowerCase().includes(q));
  }, [guests, seatedGuestIds, search]);

  const upsertConfig = async (patch: Partial<SeatingConfig>) => {
    const next = { event_id: eventId, layout_image_url: null, table_count: 0, seating_mode: "table_only" as const, ...config, ...patch };
    setConfig(next);
    const { error } = await db.from("seating_config").upsert(next, { onConflict: "event_id" });
    if (error) toast.error("Could not save settings");
  };

  const uploadFloorPlan = async (file: File) => {
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${eventId}/floor-plan-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("seating-layouts").upload(path, file, { upsert: true });
    if (error) return toast.error("Upload failed");
    const { data } = supabase.storage.from("seating-layouts").getPublicUrl(path);
    await upsertConfig({ layout_image_url: data.publicUrl });
    toast.success("Floor plan uploaded");
  };

  const applyTableCount = async (target: number) => {
    const current = tables.length;
    if (target === current) return;
    if (target < current) {
      const removed = tables.slice(target);
      const hasAssignments = removed.some(t => assignments.some(a => a.table_id === t.id));
      if (hasAssignments && !reduceWarn) { setReduceWarn({ target }); return; }
      const ids = removed.map(t => t.id);
      await db.from("seating_assignments").delete().in("table_id", ids);
      await db.from("seating_tables").delete().in("id", ids);
    } else {
      const rows = [];
      for (let i = current; i < target; i++) {
        rows.push({
          event_id: eventId,
          table_number: i + 1,
          seat_count: 10,
          color: TABLE_COLORS[i % TABLE_COLORS.length],
          table_name: `Table ${i + 1}`,
          table_type: "round",
          capacity: 10,
          sort_order: i + 1,
        });
      }
      await db.from("seating_tables").insert(rows);
    }
    await upsertConfig({ table_count: target });
    setReduceWarn(null);
    await load();
  };

  const updateTable = async (id: string, patch: Partial<SeatingTable>) => {
    setTables(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
    const dbPatch: any = { ...patch };
    if (patch.seat_count !== undefined) dbPatch.capacity = patch.seat_count;
    if (patch.label !== undefined) dbPatch.table_name = patch.label || `Table ${tables.find(t => t.id === id)?.table_number ?? ""}`;
    await db.from("seating_tables").update(dbPatch).eq("id", id);
  };

  const setSeatingMode = (mode: "table_only" | "individual_seats") => upsertConfig({ seating_mode: mode });

  const toggleGuestFlag = async (id: string, field: "needs_wheelchair" | "needs_assistance", value: boolean) => {
    setGuests(prev => prev.map(g => g.id === id ? { ...g, [field]: value } : g));
    await db.from("guests").update({ [field]: value }).eq("id", id);
  };

  const assignGuest = async (guestId: string, tableId: string, seatNumber: number | null = null) => {
    const guest = guests.find(g => g.id === guestId);
    if (!guest) return;
    // If seat-specific, remove anyone else in that seat
    if (seatNumber != null) {
      const occupied = assignments.find(a => a.table_id === tableId && a.seat_number === seatNumber);
      if (occupied) {
        await db.from("seating_assignments").delete().eq("id", occupied.id);
        setAssignments(prev => prev.filter(a => a.id !== occupied.id));
      }
    }
    // Remove any existing assignment for this guest
    const existing = assignments.find(a => a.guest_id === guestId);
    if (existing) {
      await db.from("seating_assignments").delete().eq("id", existing.id);
      setAssignments(prev => prev.filter(a => a.id !== existing.id));
    }
    const { data, error } = await db.from("seating_assignments").insert({
      event_id: eventId, guest_id: guestId, table_id: tableId, seat_number: seatNumber,
      guest_name: fullName(guest), source: "manual",
    }).select().single();
    if (error) return toast.error(error.message);
    setAssignments(prev => [...prev, data as Assignment]);
    setSelectedGuestId(null);
  };

  const unassign = async (assignmentId: string) => {
    setAssignments(prev => prev.filter(a => a.id !== assignmentId));
    await db.from("seating_assignments").delete().eq("id", assignmentId);
  };

  const seatedCount = assignments.filter(a => a.table_id).length;
  const totalGuests = guests.length;

  if (loading) {
    return <div className="py-12 text-center font-body text-sm" style={{ color: "#6B6B6B" }}>Loading seating…</div>;
  }

  return (
    <div className="space-y-8" style={{ color: "#1A1A1A" }}>
      {/* Admin Setup */}
      {isAdmin && (
        <section className="rounded-lg border bg-white shadow-sm" style={{ borderColor: "#E8E2D9" }}>
          <button
            type="button"
            onClick={() => setAdminOpen(o => !o)}
            className="w-full flex items-center justify-between px-5 py-4"
          >
            <div className="text-left">
              <p className="font-body text-[11px] tracking-widest uppercase" style={{ color: "#6B6B6B" }}>Admin setup</p>
              <h3 className="font-display text-2xl font-light" style={{ color: "#1A1A1A" }}>Floor Plan & Tables</h3>
            </div>
            {adminOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          {adminOpen && (
            <div className="px-5 pb-5 space-y-6">
              {/* Floor plan upload */}
              <div>
                <p className="font-body text-sm font-medium mb-2">Floor Plan</p>
                {config?.layout_image_url ? (
                  <div className="rounded border p-3 bg-white" style={{ borderColor: "#E8E2D9" }}>
                    <img src={config.layout_image_url} alt="Floor plan" className="w-full max-h-[420px] object-contain mx-auto" />
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 font-body text-xs border" style={{ borderColor: "#E8E2D9" }}>
                        <Replace size={12} /> Replace
                      </button>
                      <button onClick={() => upsertConfig({ layout_image_url: null })} className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 font-body text-xs" style={{ color: "#C0392B" }}>
                        <X size={12} /> Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="w-full rounded border-2 border-dashed py-10 flex flex-col items-center gap-2 hover:bg-[#FAF8F4] transition-colors"
                    style={{ borderColor: "#E8E2D9", color: "#6B6B6B" }}
                  >
                    <Upload size={20} />
                    <span className="font-body text-sm">Upload floor plan (PNG or JPG)</span>
                  </button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) void uploadFloorPlan(f); e.target.value = ""; }}
                />
              </div>

              {/* Table count */}
              <div className="flex flex-wrap gap-6">
                <div>
                  <p className="font-body text-sm font-medium mb-2">Number of tables</p>
                  <TableCountInput current={tables.length} onApply={applyTableCount} />
                </div>
                <div>
                  <p className="font-body text-sm font-medium mb-2">Seating style</p>
                  <div className="inline-flex rounded border overflow-hidden" style={{ borderColor: "#E8E2D9" }}>
                    {(["table_only", "individual_seats"] as const).map(m => {
                      const active = (config?.seating_mode ?? "table_only") === m;
                      return (
                        <button
                          key={m}
                          onClick={() => setSeatingMode(m)}
                          className="px-3 py-2 font-body text-xs"
                          style={{
                            background: active ? "#2C3E2D" : "#FFFFFF",
                            color: active ? "#FFFFFF" : "#1A1A1A",
                          }}
                        >
                          {m === "table_only" ? "By table only" : "By individual seat"}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Per-table editing */}
              {tables.length > 0 && (
                <div>
                  <p className="font-body text-sm font-medium mb-2">Tables</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {tables.map(t => (
                      <div key={t.id} className="rounded border p-3" style={{ borderColor: "#E8E2D9" }}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-4 h-4 rounded" style={{ background: t.color }} />
                          <span className="font-display text-base">Table {t.table_number}</span>
                        </div>
                        <label className="block font-body text-[11px] uppercase tracking-wider mb-1" style={{ color: "#6B6B6B" }}>Label</label>
                        <input
                          defaultValue={t.label ?? ""}
                          placeholder="e.g. Head Table"
                          onBlur={e => { if (e.target.value !== (t.label ?? "")) void updateTable(t.id, { label: e.target.value || null }); }}
                          className="w-full rounded border px-2 py-1.5 font-body text-sm mb-2"
                          style={{ borderColor: "#E8E2D9" }}
                        />
                        <label className="block font-body text-[11px] uppercase tracking-wider mb-1" style={{ color: "#6B6B6B" }}>Seats</label>
                        <input
                          type="number"
                          min={1}
                          defaultValue={t.seat_count}
                          onBlur={e => { const v = Number(e.target.value); if (v && v !== t.seat_count) void updateTable(t.id, { seat_count: v }); }}
                          className="w-full rounded border px-2 py-1.5 font-body text-sm"
                          style={{ borderColor: "#E8E2D9" }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Reduce warning */}
      {reduceWarn && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle style={{ color: "#C0392B" }} />
              <div>
                <p className="font-display text-xl">Remove tables with assigned guests?</p>
                <p className="font-body text-sm mt-1" style={{ color: "#6B6B6B" }}>
                  Reducing to {reduceWarn.target} tables will unseat guests at the removed tables.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setReduceWarn(null)} className="px-4 py-2 rounded border font-body text-sm" style={{ borderColor: "#E8E2D9" }}>Cancel</button>
              <button onClick={() => { const t = reduceWarn.target; setReduceWarn({ target: t, confirmed: true } as any); void applyTableCount(t); }} className="px-4 py-2 rounded font-body text-sm" style={{ background: "#C0392B", color: "#FFFFFF" }}>Remove tables</button>
            </div>
          </div>
        </div>
      )}

      {/* Empty state: no floor plan */}
      {!config?.layout_image_url && !isAdmin && (
        <section className="rounded-lg border bg-white p-12 text-center" style={{ borderColor: "#E8E2D9" }}>
          <ImageIcon size={28} className="mx-auto mb-3" style={{ color: "#6B6B6B" }} />
          <p className="font-display text-2xl font-light mb-1">Your seating is being arranged</p>
          <p className="font-body text-sm" style={{ color: "#6B6B6B" }}>Brandon will upload your floor plan and tables soon.</p>
        </section>
      )}

      {/* Assignment view */}
      {tables.length > 0 && (
        <section className="space-y-5">
          {/* Floor plan reference */}
          {config?.layout_image_url && (
            <div className="rounded-lg border bg-white" style={{ borderColor: "#E8E2D9" }}>
              <button
                onClick={() => setFloorPlanOpen(o => !o)}
                className="w-full flex items-center justify-between px-5 py-3"
              >
                <span className="font-body text-sm font-medium">Floor plan reference</span>
                {floorPlanOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {floorPlanOpen && (
                <div className="px-5 pb-5">
                  <img src={config.layout_image_url} alt="Floor plan" className="w-full max-h-[420px] object-contain mx-auto" />
                </div>
              )}
            </div>
          )}

          {/* Header / counts / print */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-body text-[11px] tracking-widest uppercase" style={{ color: "#6B6B6B" }}>Seating chart</p>
              <h2 className="font-display text-3xl font-light">Place your guests</h2>
              <p className="font-body text-sm" style={{ color: "#6B6B6B" }}>
                {seatedCount} seated · {totalGuests - seatedCount} unseated · {totalGuests} total
              </p>
            </div>
            <button
              onClick={() => setPrintOpen(true)}
              className="inline-flex items-center gap-2 rounded px-4 py-2 font-body text-sm border"
              style={{ borderColor: "#E8E2D9", color: "#1A1A1A" }}
            >
              <Printer size={14} /> Print seating chart
            </button>
          </div>

          {seatedCount === 0 && (
            <div className="rounded border bg-white px-5 py-4 font-body text-sm" style={{ borderColor: "#E8E2D9", color: "#6B6B6B" }}>
              No one is seated yet. Start placing guests.
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.5fr)] gap-5">
            {/* Left pane: unseated guests */}
            <div className="rounded-lg border bg-white p-4" style={{ borderColor: "#E8E2D9" }}>
              <div className="flex items-center justify-between mb-3">
                <p className="font-display text-lg">Unseated guests</p>
                <span className="font-body text-xs" style={{ color: "#6B6B6B" }}>{unseated.length}</span>
              </div>
              <div className="relative mb-3">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#6B6B6B" }} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search guests"
                  className="w-full rounded border pl-9 pr-3 py-2 font-body text-sm"
                  style={{ borderColor: "#E8E2D9" }}
                />
              </div>
              <div className="max-h-[560px] overflow-y-auto space-y-1.5 pr-1">
                {unseated.length === 0 ? (
                  <p className="font-body text-sm py-6 text-center" style={{ color: "#6B6B6B" }}>
                    {guests.length === 0 ? "No guests in the guest list yet." : "Every guest has a seat."}
                  </p>
                ) : unseated.map(g => (
                  <UnseatedRow
                    key={g.id}
                    guest={g}
                    selected={selectedGuestId === g.id}
                    onSelect={() => setSelectedGuestId(selectedGuestId === g.id ? null : g.id)}
                    onToggleFlag={(field, v) => void toggleGuestFlag(g.id, field, v)}
                    onDragStart={ev => ev.dataTransfer.setData("text/guest-id", g.id)}
                  />
                ))}
              </div>
            </div>

            {/* Right pane: table cards */}
            <div className="space-y-4">
              {tables.map(t => (
                <TableCard
                  key={t.id}
                  table={t}
                  mode={config?.seating_mode ?? "table_only"}
                  assignments={assignments.filter(a => a.table_id === t.id)}
                  guests={guests}
                  selectedGuestId={selectedGuestId}
                  onAssign={(guestId, seat) => void assignGuest(guestId, t.id, seat)}
                  onUnassign={(id) => void unassign(id)}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {printOpen && (
        <PrintView
          tables={tables}
          assignments={assignments}
          guests={guests}
          mode={config?.seating_mode ?? "table_only"}
          floorPlan={config?.layout_image_url ?? null}
          onClose={() => setPrintOpen(false)}
        />
      )}
    </div>
  );
}

/* ────────────────────────────── Markers ────────────────────────────── */

function GuestChips({ guest, size = "sm" }: { guest: Guest; size?: "sm" | "xs" }) {
  const dietary = (guest.dietary_restrictions ?? []).length > 0;
  const child = isChild(guest);
  const cls = size === "xs" ? "text-[10px] px-1.5 py-0.5" : "text-[11px] px-2 py-0.5";
  return (
    <span className="inline-flex items-center gap-1 ml-1">
      {dietary && <span title="Dietary" className="w-2 h-2 rounded-full" style={{ background: "#C9A84C" }} />}
      {child && <span title="Child" className={`rounded ${cls} font-medium`} style={{ background: "#FAF8F4", color: "#8B6F3C", border: "1px solid #E8E2D9" }}>C</span>}
      {guest.needs_wheelchair && <span title="Wheelchair" className={`rounded ${cls} inline-flex items-center gap-0.5`} style={{ background: "#FAF8F4", color: "#3F5A6B", border: "1px solid #E8E2D9" }}><Accessibility size={10} /></span>}
      {guest.needs_assistance && <span title="Needs assistance" className={`rounded ${cls} font-medium`} style={{ background: "#FAF8F4", color: "#3F5A6B", border: "1px solid #E8E2D9" }}>H</span>}
    </span>
  );
}

/* ────────────────────────────── Left pane row ────────────────────────────── */

function UnseatedRow({
  guest, selected, onSelect, onToggleFlag, onDragStart,
}: {
  guest: Guest;
  selected: boolean;
  onSelect: () => void;
  onToggleFlag: (f: "needs_wheelchair" | "needs_assistance", v: boolean) => void;
  onDragStart: (e: React.DragEvent) => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="rounded border px-3 py-2 cursor-pointer"
      style={{
        borderColor: selected ? "#2C3E2D" : "#E8E2D9",
        background: selected ? "rgba(44,62,45,0.06)" : "#FFFFFF",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={onSelect} className="flex-1 text-left">
          <span className="font-body text-sm">{fullName(guest) || "Unnamed guest"}</span>
          <GuestChips guest={guest} />
        </button>
        <div className="flex items-center gap-1">
          <IconToggle
            active={guest.needs_wheelchair}
            onClick={() => onToggleFlag("needs_wheelchair", !guest.needs_wheelchair)}
            title="Wheelchair"
          >
            <Accessibility size={12} />
          </IconToggle>
          <IconToggle
            active={guest.needs_assistance}
            onClick={() => onToggleFlag("needs_assistance", !guest.needs_assistance)}
            title="Needs help"
          >
            <HandHelping size={12} />
          </IconToggle>
        </div>
      </div>
    </div>
  );
}

function IconToggle({ active, onClick, title, children }: { active: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={title}
      className="w-6 h-6 rounded inline-flex items-center justify-center"
      style={{
        background: active ? "#2C3E2D" : "transparent",
        color: active ? "#FFFFFF" : "#6B6B6B",
        border: `1px solid ${active ? "#2C3E2D" : "#E8E2D9"}`,
      }}
    >
      {children}
    </button>
  );
}

/* ────────────────────────────── Table card ────────────────────────────── */

function TableCard({
  table, mode, assignments, guests, selectedGuestId, onAssign, onUnassign,
}: {
  table: SeatingTable;
  mode: "table_only" | "individual_seats";
  assignments: Assignment[];
  guests: Guest[];
  selectedGuestId: string | null;
  onAssign: (guestId: string, seat: number | null) => void;
  onUnassign: (assignmentId: string) => void;
}) {
  const guestById = (id: string | null) => id ? guests.find(g => g.id === id) ?? null : null;
  const seatedCount = assignments.length;
  const handleDrop = (seat: number | null) => (e: React.DragEvent) => {
    e.preventDefault();
    const gid = e.dataTransfer.getData("text/guest-id");
    if (gid) onAssign(gid, seat);
  };
  const cardClick = () => {
    if (mode === "table_only" && selectedGuestId) onAssign(selectedGuestId, null);
  };

  return (
    <div
      className="rounded-lg overflow-hidden bg-white"
      style={{ border: "1px solid #E8E2D9" }}
      onDragOver={e => { if (mode === "table_only") e.preventDefault(); }}
      onDrop={mode === "table_only" ? handleDrop(null) : undefined}
      onClick={mode === "table_only" ? cardClick : undefined}
    >
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: table.color, color: "#FFFFFF" }}>
        <div>
          <p className="font-display text-xl leading-tight">Table {table.table_number}</p>
          {table.label && <p className="font-body text-xs opacity-90">{table.label}</p>}
        </div>
        <span className="font-body text-xs opacity-90">{seatedCount} / {table.seat_count} seated</span>
      </div>

      <div className="p-4">
        {mode === "table_only" ? (
          assignments.length === 0 ? (
            <p className="font-body text-sm" style={{ color: "#6B6B6B" }}>
              {selectedGuestId ? "Click to seat the selected guest here." : "Empty. Drag a guest here or select then click."}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {assignments.map(a => {
                const g = guestById(a.guest_id);
                return (
                  <li key={a.id} className="flex items-center justify-between gap-2 rounded px-2 py-1.5" style={{ background: "#FAF8F4" }}>
                    <span className="font-body text-sm">
                      {a.guest_name ?? (g ? fullName(g) : "Guest")}
                      {g && <GuestChips guest={g} size="xs" />}
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); onUnassign(a.id); }} style={{ color: "#6B6B6B" }}>
                      <X size={13} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )
        ) : (
          <ul className="space-y-1.5">
            {Array.from({ length: table.seat_count }, (_, i) => i + 1).map(seatNum => {
              const a = assignments.find(x => x.seat_number === seatNum);
              const g = a ? guestById(a.guest_id) : null;
              return (
                <li
                  key={seatNum}
                  onDragOver={e => e.preventDefault()}
                  onDrop={handleDrop(seatNum)}
                  onClick={(e) => { e.stopPropagation(); if (selectedGuestId && !a) onAssign(selectedGuestId, seatNum); }}
                  className="flex items-center gap-2 rounded px-2 py-1.5 border cursor-pointer"
                  style={{
                    borderColor: "#E8E2D9",
                    background: a ? "#FAF8F4" : "#FFFFFF",
                  }}
                >
                  <span className="font-body text-[11px] w-5 text-right" style={{ color: "#6B6B6B" }}>{seatNum}.</span>
                  {a ? (
                    <>
                      <span className="flex-1 font-body text-sm">
                        {a.guest_name ?? (g ? fullName(g) : "Guest")}
                        {g && <GuestChips guest={g} size="xs" />}
                      </span>
                      <button onClick={(e) => { e.stopPropagation(); onUnassign(a.id); }} style={{ color: "#6B6B6B" }}>
                        <X size={12} />
                      </button>
                    </>
                  ) : (
                    <span className="flex-1 font-body text-sm italic" style={{ color: "#6B6B6B" }}>
                      {selectedGuestId ? "Click to seat here" : "Empty seat"}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────── Table count input ────────────────────────────── */

function TableCountInput({ current, onApply }: { current: number; onApply: (n: number) => void }) {
  const [v, setV] = useState(current);
  useEffect(() => { setV(current); }, [current]);
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={0}
        value={v}
        onChange={e => setV(Number(e.target.value))}
        className="w-24 rounded border px-3 py-2 font-body text-sm"
        style={{ borderColor: "#E8E2D9" }}
      />
      <button
        onClick={() => onApply(v)}
        disabled={v === current}
        className="px-3 py-2 rounded font-body text-xs disabled:opacity-50"
        style={{ background: "#2C3E2D", color: "#FFFFFF" }}
      >
        Apply
      </button>
    </div>
  );
}

/* ────────────────────────────── Print view ────────────────────────────── */

function PrintView({
  tables, assignments, guests, mode, floorPlan, onClose,
}: {
  tables: SeatingTable[];
  assignments: Assignment[];
  guests: Guest[];
  mode: "table_only" | "individual_seats";
  floorPlan: string | null;
  onClose: () => void;
}) {
  const guestById = (id: string | null) => id ? guests.find(g => g.id === id) ?? null : null;
  const markersFor = (g: Guest | null) => {
    if (!g) return "";
    const m: string[] = [];
    if ((g.dietary_restrictions ?? []).length > 0) m.push("*");
    if (isChild(g)) m.push("C");
    if (g.needs_wheelchair) m.push("W");
    if (g.needs_assistance) m.push("H");
    return m.length ? ` ${m.join(" ")}` : "";
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto" style={{ background: "#FFFFFF" }}>
      <style>{`@media print { .no-print { display: none !important; } @page { margin: 16mm; } }`}</style>
      <div className="no-print sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between" style={{ borderColor: "#E8E2D9" }}>
        <p className="font-display text-lg">Print preview</p>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="px-3 py-1.5 rounded font-body text-sm" style={{ background: "#2C3E2D", color: "#FFFFFF" }}>Print</button>
          <button onClick={onClose} className="px-3 py-1.5 rounded font-body text-sm border" style={{ borderColor: "#E8E2D9" }}>Close</button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-8" style={{ color: "#1A1A1A" }}>
        <header className="text-center mb-6">
          <h1 className="font-display text-4xl font-light" style={{ color: "#2C3E2D" }}>Seating Chart</h1>
        </header>

        {floorPlan && (
          <div className="mb-6">
            <img src={floorPlan} alt="Floor plan" className="w-full max-h-[420px] object-contain mx-auto" />
          </div>
        )}

        <div className="mb-6 rounded border px-4 py-2 font-body text-xs flex flex-wrap gap-4" style={{ borderColor: "#E8E2D9", color: "#6B6B6B" }}>
          <span><strong style={{ color: "#C9A84C" }}>*</strong> Dietary</span>
          <span><strong>C</strong> Child</span>
          <span><strong>W</strong> Wheelchair</span>
          <span><strong>H</strong> Needs help</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {tables.map(t => {
            const seats = assignments.filter(a => a.table_id === t.id);
            return (
              <div key={t.id} className="rounded overflow-hidden break-inside-avoid" style={{ border: "1px solid #E8E2D9" }}>
                <div className="px-3 py-2" style={{ background: t.color, color: "#FFFFFF" }}>
                  <p className="font-display text-lg leading-tight">Table {t.table_number}</p>
                  {t.label && <p className="font-body text-xs opacity-90">{t.label}</p>}
                </div>
                <ol className="p-3 space-y-1 font-body text-sm">
                  {Array.from({ length: t.seat_count }, (_, i) => i + 1).map(n => {
                    const a = mode === "individual_seats"
                      ? seats.find(s => s.seat_number === n)
                      : seats[n - 1];
                    const g = a ? guestById(a.guest_id) : null;
                    return (
                      <li key={n} className="flex gap-2">
                        <span className="w-5 text-right" style={{ color: "#6B6B6B" }}>{n}.</span>
                        <span>{a ? `${a.guest_name ?? (g ? fullName(g) : "Guest")}${markersFor(g)}` : <em style={{ color: "#6B6B6B" }}>—</em>}</span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
