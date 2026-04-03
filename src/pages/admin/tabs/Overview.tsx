import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EventData } from "../EventDetail";
import { Check, Edit2 } from "lucide-react";
import { addDays, subDays, format } from "date-fns";

const PACKAGE_TIERS = ["base", "premium", "elite"];
const STATUSES = ["onboarding", "planning", "active", "complete", "archived"];

interface Props {
  event: EventData;
  coupleNames: string;
  onUpdate: (e: EventData) => void;
}

function Field({ label, value, onSave }: { label: string; value: string; onSave: (v: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await onSave(draft);
    setSaving(false);
    setEditing(false);
  };

  return (
    <div className="group">
      <p className="font-body text-[11px] text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
            className="flex-1 border border-border rounded-md px-3 py-1.5 font-body text-sm bg-background focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
          />
          <button onClick={save} disabled={saving} className="w-7 h-7 rounded-md bg-primary flex items-center justify-center text-primary-foreground hover:opacity-90">
            <Check size={13} />
          </button>
          <button onClick={() => setEditing(false)} className="font-body text-xs text-muted-foreground hover:text-foreground">✕</button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <p className="font-body text-sm text-foreground">{value || <span className="text-muted-foreground italic">Not set</span>}</p>
          <button onClick={() => { setDraft(value); setEditing(true); }} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground">
            <Edit2 size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

function SelectField({ label, value, options, onSave }: { label: string; value: string; options: string[]; onSave: (v: string) => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  return (
    <div>
      <p className="font-body text-[11px] text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <select
        value={value}
        disabled={saving}
        onChange={async (e) => {
          setSaving(true);
          await onSave(e.target.value);
          setSaving(false);
        }}
        className="border border-border rounded-md px-3 py-1.5 font-body text-sm bg-background focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 capitalize"
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function DateField({ label, value, onSave, note, onSaveNote }: {
  label: string;
  value: string;
  onSave: (v: string) => Promise<void>;
  note?: string;
  onSaveNote?: (v: string) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [noteVal, setNoteVal] = useState(note || "");
  const [noteSaving, setNoteSaving] = useState(false);

  const saveNote = async () => {
    if (!onSaveNote || noteVal === (note || "")) return;
    setNoteSaving(true);
    await onSaveNote(noteVal);
    setNoteSaving(false);
  };

  return (
    <div className="space-y-1">
      <p className="font-body text-[11px] text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <input
        type="date"
        value={value}
        disabled={saving}
        onChange={async (e) => {
          setSaving(true);
          await onSave(e.target.value);
          setSaving(false);
        }}
        className="border border-border rounded-md px-3 py-1.5 font-body text-sm bg-background focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
      />
      {onSaveNote !== undefined && (
        <input
          value={noteVal}
          onChange={e => setNoteVal(e.target.value)}
          onBlur={saveNote}
          onKeyDown={e => { if (e.key === "Enter") saveNote(); }}
          placeholder="Internal note…"
          disabled={noteSaving}
          className="w-full border-0 border-b border-border/50 bg-transparent px-1 py-0.5 font-body text-[11px] text-muted-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/30"
        />
      )}
    </div>
  );
}

function SmallToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-body text-[11px] transition-colors border ${
        checked
          ? "bg-primary/10 border-primary/30 text-foreground"
          : "bg-background border-border text-muted-foreground hover:border-primary/20"
      }`}
    >
      <span className={`w-2.5 h-2.5 rounded-full transition-colors ${checked ? "bg-primary" : "bg-border"}`} />
      {label}
    </button>
  );
}

const CEREMONY_OPTIONS = ["Hilltop Cathedral", "Woodsy Ceremony Site", "Milking Parlor", "Courtyard", "Other (off-site)"];
const COCKTAIL_OPTIONS = ["Milking Parlor", "Farmhouse Lawn", "Hayloft", "Courtyard", "Other"];
const REHEARSAL_OPTIONS = ["Hayloft", "Milking Parlor", "Courtyard", "Other"];

function LocationField({ label, value, options, onSave }: {
  label: string;
  value: string;
  options: string[];
  onSave: (v: string) => Promise<void>;
}) {
  const isKnown = options.some(o => o === value);
  const isOther = value && !isKnown;
  const otherOption = options.find(o => o.startsWith("Other")) || "Other";

  const [selected, setSelected] = useState(isOther ? otherOption : (value || ""));
  const [customText, setCustomText] = useState(
    isOther ? (value.startsWith("Other: ") ? value.slice(7) : value) : ""
  );
  const [saving, setSaving] = useState(false);

  const handleSelect = async (v: string) => {
    setSelected(v);
    if (v.startsWith("Other")) {
      // Don't save yet — wait for custom text
      return;
    }
    setSaving(true);
    await onSave(v);
    setCustomText("");
    setSaving(false);
  };

  const handleCustomSave = async () => {
    if (!customText.trim()) return;
    setSaving(true);
    await onSave(`Other: ${customText.trim()}`);
    setSaving(false);
  };

  return (
    <div className="space-y-1.5">
      <p className="font-body text-[11px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <select
        value={selected}
        disabled={saving}
        onChange={e => handleSelect(e.target.value)}
        className="w-full border border-border rounded-md px-3 py-1.5 font-body text-sm bg-background focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
      >
        <option value="">Select…</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      {selected.startsWith("Other") && (
        <input
          value={customText}
          onChange={e => setCustomText(e.target.value)}
          onBlur={handleCustomSave}
          onKeyDown={e => { if (e.key === "Enter") handleCustomSave(); }}
          placeholder="Describe the location…"
          disabled={saving}
          className="w-full border border-border rounded-md px-3 py-1.5 font-body text-[12px] bg-background text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
        />
      )}
    </div>
  );
}
const ALL_ADDONS = [
  "wedding_day_breakfast", "welcome_bags", "after_party", "goat_yoga",
  "beer_burro", "haywagon", "mimosa_bar", "lawn_games", "bathroom_baskets",
];

export default function Overview({ event, coupleNames, onUpdate }: Props) {
  const [addons, setAddons] = useState<{ id: string; addon: string; included: boolean }[]>([]);
  const [addonsLoaded, setAddonsLoaded] = useState(false);
  const [earlyArrival, setEarlyArrival] = useState(() => {
    if (!event.wedding_date || !event.arrival_date) return false;
    const diff = Math.round((new Date(event.wedding_date).getTime() - new Date(event.arrival_date).getTime()) / 86400000);
    return diff >= 2;
  });
  const [lateDeparture, setLateDeparture] = useState(() => {
    if (!event.wedding_date || !event.departure_date) return false;
    const diff = Math.round((new Date(event.departure_date).getTime() - new Date(event.wedding_date).getTime()) / 86400000);
    return diff >= 2;
  });

  if (!addonsLoaded) {
    supabase.from("event_addons").select("*").eq("event_id", event.id).then(({ data }) => {
      if (data) setAddons(data);
      setAddonsLoaded(true);
    });
  }

  const patch = async (fields: Partial<EventData>) => {
    const { data } = await supabase.from("events").update(fields).eq("id", event.id).select().single();
    if (data) onUpdate(data as EventData);
  };

  const handleWeddingDateChange = useCallback(async (v: string) => {
    if (!v) {
      await patch({ wedding_date: null });
      return;
    }
    const wedding = new Date(v + "T12:00:00");
    const arrival = subDays(wedding, earlyArrival ? 2 : 1);
    const departure = addDays(wedding, lateDeparture ? 2 : 1);
    await patch({
      wedding_date: v,
      arrival_date: format(arrival, "yyyy-MM-dd"),
      departure_date: format(departure, "yyyy-MM-dd"),
    });
  }, [earlyArrival, lateDeparture, event.id]);

  const handleEarlyArrival = useCallback(async (checked: boolean) => {
    setEarlyArrival(checked);
    if (!event.wedding_date) return;
    const wedding = new Date(event.wedding_date + "T12:00:00");
    const arrival = subDays(wedding, checked ? 2 : 1);
    await patch({ arrival_date: format(arrival, "yyyy-MM-dd") });
  }, [event.wedding_date, event.id]);

  const handleLateDeparture = useCallback(async (checked: boolean) => {
    setLateDeparture(checked);
    if (!event.wedding_date) return;
    const wedding = new Date(event.wedding_date + "T12:00:00");
    const departure = addDays(wedding, checked ? 2 : 1);
    await patch({ departure_date: format(departure, "yyyy-MM-dd") });
  }, [event.wedding_date, event.id]);

  const daysUntil = event.arrival_date
    ? Math.round((new Date(event.arrival_date).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000)
    : null;

  const fmtDate = (d: string | null) =>
    d ? new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }) : "";

  const fmtShort = (d: string | null) =>
    d ? new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "";

  return (
    <div className="space-y-8 animate-fade-up">
      {/* Countdown */}
      {daysUntil !== null && (
        <div className="rounded-2xl bg-sage/8 border border-sage/20 px-6 py-5 flex items-center gap-4">
          <div className="text-center">
            <p className="font-display text-5xl font-light text-foreground leading-none">{Math.abs(daysUntil)}</p>
            <p className="font-body text-xs text-muted-foreground mt-1">
              {daysUntil >= 0 ? "days until arrival" : "days since arrival"}
            </p>
          </div>
          <div className="h-12 w-px bg-border" />
          <div>
            <p className="font-display text-xl font-light text-foreground">{coupleNames || event.title}</p>
            <p className="font-body text-sm text-muted-foreground">Arrival: {fmtDate(event.arrival_date)}</p>
          </div>
        </div>
      )}

      {/* Details grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Dates */}
        <div className="rounded-xl bg-card border border-border p-6 space-y-5">
          <p className="font-display text-lg font-light text-foreground">Key Dates</p>

          <DateField
            label="Wedding Date"
            value={event.wedding_date || ""}
            onSave={handleWeddingDateChange}
            note={event.wedding_date_note || ""}
            onSaveNote={v => patch({ wedding_date_note: v || null })}
          />

          {/* Toggles */}
          {event.wedding_date && (
            <div className="flex items-center gap-2 -mt-2">
              <SmallToggle label="Thursday arrival?" checked={earlyArrival} onChange={handleEarlyArrival} />
              <SmallToggle label="Monday departure?" checked={lateDeparture} onChange={handleLateDeparture} />
            </div>
          )}

          {/* Summary line */}
          {event.wedding_date && event.arrival_date && event.departure_date && (
            <p className="font-body text-[11px] text-muted-foreground -mt-2">
              Arrive {fmtShort(event.arrival_date)} · Wedding {fmtShort(event.wedding_date)} · Depart {fmtShort(event.departure_date)}
            </p>
          )}

          <DateField
            label="Arrival Date"
            value={event.arrival_date || ""}
            onSave={v => patch({ arrival_date: v || null })}
            note={event.arrival_date_note || ""}
            onSaveNote={v => patch({ arrival_date_note: v || null })}
          />
          <DateField
            label="Departure Date"
            value={event.departure_date || ""}
            onSave={v => patch({ departure_date: v || null })}
            note={event.departure_date_note || ""}
            onSaveNote={v => patch({ departure_date_note: v || null })}
          />
          <DateField
            label="Tasting Date"
            value={event.tasting_date || ""}
            onSave={v => patch({ tasting_date: v || null })}
            note={event.tasting_date_note || ""}
            onSaveNote={v => patch({ tasting_date_note: v || null })}
          />
        </div>

        {/* Event info */}
        <div className="rounded-xl bg-card border border-border p-6 space-y-5">
          <p className="font-display text-lg font-light text-foreground">Event Info</p>
          <Field label="Event Title" value={event.title} onSave={v => patch({ title: v })} />
          <SelectField label="Status" value={event.status} options={STATUSES} onSave={v => patch({ status: v })} />
          <SelectField label="Package Tier" value={event.package_tier || "base"} options={PACKAGE_TIERS} onSave={v => patch({ package_tier: v })} />
          <Field label="Estimated Guest Count" value={String(event.estimated_guest_count || "")} onSave={v => patch({ estimated_guest_count: parseInt(v) || null })} />
        </div>

        {/* Locations */}
        <div className="rounded-xl bg-card border border-border p-6 space-y-5">
          <p className="font-display text-lg font-light text-foreground">Locations</p>
          <LocationField label="Ceremony Location" value={event.ceremony_location || ""} options={CEREMONY_OPTIONS} onSave={v => patch({ ceremony_location: v || null })} />
          <LocationField label="Cocktail Hour Location" value={event.cocktail_hour_location || ""} options={COCKTAIL_OPTIONS} onSave={v => patch({ cocktail_hour_location: v || null })} />
          <LocationField label="Rehearsal Dinner Location" value={event.rehearsal_dinner_location || ""} options={REHEARSAL_OPTIONS} onSave={v => patch({ rehearsal_dinner_location: v || null })} />
        </div>

        {/* Add-ons */}
        <div className="rounded-xl bg-card border border-border p-6 space-y-4">
          <p className="font-display text-lg font-light text-foreground">Add-ons</p>
          {addons.length === 0 ? (
            <p className="font-body text-sm text-muted-foreground">No add-ons configured.</p>
          ) : (
            <div className="space-y-2">
              {addons.map(a => (
                <label key={a.id} className="flex items-center gap-3 cursor-pointer group">
                  <div
                    onClick={async () => {
                      const next = !a.included;
                      await supabase.from("event_addons").update({ included: next }).eq("id", a.id);
                      setAddons(prev => prev.map(x => x.id === a.id ? { ...x, included: next } : x));
                    }}
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                      a.included ? "bg-primary border-primary" : "border-border bg-background"
                    }`}
                  >
                    {a.included && <Check size={10} className="text-primary-foreground" />}
                  </div>
                  <span className="font-body text-sm text-foreground capitalize">{a.addon.replace(/_/g, " ")}</span>
                </label>
              ))}
            </div>
          )}
          <Field label="How Heard" value={event.how_heard || ""} onSave={v => patch({ how_heard: v || null })} />
        </div>
      </div>
    </div>
  );
}