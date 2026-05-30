import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, X, Search, Printer, Pencil, AlertCircle, Users } from "lucide-react";

const db = supabase as any;

interface Layout {
  id: string;
  guest_count_min: number;
  guest_count_max: number;
  label: string;
  image_url: string | null;
  table_config_description: string | null;
}

interface SeatingTable {
  id: string;
  event_id: string;
  layout_id: string | null;
  table_name: string;
  table_type: string;
  capacity: number;
  sort_order: number | null;
}

interface SeatingAssignment {
  id: string;
  event_id: string;
  table_id: string | null;
  guest_name: string;
  guest_email: string | null;
  meal_preference: string | null;
  source: string;
  lodging_room_id: string | null;
  notes: string | null;
}

const TABLE_TYPES = [
  { key: "farm", label: "Farm" },
  { key: "round", label: "Round" },
  { key: "sweetheart", label: "Sweetheart" },
  { key: "cocktail", label: "Cocktail" },
  { key: "kids", label: "Kids" },
  { key: "vendor", label: "Vendor" },
  { key: "other", label: "Other" },
];

export default function SeatingTab({ eventId, onNavigateNext: _ }: { eventId: string; onNavigateNext?: () => void }) {
  const [loading, setLoading] = useState(true);
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [tables, setTables] = useState<SeatingTable[]>([]);
  const [assignments, setAssignments] = useState<SeatingAssignment[]>([]);
  const [event, setEvent] = useState<any>(null);
  const [mealEvents, setMealEvents] = useState<any[]>([]);
  const [chosenLayoutId, setChosenLayoutId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [addingTable, setAddingTable] = useState(false);
  const [editingTable, setEditingTable] = useState<SeatingTable | null>(null);
  const [addingGuest, setAddingGuest] = useState(false);
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "assigned" | "unassigned">("all");

  useEffect(() => { load(); }, [eventId]);

  const load = async () => {
    const [{ data: lays }, { data: tbls }, { data: asgs }, { data: ev }, { data: meals }] = await Promise.all([
      db.from("layout_library").select("*").eq("is_active", true).order("sort_order"),
      db.from("seating_tables").select("*").eq("event_id", eventId).order("sort_order").order("table_name"),
      db.from("seating_assignments").select("*").eq("event_id", eventId).order("guest_name"),
      db.from("events").select("*").eq("id", eventId).single(),
      db.from("meal_events").select("meal_type, adult_count, kids_count").eq("event_id", eventId),
    ]);
    setLayouts((lays ?? []) as Layout[]);
    setTables((tbls ?? []) as SeatingTable[]);
    setAssignments((asgs ?? []) as SeatingAssignment[]);
    setEvent(ev);
    setMealEvents(meals ?? []);
    // Derive chosen layout from first table's layout_id
    const firstWithLayout = (tbls ?? []).find((t: any) => t.layout_id);
    if (firstWithLayout) setChosenLayoutId(firstWithLayout.layout_id);
    setLoading(false);
  };

  const guestCount = useMemo(() => {
    const reception = mealEvents.find(m => m.meal_type === "reception_dinner" || m.meal_type === "reception");
    if (reception) return (reception.adult_count ?? 0) + (reception.kids_count ?? 0);
    if (event?.estimated_guest_count) return event.estimated_guest_count;
    const max = Math.max(0, ...mealEvents.map(m => (m.adult_count ?? 0) + (m.kids_count ?? 0)));
    return max || 0;
  }, [mealEvents, event]);

  const suggestedLayout = useMemo(() => {
    if (!guestCount) return null;
    return layouts.find(l => guestCount >= l.guest_count_min && guestCount <= l.guest_count_max) ?? null;
  }, [layouts, guestCount]);

  const chosenLayout = chosenLayoutId ? layouts.find(l => l.id === chosenLayoutId) : suggestedLayout;

  const useThisLayout = async (layoutId: string) => {
    setChosenLayoutId(layoutId);
    // Update existing tables' layout_id reference
    if (tables.length > 0) {
      await db.from("seating_tables").update({ layout_id: layoutId }).eq("event_id", eventId);
      setTables(prev => prev.map(t => ({ ...t, layout_id: layoutId })));
    }
    setPickerOpen(false);
  };

  const addTable = async (name: string, type: string, capacity: number) => {
    const { data, error } = await db.from("seating_tables").insert({
      event_id: eventId,
      layout_id: chosenLayoutId,
      table_name: name,
      table_type: type,
      capacity,
      sort_order: tables.length,
    }).select().single();
    if (error) return alert(error.message);
    setTables(prev => [...prev, data as SeatingTable]);
    setAddingTable(false);
  };

  const updateTable = async (t: SeatingTable) => {
    const { data, error } = await db.from("seating_tables").update({
      table_name: t.table_name, table_type: t.table_type, capacity: t.capacity,
    }).eq("id", t.id).select().single();
    if (error) return alert(error.message);
    setTables(prev => prev.map(x => x.id === t.id ? data as SeatingTable : x));
    setEditingTable(null);
  };

  const deleteTable = async (id: string) => {
    if (!confirm("Delete this table? Guests assigned to it will become unassigned.")) return;
    await db.from("seating_tables").delete().eq("id", id);
    setTables(prev => prev.filter(t => t.id !== id));
    setAssignments(prev => prev.map(a => a.table_id === id ? { ...a, table_id: null } : a));
  };

  const importFromLodging = async () => {
    const { data } = await db.from("lodging_assignments")
      .select("id, room_id, assigned_guest_name, assigned_guest_email")
      .eq("event_id", eventId)
      .eq("removed", false)
      .not("assigned_guest_name", "is", null);
    const lodgings = (data ?? []) as any[];
    const existingNames = new Set(assignments.map(a => a.guest_name.toLowerCase()));
    const toInsert = lodgings
      .filter(l => l.assigned_guest_name && !existingNames.has(l.assigned_guest_name.toLowerCase()))
      .map(l => ({
        event_id: eventId,
        guest_name: l.assigned_guest_name,
        guest_email: l.assigned_guest_email,
        source: "lodging",
        lodging_room_id: l.room_id,
      }));
    if (toInsert.length === 0) {
      alert("All lodging guests are already imported.");
      return;
    }
    const { data: inserted, error } = await db.from("seating_assignments").insert(toInsert).select();
    if (error) return alert(error.message);
    setAssignments(prev => [...prev, ...(inserted as SeatingAssignment[])]);
    alert(`Imported ${inserted.length} guest${inserted.length === 1 ? "" : "s"} from lodging.`);
  };

  const addGuestManually = async (name: string, email: string, meal: string) => {
    if (!name.trim()) return;
    const { data, error } = await db.from("seating_assignments").insert({
      event_id: eventId,
      guest_name: name.trim(),
      guest_email: email.trim() || null,
      meal_preference: meal.trim() || null,
      source: "manual",
    }).select().single();
    if (error) return alert(error.message);
    setAssignments(prev => [...prev, data as SeatingAssignment]);
    setAddingGuest(false);
  };

  const assignToTable = async (guestId: string, tableId: string | null) => {
    const { error } = await db.from("seating_assignments").update({ table_id: tableId }).eq("id", guestId);
    if (error) return alert(error.message);
    setAssignments(prev => prev.map(a => a.id === guestId ? { ...a, table_id: tableId } : a));
    setSelectedGuestId(null);
  };

  const deleteGuest = async (id: string) => {
    await db.from("seating_assignments").delete().eq("id", id);
    setAssignments(prev => prev.filter(a => a.id !== id));
  };

  const filteredGuests = useMemo(() => {
    let list = assignments;
    if (filter === "assigned") list = list.filter(a => a.table_id);
    if (filter === "unassigned") list = list.filter(a => !a.table_id);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(a => a.guest_name.toLowerCase().includes(s));
    }
    return list;
  }, [assignments, filter, search]);

  const unassignedCount = assignments.filter(a => !a.table_id).length;
  const assignedCount = assignments.length - unassignedCount;
  const totalCapacity = tables.reduce((sum, t) => sum + t.capacity, 0);

  const onPrint = (mode: "by_table" | "alphabetical") => {
    window.dispatchEvent(new CustomEvent("open-seating-print", { detail: { mode } }));
  };

  if (loading) {
    return <div className="py-12 flex justify-center"><div className="w-6 h-6 rounded-full border-2 border-sage/30 border-t-sage animate-spin" /></div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-body text-xs tracking-widest uppercase text-muted-foreground mb-2">Reception planning</p>
          <h2 className="font-display text-3xl font-light text-foreground">Seating Chart</h2>
          <p className="font-body text-sm text-muted-foreground mt-1">Pick a layout, set up tables, and place every guest.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => onPrint("by_table")} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border font-body text-xs text-foreground hover:bg-muted">
            <Printer size={13} /> By Table
          </button>
          <button onClick={() => onPrint("alphabetical")} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border font-body text-xs text-foreground hover:bg-muted">
            <Printer size={13} /> Alphabetical
          </button>
        </div>
      </div>

      {/* LAYOUT SECTION */}
      <section className="rounded-2xl bg-white border border-border shadow-soft p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-display text-xl font-light text-foreground">Reception Layout</p>
            <p className="font-body text-sm text-muted-foreground">
              {guestCount
                ? `Based on your guest count of ${guestCount}, we suggest the ${suggestedLayout?.label ?? "—"} layout.`
                : "Set headcounts in Menus & Bar to get a layout suggestion."}
            </p>
          </div>
          <button onClick={() => setPickerOpen(true)} className="font-body text-xs text-sage-dark hover:underline">
            Choose different layout
          </button>
        </div>

        {chosenLayout ? (
          <div className="space-y-3">
            {chosenLayout.image_url ? (
              <div className="rounded-xl border border-border bg-cream/40 p-2 shadow-soft">
                <img src={chosenLayout.image_url} alt={chosenLayout.label} className="w-full max-h-[500px] object-contain mx-auto" />
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
                <AlertCircle size={24} className="text-muted-foreground mx-auto mb-2" />
                <p className="font-body text-sm text-muted-foreground">
                  No layout uploaded for {chosenLayout.label} yet — upload one in Settings → Table Layouts or choose a different layout.
                </p>
              </div>
            )}
            <div className="flex items-center justify-between">
              <p className="font-body text-sm text-foreground">
                <span className="font-medium">{chosenLayout.label}</span>
                {chosenLayout.table_config_description && (
                  <span className="text-muted-foreground"> · {chosenLayout.table_config_description}</span>
                )}
              </p>
              {chosenLayoutId !== chosenLayout.id && (
                <button onClick={() => useThisLayout(chosenLayout.id)} className="px-3 py-1.5 rounded-lg bg-sage text-primary-foreground font-body text-xs hover:opacity-90">
                  Use This Layout
                </button>
              )}
            </div>
          </div>
        ) : (
          <p className="font-body text-sm text-muted-foreground">No layout selected.</p>
        )}
      </section>

      {/* TABLES SECTION */}
      <section className="rounded-2xl bg-white border border-border shadow-soft p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-display text-xl font-light text-foreground">Tables</p>
            <p className="font-body text-sm text-muted-foreground">{tables.length} tables · {totalCapacity} seats</p>
          </div>
          <button onClick={() => setAddingTable(true)} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground font-body text-xs hover:opacity-90">
            <Plus size={13} /> Add Table
          </button>
        </div>

        {addingTable && <AddTableForm onCancel={() => setAddingTable(false)} onAdd={addTable} />}

        {tables.length === 0 && !addingTable ? (
          <p className="font-body text-sm text-muted-foreground italic">No tables yet — add your first table to get started.</p>
        ) : (
          <div className="space-y-2 mt-3">
            {tables.map(t => {
              const count = assignments.filter(a => a.table_id === t.id).length;
              const over = count > t.capacity;
              return editingTable?.id === t.id ? (
                <EditTableForm key={t.id} table={editingTable} setTable={setEditingTable} onSave={() => updateTable(editingTable)} onCancel={() => setEditingTable(null)} />
              ) : (
                <div key={t.id} className={`flex items-center gap-3 rounded-lg border p-3 ${over ? "border-red-300 bg-red-50" : "border-border bg-background"}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-body text-sm font-medium text-foreground">{t.table_name}</p>
                      <span className="rounded-full bg-sage/10 px-2 py-0.5 font-body text-[10px] text-sage-dark">{TABLE_TYPES.find(x => x.key === t.table_type)?.label}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-24">
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full ${over ? "bg-red-500" : "bg-sage"}`} style={{ width: `${Math.min(100, (count / t.capacity) * 100)}%` }} />
                      </div>
                      <p className={`font-body text-[11px] text-center mt-1 ${over ? "text-red-600 font-medium" : "text-muted-foreground"}`}>{count} / {t.capacity}</p>
                    </div>
                    <button onClick={() => setEditingTable(t)} className="text-muted-foreground hover:text-foreground"><Pencil size={13} /></button>
                    <button onClick={() => deleteTable(t.id)} className="text-muted-foreground hover:text-destructive"><Trash2 size={13} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* GUEST ASSIGNMENT */}
      <section className="rounded-2xl bg-white border border-border shadow-soft p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <p className="font-display text-xl font-light text-foreground">Guests</p>
            <div className="flex flex-wrap items-center gap-4 mt-1 text-xs font-body">
              <span className="text-muted-foreground">Total: <span className="text-foreground font-medium">{assignments.length}</span></span>
              <span className="text-muted-foreground">Assigned: <span className="text-sage-dark font-medium">{assignedCount}</span></span>
              <span className="text-muted-foreground">Unassigned: <span className="text-amber-700 font-medium">{unassignedCount}</span></span>
              <span className="text-muted-foreground">Seats: <span className="text-foreground font-medium">{totalCapacity}</span></span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={importFromLodging} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border font-body text-xs text-foreground hover:bg-muted">
              <Users size={13} /> Import from Lodging
            </button>
            <button onClick={() => setAddingGuest(true)} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground font-body text-xs hover:opacity-90">
              <Plus size={13} /> Add Guest
            </button>
          </div>
        </div>

        {addingGuest && <AddGuestForm onCancel={() => setAddingGuest(false)} onAdd={addGuestManually} />}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-4">
          {/* Guest Pool */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
            <p className="font-body text-xs tracking-widest uppercase text-amber-800 mb-3">Guest List</p>
            <div className="relative mb-3">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search guests…"
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-border bg-white font-body text-sm focus:outline-none focus:border-primary/50" />
            </div>
            <div className="flex gap-1 mb-3">
              {(["all", "unassigned", "assigned"] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-full font-body text-[11px] capitalize ${filter === f ? "bg-sage text-primary-foreground" : "bg-white text-muted-foreground border border-border"}`}>
                  {f}
                </button>
              ))}
            </div>
            <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
              {filteredGuests.length === 0 ? (
                <p className="font-body text-xs text-muted-foreground italic text-center py-4">No guests match.</p>
              ) : filteredGuests.map(g => {
                const table = tables.find(t => t.id === g.table_id);
                const selected = selectedGuestId === g.id;
                return (
                  <div key={g.id}
                    className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 cursor-pointer transition-colors border ${
                      selected ? "border-sage bg-sage/10" : "border-transparent bg-white hover:border-border"
                    }`}
                    onClick={() => setSelectedGuestId(selected ? null : g.id)}>
                    <div className="min-w-0 flex-1">
                      <p className="font-body text-sm text-foreground truncate">{g.guest_name}</p>
                      <p className="font-body text-[11px] text-muted-foreground truncate">
                        {table ? `Seated: ${table.table_name}` : "Unassigned"}
                        {g.source === "lodging" && " · from lodging"}
                      </p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); deleteGuest(g.id); }} className="text-muted-foreground hover:text-destructive shrink-0">
                      <X size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
            {selectedGuestId && (
              <p className="font-body text-[11px] text-sage-dark mt-3 px-1">Now click a table on the right to seat this guest.</p>
            )}
          </div>

          {/* Tables grid */}
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {tables.length === 0 ? (
              <p className="font-body text-sm text-muted-foreground italic">Add tables above to start seating guests.</p>
            ) : tables.map(t => {
              const guests = assignments.filter(a => a.table_id === t.id);
              const over = guests.length > t.capacity;
              return (
                <div key={t.id}
                  onClick={() => { if (selectedGuestId) assignToTable(selectedGuestId, t.id); }}
                  className={`rounded-xl border p-3 transition-colors ${
                    over ? "border-red-300 bg-red-50" :
                    selectedGuestId ? "border-sage bg-sage/5 cursor-pointer hover:bg-sage/10" :
                    "border-border bg-white"
                  }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-body text-sm font-medium text-foreground">{t.table_name}</p>
                      <p className="font-body text-[11px] text-muted-foreground capitalize">{t.table_type}</p>
                    </div>
                    <span className={`font-body text-xs ${over ? "text-red-600 font-medium" : "text-muted-foreground"}`}>{guests.length} / {t.capacity}</span>
                  </div>
                  <div className="h-1 rounded-full bg-muted overflow-hidden mb-2">
                    <div className={`h-full ${over ? "bg-red-500" : "bg-sage"}`} style={{ width: `${Math.min(100, (guests.length / t.capacity) * 100)}%` }} />
                  </div>
                  {guests.length === 0 ? (
                    <p className="font-body text-[11px] text-muted-foreground italic">Empty</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {guests.map(g => (
                        <span key={g.id} className="inline-flex items-center gap-1 rounded-full bg-sage/10 px-2 py-0.5 font-body text-[11px] text-sage-dark">
                          {g.guest_name}
                          <button onClick={(e) => { e.stopPropagation(); assignToTable(g.id, null); }} className="hover:text-destructive">
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {pickerOpen && (
        <LayoutPicker layouts={layouts} onPick={useThisLayout} onClose={() => setPickerOpen(false)} />
      )}

      <SeatingPrintView event={event} tables={tables} assignments={assignments} layout={chosenLayout} />
    </div>
  );
}

function AddTableForm({ onAdd, onCancel }: { onAdd: (name: string, type: string, cap: number) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("farm");
  const [cap, setCap] = useState(8);
  return (
    <div className="rounded-lg border border-sage/30 bg-sage/5 p-3 flex flex-wrap items-end gap-2 mb-3">
      <div className="flex-1 min-w-[140px]">
        <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground block mb-1">Name</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Table 1" className="w-full border border-border rounded-md px-3 py-1.5 font-body text-sm bg-white" />
      </div>
      <div>
        <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground block mb-1">Type</label>
        <select value={type} onChange={e => setType(e.target.value)} className="border border-border rounded-md px-3 py-1.5 font-body text-sm bg-white">
          {TABLE_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
      </div>
      <div className="w-24">
        <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground block mb-1">Capacity</label>
        <input type="number" min={1} value={cap} onChange={e => setCap(parseInt(e.target.value) || 1)} className="w-full border border-border rounded-md px-3 py-1.5 font-body text-sm bg-white" />
      </div>
      <button onClick={() => name.trim() && onAdd(name.trim(), type, cap)} className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-body text-xs">Add</button>
      <button onClick={onCancel} className="px-3 py-1.5 rounded-md border border-border font-body text-xs">Cancel</button>
    </div>
  );
}

function EditTableForm({ table, setTable, onSave, onCancel }: { table: SeatingTable; setTable: (t: SeatingTable) => void; onSave: () => void; onCancel: () => void }) {
  return (
    <div className="rounded-lg border border-sage/30 bg-sage/5 p-3 flex flex-wrap items-end gap-2">
      <div className="flex-1 min-w-[140px]">
        <input value={table.table_name} onChange={e => setTable({ ...table, table_name: e.target.value })} className="w-full border border-border rounded-md px-3 py-1.5 font-body text-sm bg-white" />
      </div>
      <select value={table.table_type} onChange={e => setTable({ ...table, table_type: e.target.value })} className="border border-border rounded-md px-3 py-1.5 font-body text-sm bg-white">
        {TABLE_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
      </select>
      <input type="number" min={1} value={table.capacity} onChange={e => setTable({ ...table, capacity: parseInt(e.target.value) || 1 })} className="w-20 border border-border rounded-md px-3 py-1.5 font-body text-sm bg-white" />
      <button onClick={onSave} className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-body text-xs">Save</button>
      <button onClick={onCancel} className="px-3 py-1.5 rounded-md border border-border font-body text-xs">Cancel</button>
    </div>
  );
}

function AddGuestForm({ onAdd, onCancel }: { onAdd: (name: string, email: string, meal: string) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [meal, setMeal] = useState("");
  return (
    <div className="rounded-lg border border-sage/30 bg-sage/5 p-3 flex flex-wrap items-end gap-2 mb-3">
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Guest name" className="flex-1 min-w-[160px] border border-border rounded-md px-3 py-1.5 font-body text-sm bg-white" />
      <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email (optional)" className="flex-1 min-w-[160px] border border-border rounded-md px-3 py-1.5 font-body text-sm bg-white" />
      <input value={meal} onChange={e => setMeal(e.target.value)} placeholder="Meal pref (optional)" className="flex-1 min-w-[140px] border border-border rounded-md px-3 py-1.5 font-body text-sm bg-white" />
      <button onClick={() => onAdd(name, email, meal)} className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-body text-xs">Add</button>
      <button onClick={onCancel} className="px-3 py-1.5 rounded-md border border-border font-body text-xs">Cancel</button>
    </div>
  );
}

function LayoutPicker({ layouts, onPick, onClose }: { layouts: Layout[]; onPick: (id: string) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-background rounded-2xl shadow-2xl max-w-5xl max-h-[85vh] overflow-y-auto w-full" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-card border-b border-border px-5 py-3 flex items-center justify-between z-10">
          <p className="font-display text-lg font-light">Choose a Layout</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-4">
          {layouts.map(l => (
            <button key={l.id} onClick={() => onPick(l.id)} className="text-left rounded-xl border border-border overflow-hidden bg-card hover:shadow-elevated transition-shadow">
              <div className="aspect-[4/3] bg-muted">
                {l.image_url ? (
                  <img src={l.image_url} alt={l.label} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground/50 font-body text-xs">No image</div>
                )}
              </div>
              <div className="p-3">
                <p className="font-display text-base font-light">{l.label}</p>
                {l.table_config_description && <p className="font-body text-[11px] text-muted-foreground line-clamp-2">{l.table_config_description}</p>}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ====== PRINT VIEW (window.print) ======
function SeatingPrintView({ event, tables, assignments, layout }: { event: any; tables: SeatingTable[]; assignments: SeatingAssignment[]; layout: Layout | null }) {
  const [mode, setMode] = useState<"by_table" | "alphabetical" | null>(null);

  useEffect(() => {
    const handler = (e: any) => {
      setMode(e.detail.mode);
      setTimeout(() => { window.print(); setTimeout(() => setMode(null), 500); }, 100);
    };
    window.addEventListener("open-seating-print", handler);
    return () => window.removeEventListener("open-seating-print", handler);
  }, []);

  if (!mode) return null;

  const byTable = tables.map(t => ({ table: t, guests: assignments.filter(a => a.table_id === t.id).sort((a, b) => a.guest_name.localeCompare(b.guest_name)) }));
  const alpha = [...assignments].sort((a, b) => {
    const la = a.guest_name.split(" ").slice(-1)[0];
    const lb = b.guest_name.split(" ").slice(-1)[0];
    return la.localeCompare(lb);
  });

  const tableNameFor = (id: string | null) => tables.find(t => t.id === id)?.table_name ?? "Unassigned";

  return (
    <div className="fixed inset-0 z-[100] bg-white overflow-y-auto print:static print:overflow-visible">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .seating-print, .seating-print * { visibility: visible; }
          .seating-print { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>
      <div className="no-print sticky top-0 bg-card border-b border-border p-3 flex items-center justify-between z-10">
        <p className="font-display text-lg">Print Preview — {mode === "by_table" ? "By Table" : "Alphabetical"}</p>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-body text-xs">Print</button>
          <button onClick={() => setMode(null)} className="px-3 py-1.5 rounded-md border border-border font-body text-xs">Close</button>
        </div>
      </div>
      <div className="seating-print max-w-3xl mx-auto p-8">
        <div className="text-center mb-6">
          <p className="font-display text-3xl font-light">{event?.title ?? "Wedding"}</p>
          {event?.wedding_date && <p className="font-body text-sm text-muted-foreground">{new Date(event.wedding_date).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>}
          <p className="font-display text-lg italic text-foreground mt-1">Seating Chart — {mode === "by_table" ? "By Table" : "Alphabetical"}</p>
        </div>
        {layout?.image_url && (
          <div className="mb-6 border border-border rounded-lg p-2">
            <img src={layout.image_url} alt="" className="w-full max-h-80 object-contain mx-auto" />
            <p className="font-body text-xs text-center text-muted-foreground mt-2">{layout.label}</p>
          </div>
        )}
        {mode === "by_table" ? (
          <div className="space-y-5">
            {byTable.map(({ table, guests }) => (
              <div key={table.id} className="border-b border-border pb-3">
                <p className="font-display text-xl font-light">{table.table_name} <span className="font-body text-xs text-muted-foreground">({guests.length} / {table.capacity})</span></p>
                <ul className="font-body text-sm mt-2 columns-2 gap-6">
                  {guests.map(g => <li key={g.id} className="break-inside-avoid">{g.guest_name}</li>)}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <table className="w-full font-body text-sm">
            <thead><tr className="border-b border-border"><th className="text-left py-2">Guest</th><th className="text-left py-2">Table</th></tr></thead>
            <tbody>
              {alpha.map(g => (
                <tr key={g.id} className="border-b border-border/50">
                  <td className="py-1.5">{g.guest_name}</td>
                  <td className="py-1.5 text-muted-foreground">{tableNameFor(g.table_id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
