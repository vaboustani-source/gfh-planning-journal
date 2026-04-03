import { useState } from "react";
import { SectionTabs } from "@/components/portal/SectionTabs";
import BarTab from "./BarTab";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, Trash2, Save, Check, Calendar } from "lucide-react";
import { useAutosaveStatus } from "@/hooks/useAutosaveStatus";
import AdminStickyFooter from "@/components/admin/AdminStickyFooter";

/* ──── Meal Events sub-tab ──── */

interface MealEvent {
  id: string;
  meal_type: string;
  location: string | null;
  adult_count: number | null;
  kids_count: number | null;
  vendor_count: number | null;
  included_in_package: boolean;
  notes: string | null;
}

function MealEventsSubTab({ eventId }: { eventId: string }) {
  const [meals, setMeals] = useState<MealEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const autosave = useAutosaveStatus();

  useEffect(() => {
    supabase
      .from("meal_events")
      .select("*")
      .eq("event_id", eventId)
      .order("meal_type")
      .then(({ data }) => {
        if (data) setMeals(data.map(m => ({ ...m, included_in_package: m.included_in_package ?? true })));
        setLoading(false);
      });
  }, [eventId]);

  const saveMeal = async (meal: MealEvent) => {
    autosave.setSaving();
    const { error } = await supabase.from("meal_events").update({
      meal_type: meal.meal_type,
      location: meal.location,
      adult_count: meal.adult_count,
      kids_count: meal.kids_count,
      vendor_count: meal.vendor_count,
      included_in_package: meal.included_in_package,
      notes: meal.notes,
    }).eq("id", meal.id);
    error ? autosave.setError() : autosave.setSaved();
  };

  const addMeal = async () => {
    const { data } = await supabase
      .from("meal_events")
      .insert({ event_id: eventId, meal_type: "New Meal", included_in_package: true })
      .select("*")
      .single();
    if (data) setMeals(prev => [...prev, { ...data, included_in_package: data.included_in_package ?? true }]);
  };

  const deleteMeal = async (id: string) => {
    setMeals(prev => prev.filter(m => m.id !== id));
    await supabase.from("meal_events").delete().eq("id", id);
  };

  const updateMeal = (id: string, field: string, value: any) => {
    setMeals(prev => prev.map(m => {
      if (m.id !== id) return m;
      const updated = { ...m, [field]: value };
      saveMeal(updated);
      return updated;
    }));
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <p className="font-body text-sm text-muted-foreground">{meals.length} meal events</p>
        <button onClick={addMeal} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 font-body text-xs text-primary-foreground hover:bg-primary/90 transition-colors">
          <Plus size={13} /> Add Meal
        </button>
      </div>
      {meals.map(meal => (
        <div key={meal.id} className="rounded-xl bg-card border border-border p-5 shadow-soft space-y-3">
          <div className="flex items-center justify-between">
            <input
              value={meal.meal_type}
              onChange={e => updateMeal(meal.id, "meal_type", e.target.value)}
              className="font-display text-lg font-light text-foreground bg-transparent outline-none border-b border-transparent focus:border-primary/30 w-full"
            />
            <button onClick={() => deleteMeal(meal.id)} className="text-muted-foreground hover:text-destructive transition-colors ml-2">
              <Trash2 size={14} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">Location</label>
              <input value={meal.location ?? ""} onChange={e => updateMeal(meal.id, "location", e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 font-body text-sm" />
            </div>
            <div>
              <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">Adults</label>
              <input type="number" value={meal.adult_count ?? 0} onChange={e => updateMeal(meal.id, "adult_count", parseInt(e.target.value) || 0)} className="w-full rounded-lg border border-border bg-background px-3 py-2 font-body text-sm" />
            </div>
            <div>
              <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">Kids</label>
              <input type="number" value={meal.kids_count ?? 0} onChange={e => updateMeal(meal.id, "kids_count", parseInt(e.target.value) || 0)} className="w-full rounded-lg border border-border bg-background px-3 py-2 font-body text-sm" />
            </div>
            <div>
              <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">Vendor meals</label>
              <input type="number" value={meal.vendor_count ?? 0} onChange={e => updateMeal(meal.id, "vendor_count", parseInt(e.target.value) || 0)} className="w-full rounded-lg border border-border bg-background px-3 py-2 font-body text-sm" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={meal.included_in_package} onChange={e => updateMeal(meal.id, "included_in_package", e.target.checked)} className="accent-primary" />
            <span className="font-body text-xs text-muted-foreground">Included in package</span>
          </div>
          <div>
            <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">Notes</label>
            <textarea value={meal.notes ?? ""} onChange={e => updateMeal(meal.id, "notes", e.target.value)} rows={2} className="w-full rounded-lg border border-border bg-background px-3 py-2 font-body text-sm resize-none" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ──── Tasting sub-tab ──── */

function TastingSubTab({ eventId, tastingDate, tastingDateNote }: { eventId: string; tastingDate: string | null; tastingDateNote: string | null }) {
  const [date, setDate] = useState(tastingDate ?? "");
  const [notes, setNotes] = useState(tastingDateNote ?? "");
  const [confirmed, setConfirmed] = useState(!!tastingDate);
  const autosave = useAutosaveStatus();

  const save = async (field: string, value: any) => {
    autosave.setSaving();
    const { error } = await supabase.from("events").update({ [field]: value }).eq("id", eventId);
    error ? autosave.setError() : autosave.setSaved();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-card border border-border p-5 shadow-soft space-y-4">
        <p className="font-display text-lg font-light text-foreground">Tasting Details</p>
        <div>
          <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">Tasting Date</label>
          <input
            type="date"
            value={date}
            onChange={e => { setDate(e.target.value); save("tasting_date", e.target.value || null); }}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 font-body text-sm mt-1"
          />
        </div>
        <div>
          <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">Tasting Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            onBlur={() => save("tasting_date_note", notes || null)}
            rows={4}
            placeholder="Notes from the tasting — flavors chosen, couple preferences, any changes..."
            className="w-full rounded-lg border border-border bg-background px-3 py-2 font-body text-sm resize-none mt-1"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={e => { setConfirmed(e.target.checked); }}
            className="accent-primary"
          />
          <span className="font-body text-sm text-foreground">Tasting confirmed</span>
        </div>
      </div>
    </div>
  );
}

/* ──── Main wrapper ──── */

const SUB_TABS = [
  { id: "meals", label: "Meal Events" },
  { id: "bar", label: "Bar Selections" },
  { id: "tasting", label: "Tasting" },
];

export default function MenusBarTab({ eventId, onNavigateNext, tastingDate, tastingDateNote }: {
  eventId: string;
  onNavigateNext: () => void;
  tastingDate?: string | null;
  tastingDateNote?: string | null;
}) {
  const [sub, setSub] = useState("meals");

  return (
    <div>
      <SectionTabs tabs={SUB_TABS} active={sub} onChange={setSub} />
      <div className="mt-6">
        {sub === "meals" && <MealEventsSubTab eventId={eventId} />}
        {sub === "bar" && <BarTab eventId={eventId} onNavigateNext={() => {}} embedded />}
        {sub === "tasting" && <TastingSubTab eventId={eventId} tastingDate={tastingDate ?? null} tastingDateNote={tastingDateNote ?? null} />}
      </div>
      <AdminStickyFooter onSaveAndContinue={onNavigateNext} />
    </div>
  );
}
