import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Check, Plus, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

// Package tiers were retired 9/23/26: every wedding gets its own checklist of what's
// included. Rows live in event_addons (one per item). No row = not included.
export const STANDARD_INCLUSIONS: { key: string; label: string }[] = [
  { key: "planning_coordination", label: "Month-of planning + weekend coordination" },
  { key: "guest_services", label: "Guest services team + golf cart shuttles" },
  { key: "beverages_snacks", label: "Coffee, tea, beverages, ice & snacks" },
  { key: "nightly_bonfires", label: "Nightly bonfires + roasting marshmallows" },
  { key: "tables_chairs", label: "Tables, chairs & tableware" },
  { key: "wedding_day_breakfast", label: "Wedding-day breakfast" },
  { key: "welcome_bags", label: "Welcome bags" },
  { key: "after_party", label: "After-party lounge" },
  { key: "silent_disco", label: "Silent disco after-party" },
  { key: "goat_yoga", label: "Goat yoga" },
  { key: "beer_burro", label: "Beer burro" },
  { key: "haywagon", label: "Haywagon ceremony ride" },
  { key: "mimosa_bar", label: "Mimosa / craft beer getting-ready bar (up to 20)" },
  { key: "lawn_games", label: "Lawn games" },
  { key: "bathroom_baskets", label: "Reception bathroom baskets" },
  { key: "content_creator", label: "GF content creator" },
  { key: "archery", label: "Archery" },
  { key: "live_musician", label: "Live musician at bonfire" },
  { key: "pop_up_tents", label: "Pop-up tents" },
];

interface AddonRow {
  id: string;
  addon: string;
  included: boolean | null;
  label: string | null;
  note: string | null;
  sort_order: number;
}

export default function InclusionsChecklist({ eventId }: { eventId: string }) {
  const [rows, setRows] = useState<Record<string, AddonRow>>({});
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState("");

  useEffect(() => {
    let cancelled = false;
    supabase.from("event_addons")
      .select("id, addon, included, label, note, sort_order")
      .eq("event_id", eventId)
      .then(({ data }) => {
        if (cancelled) return;
        const map: Record<string, AddonRow> = {};
        (data ?? []).forEach(r => { map[r.addon] = r; });
        setRows(map);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [eventId]);

  const upsert = async (addon: string, patch: Partial<AddonRow>) => {
    const prev = rows[addon];
    const next = { ...(prev ?? { id: "", addon, included: false, label: null, note: null, sort_order: 0 }), ...patch };
    setRows(r => ({ ...r, [addon]: next }));
    const { data, error } = await supabase.from("event_addons")
      .upsert({
        event_id: eventId, addon,
        included: next.included, label: next.label, note: next.note, sort_order: next.sort_order,
        updated_at: new Date().toISOString(),
      }, { onConflict: "event_id,addon" })
      .select("id, addon, included, label, note, sort_order")
      .single();
    if (error) {
      setRows(r => { const c = { ...r }; if (prev) c[addon] = prev; else delete c[addon]; return c; });
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    setRows(r => ({ ...r, [addon]: data }));
  };

  const removeCustom = async (addon: string) => {
    const prev = rows[addon];
    setRows(r => { const c = { ...r }; delete c[addon]; return c; });
    const { error } = await supabase.from("event_addons").delete().eq("event_id", eventId).eq("addon", addon);
    if (error) {
      setRows(r => ({ ...r, [addon]: prev }));
      toast({ title: "Couldn't remove", description: error.message, variant: "destructive" });
    }
  };

  const addCustom = async () => {
    const label = newItem.trim();
    if (!label) return;
    setNewItem("");
    await upsert(`custom_${Date.now()}`, { label, included: true, sort_order: 1000 + Object.keys(rows).length });
  };

  const standardKeys = new Set(STANDARD_INCLUSIONS.map(s => s.key));
  const customRows = Object.values(rows)
    .filter(r => !standardKeys.has(r.addon))
    .sort((a, b) => a.sort_order - b.sort_order);
  const items = [
    ...STANDARD_INCLUSIONS.map(s => ({ key: s.key, label: s.label, custom: false })),
    ...customRows.map(r => ({ key: r.addon, label: r.label || r.addon, custom: true })),
  ];
  const includedCount = items.filter(i => rows[i.key]?.included).length;

  return (
    <div className="rounded-xl bg-card border border-border p-6">
      <div className="flex items-baseline justify-between mb-1">
        <p className="font-display text-lg font-light text-foreground">Inclusions</p>
        {!loading && (
          <span className="font-body text-[11px] text-muted-foreground uppercase tracking-wider">
            {includedCount} of {items.length} included
          </span>
        )}
      </div>
      <p className="font-body text-xs text-muted-foreground mb-4">
        Check what this wedding includes. Add a note for details like "interested in" or "10 tents in village".
      </p>

      {loading ? (
        <p className="font-body text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="divide-y divide-border/50">
          {items.map(item => (
            <InclusionRow
              key={item.key}
              label={item.label}
              custom={item.custom}
              row={rows[item.key]}
              onToggle={() => upsert(item.key, { included: !rows[item.key]?.included, label: item.custom ? item.label : null })}
              onNote={note => upsert(item.key, { note: note || null, label: item.custom ? item.label : null })}
              onRemove={item.custom ? () => removeCustom(item.key) : undefined}
            />
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mt-4">
        <input
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") addCustom(); }}
          placeholder="Add a one-off item for this wedding"
          className="flex-1 border border-border rounded-md px-3 py-1.5 font-body text-sm bg-background placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
        />
        <button onClick={addCustom} disabled={!newItem.trim()} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 font-body text-xs text-foreground hover:border-primary/40 disabled:opacity-40">
          <Plus size={13} /> Add
        </button>
      </div>
    </div>
  );
}

function InclusionRow({ label, custom, row, onToggle, onNote, onRemove }: {
  label: string;
  custom: boolean;
  row?: AddonRow;
  onToggle: () => void;
  onNote: (note: string) => void;
  onRemove?: () => void;
}) {
  const included = !!row?.included;
  const [note, setNote] = useState(row?.note ?? "");
  useEffect(() => { setNote(row?.note ?? ""); }, [row?.note]);

  return (
    <div className="group flex flex-col sm:flex-row sm:items-center gap-2 py-2.5">
      <button type="button" onClick={onToggle} className="flex items-center gap-3 text-left sm:w-[46%] shrink-0">
        <span className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${included ? "bg-primary border-primary text-primary-foreground" : "bg-background border-border"}`}>
          {included && <Check size={13} />}
        </span>
        <span className={`font-body text-sm ${included ? "text-foreground" : "text-muted-foreground"}`}>
          {label}{custom && <span className="ml-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/70">one-off</span>}
        </span>
      </button>
      <div className="flex items-center gap-2 flex-1 pl-8 sm:pl-0">
        <input
          value={note}
          onChange={e => setNote(e.target.value)}
          onBlur={() => { if (note !== (row?.note ?? "")) onNote(note.trim()); }}
          onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          placeholder="Note"
          className="flex-1 border border-transparent hover:border-border focus:border-primary/50 rounded-md px-2 py-1 font-body text-xs bg-transparent placeholder:text-muted-foreground/40 focus:outline-none focus:bg-background"
        />
        {onRemove && (
          <button onClick={onRemove} title="Remove item" className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
            <X size={13} />
          </button>
        )}
      </div>
    </div>
  );
}
