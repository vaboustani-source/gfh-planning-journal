import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePortalData } from "@/hooks/usePortalData";
import { Loader2, Check, Lock, Wine, Beer } from "lucide-react";

interface BarData {
  id: string;
  bar_package: string | null;
  welcome_drink_1: string | null;
  welcome_drink_2: string | null;
  welcome_drink_3: string | null;
  champagne_arrival_upgrade: boolean;
  champagne_welcome_toast: boolean;
  beer_selection_1: string | null;
  beer_selection_2: string | null;
  high_noon_upgrade_1: boolean;
  high_noon_upgrade_2: boolean;
  high_noon_add_third: boolean;
  high_noon_events: string | null;
  signature_drink_1: string | null;
  signature_drink_2: string | null;
  signature_drink_special_request: string | null;
  red_wine_1: string | null;
  red_wine_2: string | null;
  white_wine_1: string | null;
  white_wine_2: string | null;
  finalized: boolean;
  locked_by_brandon: boolean;
  notes: string | null;
}

const WELCOME_DRINK_OPTIONS = [
  "Infused Water - Cucumber Mint",
  "Infused Water - Strawberry Basil",
  "Infused Water - Lemon Lavender",
  "Wine Spritzer",
  "Sangria",
];
const BEER_OPTIONS = ["Corona", "Bud Light", "Coors Light", "Blue Moon", "Stella Artois", "Sam Adams", "Truly Hard Seltzer", "Dogfish Head", "Lagunitas IPA", "Goose Island"];
const RED_WINE_OPTIONS = ["Cabernet Sauvignon", "Merlot", "Pinot Noir", "Malbec"];
const WHITE_WINE_OPTIONS = ["Pinot Grigio", "Sauvignon Blanc", "Chardonnay", "Moscato"];

