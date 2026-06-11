import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Wallet, Check } from "lucide-react";

interface Props {
  eventId: string;
}

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

const currency = (n: number | null | undefined) =>
  n == null
    ? "$0"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(Number(n));

export default function AdminBudgetTab({ eventId }: Props) {
  const [loading, setLoading] = useState(true);
  const [budget, setBudget] = useState<BudgetRow | null>(null);
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [gfhItems, setGfhItems] = useState<GfhLineItem[]>([]);

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    Promise.all([
      supabase.from("event_budgets").select("*").eq("event_id", eventId).maybeSingle(),
      supabase.from("budget_items").select("*").eq("event_id", eventId).order("category"),
      supabase.from("financial_line_items").select("id, section, label, unit_price, total").eq("event_id", eventId),
    ]).then(([{ data: bData }, { data: iData }, { data: gData }]) => {
      setBudget((bData as BudgetRow) ?? null);
      setItems((iData as BudgetItem[]) ?? []);
      setGfhItems((gData as GfhLineItem[]) ?? []);
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

  const grouped = useMemo(() => {
    const map = new Map<string, BudgetItem[]>();
    items.forEach(i => {
      const arr = map.get(i.category) ?? [];
      arr.push(i);
      map.set(i.category, arr);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!budget?.enabled) {
    return (
      <div className="max-w-3xl mx-auto px-5 py-10">
        <p className="font-body text-xs tracking-widest uppercase text-muted-foreground mb-2">Couple's Budget</p>
        <h1 className="font-display text-3xl font-light text-foreground mb-6" style={{ color: "#2C3E2D" }}>Budget</h1>
        <div className="rounded-xl border border-border shadow-soft p-8" style={{ backgroundColor: "#FAF8F4" }}>
          <div className="w-12 h-12 rounded-full bg-sage/15 border border-sage/25 flex items-center justify-center mb-4">
            <Wallet size={20} className="text-sage" />
          </div>
          <p className="font-body text-sm text-foreground leading-relaxed">
            This couple has not turned on their budget yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-5 py-8 lg:px-8 lg:py-10">
      <div className="mb-8">
        <p className="font-body text-xs tracking-widest uppercase text-muted-foreground mb-2">Couple's Budget (Read Only)</p>
        <h1 className="font-display text-3xl font-light" style={{ color: "#2C3E2D" }}>Budget</h1>
        <p className="font-body text-xs text-muted-foreground mt-1">
          You are viewing the couple's planning budget. Staff cannot edit these figures.
        </p>
      </div>

      {/* Summary */}
      <div className="rounded-xl border border-border shadow-soft p-6 mb-6" style={{ backgroundColor: "#FAF8F4" }}>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-5">
          <Stat label="Gilbertsville" value={currency(gfhTotal)} />
          <Stat label="Their Other" value={currency(externalTotal)} />
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
      </div>

      {/* Gilbertsville Farmhouse section */}
      <div className="rounded-xl bg-card border border-border shadow-soft overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center justify-between">
          <p className="font-display text-lg font-light text-foreground">Gilbertsville Farmhouse</p>
          <p className="font-body text-sm tabular-nums text-foreground">{currency(gfhTotal)}</p>
        </div>
        {gfhItems.length === 0 ? (
          <p className="px-5 py-4 font-body text-sm text-muted-foreground">No venue line items recorded yet.</p>
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
          Sourced from this event's Financials.
        </p>
      </div>

      {/* Couple's external items */}
      <div className="rounded-xl bg-card border border-border shadow-soft overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center justify-between">
          <p className="font-display text-lg font-light text-foreground">Their Other Costs</p>
          <p className="font-body text-sm tabular-nums text-foreground">{currency(externalTotal)}</p>
        </div>

        {grouped.length === 0 ? (
          <p className="px-5 py-4 font-body text-sm text-muted-foreground">
            The couple has not added any external items yet.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {grouped.map(([cat, catItems]) => {
              const catTotal = catItems.reduce((s, i) => s + Number(i.estimated_amount ?? 0), 0);
              return (
                <div key={cat} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-body text-sm font-medium text-foreground">{cat}</p>
                    <p className="font-body text-sm tabular-nums text-foreground">{currency(catTotal)}</p>
                  </div>
                  <div className="space-y-1.5">
                    {catItems.map(item => (
                      <div key={item.id} className="flex items-center justify-between gap-3 py-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="font-body text-sm text-foreground truncate">
                            {item.label || <span className="italic text-muted-foreground">Untitled</span>}
                          </p>
                          {item.booked && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-body uppercase tracking-wider"
                              style={{ backgroundColor: "#C9A84C22", color: "#7a6320" }}
                            >
                              <Check size={10} /> Booked
                            </span>
                          )}
                        </div>
                        <p className="font-body text-sm tabular-nums text-foreground">{currency(item.estimated_amount)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
