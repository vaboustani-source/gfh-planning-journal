import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePortalData } from "@/hooks/usePortalData";
import { Search, Sparkles, Printer, Plus, X } from "lucide-react";

const db = supabase as any;

interface Layout { id: string; label: string; image_url: string | null; }
interface SeatingTable { id: string; table_name: string; table_type: string; capacity: number; layout_id: string | null; }
interface SeatingAssignment { id: string; table_id: string | null; guest_name: string; guest_email: string | null; source: string; }

export default function Seating() {
  const { eventId, event } = usePortalData();
  const [loading, setLoading] = useState(true);
  const [tables, setTables] = useState<SeatingTable[]>([]);
  const [assignments, setAssignments] = useState<SeatingAssignment[]>([]);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);

  useEffect(() => { if (eventId) load(); }, [eventId]);

  const load = async () => {
    const [{ data: tbls }, { data: asgs }] = await Promise.all([
      db.from("seating_tables").select("*").eq("event_id", eventId).order("sort_order").order("table_name"),
      db.from("seating_assignments").select("*").eq("event_id", eventId).order("guest_name"),
    ]);
    const tablesList = (tbls ?? []) as SeatingTable[];
    setTables(tablesList);
    setAssignments((asgs ?? []) as SeatingAssignment[]);
    const layoutId = tablesList.find(t => t.layout_id)?.layout_id;
    if (layoutId) {
      const { data } = await db.from("layout_library").select("id, label, image_url").eq("id", layoutId).single();
      if (data) setLayout(data as Layout);
    }
    setLoading(false);
  };

  const addGuest = async (name: string, email: string) => {
    if (!name.trim()) return;
    const { data, error } = await db.from("seating_assignments").insert({
      event_id: eventId, guest_name: name.trim(), guest_email: email.trim() || null, source: "manual",
    }).select().single();
    if (error) return alert(error.message);
    setAssignments(prev => [...prev, data as SeatingAssignment]);
    setAdding(false);
  };

  const matched = useMemo(() => {
    if (!search.trim()) return null;
    const s = search.toLowerCase();
    return assignments.filter(a => a.guest_name.toLowerCase().includes(s));
  }, [assignments, search]);

  const matchedTableIds = new Set((matched ?? []).map(a => a.table_id).filter(Boolean));

  const fullyAssigned = assignments.length > 0 && assignments.every(a => a.table_id);
  const noSetup = tables.length === 0;

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-6 h-6 rounded-full border-2 border-sage/30 border-t-sage animate-spin" /></div>;
  }

  if (noSetup) {
    return (
      <div className="max-w-3xl mx-auto px-4 lg:px-8 py-16 text-center">
        <Sparkles size={32} className="text-sage/60 mx-auto mb-4" />
        <p className="font-display text-3xl font-light text-foreground mb-2">Your seating chart is being arranged</p>
        <p className="font-body text-base text-muted-foreground">Brandon is working on your reception layout — check back soon.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 lg:px-8 py-8 pb-20">
      <div className="mb-6 animate-fade-up">
        <p className="font-body text-xs tracking-widest uppercase text-muted-foreground mb-2">Reception</p>
        <h1 className="font-display text-4xl font-light text-foreground mb-1">Seating Chart</h1>
        <p className="font-body text-base text-muted-foreground">Chandelier Barn — Reception Layout</p>
      </div>

      {/* Hero: Find your seat */}
      <section className="rounded-2xl bg-cream/40 border border-sage/20 p-6 mb-6 text-center">
        <p className="font-display text-2xl font-light text-foreground mb-3">Find Your Seat</p>
        <div className="relative max-w-md mx-auto">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Type a guest name…"
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-border bg-white font-body text-base focus:outline-none focus:border-sage focus:ring-2 focus:ring-sage/20" />
        </div>
        {matched && matched.length > 0 && (
          <div className="mt-4 space-y-1">
            {matched.slice(0, 5).map(a => {
              const t = tables.find(x => x.id === a.table_id);
              return (
                <p key={a.id} className="font-body text-sm">
                  <span className="font-medium">{a.guest_name}</span>
                  {t ? <> · <span className="text-sage-dark">{t.table_name}</span></> : <span className="text-amber-700"> · Not seated yet</span>}
                </p>
              );
            })}
          </div>
        )}
        {matched && matched.length === 0 && (
          <p className="font-body text-sm text-muted-foreground mt-4">No matches — try a different spelling.</p>
        )}
      </section>

      {/* Layout image */}
      {layout?.image_url && (
        <section className="rounded-2xl bg-white border border-border shadow-soft p-3 mb-6">
          <img src={layout.image_url} alt={layout.label} className="w-full max-h-[500px] object-contain mx-auto rounded-lg" />
          <p className="font-body text-xs text-center text-muted-foreground mt-2">{layout.label}</p>
        </section>
      )}

      {/* Status banner if not fully assigned */}
      {!fullyAssigned && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 mb-6">
          <p className="font-body text-sm text-amber-900">
            <span className="font-medium">Help us fill in the seats.</span> Some guests still need a table — let Brandon know any preferences.
          </p>
        </div>
      )}

      {/* Tables */}
      <section className="space-y-3 mb-6">
        <div className="flex items-center justify-between">
          <p className="font-display text-xl font-light text-foreground">Tables</p>
          <button onClick={() => setPrintOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border font-body text-xs text-foreground hover:bg-muted">
            <Printer size={12} /> Print View
          </button>
        </div>
        {tables.map(t => {
          const guests = assignments.filter(a => a.table_id === t.id).sort((a, b) => a.guest_name.localeCompare(b.guest_name));
          const highlight = matchedTableIds.has(t.id);
          return (
            <div key={t.id} className={`rounded-xl bg-white border p-4 ${highlight ? "border-sage ring-2 ring-sage/30" : "border-border"}`}>
              <div className="flex items-center justify-between mb-2">
                <p className="font-display text-lg font-light">{t.table_name}</p>
                <span className="font-body text-xs text-muted-foreground">{guests.length} / {t.capacity}</span>
              </div>
              {guests.length === 0 ? (
                <p className="font-body text-sm text-muted-foreground italic">No guests seated yet</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {guests.map(g => (
                    <span key={g.id} className="inline-block rounded-full bg-sage/10 px-2.5 py-0.5 font-body text-xs text-sage-dark">
                      {g.guest_name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Add off-site guest */}
      <section className="rounded-2xl bg-white border border-border p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-display text-lg font-light">Add a guest</p>
            <p className="font-body text-xs text-muted-foreground">For off-site guests who aren't booking lodging here.</p>
          </div>
          {!adding && (
            <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-body text-xs">
              <Plus size={12} /> Add
            </button>
          )}
        </div>
        {adding && <AddGuestInline onAdd={addGuest} onCancel={() => setAdding(false)} />}
      </section>

      {printOpen && <PrintModal event={event} tables={tables} assignments={assignments} layout={layout} onClose={() => setPrintOpen(false)} />}
    </div>
  );
}

function AddGuestInline({ onAdd, onCancel }: { onAdd: (n: string, e: string) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  return (
    <div className="flex flex-wrap items-end gap-2">
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Guest name" className="flex-1 min-w-[160px] border border-border rounded-md px-3 py-2 font-body text-sm bg-background" />
      <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email (optional)" className="flex-1 min-w-[160px] border border-border rounded-md px-3 py-2 font-body text-sm bg-background" />
      <button onClick={() => onAdd(name, email)} className="px-3 py-2 rounded-md bg-primary text-primary-foreground font-body text-xs">Add</button>
      <button onClick={onCancel} className="px-3 py-2 rounded-md border border-border font-body text-xs">Cancel</button>
    </div>
  );
}

function PrintModal({ event, tables, assignments, layout, onClose }: any) {
  const alpha = [...assignments].sort((a: any, b: any) => {
    const la = a.guest_name.split(" ").slice(-1)[0];
    const lb = b.guest_name.split(" ").slice(-1)[0];
    return la.localeCompare(lb);
  });
  const tableName = (id: string | null) => tables.find((t: any) => t.id === id)?.table_name ?? "—";
  return (
    <div className="fixed inset-0 z-[100] bg-white overflow-y-auto">
      <style>{`@media print { .no-print { display: none !important; } }`}</style>
      <div className="no-print sticky top-0 bg-card border-b border-border p-3 flex items-center justify-between z-10">
        <p className="font-display text-lg">Seating Chart — Print View</p>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-body text-xs">Print</button>
          <button onClick={onClose} className="px-3 py-1.5 rounded-md border border-border font-body text-xs">Close</button>
        </div>
      </div>
      <div className="max-w-3xl mx-auto p-8">
        <div className="text-center mb-6">
          <p className="font-display text-3xl font-light">{event?.title ?? "Wedding"}</p>
          {event?.wedding_date && <p className="font-body text-sm text-muted-foreground">{new Date(event.wedding_date).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>}
        </div>
        {layout?.image_url && (
          <div className="mb-6 border border-border rounded-lg p-2">
            <img src={layout.image_url} alt="" className="w-full max-h-80 object-contain mx-auto" />
          </div>
        )}
        <table className="w-full font-body text-sm">
          <thead><tr className="border-b border-border"><th className="text-left py-2">Guest</th><th className="text-left py-2">Table</th></tr></thead>
          <tbody>
            {alpha.map((g: any) => (
              <tr key={g.id} className="border-b border-border/50">
                <td className="py-1.5">{g.guest_name}</td>
                <td className="py-1.5 text-muted-foreground">{tableName(g.table_id)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