export function BarSelections() {
  const { eventId } = usePortalData();
  const [bar, setBar] = useState<BarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      const { data } = await supabase
        .from("bar_selections")
        .select("*")
        .eq("event_id", eventId)
        .maybeSingle();
      if (data) {
        setBar({
          ...data,
          champagne_arrival_upgrade: data.champagne_arrival_upgrade ?? false,
          champagne_welcome_toast: data.champagne_welcome_toast ?? false,
          high_noon_upgrade_1: data.high_noon_upgrade_1 ?? false,
          high_noon_upgrade_2: data.high_noon_upgrade_2 ?? false,
          high_noon_add_third: data.high_noon_add_third ?? false,
          finalized: data.finalized ?? false,
          locked_by_brandon: data.locked_by_brandon ?? false,
        });
      } else {
        // Create a new bar_selections row
        const { data: newRow } = await supabase
          .from("bar_selections")
          .insert({ event_id: eventId })
          .select()
          .single();
        if (newRow) setBar({
          ...newRow,
          champagne_arrival_upgrade: false,
          champagne_welcome_toast: false,
          high_noon_upgrade_1: false,
          high_noon_upgrade_2: false,
          high_noon_add_third: false,
          finalized: false,
          locked_by_brandon: false,
        });
      }
      setLoading(false);
    })();
  }, [eventId]);

  const update = useCallback((field: string, value: any) => {
    if (!bar || bar.locked_by_brandon) return;
    const updated = { ...bar, [field]: value };
    setBar(updated);
    setSaveStatus("saving");
    const timer = setTimeout(async () => {
      await supabase.from("bar_selections").update({ [field]: value, updated_at: new Date().toISOString() }).eq("id", bar.id);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    }, 800);
    return () => clearTimeout(timer);
  }, [bar]);

  if (loading || !bar) {
    return <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>;
  }

  const readOnly = bar.locked_by_brandon;

  return (
    <div className="space-y-6">
      {/* Locked banner */}
      {readOnly && (
        <div className="rounded-xl bg-sage/10 border border-sage/25 px-5 py-4 flex items-center gap-3">
          <Lock size={16} className="text-primary shrink-0" />
          <p className="font-body text-sm text-foreground">Bar selections have been finalized by Brandon.</p>
        </div>
      )}

      {/* Instruction */}
      {!readOnly && (
        <div className="rounded-xl bg-sage/8 border border-sage/20 px-5 py-4">
          <p className="font-body text-sm text-foreground/80 italic leading-relaxed">
            Complete your bar selections before your tasting date. If you haven't had your tasting yet, Brandon will walk you through these on your catering call.
          </p>
        </div>
      )}

      {/* Autosave indicator */}
      {saveStatus !== "idle" && (
        <p className="font-body text-xs text-muted-foreground text-right">
          {saveStatus === "saving" ? "Saving…" : <><Check size={12} className="inline" /> Saved</>}
        </p>
      )}

      {/* Bar Package */}
      <Section title="Bar Package">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <PackageCard
            title="Open Bar"
            desc="House spirits, 2 beers, 2 signature drinks, 2 red wines, 2 white wines"
            selected={bar.bar_package === "open"}
            onClick={() => !readOnly && update("bar_package", "open")}
            disabled={readOnly}
          />
          <PackageCard
            title="Premium Open Bar"
            desc="Premium spirits, 2 beers, 2 signature drinks, 2 red wines, 2 white wines"
            selected={bar.bar_package === "premium"}
            onClick={() => !readOnly && update("bar_package", "premium")}
            disabled={readOnly}
          />
        </div>
      </Section>

      {/* Welcome Drinks */}
      <Section title="Welcome Drinks">
        {[1, 2, 3].map(n => (
          <SelectField
            key={n}
            label={`Welcome Drink ${n}`}
            value={(bar as any)[`welcome_drink_${n}`] ?? ""}
            options={WELCOME_DRINK_OPTIONS}
            onChange={v => update(`welcome_drink_${n}`, v || null)}
            readOnly={readOnly}
          />
        ))}
      </Section>

      {/* Champagne Options */}
      <Section title="Champagne Options">
        <ToggleRow
          label="Champagne arrival upgrade (+$6pp)"
          checked={bar.champagne_arrival_upgrade}
          onChange={v => update("champagne_arrival_upgrade", v)}
          readOnly={readOnly}
        />
        <ToggleRow
          label="Champagne welcome toast (LaMarca Prosecco — included, just confirm)"
          checked={bar.champagne_welcome_toast}
          onChange={v => update("champagne_welcome_toast", v)}
          readOnly={readOnly}
        />
      </Section>

      {/* Beer */}
      <Section title="Beer Selections">
        <SelectField label="Beer 1" value={bar.beer_selection_1 ?? ""} options={BEER_OPTIONS} onChange={v => update("beer_selection_1", v || null)} readOnly={readOnly} />
        <SelectField label="Beer 2" value={bar.beer_selection_2 ?? ""} options={BEER_OPTIONS} onChange={v => update("beer_selection_2", v || null)} readOnly={readOnly} />
      </Section>

      {/* High Noon */}
      <Section title="High Noon Upgrades">
        <ToggleRow label="High Noon Upgrade #1 (+$3pp)" checked={bar.high_noon_upgrade_1} onChange={v => update("high_noon_upgrade_1", v)} readOnly={readOnly} />
        <ToggleRow label="High Noon Upgrade #2 (+$3pp)" checked={bar.high_noon_upgrade_2} onChange={v => update("high_noon_upgrade_2", v)} readOnly={readOnly} />
        <ToggleRow label="Add Third High Noon (+$2pp)" checked={bar.high_noon_add_third} onChange={v => update("high_noon_add_third", v)} readOnly={readOnly} />
        <div className="mt-2">
          <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">Which events?</label>
          <input
            type="text"
            value={bar.high_noon_events ?? ""}
            onChange={e => update("high_noon_events", e.target.value || null)}
            readOnly={readOnly}
            placeholder="e.g. Cocktail hour, Reception"
            className={`mt-1 w-full rounded-lg border px-3.5 py-2.5 font-body text-sm transition-colors focus:outline-none ${readOnly ? "border-border bg-muted/20 text-muted-foreground" : "border-border bg-background text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50 focus:ring-1 focus:ring-primary/20"}`}
          />
        </div>
      </Section>

      {/* Signature Drinks */}
      <Section title="Signature Drinks">
        <div>
          <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">Signature Drink 1</label>
          <input type="text" value={bar.signature_drink_1 ?? ""} onChange={e => update("signature_drink_1", e.target.value || null)} readOnly={readOnly} placeholder="Custom drink name" className={inputClass(readOnly)} />
        </div>
        <div>
          <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">Signature Drink 2</label>
          <input type="text" value={bar.signature_drink_2 ?? ""} onChange={e => update("signature_drink_2", e.target.value || null)} readOnly={readOnly} placeholder="Custom drink name" className={inputClass(readOnly)} />
        </div>
        <div>
          <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">Special Requests</label>
          <textarea
            value={bar.signature_drink_special_request ?? ""}
            onChange={e => update("signature_drink_special_request", e.target.value || null)}
            readOnly={readOnly}
            placeholder="Any special requests for signature drinks…"
            rows={2}
            className={`mt-1 w-full rounded-lg border px-3.5 py-2.5 font-body text-sm resize-none transition-colors focus:outline-none ${readOnly ? "border-border bg-muted/20 text-muted-foreground" : "border-border bg-background text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50 focus:ring-1 focus:ring-primary/20"}`}
          />
        </div>
      </Section>

      {/* Wine */}
      <Section title="Wine Selections">
        <SelectField label="Red Wine 1" value={bar.red_wine_1 ?? ""} options={RED_WINE_OPTIONS} onChange={v => update("red_wine_1", v || null)} readOnly={readOnly} />
        <SelectField label="Red Wine 2" value={bar.red_wine_2 ?? ""} options={RED_WINE_OPTIONS} onChange={v => update("red_wine_2", v || null)} readOnly={readOnly} />
        <SelectField label="White Wine 1" value={bar.white_wine_1 ?? ""} options={WHITE_WINE_OPTIONS} onChange={v => update("white_wine_1", v || null)} readOnly={readOnly} />
        <SelectField label="White Wine 2" value={bar.white_wine_2 ?? ""} options={WHITE_WINE_OPTIONS} onChange={v => update("white_wine_2", v || null)} readOnly={readOnly} />
      </Section>
    </div>
  );
}

