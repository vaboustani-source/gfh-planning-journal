import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { LodgingList } from "./people/LodgingList";
import PortalStickyFooter from "@/components/portal/PortalStickyFooter";
import { OffsiteAccommodationsSection } from "@/components/lodging/OffsiteAccommodationsSection";
import { usePortalData } from "@/hooks/usePortalData";
import GuestList from "@/components/people/GuestList";
import { PeopleSubTabs, PeopleSubTab } from "@/components/people/PeopleSubTabs";
import { usePeopleCounts } from "@/components/people/usePeopleCounts";
import { supabase } from "@/integrations/supabase/client";
import { Armchair, Search, Sparkles, Users, X } from "lucide-react";
import { toast } from "sonner";

const db = supabase as any;

interface GuestRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  rsvp_status: string;
  lodging_preference: string | null;
  meal_preference: string | null;
}

interface SeatingLayout {
  id: string;
  label: string;
  image_url: string | null;
}

interface SeatingTable {
  id: string;
  table_name: string;
  table_type: string;
  capacity: number;
  layout_id: string | null;
  sort_order: number | null;
}

interface SeatingAssignment {
  id: string;
  table_id: string | null;
  guest_name: string;
  guest_email: string | null;
  meal_preference: string | null;
  source: string;
}

const tabFromParam = (tab: string | null): PeopleSubTab => {
  if (tab === "lodging") return "lodging";
  if (tab === "seating") return "seating";
  return "guests";
};

export default function OurPeople() {
  const navigate = useNavigate();
  const { eventId } = usePortalData();
  const [params, setParams] = useSearchParams();
  const tabParam = params.get("tab");
  const [sub, setSub] = useState<PeopleSubTab>(() => tabFromParam(tabParam));
  const { counts, reload } = usePeopleCounts(eventId);

  useEffect(() => {
    setSub(tabFromParam(tabParam));
  }, [tabParam]);

  useEffect(() => {
    const nextTab = sub === "guests" ? null : sub;
    if (tabParam === nextTab || (!tabParam && !nextTab)) return;
    const next = new URLSearchParams(params);
    if (!nextTab) next.delete("tab");
    else next.set("tab", nextTab);
    setParams(next, { replace: true });
  }, [params, setParams, sub, tabParam]);

  const onSub = (t: PeopleSubTab) => {
    setSub(t);
    reload();
  };

  return (
    <>
      <div className="max-w-5xl mx-auto px-5 py-8 lg:px-8 lg:py-10 pb-32">
        <div className="animate-fade-up space-y-2">
          <p className="font-body text-xs tracking-widest uppercase text-muted-foreground">Your weekend, your people</p>
          <h1 className="font-display text-4xl font-light text-foreground mb-6">Our People</h1>

          <PeopleSubTabs active={sub} onChange={onSub}
            guestCount={counts.guests} onSiteCount={counts.onSite}
            seatedCount={counts.seated} confirmedCount={counts.confirmed} />

          {sub === "guests" && eventId && (
            <div className="space-y-2">
              <p className="font-body text-xs tracking-widest uppercase text-muted-foreground">Your guests</p>
              <h2 className="font-display text-2xl font-light mb-4">Guest List</h2>
              <GuestList eventId={eventId} onCountChange={reload} />
            </div>
          )}

          {sub === "lodging" && (
            <div className="space-y-10">
              <LodgingList />
              {eventId && <OffsiteAccommodationsSection eventId={eventId} variant="portal" />}
            </div>
          )}

          {sub === "seating" && eventId && <PortalSeatingPanel eventId={eventId} onChanged={reload} />}
        </div>
      </div>
      <PortalStickyFooter onContinue={() => navigate("/portal/financials")} />
    </>
  );
}

