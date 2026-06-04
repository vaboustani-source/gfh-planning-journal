import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Info, AlertTriangle, AlertCircle, Leaf, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import AdminStickyFooter from "@/components/admin/AdminStickyFooter";
import { useAutosaveStatus } from "@/hooks/useAutosaveStatus";
import { SEVERITY_BADGE, isProximity } from "@/lib/dietary";

const db = supabase as any;

interface Guest {
  id: string;
  first_name: string;
  last_name: string;
  rsvp_status: string | null;
  dietary_restrictions: string[] | null; // legacy
}

interface Entry {
  id: string;
  guest_id: string;
  restriction: string;
  restriction_type: string | null;
  severity: string | null;
  applies_to_meals: string[] | null;
  notes: string | null;
}

const MEAL_LABEL: Record<string, string> = {
  arrival_lunch: "Arrival Lunch",
  rehearsal_dinner: "Rehearsal Dinner",
  wedding_day_breakfast: "Wedding Day Breakfast",
  wedding: "Wedding",
  farewell_brunch: "Farewell Brunch",
};
const mealLabel = (m: string) => MEAL_LABEL[m] || m.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const SEVERITY_ORDER = ["fatal", "medical", "preference"] as const;

const SECTION_META: Record<string, { title: string; subtitle: string; border: string; icon: any; accent: string }> = {
  fatal: {
    title: "Critical Allergies",
    subtitle: "Life-threatening — must be flagged to the kitchen and every food handler",
    border: "border-red-400 bg-red-50/50",
    icon: AlertCircle,
    accent: "text-red-700",
  },
  medical: {
    title: "Medically Significant",
    subtitle: "Serious symptoms — handle carefully",
    border: "border-amber-300 bg-amber-50/40",
    icon: AlertTriangle,
    accent: "text-amber-800",
  },
  preference: {
    title: "Preferences",
    subtitle: "Lifestyle, religious, or preference-based",
    border: "border-sage/30 bg-sage/5",
    icon: Leaf,
    accent: "text-sage-dark",
  },
};