/* ── Helpers ── */
const inputClass = (readOnly: boolean) =>
  `mt-1 w-full rounded-lg border px-3.5 py-2.5 font-body text-sm transition-colors focus:outline-none ${readOnly ? "border-border bg-muted/20 text-muted-foreground" : "border-border bg-background text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50 focus:ring-1 focus:ring-primary/20"}`;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-card border border-border shadow-soft overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border bg-muted/30">
        <p className="font-display text-lg font-light text-foreground">{title}</p>
      </div>
      <div className="px-5 py-4 space-y-3">{children}</div>
    </div>
  );
}

function PackageCard({ title, desc, selected, onClick, disabled }: { title: string; desc: string; selected: boolean; onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`text-left rounded-xl border-2 p-5 transition-all ${
        selected
          ? "border-primary bg-sage/10 shadow-sm"
          : "border-border bg-background hover:border-primary/30"
      } ${disabled ? "opacity-70 cursor-default" : "cursor-pointer"}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Wine size={16} className={selected ? "text-primary" : "text-muted-foreground"} />
        <p className="font-display text-base font-medium text-foreground">{title}</p>
      </div>
      <p className="font-body text-xs text-muted-foreground leading-relaxed">{desc}</p>
      {selected && <div className="mt-3 flex items-center gap-1 text-primary font-body text-xs"><Check size={12} /> Selected</div>}
    </button>
  );
}

function SelectField({ label, value, options, onChange, readOnly }: { label: string; value: string; options: string[]; onChange: (v: string) => void; readOnly: boolean }) {
  return (
    <div>
      <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={readOnly}
        className={`mt-1 w-full rounded-lg border px-3.5 py-2.5 font-body text-sm transition-colors focus:outline-none ${readOnly ? "border-border bg-muted/20 text-muted-foreground" : "border-border bg-background text-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20"}`}
      >
        <option value="">Select…</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function ToggleRow({ label, checked, onChange, readOnly }: { label: string; checked: boolean; onChange: (v: boolean) => void; readOnly: boolean }) {
  return (
    <label className={`flex items-center gap-3 py-2 ${readOnly ? "cursor-default" : "cursor-pointer"}`}>
      <div
        onClick={() => !readOnly && onChange(!checked)}
        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
          checked ? "bg-primary border-primary" : "border-border bg-background"
        } ${readOnly ? "opacity-60" : "cursor-pointer"}`}
      >
        {checked && <Check size={10} className="text-primary-foreground" />}
      </div>
      <span className="font-body text-sm text-foreground">{label}</span>
    </label>
  );
}
