import { useState, useEffect, useMemo } from "react";
import { SectionTabs } from "@/components/portal/SectionTabs";
import BarTab from "./BarTab";
import MenuSelectionsSubTab from "./MenuSelectionsSubTab";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Lock, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { formatMealType } from "@/lib/formatMealType";
import { useAutosaveStatus } from "@/hooks/useAutosaveStatus";
import AdminStickyFooter from "@/components/admin/AdminStickyFooter";
import { guestAttendsMeal, countMealAttendees, type AttendanceGuest } from "@/lib/mealAttendance";

interface GuestForMeals extends AttendanceGuest {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

interface DietaryEntryLite {
  guest_id: string | null;
  restriction: string;
  severity: string | null;
  applies_to_meals: string[] | null;
}

/* ──── Meal Events sub-tab ──── */

interface MealEvent {
  id: string;
  meal_type: string;
  location: string | null;
  adult_count: number | null;
  kids_count: number | null;
  vendor_count: number | null;
  included_in_package: boolean;
  doing_meal: boolean;
  notes: string | null;
}

function MealEventsSubTab({ eventId }: { eventId: string }) {
  const [meals, setMeals] = useState<MealEvent[]>([]);
  const [guests, setGuests] = useState<GuestForMeals[]>([]);
  const [dietaries, setDietaries] = useState<DietaryEntryLite[]>([]);
  const [loading, setLoading] = useState(true);
  const autosave = useAutosaveStatus();

  useEffect(() => {
    (async () => {
      const [mealsRes, guestsRes, dietRes] = await Promise.all([
        supabase.from("meal_events").select("*").eq("event_id", eventId).order("meal_type"),
        supabase
          .from("guests")
          .select("id, first_name, last_name, lodging_preference, is_child, invited_optional_meals, rsvp_status")
          .eq("event_id", eventId),
        supabase
          .from("guest_dietary_entries")
          .select("guest_id, restriction, severity, applies_to_meals")
          .eq("event_id", eventId),
      ]);
      if (mealsRes.data) setMeals(mealsRes.data.map((m: any) => ({ ...m, included_in_package: m.included_in_package ?? true, doing_meal: m.doing_meal ?? true })));
      if (guestsRes.data) setGuests(guestsRes.data as any);
      if (dietRes.data) setDietaries(dietRes.data as any);
      setLoading(false);
    })();
  }, [eventId]);

  const updateMeal = (id: string, field: string, value: any) => {
    setMeals(prev => prev.map(m => m.id !== id ? m : { ...m, [field]: value }));
    autosave.debouncedSave(`meal-${id}-${field}`, async () => {
      await supabase.from("meal_events").update({ [field]: value } as any).eq("id", id);
    });
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

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <p className="font-body text-sm text-muted-foreground">{meals.length} meal events</p>
        <button onClick={addMeal} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 font-body text-xs text-primary-foreground hover:bg-primary/90 transition-colors">
          <Plus size={13} /> Add Meal
        </button>
      </div>
      {meals.map(meal => {
        const { adults, kids } = countMealAttendees(meal.meal_type, guests);
        // Per-meal dietary summary: include entries whose applies_to_meals is empty/null
        // (treated as all-meals default) or contains this meal_type, AND whose guest attends.
        const attendingIds = new Set(
          guests.filter(g => g.rsvp_status !== "declined" && guestAttendsMeal(g, meal.meal_type)).map(g => g.id)
        );
        const relevant = dietaries.filter(d => {
          if (!d.guest_id || !attendingIds.has(d.guest_id)) return false;
          const tags = d.applies_to_meals ?? [];
          return tags.length === 0 || tags.includes(meal.meal_type) || tags.includes("wedding");
        });
        const counts = new Map<string, number>();
        for (const d of relevant) {
          const key = d.restriction;
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        const summary = Array.from(counts.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([k, n]) => `${n} ${k}`)
          .join(", ");
        const fatalCount = relevant.filter(d => d.severity === "fatal").length;

        return (
        <div key={meal.id} className="rounded-xl bg-card border border-border p-5 shadow-soft space-y-3">
          <div className="flex items-center justify-between">
            <input
              value={formatMealType(meal.meal_type)}
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
              <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">Vendor meals</label>
              <input type="number" value={meal.vendor_count ?? 0} onChange={e => updateMeal(meal.id, "vendor_count", parseInt(e.target.value) || 0)} className="w-full rounded-lg border border-border bg-background px-3 py-2 font-body text-sm" />
            </div>
            <div>
              <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">Adults</label>
              <div className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 font-body text-sm flex items-baseline justify-between">
                <span className="font-medium">{adults}</span>
                <span className="text-[10px] text-muted-foreground italic">from guest list</span>
              </div>
            </div>
            <div>
              <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">Kids</label>
              <div className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 font-body text-sm flex items-baseline justify-between">
                <span className="font-medium">{kids}</span>
                <span className="text-[10px] text-muted-foreground italic">from guest list</span>
              </div>
            </div>
          </div>
          <div>
            <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">Dietary summary</label>
            {relevant.length === 0 ? (
              <p className="font-body text-xs text-muted-foreground italic mt-1">No dietary needs noted.</p>
            ) : (
              <p className="font-body text-xs text-foreground mt-1">
                {summary}
                {fatalCount > 0 && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-red-100 text-red-800 border border-red-300 px-1.5 py-0.5 text-[10px] font-medium">
                    {fatalCount} fatal
                  </span>
                )}
              </p>
            )}
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
      );})}
    </div>
  );
}

/* ──── Tasting sub-tab ──── */

function TastingSubTab({ eventId, tastingDate, tastingDateNote }: { eventId: string; tastingDate: string | null; tastingDateNote: string | null }) {
  const [date, setDate] = useState(tastingDate ?? "");
  const [notes, setNotes] = useState(tastingDateNote ?? "");
  const [internalNotes, setInternalNotes] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const { user } = useAuth();
  const autosave = useAutosaveStatus();

  useEffect(() => {
    if (!user) return;
    supabase
      .from("users")
      .select("is_gfh_internal")
      .eq("id", user.id)
      .single()
      .then(({ data }) => setIsInternal(!!(data as any)?.is_gfh_internal));
  }, [user]);

  useEffect(() => {
    if (!isInternal) return;
    supabase
      .from("events")
      .select("tasting_notes_internal")
      .eq("id", eventId)
      .single()
      .then(({ data }) => setInternalNotes(((data as any)?.tasting_notes_internal as string) ?? ""));
  }, [eventId, isInternal]);

  const save = async (field: string, value: any) => {
    autosave.debouncedSave(`tasting-${field}`, async () => {
      await supabase.from("events").update({ [field]: value } as any).eq("id", eventId);
    });
  };

  const saveInternal = async () => {
    await supabase.from("events").update({ tasting_notes_internal: internalNotes || null } as any).eq("id", eventId);
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
            onChange={e => { setNotes(e.target.value); save("tasting_date_note", e.target.value || null); }}
            rows={4}
            placeholder="Notes from the tasting — flavors chosen, couple preferences, any changes..."
            className="w-full rounded-lg border border-border bg-background px-3 py-2 font-body text-sm resize-none mt-1"
          />
        </div>
      </div>

      {isInternal && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 p-5 shadow-soft space-y-3">
          <div className="flex items-center gap-2">
            <Lock size={14} className="text-amber-700 dark:text-amber-400" />
            <p className="font-body text-[11px] tracking-widest uppercase text-amber-800 dark:text-amber-300 font-semibold">
              GFH Internal Only
            </p>
          </div>
          <div>
            <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">Tasting Notes (Internal)</label>
            <textarea
              value={internalNotes}
              onChange={e => setInternalNotes(e.target.value)}
              onBlur={saveInternal}
              rows={5}
              placeholder="Internal-only notes — kitchen feedback, staffing observations, cost considerations..."
              className="w-full rounded-lg border border-amber-300 dark:border-amber-800 bg-background px-3 py-2 font-body text-sm resize-none mt-1"
            />
            <p className="font-body text-[11px] text-muted-foreground mt-1.5">Visible only to GFH internal staff. Not shown to couples or external planners.</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ──── Main wrapper ──── */

const SUB_TABS = [
  { id: "meals", label: "Meal Events" },
  { id: "selections", label: "Menu Selections" },
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
  const autosave = useAutosaveStatus();

  return (
    <div>
      <SectionTabs tabs={SUB_TABS} active={sub} onChange={setSub} />
      <div className="mt-6">
        {sub === "meals" && <MealEventsSubTab eventId={eventId} />}
        {sub === "selections" && <MenuSelectionsSubTab eventId={eventId} />}
        {sub === "bar" && <BarTab eventId={eventId} onNavigateNext={() => {}} />}
        {sub === "tasting" && <TastingSubTab eventId={eventId} tastingDate={tastingDate ?? null} tastingDateNote={tastingDateNote ?? null} />}
      </div>
      <AdminStickyFooter status={autosave.status} onSave={() => {}} onSaveAndContinue={onNavigateNext} />
    </div>
  );
}