export default function DietaryTab({ eventId, onNavigateNext }: { eventId: string; onNavigateNext: () => void }) {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const autosave = useAutosaveStatus();

  useEffect(() => { if (eventId) load(); }, [eventId]);

  const load = async () => {
    setLoading(true);
    const [g, e] = await Promise.all([
      db.from("guests").select("id,first_name,last_name,rsvp_status,dietary_restrictions").eq("event_id", eventId).order("last_name"),
      db.from("guest_dietary_entries").select("*").eq("event_id", eventId).order("created_at"),
    ]);
    if (g.error) toast.error("Could not load guests");
    setGuests((g.data ?? []) as Guest[]);
    setEntries((e.data ?? []) as Entry[]);
    setLoading(false);
  };

  const guestById = useMemo(() => {
    const m = new Map<string, Guest>();
    guests.forEach((g) => m.set(g.id, g));
    return m;
  }, [guests]);

  const grouped = useMemo(() => {
    const buckets: Record<string, Entry[]> = { fatal: [], medical: [], preference: [], unspecified: [] };
    for (const e of entries) {
      const key = (SEVERITY_ORDER as readonly string[]).includes(e.severity ?? "") ? (e.severity as string) : "unspecified";
      buckets[key].push(e);
    }
    return buckets;
  }, [entries]);

  const legacyGuests = useMemo(
    () => guests.filter((g) => (g.dietary_restrictions ?? []).length > 0),
    [guests]
  );

  const totals = {
    fatal: grouped.fatal.length,
    medical: grouped.medical.length,
    preference: grouped.preference.length,
    total: entries.length,
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-lg bg-sage/10 border border-sage/20 px-4 py-3">
        <Info size={16} className="text-sage-dark shrink-0 mt-0.5" />
        <p className="font-body text-sm text-foreground">
          Dietary information is recorded per guest with structured restriction, type, and severity. Add or
          edit entries from the Our People tab. Critical allergies surface at the top for kitchen safety.
        </p>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap items-center gap-3">
        <SummaryChip label="Critical" value={totals.fatal} tone="text-red-700" />
        <SummaryChip label="Medical" value={totals.medical} tone="text-amber-800" />
        <SummaryChip label="Preference" value={totals.preference} tone="text-sage-dark" />
        <SummaryChip label="Total entries" value={totals.total} />
      </div>

      {totals.total === 0 && legacyGuests.length === 0 && (
        <div className="bg-white border border-dashed border-border rounded-lg p-10 text-center">
          <p className="font-display text-lg italic text-muted-foreground">No dietary needs recorded yet</p>
          <p className="font-body text-sm text-muted-foreground mt-1">
            Open a guest in the Our People tab and use "Add Dietary Need".
          </p>
        </div>
      )}

      {(["fatal", "medical", "preference"] as const).map((sev) => {
        const items = grouped[sev];
        if (items.length === 0) return null;
        const meta = SECTION_META[sev];
        const Icon = meta.icon;
        return (
          <section key={sev} className={`rounded-xl border-2 ${meta.border} p-5`}>
            <div className="flex items-start gap-2.5 mb-4">
              <Icon size={20} className={`${meta.accent} mt-0.5`} />
              <div>
                <h3 className={`font-display text-xl ${meta.accent}`}>{meta.title}</h3>
                <p className="font-body text-xs text-muted-foreground">{meta.subtitle}</p>
              </div>
              <span className="ml-auto font-body text-xs text-muted-foreground">{items.length} entries</span>
            </div>
            <div className="space-y-2">
              {items.map((e) => (
                <EntryRow key={e.id} entry={e} guest={guestById.get(e.guest_id)} />
              ))}
            </div>
          </section>
        );
      })}

      {grouped.unspecified.length > 0 && (
        <section className="rounded-xl border border-border bg-white p-5">
          <h3 className="font-display text-lg mb-3">Severity not yet set</h3>
          <div className="space-y-2">
            {grouped.unspecified.map((e) => (
              <EntryRow key={e.id} entry={e} guest={guestById.get(e.guest_id)} />
            ))}
          </div>
        </section>
      )}

      {/* Legacy free-text data */}
      {legacyGuests.length > 0 && (
        <section className="rounded-xl border border-dashed border-border bg-cream-dark/20 p-5">
          <h3 className="font-display text-lg mb-1">Legacy notes</h3>
          <p className="font-body text-xs text-muted-foreground mb-3">
            These guests have free-text dietary info from the previous system. Convert to structured entries
            by editing the guest in Our People.
          </p>
          <div className="space-y-1.5">
            {legacyGuests.map((g) => (
              <div key={g.id} className="flex items-center gap-3 text-sm">
                <span className="font-body font-medium">{g.first_name} {g.last_name}</span>
                <span className="font-body text-xs text-muted-foreground">— {(g.dietary_restrictions ?? []).join(", ")}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <AdminStickyFooter status={autosave.status} onSave={async () => {}} onSaveAndContinue={async () => { onNavigateNext(); }} />
    </div>
  );
}

function SummaryChip({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg bg-white border border-border px-4 py-2">
      <p className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`font-display text-xl ${tone ?? "text-foreground"}`}>{value}</p>
    </div>
  );
}

function EntryRow({ entry, guest }: { entry: Entry; guest?: Guest }) {
  const sev = entry.severity ? SEVERITY_BADGE[entry.severity] : null;
  const proximity = isProximity(entry.restriction_type);
  return (
    <div className="bg-white border border-border rounded-lg px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <div className="font-body text-sm font-medium min-w-[140px]">
        {guest ? `${guest.first_name} ${guest.last_name}` : "Unknown guest"}
      </div>
      <div className="font-body text-sm text-foreground inline-flex items-center gap-1.5">
        <UtensilsCrossed size={12} className="text-muted-foreground" />
        {entry.restriction}
      </div>
      {entry.restriction_type && (
        <span className="font-body text-[11px] text-muted-foreground">· {entry.restriction_type}</span>
      )}
      {proximity && (
        <span title="Proximity restriction — affects kitchen handling" className="inline-flex items-center gap-1 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
          <AlertTriangle size={11} /> Proximity
        </span>
      )}
      {sev && (
        <span className={`px-2 py-0.5 rounded-full font-body text-[10px] border ${sev.cls}`}>{sev.label}</span>
      )}
      {(entry.applies_to_meals ?? []).length > 0 && (
        <span className="font-body text-[11px] text-muted-foreground ml-auto">
          {(entry.applies_to_meals ?? []).map(mealLabel).join(", ")}
        </span>
      )}
      {entry.notes && (
        <p className="basis-full font-body text-[11px] text-muted-foreground italic pl-1">↳ {entry.notes}</p>
      )}
    </div>
  );
}
