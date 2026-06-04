import { useEffect, useState } from "react";
import { Plus, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  DIETARY_RESTRICTIONS,
  RESTRICTION_TYPES,
  SEVERITIES,
  DietaryEntry,
  isProximity,
} from "@/lib/dietary";

const db = supabase as any;

interface MealEvent {
  id: string;
  meal_type: string;
}

interface Props {
  eventId: string;
  guestId: string;
  /** Optional pre-fetched meal events */
  mealEvents?: MealEvent[];
}

const MEAL_LABEL: Record<string, string> = {
  arrival_lunch: "Arrival Lunch",
  rehearsal_dinner: "Rehearsal Dinner",
  wedding_day_breakfast: "Wedding Day Breakfast",
  wedding: "Wedding",
  farewell_brunch: "Farewell Brunch",
};

const mealLabel = (m: string) =>
  MEAL_LABEL[m] || m.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default function DietaryEntriesEditor({ eventId, guestId, mealEvents: mealEventsProp }: Props) {
  const [entries, setEntries] = useState<DietaryEntry[]>([]);
  const [meals, setMeals] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [entriesRes, mealsRes] = await Promise.all([
        db.from("guest_dietary_entries").select("*").eq("guest_id", guestId).order("created_at"),
        mealEventsProp
          ? Promise.resolve({ data: mealEventsProp })
          : db.from("meal_events").select("id,meal_type").eq("event_id", eventId),
      ]);
      setEntries((entriesRes.data ?? []) as DietaryEntry[]);
      const mealTypes = ((mealsRes.data ?? []) as MealEvent[]).map((m) => m.meal_type).filter(Boolean);
      // Always include 'wedding' if no meal events configured
      setMeals(mealTypes.length ? Array.from(new Set(mealTypes)) : ["wedding"]);
      setLoading(false);
    })();
  }, [eventId, guestId]);

  const addEntry = async () => {
    const payload = {
      guest_id: guestId,
      event_id: eventId,
      restriction: DIETARY_RESTRICTIONS[0],
      restriction_type: null,
      severity: null,
      applies_to_meals: meals,
      notes: null,
    };
    const { data, error } = await db.from("guest_dietary_entries").insert(payload).select().single();
    if (error) return toast.error(error.message);
    setEntries((prev) => [...prev, data as DietaryEntry]);
  };

  const updateEntry = async (id: string, patch: Partial<DietaryEntry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    setSavingId(id);
    const { error } = await db.from("guest_dietary_entries").update(patch).eq("id", id);
    setSavingId(null);
    if (error) toast.error(error.message);
  };

  const removeEntry = async (id: string) => {
    if (!confirm("Remove this dietary entry?")) return;
    const { error } = await db.from("guest_dietary_entries").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 size={16} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.length === 0 && (
        <p className="font-body text-xs text-muted-foreground italic">
          No dietary needs recorded. Click "Add Dietary Need" to record an allergy, restriction, or preference.
        </p>
      )}

      {entries.map((e) => {
        const proximity = isProximity(e.restriction_type);
        return (
          <div key={e.id} className="rounded-lg border border-border bg-white p-3 space-y-2.5">
            <div className="flex items-start gap-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 flex-1">
                <select
                  className="px-2 py-1.5 rounded border border-input bg-background font-body text-xs"
                  value={e.restriction}
                  onChange={(ev) => updateEntry(e.id, { restriction: ev.target.value })}
                >
                  {DIETARY_RESTRICTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <select
                  className="px-2 py-1.5 rounded border border-input bg-background font-body text-xs"
                  value={e.restriction_type ?? ""}
                  onChange={(ev) => updateEntry(e.id, { restriction_type: ev.target.value || null })}
                >
                  <option value="">Type of restriction…</option>
                  {RESTRICTION_TYPES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <select
                  className="px-2 py-1.5 rounded border border-input bg-background font-body text-xs"
                  value={e.severity ?? ""}
                  onChange={(ev) => updateEntry(e.id, { severity: ev.target.value || null })}
                >
                  <option value="">Severity…</option>
                  {SEVERITIES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => removeEntry(e.id)}
                className="p-1.5 text-muted-foreground hover:text-destructive"
                title="Remove"
              >
                <Trash2 size={14} />
              </button>
            </div>

            {proximity && (
              <div className="flex items-center gap-1.5 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                <AlertTriangle size={12} /> Proximity restriction — affects kitchen handling, not just the plate.
              </div>
            )}

            <div>
              <p className="font-body text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Applies to meals
              </p>
              <div className="flex flex-wrap gap-1.5">
                {meals.map((m) => {
                  const checked = (e.applies_to_meals ?? []).includes(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        const cur = e.applies_to_meals ?? [];
                        const next = checked ? cur.filter((x) => x !== m) : [...cur, m];
                        updateEntry(e.id, { applies_to_meals: next });
                      }}
                      className={`px-2 py-0.5 rounded-full font-body text-[11px] border transition-colors ${
                        checked
                          ? "bg-sage text-primary-foreground border-sage"
                          : "bg-white text-muted-foreground border-border hover:text-foreground"
                      }`}
                    >
                      {mealLabel(m)}
                    </button>
                  );
                })}
              </div>
            </div>

            <input
              className="w-full px-2 py-1.5 rounded border border-input bg-background font-body text-xs"
              placeholder="Optional notes (severity details, cross-contamination, etc.)"
              value={e.notes ?? ""}
              onChange={(ev) => updateEntry(e.id, { notes: ev.target.value })}
            />
            {savingId === e.id && (
              <p className="text-[10px] text-muted-foreground">Saving…</p>
            )}
          </div>
        );
      })}

      <button
        onClick={addEntry}
        className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-border py-2.5 font-body text-xs text-muted-foreground hover:border-sage hover:text-sage-dark transition-colors"
      >
        <Plus size={14} /> Add Dietary Need
      </button>
    </div>
  );
}
