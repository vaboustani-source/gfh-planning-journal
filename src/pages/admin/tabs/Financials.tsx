import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Check, Trash2, CalendarClock, Pencil } from "lucide-react";
import { useAutosaveStatus } from "@/hooks/useAutosaveStatus";
import AdminStickyFooter from "@/components/admin/AdminStickyFooter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { format, parseISO, differenceInDays, addDays } from "date-fns";

interface PaymentLine {
  id: string;
  event_id: string | null;
  track: string;
  label: string;
  due_date: string | null;
  amount: number | null;
  paid: boolean | null;
  paid_date: string | null;
  method: string | null;
  payment_number: number | null;
  status: string | null;
}

interface LineItem {
  id: string;
  event_id: string;
  section: string;
  label: string;
  quantity: number | null;
  unit_price: number | null;
  total: number | null;
  source_table: string | null;
  source_id: string | null;
  sort_order: number | null;
}

const CATEGORIES = [
  { key: "site_fee", label: "Site Fee & Experiences", placeholder: 'e.g., "Site Fee", "Goat Yoga", "Fireworks"' },
  { key: "catering", label: "Food & Beverage", placeholder: 'e.g., "Catering — 150 guests", "Bar Package"' },
] as const;

function fmt(n: number | null | undefined) {
  if (n == null) return "$0";
  return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function computeStatus(p: PaymentLine): "paid" | "overdue" | "due_soon" | "upcoming" {
  if (p.paid) return "paid";
  if (!p.due_date) return "upcoming";
  const days = differenceInDays(parseISO(p.due_date), new Date());
  if (days < 0) return "overdue";
  if (days <= 14) return "due_soon";
  return "upcoming";
}

const STATUS_CHIP: Record<string, string> = {
  paid: "bg-sage/15 text-sage border-sage/30",
  overdue: "bg-destructive/10 text-destructive border-destructive/30",
  due_soon: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  upcoming: "bg-muted text-muted-foreground border-border",
};

const STATUS_LABEL: Record<string, string> = {
  paid: "Paid",
  overdue: "Overdue",
  due_soon: "Due Soon",
  upcoming: "Upcoming",
};

// ---------------- Line Item Row ----------------
function LineItemRow({ item, onUpdate, onDelete, isDecorAuto }: {
  item: LineItem;
  onUpdate: (id: string, fields: Partial<LineItem>) => void;
  onDelete: (id: string) => void;
  isDecorAuto: boolean;
}) {
  const [label, setLabel] = useState(item.label);
  const [amount, setAmount] = useState<number | null>(isDecorAuto ? Number(item.total ?? 0) : item.unit_price);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const debounced = (fields: Partial<LineItem>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onUpdate(item.id, fields), 700);
  };

  return (
    <div className="px-5 py-2.5 grid grid-cols-[1fr_auto_auto] gap-3 items-center">
      <input
        value={label}
        disabled={isDecorAuto}
        onChange={e => { setLabel(e.target.value); debounced({ label: e.target.value }); }}
        className="border border-border rounded-md px-2.5 py-1.5 font-body text-sm bg-background focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 w-full disabled:opacity-70 disabled:bg-muted/30"
      />
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-body text-xs text-muted-foreground">$</span>
        <input
          type="number"
          value={amount ?? ""}
          disabled={isDecorAuto}
          onChange={e => {
            const v = parseFloat(e.target.value);
            const val = isNaN(v) ? null : v;
            setAmount(val);
            debounced({ unit_price: val, total: val });
          }}
          placeholder="0.00"
          className="border border-border rounded-md pl-5 pr-2.5 py-1.5 font-body text-sm bg-background focus:outline-none focus:border-primary/50 w-32 disabled:opacity-70 disabled:bg-muted/30"
        />
      </div>
      {isDecorAuto ? (
        <span className="font-body text-[9px] uppercase tracking-wider text-muted-foreground px-2">auto</span>
      ) : (
        <button onClick={() => onDelete(item.id)} className="text-muted-foreground hover:text-destructive transition-colors">
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

// ---------------- Payment Schedule Modal ----------------
function ScheduleModal({ open, onClose, suggestedTotal, weddingDate, onGenerate }: {
  open: boolean;
  onClose: () => void;
  suggestedTotal: number;
  weddingDate: string | null;
  onGenerate: (rows: { label: string; due_date: string | null; amount: number; payment_number: number }[]) => Promise<void>;
}) {
  const DEFAULT_DAYS = [365, 180, 90, 30];
  const [total, setTotal] = useState<number>(suggestedTotal);
  const [count, setCount] = useState<number>(3);
  const [payments, setPayments] = useState<{ days: number; amount: number; label: string }[]>([]);

  useEffect(() => {
    if (open) setTotal(suggestedTotal);
  }, [open, suggestedTotal]);

  useEffect(() => {
    if (!open) return;
    const each = count > 0 ? Math.round((total / count) * 100) / 100 : 0;
    const rows = Array.from({ length: count }).map((_, i) => ({
      days: DEFAULT_DAYS[i] ?? Math.max(30, 365 - i * 90),
      amount: each,
      label: `Payment ${i + 1} of ${count}`,
    }));
    const sum = each * count;
    if (rows.length > 0) rows[rows.length - 1].amount = Math.round((rows[rows.length - 1].amount + (total - sum)) * 100) / 100;
    setPayments(rows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, open, total]);

  const dueDateFor = (days: number): string | null => {
    if (!weddingDate) return null;
    return addDays(parseISO(weddingDate), -days).toISOString().split("T")[0];
  };

  const update = (i: number, fields: Partial<{ days: number; amount: number; label: string }>) => {
    setPayments(prev => prev.map((p, idx) => idx === i ? { ...p, ...fields } : p));
  };

  const handleGenerate = async () => {
    const rows = payments.map((p, i) => ({
      label: p.label,
      due_date: dueDateFor(p.days),
      amount: p.amount,
      payment_number: i + 1,
    }));
    await onGenerate(rows);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display font-light">Set Up Payment Schedule</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div>
            <label className="block font-body text-xs uppercase tracking-wide text-muted-foreground mb-1.5">Total to collect</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-body text-sm text-muted-foreground">$</span>
              <input
                type="number"
                value={total}
                onChange={e => setTotal(parseFloat(e.target.value) || 0)}
                className="border border-border rounded-md pl-7 pr-3 py-2 font-body text-base bg-background focus:outline-none focus:border-primary/50 w-full"
              />
            </div>
          </div>

          <div>
            <label className="block font-body text-xs uppercase tracking-wide text-muted-foreground mb-1.5">Number of payments</label>
            <div className="flex gap-1.5 flex-wrap items-center">
              {[1, 2, 3, 4].map(n => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className={`px-4 py-1.5 rounded-full font-body text-sm border transition-colors ${count === n ? "bg-primary text-primary-foreground border-primary" : "bg-background text-foreground border-border hover:border-primary/40"}`}
                >
                  {n}
                </button>
              ))}
              <input
                type="number"
                min={1}
                max={24}
                value={![1, 2, 3, 4].includes(count) ? count : ""}
                placeholder="Custom"
                onChange={e => {
                  const v = parseInt(e.target.value);
                  if (!isNaN(v) && v > 0) setCount(v);
                }}
                className="px-3 py-1.5 rounded-full font-body text-sm border border-border bg-background w-24 focus:outline-none focus:border-primary/50"
              />
            </div>
          </div>

          {!weddingDate && (
            <p className="font-body text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              Set a wedding date on the Overview tab to auto-calculate due dates.
            </p>
          )}

          <div>
            <label className="block font-body text-xs uppercase tracking-wide text-muted-foreground mb-1.5">Payments</label>
            <div className="space-y-2">
              {payments.map((p, i) => {
                const due = dueDateFor(p.days);
                return (
                  <div key={i} className="rounded-md border border-border p-3 space-y-2">
                    <input
                      value={p.label}
                      onChange={e => update(i, { label: e.target.value })}
                      className="border border-border rounded px-2 py-1 font-body text-sm bg-background focus:outline-none focus:border-primary/50 w-full"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="relative">
                          <input
                            type="number"
                            value={p.days}
                            onChange={e => update(i, { days: parseInt(e.target.value) || 0 })}
                            className="border border-border rounded px-2 py-1 pr-20 font-body text-sm bg-background focus:outline-none focus:border-primary/50 w-full"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 font-body text-[11px] text-muted-foreground pointer-events-none">days before</span>
                        </div>
                        {due && <p className="font-body text-[11px] text-muted-foreground mt-1">{format(parseISO(due), "MMMM d, yyyy")}</p>}
                      </div>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 font-body text-xs text-muted-foreground">$</span>
                        <input
                          type="number"
                          value={p.amount}
                          onChange={e => update(i, { amount: parseFloat(e.target.value) || 0 })}
                          className="border border-border rounded pl-5 pr-2 py-1 font-body text-sm bg-background focus:outline-none focus:border-primary/50 w-full"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="font-body text-xs text-muted-foreground mt-2">
              Sum: {fmt(payments.reduce((s, p) => s + (p.amount || 0), 0))} of {fmt(total)}
            </p>
          </div>
        </div>
        <DialogFooter>
          <button onClick={onClose} className="px-4 py-2 font-body text-sm rounded-lg border border-border hover:bg-muted transition-colors">Cancel</button>
          <button onClick={handleGenerate} className="px-4 py-2 font-body text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity">Generate Schedule</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Payment Row ----------------
function PaymentRow({ p, onTogglePaid, onDelete }: {
  p: PaymentLine;
  onTogglePaid: (p: PaymentLine) => void;
  onDelete: (id: string) => void;
}) {
  const status = computeStatus(p);
  return (
    <div className="px-5 py-3 grid grid-cols-[2rem_1fr_auto_auto_auto_auto] gap-3 items-center">
      <span className="font-body text-xs text-muted-foreground tabular-nums">{p.payment_number ? `#${p.payment_number}` : "—"}</span>
      <div className="min-w-0">
        <p className="font-body text-sm text-foreground truncate">{p.label}</p>
        {p.due_date && (
          <p className={`font-body text-[11px] ${status === "overdue" ? "text-destructive" : "text-muted-foreground"}`}>
            Due {format(parseISO(p.due_date), "MMM d, yyyy")}
          </p>
        )}
      </div>
      <p className="font-body text-sm tabular-nums text-foreground">{fmt(p.amount)}</p>
      <span className={`px-2 py-0.5 rounded-full border font-body text-[10px] uppercase tracking-wide ${STATUS_CHIP[status]}`}>{STATUS_LABEL[status]}</span>
      <button
        onClick={() => onTogglePaid(p)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-body text-xs transition-colors ${p.paid ? "bg-sage/15 text-sage border border-sage/30" : "bg-muted text-muted-foreground border border-border hover:border-sage/40"}`}
      >
        {p.paid && <Check size={10} />}
        {p.paid ? "Paid" : "Mark paid"}
      </button>
      <button onClick={() => onDelete(p.id)} className="text-muted-foreground hover:text-destructive transition-colors">
        <Trash2 size={14} />
      </button>
    </div>
  );
}

// ---------------- Category Card ----------------
function CategoryCard({
  category, label, placeholder, items, payments, decorItems, weddingDate,
  onAddItem, onUpdateItem, onDeleteItem, onGenerateSchedule, onAddPayment, onTogglePaid, onDeletePayment,
}: {
  category: string;
  label: string;
  placeholder: string;
  items: LineItem[];
  payments: PaymentLine[];
  decorItems: LineItem[];
  weddingDate: string | null;
  onAddItem: (cat: string) => void;
  onUpdateItem: (id: string, fields: Partial<LineItem>) => void;
  onDeleteItem: (id: string) => void;
  onGenerateSchedule: (cat: string, rows: { label: string; due_date: string | null; amount: number; payment_number: number }[]) => Promise<void>;
  onAddPayment: (cat: string) => void;
  onTogglePaid: (p: PaymentLine) => void;
  onDeletePayment: (id: string) => void;
}) {
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const itemsTotal = items.reduce((s, l) => s + Number(l.unit_price ?? 0), 0);
  const decorTotal = decorItems.reduce((s, l) => s + Number(l.total ?? 0), 0);
  const subtotal = itemsTotal + decorTotal;
  const paid = payments.filter(p => p.paid).reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const remaining = subtotal - paid;
  const today = todayStr();
  const upcomingPayments = payments.filter(p => !p.paid && p.due_date).sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
  const nextPayment = upcomingPayments.find(p => (p.due_date ?? "") >= today) ?? upcomingPayments[0];

  return (
    <div className="rounded-xl bg-card border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-muted/20">
        <p className="font-display text-lg font-light text-foreground">{label}</p>
      </div>

      {/* Line items */}
      <div className="px-5 pt-3 pb-2 flex items-center justify-between">
        <p className="font-body text-[11px] uppercase tracking-wide text-muted-foreground">Line items</p>
        <button
          onClick={() => onAddItem(category)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/10 text-primary font-body text-xs hover:bg-primary/20 transition-colors"
        >
          <Plus size={11} /> Add Line Item
        </button>
      </div>
      <div className="divide-y divide-border">
        {items.length === 0 && decorItems.length === 0 ? (
          <p className="px-5 py-4 font-body text-xs text-muted-foreground text-center italic">{placeholder}</p>
        ) : (
          <>
            {items.map(item => (
              <LineItemRow key={item.id} item={item} onUpdate={onUpdateItem} onDelete={onDeleteItem} isDecorAuto={false} />
            ))}
            {decorItems.map(item => (
              <LineItemRow key={item.id} item={item} onUpdate={onUpdateItem} onDelete={onDeleteItem} isDecorAuto={true} />
            ))}
          </>
        )}
      </div>

      {/* Schedule */}
      <div className="px-5 pt-4 pb-2 border-t border-border flex items-center justify-between">
        <p className="font-body text-[11px] uppercase tracking-wide text-muted-foreground">Payment schedule</p>
        <div className="flex items-center gap-2">
          {payments.length > 0 && (
            <button
              onClick={() => onAddPayment(category)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted text-foreground font-body text-xs hover:bg-muted/70 transition-colors"
            >
              <Plus size={11} /> Add Payment
            </button>
          )}
          <button
            onClick={() => setScheduleOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary text-primary-foreground font-body text-xs hover:opacity-90 transition-opacity"
          >
            {payments.length > 0 ? <><Pencil size={11} /> Edit Schedule</> : <><CalendarClock size={11} /> Set Up Payment Schedule</>}
          </button>
        </div>
      </div>
      <div className="divide-y divide-border">
        {payments.length === 0 ? (
          <p className="px-5 py-4 font-body text-xs text-muted-foreground text-center italic">No payments scheduled yet.</p>
        ) : payments
            .slice()
            .sort((a, b) => (a.payment_number ?? 99) - (b.payment_number ?? 99) || (a.due_date ?? "").localeCompare(b.due_date ?? ""))
            .map(p => <PaymentRow key={p.id} p={p} onTogglePaid={onTogglePaid} onDelete={onDeletePayment} />)}
      </div>

      {/* Card summary */}
      <div className="px-5 py-4 border-t border-border bg-muted/10 grid grid-cols-2 lg:grid-cols-4 gap-3 text-center">
        <div>
          <p className="font-body text-[10px] uppercase tracking-wide text-muted-foreground">Subtotal</p>
          <p className="font-body text-sm font-medium text-foreground tabular-nums">{fmt(subtotal)}</p>
        </div>
        <div>
          <p className="font-body text-[10px] uppercase tracking-wide text-muted-foreground">Paid</p>
          <p className="font-body text-sm font-medium text-sage tabular-nums">{fmt(paid)}</p>
        </div>
        <div>
          <p className="font-body text-[10px] uppercase tracking-wide text-muted-foreground">Remaining</p>
          <p className="font-body text-sm font-medium text-foreground tabular-nums">{fmt(remaining)}</p>
        </div>
        <div>
          <p className="font-body text-[10px] uppercase tracking-wide text-muted-foreground">Next due</p>
          <p className="font-body text-sm font-medium text-foreground tabular-nums">
            {nextPayment ? `${fmt(nextPayment.amount)} · ${nextPayment.due_date ? format(parseISO(nextPayment.due_date), "MMM d") : "—"}` : "—"}
          </p>
        </div>
      </div>

      <ScheduleModal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        suggestedTotal={subtotal}
        weddingDate={weddingDate}
        onGenerate={async rows => onGenerateSchedule(category, rows)}
      />
    </div>
  );
}

// ---------------- Main Tab ----------------
export default function FinancialsTab({ eventId, onNavigateNext }: { eventId: string; onNavigateNext?: () => void }) {
  const [items, setItems] = useState<LineItem[]>([]);
  const [payments, setPayments] = useState<PaymentLine[]>([]);
  const [weddingDate, setWeddingDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { status, markSaving, markSaved } = useAutosaveStatus();

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [eventId]);

  const fetchData = async () => {
    const [{ data: itemsData }, { data: paymentsData }, { data: eventData }, { data: finData }] = await Promise.all([
      supabase.from("financial_line_items").select("*").eq("event_id", eventId).order("section").order("sort_order"),
      supabase.from("payment_schedule").select("*").eq("event_id", eventId).order("payment_number", { ascending: true }),
      supabase.from("events").select("wedding_date").eq("id", eventId).maybeSingle(),
      supabase.from("financials").select("site_fee_total, catering_estimate").eq("event_id", eventId).maybeSingle(),
    ]);

    let itemsList: LineItem[] = (itemsData as any) || [];
    setWeddingDate(eventData?.wedding_date ?? null);

    // Auto-migrate legacy totals into line items if no manual entry exists for that category
    const ensureLegacy = async (section: string, label: string, amount: number) => {
      const exists = itemsList.some(i => i.section === section);
      if (!exists && amount > 0) {
        const { data } = await supabase.from("financial_line_items").insert({
          event_id: eventId, section, label, quantity: 1, unit_price: amount, total: amount, source_table: "manual",
        } as any).select().single();
        if (data) itemsList = [...itemsList, data as any];
      }
    };
    if (finData?.site_fee_total && Number(finData.site_fee_total) > 0) await ensureLegacy("site_fee", "Site Fee", Number(finData.site_fee_total));
    if (finData?.catering_estimate && Number(finData.catering_estimate) > 0) await ensureLegacy("catering", "Catering", Number(finData.catering_estimate));

    setItems(itemsList);
    setPayments((paymentsData as any) || []);
    setLoading(false);
  };

  // ---- line item CRUD ----
  const addItem = async (category: string) => {
    markSaving();
    const { data, error } = await supabase.from("financial_line_items").insert({
      event_id: eventId, section: category, label: "New line item", quantity: 1, unit_price: 0, total: 0, source_table: "manual",
    } as any).select().single();
    if (error) {
      console.error("addItem error:", error);
    }
    if (data) setItems(prev => [...prev, data as any]);
    markSaved();
  };

  const updateItem = async (id: string, fields: Partial<LineItem>) => {
    markSaving();
    const payload: any = { ...fields };
    if ("unit_price" in fields) payload.total = fields.unit_price;
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...payload } : i));
    await supabase.from("financial_line_items").update(payload).eq("id", id);
    markSaved();
  };

  const deleteItem = async (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    await supabase.from("financial_line_items").delete().eq("id", id);
  };

  // ---- payment CRUD ----
  const generateSchedule = async (category: string, rows: { label: string; due_date: string | null; amount: number; payment_number: number }[]) => {
    markSaving();
    await supabase.from("payment_schedule").delete().eq("event_id", eventId).eq("track", category);
    const inserts = rows.map(r => ({
      event_id: eventId, track: category, label: r.label, due_date: r.due_date, amount: r.amount,
      payment_number: r.payment_number, paid: false, status: "upcoming",
    }));
    const { data } = await supabase.from("payment_schedule").insert(inserts).select();
    setPayments(prev => [...prev.filter(p => p.track !== category), ...((data as any) || [])]);
    markSaved();
  };

  const addPayment = async (category: string) => {
    const existing = payments.filter(p => p.track === category);
    const nextNum = (Math.max(0, ...existing.map(p => p.payment_number ?? 0)) || 0) + 1;
    const { data } = await supabase.from("payment_schedule").insert({
      event_id: eventId, track: category, label: `Payment ${nextNum}`, paid: false,
      payment_number: nextNum, status: "upcoming",
    } as any).select().single();
    if (data) setPayments(prev => [...prev, data as any]);
  };

  const togglePaid = async (p: PaymentLine) => {
    markSaving();
    const fields = { paid: !p.paid, paid_date: !p.paid ? todayStr() : null, status: !p.paid ? "paid" : "upcoming" };
    setPayments(prev => prev.map(x => x.id === p.id ? { ...x, ...fields } : x));
    await supabase.from("payment_schedule").update(fields).eq("id", p.id);
    markSaved();
  };

  const deletePayment = async (id: string) => {
    setPayments(prev => prev.filter(p => p.id !== id));
    await supabase.from("payment_schedule").delete().eq("id", id);
  };

  if (loading) return <div className="py-12 flex justify-center"><div className="w-6 h-6 rounded-full border-2 border-sage/30 border-t-sage animate-spin" /></div>;

  // Grand totals
  const allSubtotal = items.reduce((s, l) => {
    if (l.section === "Décor Rentals") return s + Number(l.total ?? 0);
    if (l.section === "site_fee" || l.section === "catering") return s + Number(l.unit_price ?? 0);
    return s;
  }, 0);
  const allPaid = payments.filter(p => p.paid).reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const allRemaining = allSubtotal - allPaid;

  return (
    <div className="space-y-6 pb-32 animate-fade-up relative">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {CATEGORIES.map(cat => (
          <CategoryCard
            key={cat.key}
            category={cat.key}
            label={cat.label}
            placeholder={cat.placeholder}
            items={items.filter(i => i.section === cat.key)}
            decorItems={cat.key === "site_fee" ? items.filter(i => i.section === "Décor Rentals") : []}
            payments={payments.filter(p => p.track === cat.key)}
            weddingDate={weddingDate}
            onAddItem={addItem}
            onUpdateItem={updateItem}
            onDeleteItem={deleteItem}
            onGenerateSchedule={generateSchedule}
            onAddPayment={addPayment}
            onTogglePaid={togglePaid}
            onDeletePayment={deletePayment}
          />
        ))}
      </div>

      {/* Grand total bar */}
      <div className="rounded-xl bg-forest text-white px-6 py-4 grid grid-cols-1 sm:grid-cols-3 gap-3 shadow-soft">
        <div>
          <p className="font-body text-[10px] uppercase tracking-widest text-white/70">Total Contract Value</p>
          <p className="font-display text-2xl font-light tabular-nums">{fmt(allSubtotal)}</p>
        </div>
        <div>
          <p className="font-body text-[10px] uppercase tracking-widest text-white/70">Total Paid</p>
          <p className="font-display text-2xl font-light tabular-nums">{fmt(allPaid)}</p>
        </div>
        <div>
          <p className="font-body text-[10px] uppercase tracking-widest text-white/70">Balance Remaining</p>
          <p className="font-display text-2xl font-light tabular-nums">{fmt(allRemaining)}</p>
        </div>
      </div>

      <AdminStickyFooter status={status} onSave={() => {}} onSaveAndContinue={() => onNavigateNext?.()} />
    </div>
  );
}
