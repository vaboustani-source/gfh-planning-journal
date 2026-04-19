import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Check, Lock, Unlock } from "lucide-react";
import { useAutosaveStatus } from "@/hooks/useAutosaveStatus";
import AdminStickyFooter from "@/components/admin/AdminStickyFooter";

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

const WELCOME_DRINK_OPTIONS = ["Infused Water - Cucumber Mint", "Infused Water - Strawberry Basil", "Infused Water - Lemon Lavender", "Wine Spritzer", "Sangria"];
const BEER_OPTIONS = ["Corona", "Bud Light", "Coors Light", "Blue Moon", "Stella Artois", "Sam Adams", "Truly Hard Seltzer", "Dogfish Head", "Lagunitas IPA", "Goose Island"];
const RED_WINE_OPTIONS = ["Cabernet Sauvignon", "Merlot", "Pinot Noir", "Malbec"];
const WHITE_WINE_OPTIONS = ["Pinot Grigio", "Sauvignon Blanc", "Chardonnay", "Moscato"];

export default function BarTab({ eventId, onNavigateNext }: { eventId: string; onNavigateNext: () => void }) {
  const [bar, setBar] = useState<BarData | null>(null);
  const [loading, setLoading] = useState(true);
  const autosave = useAutosaveStatus();

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("bar_selections").select("*").eq("event_id", eventId).maybeSingle();
      if (data) {
        setBar({ ...data, champagne_arrival_upgrade: data.champagne_arrival_upgrade ?? false, champagne_welcome_toast: data.champagne_welcome_toast ?? false, high_noon_upgrade_1: data.high_noon_upgrade_1 ?? false, high_noon_upgrade_2: data.high_noon_upgrade_2 ?? false, high_noon_add_third: data.high_noon_add_third ?? false, finalized: data.finalized ?? false, locked_by_brandon: data.locked_by_brandon ?? false });
      } else {
        const { data: newRow } = await supabase.from("bar_selections").insert({ event_id: eventId }).select().single();
        if (newRow) setBar({ ...newRow, champagne_arrival_upgrade: false, champagne_welcome_toast: false, high_noon_upgrade_1: false, high_noon_upgrade_2: false, high_noon_add_third: false, finalized: false, locked_by_brandon: false });
      }
      setLoading(false);
    })();
  }, [eventId]);

  const update = useCallback((field: string, value: any) => {
    if (!bar) return;
    setBar(prev => prev ? { ...prev, [field]: value } : prev);
    autosave.debouncedSave(`bar-${field}`, async () => {
      await supabase.from("bar_selections").update({ [field]: value, updated_at: new Date().toISOString() } as any).eq("id", bar.id);
    });
  }, [bar, autosave]);

  const toggleLock = async () => {
    if (!bar) return;
    const newVal = !bar.locked_by_brandon;
    setBar(prev => prev ? { ...prev, locked_by_brandon: newVal } : prev);
    await supabase.from("bar_selections").update({ locked_by_brandon: newVal }).eq("id", bar.id);
  };

  const saveAll = async () => {
    // All fields autosave, this is a no-op confirmation
    autosave.markSaved();
  };

  if (loading || !bar) {
    return <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Lock toggle */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-light text-foreground">Bar Selections</h2>
        <button
          onClick={toggleLock}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 font-body text-sm transition-colors ${
            bar.locked_by_brandon ? "bg-primary text-primary-foreground" : "bg-muted border border-border text-foreground hover:bg-muted/80"
          }`}
        >
          {bar.locked_by_brandon ? <><Lock size={14} /> Locked</> : <><Unlock size={14} /> Lock Selections</>}
        </button>
      </div>

      {/* Package */}
      <FieldSection title="Bar Package">
        <select value={bar.bar_package ?? ""} onChange={e => update("bar_package", e.target.value || null)} className={selectClass}>
          <option value="">Select package</option>
          <option value="open">Open Bar</option>
          <option value="premium">Premium Open Bar</option>
        </select>
      </FieldSection>

      {/* Welcome Drinks */}
      <FieldSection title="Welcome Drinks">
        {[1, 2, 3].map(n => (
          <div key={n}>
            <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">Welcome Drink {n}</label>
            <select value={(bar as any)[`welcome_drink_${n}`] ?? ""} onChange={e => update(`welcome_drink_${n}`, e.target.value || null)} className={selectClass}>
              <option value="">Select…</option>
              {WELCOME_DRINK_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        ))}
      </FieldSection>

      {/* Champagne */}
      <FieldSection title="Champagne Options">
        <CheckRow label="Champagne arrival upgrade (+$6pp)" checked={bar.champagne_arrival_upgrade} onChange={v => update("champagne_arrival_upgrade", v)} />
        <CheckRow label="Champagne welcome toast" checked={bar.champagne_welcome_toast} onChange={v => update("champagne_welcome_toast", v)} />
      </FieldSection>

      {/* Beer */}
      <FieldSection title="Beer Selections">
        {[1, 2].map(n => (
          <div key={n}>
            <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">Beer {n}</label>
            <select value={(bar as any)[`beer_selection_${n}`] ?? ""} onChange={e => update(`beer_selection_${n}`, e.target.value || null)} className={selectClass}>
              <option value="">Select…</option>
              {BEER_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        ))}
      </FieldSection>

      {/* High Noon */}
      <FieldSection title="High Noon Upgrades">
        <CheckRow label="High Noon Upgrade #1 (+$3pp)" checked={bar.high_noon_upgrade_1} onChange={v => update("high_noon_upgrade_1", v)} />
        <CheckRow label="High Noon Upgrade #2 (+$3pp)" checked={bar.high_noon_upgrade_2} onChange={v => update("high_noon_upgrade_2", v)} />
        <CheckRow label="Add Third High Noon (+$2pp)" checked={bar.high_noon_add_third} onChange={v => update("high_noon_add_third", v)} />
        <div>
          <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">Which events?</label>
          <input type="text" value={bar.high_noon_events ?? ""} onChange={e => update("high_noon_events", e.target.value || null)} placeholder="e.g. Cocktail hour, Reception" className={inputClass} />
        </div>
      </FieldSection>

      {/* Signature Drinks */}
      <FieldSection title="Signature Drinks">
        <div>
          <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">Drink 1</label>
          <input type="text" value={bar.signature_drink_1 ?? ""} onChange={e => update("signature_drink_1", e.target.value || null)} placeholder="Custom drink name" className={inputClass} />
        </div>
        <div>
          <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">Drink 2</label>
          <input type="text" value={bar.signature_drink_2 ?? ""} onChange={e => update("signature_drink_2", e.target.value || null)} placeholder="Custom drink name" className={inputClass} />
        </div>
        <div>
          <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">Special Requests</label>
          <textarea value={bar.signature_drink_special_request ?? ""} onChange={e => update("signature_drink_special_request", e.target.value || null)} rows={2} placeholder="Any special requests…" className={`${inputClass} resize-none`} />
        </div>
      </FieldSection>

      {/* Wine */}
      <FieldSection title="Wine Selections">
        {[{ label: "Red 1", field: "red_wine_1", opts: RED_WINE_OPTIONS }, { label: "Red 2", field: "red_wine_2", opts: RED_WINE_OPTIONS }, { label: "White 1", field: "white_wine_1", opts: WHITE_WINE_OPTIONS }, { label: "White 2", field: "white_wine_2", opts: WHITE_WINE_OPTIONS }].map(w => (
          <div key={w.field}>
            <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">{w.label}</label>
            <select value={(bar as any)[w.field] ?? ""} onChange={e => update(w.field, e.target.value || null)} className={selectClass}>
              <option value="">Select…</option>
              {w.opts.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        ))}
      </FieldSection>

      {/* Notes */}
      <FieldSection title="Admin Notes">
        <textarea value={bar.notes ?? ""} onChange={e => update("notes", e.target.value || null)} rows={3} placeholder="Internal notes…" className={`${inputClass} resize-none`} />
      </FieldSection>

      <AdminStickyFooter status={autosave.status} onSave={saveAll} onSaveAndContinue={async () => { await saveAll(); onNavigateNext(); }} />
    </div>
  );
}

const inputClass = "mt-1 w-full rounded-lg border border-border bg-background px-3.5 py-2.5 font-body text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors";
const selectClass = "mt-1 w-full rounded-lg border border-border bg-background px-3.5 py-2.5 font-body text-sm text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors";

function FieldSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-card border border-border shadow-soft overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border bg-muted/30">
        <p className="font-display text-lg font-light text-foreground">{title}</p>
      </div>
      <div className="px-5 py-4 space-y-3">{children}</div>
    </div>
  );
}

function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer py-1">
      <div
        onClick={() => onChange(!checked)}
        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
          checked ? "bg-primary border-primary" : "border-border bg-background"
        }`}
      >
        {checked && <Check size={10} className="text-primary-foreground" />}
      </div>
      <span className="font-body text-sm text-foreground">{label}</span>
    </label>
  );
}
