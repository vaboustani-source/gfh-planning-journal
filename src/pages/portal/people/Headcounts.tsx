import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePortalData } from "@/hooks/usePortalData";
import { Save, Check, Loader2, Minus, Plus } from "lucide-react";

interface MealEvent {
  id: string;
  meal_type: string;
  adult_count: number;
  kids_count: number;
  location: string | null;
}

function formatMealType(raw: string) {
  return raw
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function Stepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <p className="font-body text-sm text-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(0, value - 1))}
          className="w-11 h-11 sm:w-8 sm:h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
        >
          <Minus size={14} />
        </button>
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => {
            const n = parseInt(e.target.value);
            onChange(isNaN(n) || n < 0 ? 0 : n);
          }}
          className="w-12 h-11 sm:h-8 rounded-md border border-border bg-background text-center font-display text-xl font-light text-foreground tabular-nums focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button
          onClick={() => onChange(value + 1)}
          className="w-11 h-11 sm:w-8 sm:h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

export function Headcounts() {
  const { eventId } = usePortalData();
  const [meals, setMeals] = useState<MealEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    supabase
      .from("meal_events")
      .select("id, meal_type, adult_count, kids_count, location")
      .eq("event_id", eventId)
      .order("meal_type")
      .then(({ data }) => {
        if (data) {
          setMeals(
            data.map((m) => ({
              ...m,
              adult_count: m.adult_count ?? 0,
              kids_count: m.kids_count ?? 0,
            }))
          );
        }
        setLoading(false);
      });
  }, [eventId]);

  const updateCount = (id: string, field: "adult_count" | "kids_count", value: number) => {
    setMeals((prev) => prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    await Promise.all(
      meals.map((m) =>
        supabase
          .from("meal_events")
          .update({ adult_count: m.adult_count, kids_count: m.kids_count })
          .eq("id", m.id)
      )
    );
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const totalAdults = meals.reduce((s, m) => s + m.adult_count, 0);
  const totalKids = meals.reduce((s, m) => s + m.kids_count, 0);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>;
  }

  if (meals.length === 0) {
    return (
      <p className="font-body text-sm text-muted-foreground text-center py-8">
        Your meal events will appear here once your coordinator adds them.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {meals.map((meal) => (
        <div key={meal.id} className="rounded-xl bg-card border border-border shadow-soft overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border bg-muted/30">
            <p className="font-display text-xl font-light text-foreground">
              {formatMealType(meal.meal_type)}
            </p>
            {meal.location && (
              <p className="font-body text-xs text-muted-foreground mt-0.5">{meal.location}</p>
            )}
          </div>
          <div className="px-5 py-2 divide-y divide-border">
            <Stepper label="Adults" value={meal.adult_count} onChange={(v) => updateCount(meal.id, "adult_count", v)} />
            <Stepper label="Children" value={meal.kids_count} onChange={(v) => updateCount(meal.id, "kids_count", v)} />
          </div>
          <div className="px-5 py-3 bg-muted/20 border-t border-border">
            <p className="font-body text-xs text-muted-foreground text-right">
              Total:{" "}
              <span className="font-medium text-foreground">
                {meal.adult_count + meal.kids_count}
              </span>
            </p>
          </div>
        </div>
      ))}

      {/* Grand total */}
      <div className="rounded-xl bg-sage/6 border border-sage/15 px-5 py-4 flex items-center justify-between">
        <p className="font-body text-sm text-foreground font-medium">Overall total</p>
        <p className="font-body text-sm text-foreground">
          <span className="font-medium">{totalAdults}</span> adults
          {totalKids > 0 && <> + <span className="font-medium">{totalKids}</span> children</>}
        </p>
      </div>

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
          <><Save size={15} /> Save Headcounts</>
        )}
      </button>
    </div>
  );
}
