import { useEffect, useMemo, useRef, useState } from "react";
import { usePortalData } from "@/hooks/usePortalData";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, Trash2, Wallet, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { defaultsForRole } from "@/lib/tabAccess";

interface BudgetRow {
  id: string;
  event_id: string;
  enabled: boolean;
  target_amount: number | null;
}

interface BudgetItem {
  id: string;
  event_id: string;
  category: string;
  label: string | null;
  estimated_amount: number;
  booked: boolean;
  notes: string | null;
}

interface GfhLineItem {
  id: string;
  section: string;
  label: string;
  unit_price: number | null;
  total: number | null;
}

const CATEGORIES = [
  "Photography",
  "Florals",
  "Music and Entertainment",
  "Attire and Beauty",
  "Stationery",
  "Transportation",
  "Officiant",
  "Rings",
  "Rentals",
  "Other",
];

const currency = (n: number | null | undefined) =>
  n == null
    ? "$0"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(Number(n));

function useDebouncedCallback<T extends (...args: any[]) => void>(fn: T, delay = 800) {
  const ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  return (...args: Parameters<T>) => {
    if (ref.current) clearTimeout(ref.current);
    ref.current = setTimeout(() => fn(...args), delay);
  };
}

export default function Budget() {
  const { eventId, loading: portalLoading } = usePortalData();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [budget, setBudget] = useState<BudgetRow | null>(null);
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [gfhItems, setGfhItems] = useState<GfhLineItem[]>([]);
  const [targetInput, setTargetInput] = useState<string>("");

  // Load
  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    Promise.all([
      supabase.from("event_budgets").select("*").eq("event_id", eventId).maybeSingle(),
      supabase.from("budget_items").select("*").eq("event_id", eventId).order("created_at"),
      supabase.from("financial_line_items").select("id, section, label, unit_price, total").eq("event_id", eventId),
    ]).then(([{ data: bData }, { data: iData }, { data: gData }]) => {
      setBudget((bData as BudgetRow) ?? null);
      setItems((iData as BudgetItem[]) ?? []);
      setGfhItems((gData as GfhLineItem[]) ?? []);
      setTargetInput(bData?.target_amount != null ? String(bData.target_amount) : "");
      setLoading(false);
    });
  }, [eventId]);

  const gfhAmount = (li: GfhLineItem) =>
    li.section === "Décor Rentals" ? Number(li.total ?? 0) : Number(li.unit_price ?? 0);
  const gfhTotal = useMemo(() => gfhItems.reduce((s, i) => s + gfhAmount(i), 0), [gfhItems]);
  const externalTotal = useMemo(() => items.reduce((s, i) => s + Number(i.estimated_amount ?? 0), 0), [items]);
  const combinedTotal = gfhTotal + externalTotal;
  const target = Number(budget?.target_amount ?? 0);
  const remaining = target - combinedTotal;
  const pctUsed = target > 0 ? Math.round((combinedTotal / target) * 100) : 0;

  // External by category breakdown
  const categoryTotals = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach(i => {
      map.set(i.category, (map.get(i.category) ?? 0) + Number(i.estimated_amount ?? 0));
    });
    if (gfhTotal > 0) map.set("Gilbertsville Farmhouse", gfhTotal);
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [items, gfhTotal]);

  async function enableBudget() {
    if (!eventId) return;
    const { data, error } = await supabase
      .from("event_budgets")
      .upsert({ event_id: eventId, enabled: true }, { onConflict: "event_id" })
      .select()
      .single();
    if (error) { toast.error("Could not enable budget"); return; }
    setBudget(data as BudgetRow);
    toast.success("Budget turned on");
  }

  async function disableBudget() {
    if (!budget) return;
    const { error } = await supabase.from("event_budgets").update({ enabled: false }).eq("id", budget.id);
    if (error) { toast.error("Could not turn off"); return; }
    setBudget({ ...budget, enabled: false });
    toast.success("Budget turned off");
  }

  const persistTarget = useDebouncedCallback(async (val: string) => {
    if (!budget) return;
    const num = val === "" ? null : Number(val);
    await supabase.from("event_budgets").update({ target_amount: num }).eq("id", budget.id);
  }, 800);

  function onTargetChange(v: string) {
    setTargetInput(v);
    setBudget(b => (b ? { ...b, target_amount: v === "" ? null : Number(v) } : b));
    persistTarget(v);
  }

  async function addItem(category: string) {
    if (!eventId) return;
    const { data, error } = await supabase
      .from("budget_items")
      .insert({ event_id: eventId, category, label: "", estimated_amount: 0, created_by: user?.id ?? null })
      .select()
      .single();
    if (error) { toast.error("Could not add"); return; }
    setItems(prev => [...prev, data as BudgetItem]);
  }

  const persistItem = useDebouncedCallback(async (id: string, patch: Partial<BudgetItem>) => {
    await supabase.from("budget_items").update(patch).eq("id", id);
  }, 600);

  function updateItem(id: string, patch: Partial<BudgetItem>) {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, ...patch } : i)));
    persistItem(id, patch);
  }

  async function deleteItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id));
    await supabase.from("budget_items").delete().eq("id", id);
  }

  if (portalLoading || loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  const enabled = !!budget?.enabled;

  // Off state
  if (!enabled) {
    return (
      <div className="max-w-3xl mx-auto px-5 py-10 lg:px-8 lg:py-14">
        <p className="font-body text-xs tracking-widest uppercase text-muted-foreground mb-2">Planning tool</p>
        <h1 className="font-display text-4xl font-light text-foreground mb-6">Budget</h1>
        <div className="rounded-xl bg-card border border-border shadow-soft p-8">
          <div className="w-12 h-12 rounded-full bg-sage/15 border border-sage/25 flex items-center justify-center mb-4">
            <Wallet size={20} className="text-sage" />
          </div>
          <p className="font-display text-2xl font-light text-foreground mb-3">Plan your full wedding budget in one place</p>
          <p className="font-body text-sm text-muted-foreground leading-relaxed mb-6">
            This is an optional tool to map out everything you are spending on your wedding. Your
            Gilbertsville Farmhouse costs come in automatically. You add the rest, such as photography,
            florals, attire, and music, and we keep a running total against your target.
          </p>
          <button
            onClick={enableBudget}
            className="rounded-lg px-5 py-2.5 font-body text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: "#2C3E2D" }}
          >
            Turn on Budget
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-5 py-8 lg:px-8 lg:py-10 pb-32">
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="font-body text-xs tracking-widest uppercase text-muted-foreground mb-2">Planning tool</p>
          <h1 className="font-display text-4xl font-light text-foreground">Budget</h1>
        </div>
        <button
          onClick={disableBudget}
          className="font-body text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
        >
          Turn off
        </button>
      </div>

      {/* Target input */}
      <div className="rounded-xl bg-card border border-border shadow-soft p-5 mb-6">
        <label className="block font-body text-[11px] uppercase tracking-widest text-muted-foreground mb-2">Target budget</label>
        <div className="flex items-center gap-2">
          <span className="font-display text-2xl font-light text-foreground">$</span>
          <input
            type="number"
            inputMode="decimal"
            value={targetInput}
            onChange={e => onTargetChange(e.target.value)}
            placeholder="0"
            className="flex-1 bg-transparent border-b border-border focus:border-sage outline-none font-display text-2xl font-light text-foreground py-1"
          />
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-xl border border-border shadow-soft p-6 mb-6" style={{ backgroundColor: "#FAF8F4" }}>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-5">
          <Stat label="Gilbertsville" value={currency(gfhTotal)} />
          <Stat label="Your Other" value={currency(externalTotal)} />
          <Stat label="Combined" value={currency(combinedTotal)} accent />
          <Stat label="Target" value={currency(target)} />
          <Stat
            label="Remaining"
            value={currency(remaining)}
            tone={remaining < 0 ? "danger" : "ok"}
          />
        </div>
        {target > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-body text-xs text-muted-foreground">{pctUsed}% of target used</span>
            </div>
            <div className="h-2 w-full rounded-full bg-border/60 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, pctUsed)}%`,
                  backgroundColor: pctUsed > 100 ? "#B7423A" : "#C9A84C",
                }}
              />
            </div>
          </div>
        )}

        {categoryTotals.length > 0 && (
          <div className="mt-6">
            <p className="font-body text-[11px] uppercase tracking-widest text-muted-foreground mb-3">By category</p>
            <div className="space-y-2">
              {categoryTotals.map(([cat, amt]) => {
                const pct = combinedTotal > 0 ? (amt / combinedTotal) * 100 : 0;
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-body text-sm text-foreground">{cat}</span>
                      <span className="font-body text-sm tabular-nums text-foreground">{currency(amt)}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-border/60 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: "#2C3E2D" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Gilbertsville Farmhouse section */}
      <div className="rounded-xl bg-card border border-border shadow-soft overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center justify-between">
          <p className="font-display text-lg font-light text-foreground">Gilbertsville Farmhouse</p>
          <p className="font-body text-sm tabular-nums text-foreground">{currency(gfhTotal)}</p>
        </div>
        {gfhItems.length === 0 ? (
          <p className="px-5 py-4 font-body text-sm text-muted-foreground">
            Your venue costs will appear here once Brandon sets them up in Financials.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {gfhItems.map(li => (
              <div key={li.id} className="px-5 py-2.5 flex items-center justify-between">
                <p className="font-body text-sm text-foreground">{li.label}</p>
                <p className="font-body text-sm tabular-nums text-foreground">{currency(gfhAmount(li))}</p>
              </div>
            ))}
          </div>
        )}
        <p className="px-5 py-2 text-[11px] font-body text-muted-foreground bg-muted/10 border-t border-border">
          These figures match your Financials page and cannot be edited here.
        </p>
      </div>

      {/* Your Other Costs */}
      <div className="rounded-xl bg-card border border-border shadow-soft overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-muted/20">
          <p className="font-display text-lg font-light text-foreground">Your Other Costs</p>
        </div>

        <div className="divide-y divide-border">
          {CATEGORIES.map(cat => {
            const catItems = items.filter(i => i.category === cat);
            return (
              <div key={cat} className="px-5 py-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-body text-sm font-medium text-foreground">{cat}</p>
                  <button
                    onClick={() => addItem(cat)}
                    className="flex items-center gap-1 font-body text-xs text-sage hover:text-sage-dark"
                  >
                    <Plus size={14} /> Add
                  </button>
                </div>
                {catItems.length === 0 ? (
                  <p className="font-body text-xs text-muted-foreground italic">No items yet.</p>
                ) : (
                  <div className="space-y-2">
                    {catItems.map(item => (
                      <div key={item.id} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={item.label ?? ""}
                          onChange={e => updateItem(item.id, { label: e.target.value })}
                          placeholder="What is this?"
                          className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 font-body text-sm focus:border-sage outline-none"
                        />
                        <div className="flex items-center">
                          <span className="font-body text-sm text-muted-foreground mr-1">$</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            value={item.estimated_amount === 0 ? "" : item.estimated_amount}
                            onChange={e => updateItem(item.id, { estimated_amount: e.target.value === "" ? 0 : Number(e.target.value) })}
                            placeholder="0"
                            className="w-24 rounded-md border border-border bg-background px-2 py-1.5 font-body text-sm text-right tabular-nums focus:border-sage outline-none"
                          />
                        </div>
                        <label className="flex items-center gap-1.5 px-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={item.booked}
                            onChange={e => updateItem(item.id, { booked: e.target.checked })}
                            className="rounded border-border accent-sage"
                          />
                          <span className="font-body text-xs text-muted-foreground">Booked</span>
                        </label>
                        <button
                          onClick={() => deleteItem(item.id)}
                          className="p-1.5 text-muted-foreground hover:text-destructive"
                          aria-label="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  tone,
}: { label: string; value: string; accent?: boolean; tone?: "ok" | "danger" }) {
  const color = tone === "danger" ? "#B7423A" : accent ? "#2C3E2D" : "#1a1a1a";
  return (
    <div>
      <p className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="font-display text-xl font-light tabular-nums mt-0.5" style={{ color }}>{value}</p>
    </div>
  );
}