function PortalSeatingPanel({ eventId, onChanged }: { eventId: string; onChanged: () => void }) {
  const [loading, setLoading] = useState(true);
  const [tables, setTables] = useState<SeatingTable[]>([]);
  const [assignments, setAssignments] = useState<SeatingAssignment[]>([]);
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [layout, setLayout] = useState<SeatingLayout | null>(null);
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: tbls }, { data: asgs }, { data: guestRows }] = await Promise.all([
      db.from("seating_tables").select("id, table_name, table_type, capacity, layout_id, sort_order").eq("event_id", eventId).order("sort_order").order("table_name"),
      db.from("seating_assignments").select("id, table_id, guest_name, guest_email, meal_preference, source").eq("event_id", eventId).order("guest_name"),
      db.from("guests").select("id, first_name, last_name, email, rsvp_status, lodging_preference, meal_preference").eq("event_id", eventId).order("last_name").order("first_name"),
    ]);

    const nextTables = (tbls ?? []) as SeatingTable[];
    setTables(nextTables);
    setAssignments((asgs ?? []) as SeatingAssignment[]);
    setGuests((guestRows ?? []) as GuestRow[]);

    const layoutId = nextTables.find((table) => table.layout_id)?.layout_id;
    if (layoutId) {
      const { data } = await db.from("layout_library").select("id, label, image_url").eq("id", layoutId).maybeSingle();
      setLayout((data as SeatingLayout | null) ?? null);
    } else {
      setLayout(null);
    }
    setLoading(false);
  }, [eventId]);

  useEffect(() => { void load(); }, [load]);

  const confirmedGuests = useMemo(
    () => guests.filter((guest) => guest.rsvp_status === "confirmed"),
    [guests],
  );

  const unassignedGuests = useMemo(() => {
    const list = assignments.filter((assignment) => !assignment.table_id);
    if (!search.trim()) return list;
    const query = search.toLowerCase();
    return list.filter((assignment) => assignment.guest_name.toLowerCase().includes(query));
  }, [assignments, search]);

  const assignedCount = assignments.filter((assignment) => assignment.table_id).length;
  const selectedGuest = assignments.find((assignment) => assignment.id === selectedGuestId) ?? null;

  const importConfirmedGuests = async () => {
    setImporting(true);
    const existingNames = new Set(assignments.map((assignment) => assignment.guest_name.trim().toLowerCase()));
    const rows = confirmedGuests
      .map((guest) => ({
        event_id: eventId,
        guest_name: `${guest.first_name} ${guest.last_name}`.trim(),
        guest_email: guest.email,
        meal_preference: guest.meal_preference,
        source: "manual",
      }))
      .filter((guest) => guest.guest_name && !existingNames.has(guest.guest_name.toLowerCase()));

    if (rows.length === 0) {
      toast.message("All confirmed guests are already in the seating chart.");
      setImporting(false);
      return;
    }

    const { data, error } = await db.from("seating_assignments").insert(rows).select("id, table_id, guest_name, guest_email, meal_preference, source");
    setImporting(false);
    if (error) {
      toast.error("Could not import confirmed guests");
      return;
    }
    setAssignments((prev) => [...prev, ...((data ?? []) as SeatingAssignment[])]);
    toast.success(`Imported ${rows.length} confirmed guest${rows.length === 1 ? "" : "s"}`);
    onChanged();
  };

  const assignGuestToTable = async (guestId: string, tableId: string | null) => {
    const previous = assignments;
    setAssignments((prev) => prev.map((assignment) => assignment.id === guestId ? { ...assignment, table_id: tableId } : assignment));
    setSelectedGuestId(null);
    const { error } = await db.from("seating_assignments").update({ table_id: tableId }).eq("id", guestId);
    if (error) {
      setAssignments(previous);
      toast.error("Could not update seating");
      return;
    }
    onChanged();
  };

  const removeFromSeating = async (guestId: string) => {
    const previous = assignments;
    setAssignments((prev) => prev.filter((assignment) => assignment.id !== guestId));
    const { error } = await db.from("seating_assignments").delete().eq("id", guestId);
    if (error) {
      setAssignments(previous);
      toast.error("Could not remove guest");
      return;
    }
    onChanged();
  };

  if (loading) {
    return <div className="py-12 text-center font-body text-sm text-muted-foreground">Loading seating…</div>;
  }

  if (tables.length === 0) {
    return (
      <section className="rounded-lg border border-border bg-card px-6 py-12 text-center shadow-soft">
        <Sparkles size={30} className="mx-auto mb-4 text-sage" strokeWidth={1.5} />
        <h2 className="font-display text-3xl font-light text-foreground">Your seating chart is being arranged — check back soon</h2>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-body text-xs tracking-widest uppercase text-muted-foreground">Reception seating</p>
          <h2 className="font-display text-2xl font-light text-foreground">Seating Chart</h2>
          <p className="font-body text-sm text-muted-foreground">{assignedCount} seated · {unassignedGuests.length} unassigned · {confirmedGuests.length} confirmed</p>
        </div>
        <button
          type="button"
          onClick={importConfirmedGuests}
          disabled={importing}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-body text-sm text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          <Users size={15} /> {importing ? "Importing…" : "Import confirmed guests"}
        </button>
      </div>

      {layout?.image_url && (
        <section className="rounded-lg border border-border bg-card p-3 shadow-soft">
          <img src={layout.image_url} alt={layout.label} className="mx-auto max-h-[460px] w-full rounded-md object-contain" />
          <p className="mt-2 text-center font-body text-xs text-muted-foreground">{layout.label}</p>
        </section>
      )}

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(260px,0.85fr)_minmax(0,1.4fr)]">
        <div className="rounded-lg border border-border bg-card p-4 shadow-soft">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="font-display text-xl font-light text-foreground">Unassigned Guest Pool</p>
              <p className="font-body text-xs text-muted-foreground">{unassignedGuests.length} guests waiting for a table</p>
            </div>
            <Armchair size={18} className="text-sage" strokeWidth={1.5} />
          </div>
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name"
              className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 font-body text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>
          <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
            {unassignedGuests.length === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-background px-3 py-6 text-center font-body text-sm text-muted-foreground">All imported guests are seated.</p>
            ) : unassignedGuests.map((guest) => (
              <button
                key={guest.id}
                type="button"
                onClick={() => setSelectedGuestId(selectedGuestId === guest.id ? null : guest.id)}
                className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${selectedGuestId === guest.id ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-secondary"}`}
              >
                <span className="block font-body text-sm font-medium text-foreground">{guest.guest_name}</span>
                <span className="block font-body text-xs text-muted-foreground">{guest.guest_email || "No email"}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {selectedGuest && (
            <div className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/10 px-4 py-3">
              <p className="font-body text-sm text-foreground"><span className="font-medium">Selected:</span> {selectedGuest.guest_name}</p>
              <button type="button" onClick={() => setSelectedGuestId(null)} className="text-muted-foreground hover:text-foreground"><X size={15} /></button>
            </div>
          )}
          {tables.map((table) => {
            const seated = assignments.filter((assignment) => assignment.table_id === table.id).sort((a, b) => a.guest_name.localeCompare(b.guest_name));
            const overCapacity = seated.length > table.capacity;
            return (
              <div
                key={table.id}
                onClick={() => { if (selectedGuestId) void assignGuestToTable(selectedGuestId, table.id); }}
                className={`rounded-lg border bg-card p-4 shadow-soft transition-colors ${selectedGuestId ? "cursor-pointer border-primary/40 hover:bg-primary/5" : "border-border"} ${overCapacity ? "border-destructive bg-destructive/10" : ""}`}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-display text-lg font-light text-foreground">{table.table_name}</p>
                    <p className="font-body text-xs capitalize text-muted-foreground">{table.table_type}</p>
                  </div>
                  <span className="rounded-full bg-secondary px-2.5 py-1 font-body text-xs text-secondary-foreground">{seated.length} / {table.capacity}</span>
                </div>
                {seated.length === 0 ? (
                  <p className="font-body text-sm italic text-muted-foreground">No guests seated yet</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {seated.map((guest) => (
                      <span key={guest.id} className="inline-flex items-center gap-1.5 rounded-full bg-sage/10 px-2.5 py-1 font-body text-xs text-sage-dark">
                        {guest.guest_name}
                        <button type="button" onClick={(event) => { event.stopPropagation(); void assignGuestToTable(guest.id, null); }} className="hover:text-destructive">
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <div className="rounded-lg border border-border bg-card p-4 shadow-soft">
            <p className="font-display text-lg font-light text-foreground">Assigned Guests</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[520px] font-body text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Guest</th>
                    <th className="py-2 pr-3 font-medium">Table</th>
                    <th className="py-2 pr-3 font-medium">Meal</th>
                    <th className="py-2 pr-3" />
                  </tr>
                </thead>
                <tbody>
                  {assignments.filter((assignment) => assignment.table_id).map((assignment) => (
                    <tr key={assignment.id} className="border-b border-border/70 last:border-0">
                      <td className="py-2 pr-3 text-foreground">{assignment.guest_name}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{tables.find((table) => table.id === assignment.table_id)?.table_name ?? "—"}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{assignment.meal_preference || "—"}</td>
                      <td className="py-2 text-right">
                        <button type="button" onClick={() => void removeFromSeating(assignment.id)} className="text-muted-foreground hover:text-destructive"><X size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
