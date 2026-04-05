import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePortalData } from "@/hooks/usePortalData";
import { Loader2, Save, Check } from "lucide-react";
import { formatMealType, MEAL_SORT_ORDER } from "@/lib/formatMealType";

interface MealEvent {
  id: string;
  meal_type: string;
  adult_count: number | null;
  kids_count: number | null;
  location: string | null;
  notes: string;
}

export function MealPrefs() {
  const { eventId } = usePortalData();
  const [meals, setMeals] = useState<MealEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    supabase
      .from("meal_events")
      .select("id, meal_type, adult_count, kids_count, location, notes")
      .eq("event_id", eventId)
      .then(({ data }) => {
        if (data) {
          const sorted = [...data].sort((a, b) => {
            const ai = MEAL_SORT_ORDER.indexOf(a.meal_type);
            const bi = MEAL_SORT_ORDER.indexOf(b.meal_type);
            return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
          });
          setMeals(sorted.map((m) => ({ ...m, notes: m.notes ?? "" })));
        }
        setLoading(false);
      });
  }, [eventId]);

  const updateNote = (id: string, notes: string) => {
    setMeals((prev) => prev.map((m) => (m.id === id ? { ...m, notes } : m)));
    setSavedId(null);
  };

  const saveNote = async (id: string, notes: string) => {
    setSavingId(id);
    await supabase.from("meal_events").update({ notes: notes || null }).eq("id", id);
    setSavingId(null);
    setSavedId(id);
    setTimeout(() => setSavedId(null), 2500);
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>;
  }

  if (meals.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="font-display text-xl italic text-muted-foreground">No meal events yet</p>
        <p className="font-body text-sm text-muted-foreground mt-1">Meal events will appear here once they're added.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="font-body text-sm text-muted-foreground">
        Add any dietary preferences, restrictions, or special requests for each meal.
      </p>

      {meals.map((meal) => {
        const total = (meal.adult_count ?? 0) + (meal.kids_count ?? 0);
        return (
          <div key={meal.id} className="rounded-xl bg-card border border-border shadow-soft overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border bg-muted/30 flex items-start justify-between">
              <div>
                <p className="font-display text-xl font-light text-foreground">
                  {formatMealType(meal.meal_type)}
                </p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {meal.location && (
                    <span className="font-body text-xs text-muted-foreground">{meal.location}</span>
                  )}
                  {total > 0 && (
                    <>
                      {meal.location && <span className="text-border">·</span>}
                      <span className="font-body text-xs text-muted-foreground">{total} guests</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="px-5 py-4 space-y-2">
              <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">
                Dietary preferences & special requests
              </label>
              <textarea
                value={meal.notes}
                onChange={(e) => updateNote(meal.id, e.target.value)}
                placeholder={`Any preferences for ${formatMealType(meal.meal_type).toLowerCase()}? Allergies, dietary restrictions, special seating…`}
                rows={3}
                maxLength={600}
                className="w-full rounded-lg border border-border bg-background px-3.5 py-3 font-body text-sm text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
              />
              <div className="flex justify-end">
                <button
                  onClick={() => saveNote(meal.id, meal.notes)}
                  disabled={savingId === meal.id}
                  className="flex items-center gap-1.5 font-body text-xs text-primary hover:text-sage-dark transition-colors disabled:opacity-50"
                >
                  {savingId === meal.id ? (
                    <><Loader2 size={12} className="animate-spin" /> Saving…</>
                  ) : savedId === meal.id ? (
                    <><Check size={12} /> Saved</>
                  ) : (
                    <><Save size={12} /> Save notes</>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
