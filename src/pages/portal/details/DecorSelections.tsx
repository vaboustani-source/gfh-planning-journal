import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePortalData } from "@/hooks/usePortalData";
import { Image as ImageIcon, Plus, Minus, Check, X, Pencil, Loader2 } from "lucide-react";
import { DECOR_CATEGORIES, getCategoryLabel } from "@/lib/decorCategories";

interface CatalogItem {
  id: string;
  category: string;
  title: string;
  description: string | null;
  price_per_unit: number;
  price_label: string | null;
  photo_url: string | null;
  available: boolean | null;
}

interface Selection {
  id: string;
  catalog_item_id: string;
  quantity: number;
  unit_price: number;
  notes: string | null;
}

function currency(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function DecorSelections() {
  const { eventId } = usePortalData();
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [selections, setSelections] = useState<Selection[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [pendingQty, setPendingQty] = useState<Record<string, number>>({});
  const [editingQty, setEditingQty] = useState<string | null>(null);
  const [decorNotes, setDecorNotes] = useState("");
  const notesDebounce = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!eventId) return;
    Promise.all([
      supabase.from("decor_catalog").select("*").eq("available", true).order("sort_order").order("title"),
      supabase.from("decor_selections").select("id, catalog_item_id, quantity, unit_price, notes").eq("event_id", eventId),
      supabase.from("events").select("decor_notes").eq("id", eventId).maybeSingle(),
    ]).then(([{ data: cData }, { data: sData }, { data: eData }]) => {
      if (cData) setCatalog(cData as CatalogItem[]);
      if (sData) setSelections(sData as Selection[]);
      if (eData) setDecorNotes((eData as any).decor_notes ?? "");
      setLoading(false);
    });
  }, [eventId]);

  const filtered = useMemo(
    () => filter === "all" ? catalog : catalog.filter(c => c.category === filter),
    [catalog, filter]
  );

  const selectionByItem = useMemo(() => {
    const m = new Map<string, Selection>();
    selections.forEach(s => m.set(s.catalog_item_id, s));
    return m;
  }, [selections]);

  const totals = useMemo(() => {
    const itemCount = selections.reduce((s, x) => s + x.quantity, 0);
    const totalPrice = selections.reduce((s, x) => s + x.quantity * Number(x.unit_price), 0);
    return { itemCount, totalPrice };
  }, [selections]);

  const addToEvent = async (item: CatalogItem, quantity: number) => {
    if (!eventId) return;
    const { data, error } = await supabase.from("decor_selections").insert({
      event_id: eventId,
      catalog_item_id: item.id,
      quantity,
      unit_price: item.price_per_unit,
    }).select("id, catalog_item_id, quantity, unit_price, notes").single();
    if (error) { console.error(error); return; }
    setSelections(prev => [...prev, data as Selection]);
    setPendingQty(prev => { const n = { ...prev }; delete n[item.id]; return n; });
  };

  const updateQuantity = async (sel: Selection, quantity: number) => {
    if (quantity < 1) return;
    await supabase.from("decor_selections").update({ quantity }).eq("id", sel.id);
    setSelections(prev => prev.map(s => s.id === sel.id ? { ...s, quantity } : s));
  };

  const removeSelection = async (id: string) => {
    await supabase.from("decor_selections").delete().eq("id", id);
    setSelections(prev => prev.filter(s => s.id !== id));
  };

  const saveNotes = (val: string) => {
    setDecorNotes(val);
    if (notesDebounce.current) clearTimeout(notesDebounce.current);
    notesDebounce.current = setTimeout(async () => {
      await supabase.from("events").update({ decor_notes: val } as any).eq("id", eventId!);
    }, 800);
  };

  const scrollToSummary = () => {
    document.getElementById("decor-summary")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>;
  }

  if (catalog.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="font-display text-xl italic text-muted-foreground">Décor inventory coming soon</p>
        <p className="font-body text-sm text-muted-foreground mt-1">Brandon will publish the rental catalog here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Category pills */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-1 px-1">
        {[{ key: "all", label: "All" }, ...DECOR_CATEGORIES].map(c => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full font-body text-xs transition-colors border ${
              filter === c.key
                ? "bg-sage text-primary-foreground border-sage"
                : "bg-card text-muted-foreground border-border hover:border-sage/40"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Selections summary bar */}
      {totals.itemCount > 0 && (
        <button
          onClick={scrollToSummary}
          className="w-full sticky top-2 z-10 rounded-xl bg-sage/10 border border-sage/30 px-5 py-3 flex items-center justify-between hover:bg-sage/15 transition-colors"
        >
          <p className="font-body text-sm text-foreground">
            <span className="font-medium">{totals.itemCount}</span> item{totals.itemCount === 1 ? "" : "s"} selected
            <span className="text-muted-foreground"> · Total: </span>
            <span className="font-medium tabular-nums">{currency(totals.totalPrice)}</span>
          </p>
          <span className="font-body text-xs text-sage">View all →</span>
        </button>
      )}

      {/* Catalog grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map(item => {
          const sel = selectionByItem.get(item.id);
          const pending = pendingQty[item.id];
          return (
            <div key={item.id} className="rounded-xl bg-card border border-border shadow-soft overflow-hidden flex flex-col">
              <div className="relative h-[200px] bg-muted overflow-hidden">
                {item.photo_url ? (
                  <img src={item.photo_url} alt={item.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-sage/10 to-cream">
                    <ImageIcon size={32} className="text-muted-foreground/40" />
                  </div>
                )}
                {sel && (
                  <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-background/95 px-2.5 py-1 font-body text-[10px] tracking-wide text-amber-700 border border-amber-200">
                    <Check size={10} className="text-amber-600" /> Added
                  </span>
                )}
              </div>
              <div className="p-4 flex-1 flex flex-col gap-2">
                <p className="font-display text-base text-foreground leading-tight">{item.title}</p>
                <span className="self-start rounded-full bg-sage/10 px-2 py-0.5 font-body text-[10px] tracking-wide text-sage">
                  {getCategoryLabel(item.category)}
                </span>
                <p className="font-body text-sm text-foreground tabular-nums">
                  {currency(Number(item.price_per_unit))} <span className="text-muted-foreground text-xs">{item.price_label || "per item"}</span>
                </p>
                {item.description && (
                  <p className="font-body text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                )}

                <div className="mt-auto pt-3">
                  {sel ? (
                    editingQty === sel.id ? (
                      <div className="flex items-center gap-2">
                        <QtyStepper value={sel.quantity} onChange={(q) => updateQuantity(sel, q)} />
                        <button onClick={() => setEditingQty(null)} className="px-2.5 py-1.5 rounded-md bg-sage text-primary-foreground font-body text-xs">
                          Done
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-body text-xs text-muted-foreground">
                          Qty: <span className="font-medium text-foreground">{sel.quantity}</span>
                        </p>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setEditingQty(sel.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                            <Pencil size={12} />
                          </button>
                          <button onClick={() => removeSelection(sel.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors">
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    )
                  ) : pending !== undefined ? (
                    <div className="flex items-center gap-2">
                      <QtyStepper value={pending} onChange={(q) => setPendingQty(prev => ({ ...prev, [item.id]: q }))} />
                      <button onClick={() => addToEvent(item, pending)} className="px-2.5 py-1.5 rounded-md bg-sage text-primary-foreground font-body text-xs">
                        Save
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setPendingQty(prev => ({ ...prev, [item.id]: 1 }))}
                      className="w-full px-3 py-2 rounded-md border border-sage/30 bg-sage/5 text-sage font-body text-xs hover:bg-sage/10 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Plus size={12} /> Add to Event
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom summary */}
      {selections.length > 0 && (
        <div id="decor-summary" className="rounded-xl bg-card border border-border shadow-soft overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-cream/40">
            <p className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">Your selections</p>
            <p className="font-display text-xl font-light text-foreground mt-0.5">Your Décor Selections</p>
          </div>
          <div className="divide-y divide-border">
            {selections.map(sel => {
              const item = catalog.find(c => c.id === sel.catalog_item_id);
              if (!item) return null;
              const lineTotal = sel.quantity * Number(sel.unit_price);
              return (
                <div key={sel.id} className="px-5 py-3.5 flex items-center gap-3">
                  <div className="w-14 h-14 rounded-md bg-muted overflow-hidden shrink-0">
                    {item.photo_url ? (
                      <img src={item.photo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><ImageIcon size={16} className="text-muted-foreground/40" /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-sm text-foreground truncate">{item.title}</p>
                    <p className="font-body text-xs text-muted-foreground">
                      Qty {sel.quantity} × {currency(Number(sel.unit_price))}
                    </p>
                  </div>
                  <p className="font-body text-sm tabular-nums text-foreground">{currency(lineTotal)}</p>
                  <button onClick={() => removeSelection(sel.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
          <div className="px-5 py-4 bg-muted/20 flex justify-between items-center">
            <p className="font-body text-sm text-muted-foreground">Total</p>
            <p className="font-display text-2xl font-light text-foreground tabular-nums">{currency(totals.totalPrice)}</p>
          </div>
          <div className="px-5 py-4 border-t border-border space-y-2">
            <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">Any notes for Brandon about your décor?</label>
            <textarea
              value={decorNotes}
              onChange={e => saveNotes(e.target.value)}
              rows={3}
              placeholder="Special placement, sentimental items, questions…"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 font-body text-sm text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function QtyStepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="inline-flex items-center rounded-md border border-border bg-background overflow-hidden">
      <button onClick={() => onChange(Math.max(1, value - 1))} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors">
        <Minus size={12} />
      </button>
      <span className="w-8 text-center font-body text-sm tabular-nums">{value}</span>
      <button onClick={() => onChange(value + 1)} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors">
        <Plus size={12} />
      </button>
    </div>
  );
}
