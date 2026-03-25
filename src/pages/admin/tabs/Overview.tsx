import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EventData } from "../EventDetail";
import { Check, Edit2 } from "lucide-react";

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

function DateField({ label, value, onSave }: { label: string; value: string; onSave: (v: string) => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  return (
    <div>
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
    </div>
  );
}

export default function Overview({ event, coupleNames, onUpdate }: Props) {
  const [addons, setAddons] = useState<{ id: string; addon: string; included: boolean }[]>([]);
  const [addonsLoaded, setAddonsLoaded] = useState(false);

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

  const daysUntil = event.arrival_date
    ? Math.round((new Date(event.arrival_date).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000)
    : null;

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }) : "";

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
          <DateField label="Wedding Date" value={event.wedding_date || ""} onSave={v => patch({ wedding_date: v || null })} />
          <DateField label="Arrival Date" value={event.arrival_date || ""} onSave={v => patch({ arrival_date: v || null })} />
          <DateField label="Departure Date" value={event.departure_date || ""} onSave={v => patch({ departure_date: v || null })} />
          <DateField label="Tasting Date" value={event.tasting_date || ""} onSave={v => patch({ tasting_date: v || null })} />
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
          <Field label="Ceremony Location" value={event.ceremony_location || ""} onSave={v => patch({ ceremony_location: v || null })} />
          <Field label="Cocktail Hour Location" value={event.cocktail_hour_location || ""} onSave={v => patch({ cocktail_hour_location: v || null })} />
          <Field label="Rehearsal Dinner Location" value={event.rehearsal_dinner_location || ""} onSave={v => patch({ rehearsal_dinner_location: v || null })} />
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
