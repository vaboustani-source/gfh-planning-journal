import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePortalData } from "@/hooks/usePortalData";
import { Loader2, Save, Check, Plus, Trash2, GripVertical } from "lucide-react";

interface DietaryGuest {
  id: string;
  guest_name: string;
  is_onsite: boolean;
  reception_only: boolean;
  other_meals: string;
  has_restriction: boolean;
  restriction_type: string;
  severity: string;
  notes: string;
  is_child: boolean;
  child_age: number | null;
  sort_order: number;
  isPartner?: boolean;
}

const SEVERITY_OPTIONS = ["Mild", "Moderate", "Severe", "Allergy"];

const emptyGuest = (sort: number): Omit<DietaryGuest, "id"> => ({
  guest_name: "",
  is_onsite: false,
  reception_only: false,
  other_meals: "",
  has_restriction: false,
  restriction_type: "",
  severity: "",
  notes: "",
  is_child: false,
  child_age: null,
  sort_order: sort,
});

export function DietaryRestrictions() {
  const { eventId } = usePortalData();
  const [guests, setGuests] = useState<DietaryGuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      const { data } = await supabase
        .from("dietary_restrictions")
        .select("*")
        .eq("event_id", eventId)
        .order("sort_order");
      if (data && data.length > 0) {
        setGuests(data.map(g => ({
          ...g,
          guest_name: g.guest_name ?? "",
          other_meals: g.other_meals ?? "",
          restriction_type: g.restriction_type ?? "",
          severity: g.severity ?? "",
          notes: g.notes ?? "",
          is_onsite: g.is_onsite ?? false,
          reception_only: g.reception_only ?? false,
          has_restriction: g.has_restriction ?? false,
          is_child: g.is_child ?? false,
          child_age: g.child_age,
          sort_order: g.sort_order ?? 0,
        })));
      } else {
        // Pre-populate with two partner rows
        const p1: DietaryGuest = { id: crypto.randomUUID(), ...emptyGuest(0), guest_name: "Partner 1", isPartner: true };
        const p2: DietaryGuest = { id: crypto.randomUUID(), ...emptyGuest(1), guest_name: "Partner 2", isPartner: true };
        setGuests([p1, p2]);
      }
      setLoading(false);
    })();
  }, [eventId]);

  const updateGuest = (id: string, field: string, value: any) => {
    setGuests(prev => prev.map(g => g.id === id ? { ...g, [field]: value } : g));
    setSaved(false);
  };

  const addGuest = () => {
    setGuests(prev => [...prev, { id: crypto.randomUUID(), ...emptyGuest(prev.length) }]);
    setSaved(false);
  };

  const removeGuest = (id: string) => {
    setGuests(prev => prev.filter(g => g.id !== id));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!eventId) return;
    setSaving(true);
    // Delete all existing then re-insert
    await supabase.from("dietary_restrictions").delete().eq("event_id", eventId);
    const rows = guests.map((g, i) => ({
      id: g.id,
      event_id: eventId,
      guest_name: g.guest_name || null,
      is_onsite: g.is_onsite,
      reception_only: g.reception_only,
      other_meals: g.other_meals || null,
      has_restriction: g.has_restriction,
      restriction_type: g.has_restriction ? (g.restriction_type || null) : null,
      severity: g.has_restriction ? (g.severity || null) : null,
      notes: g.notes || null,
      is_child: g.is_child,
      child_age: g.is_child ? g.child_age : null,
      sort_order: i,
    }));
    if (rows.length > 0) {
      await supabase.from("dietary_restrictions").insert(rows);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const restrictionCount = guests.filter(g => g.has_restriction).length;
  const childCount = guests.filter(g => g.is_child).length;

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-5">
      {/* Instruction */}
      <div className="rounded-xl bg-sage/8 border border-sage/20 px-5 py-4">
        <p className="font-body text-sm text-foreground/80 italic leading-relaxed">
          List any guests with dietary restrictions, allergies, or special needs — including children under 8 who need kids meals. You don't need your full guest list here — just the ones with specific needs or kids meals.
        </p>
      </div>

      {/* Summary */}
      {(restrictionCount > 0 || childCount > 0) && (
        <p className="font-body text-sm text-muted-foreground">
          {restrictionCount} guest{restrictionCount !== 1 && "s"} with restrictions · {childCount} child{childCount !== 1 && "ren"}
        </p>
      )}

      {/* Guest rows */}
      {guests.map((guest, idx) => (
        <div key={guest.id} className="rounded-xl bg-card border border-border shadow-soft overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border bg-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GripVertical size={14} className="text-muted-foreground/40" />
              <span className="font-body text-xs text-muted-foreground">Guest {idx + 1}</span>
            </div>
            {!guest.isPartner && idx >= 2 && (
              <button onClick={() => removeGuest(guest.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 size={14} />
              </button>
            )}
          </div>
          <div className="px-5 py-4 space-y-4">
            {/* Name */}
            <div>
              <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">Guest Name</label>
              <input
                type="text"
                value={guest.guest_name}
                onChange={e => updateGuest(guest.id, "guest_name", e.target.value)}
                placeholder="Full name"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3.5 py-2.5 font-body text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
              />
            </div>

            {/* Attendance toggles */}
            <div className="flex flex-wrap gap-3">
              <ToggleChip label="On-site (all meals)" active={guest.is_onsite} onChange={v => {
                updateGuest(guest.id, "is_onsite", v);
                if (v) updateGuest(guest.id, "reception_only", false);
              }} />
              <ToggleChip label="Reception only" active={guest.reception_only} onChange={v => {
                updateGuest(guest.id, "reception_only", v);
                if (v) updateGuest(guest.id, "is_onsite", false);
              }} />
            </div>

            {!guest.is_onsite && !guest.reception_only && (
              <div>
                <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">Which meals?</label>
                <input
                  type="text"
                  value={guest.other_meals}
                  onChange={e => updateGuest(guest.id, "other_meals", e.target.value)}
                  placeholder="e.g. Friday dinner + Saturday lunch"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3.5 py-2.5 font-body text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                />
              </div>
            )}

            {/* Dietary restriction */}
            <ToggleChip label="Has dietary restriction" active={guest.has_restriction} onChange={v => updateGuest(guest.id, "has_restriction", v)} />

            {guest.has_restriction && (
              <div className="pl-4 border-l-2 border-sage/20 space-y-3">
                <div>
                  <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">Restriction Type</label>
                  <input
                    type="text"
                    value={guest.restriction_type}
                    onChange={e => updateGuest(guest.id, "restriction_type", e.target.value)}
                    placeholder="e.g. Gluten-free, Vegetarian, Nut allergy"
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3.5 py-2.5 font-body text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                  />
                </div>
                <div>
                  <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">Severity</label>
                  <select
                    value={guest.severity}
                    onChange={e => updateGuest(guest.id, "severity", e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3.5 py-2.5 font-body text-sm text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                  >
                    <option value="">Select severity</option>
                    {SEVERITY_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">Notes</label>
                  <textarea
                    value={guest.notes}
                    onChange={e => updateGuest(guest.id, "notes", e.target.value)}
                    placeholder="Additional details…"
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3.5 py-2.5 font-body text-sm text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                  />
                </div>
              </div>
            )}

            {/* Child toggle */}
            <ToggleChip label="Child (needs kids meal)" active={guest.is_child} onChange={v => updateGuest(guest.id, "is_child", v)} />

            {guest.is_child && (
              <div className="pl-4 border-l-2 border-sage/20">
                <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">Child's Age</label>
                <input
                  type="number"
                  min={0} max={17}
                  value={guest.child_age ?? ""}
                  onChange={e => updateGuest(guest.id, "child_age", e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="Age"
                  className="mt-1 w-24 rounded-lg border border-border bg-background px-3.5 py-2.5 font-body text-sm text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                />
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Add guest */}
      <button
        onClick={addGuest}
        className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-3.5 font-body text-sm text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
      >
        <Plus size={15} /> Add Guest
      </button>

      {/* Save */}
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
          <><Save size={15} /> Save Dietary Info</>
        )}
      </button>
    </div>
  );
}

function ToggleChip({ label, active, onChange }: { label: string; active: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!active)}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 font-body text-sm transition-colors border ${
        active
          ? "bg-sage/15 border-sage/30 text-foreground"
          : "bg-background border-border text-muted-foreground hover:border-primary/30"
      }`}
    >
      <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-colors ${
        active ? "border-primary bg-primary" : "border-muted-foreground/40"
      }`}>
        {active && <Check size={8} className="text-primary-foreground" />}
      </div>
      {label}
    </button>
  );
}
