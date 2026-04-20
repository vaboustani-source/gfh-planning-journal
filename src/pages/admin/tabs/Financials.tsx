import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Check, Trash2 } from "lucide-react";
import { useAutosaveStatus } from "@/hooks/useAutosaveStatus";
import AdminStickyFooter from "@/components/admin/AdminStickyFooter";

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
}

interface FinancialsRow {
  site_fee_total: number | null;
  catering_estimate: number | null;
}

const TRACKS = ["site_fee", "catering"] as const;
const TRACK_LABELS: Record<string, string> = { site_fee: "Site Fee", catering: "Catering" };
const TRACK_COLUMN: Record<string, keyof FinancialsRow> = {
  site_fee: "site_fee_total",
  catering: "catering_estimate",
};

function fmt(n: number | null) {
  if (n == null) return "—";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function TrackPanel({
  track, lines, trackTotal, onTrackTotalChange, onAdd, onUpdate, onDelete, onSaveStart, onSaveEnd,
}: {
  track: string;
  lines: PaymentLine[];
  trackTotal: number | null;
  onTrackTotalChange: (track: string, value: number | null) => void;
  onAdd: (track: string) => Promise<void>;
  onUpdate: (id: string, fields: Partial<PaymentLine>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSaveStart: () => void;
  onSaveEnd: () => void;
}) {
  const total = trackTotal ?? 0;
  const paid = lines.filter(l => l.paid).reduce((s, l) => s + (l.amount ?? 0), 0);
  const remaining = total - paid;
  const debounceRefs = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [localTotal, setLocalTotal] = useState<number | null>(trackTotal);

  useEffect(() => { setLocalTotal(trackTotal); }, [trackTotal]);

  const debouncedUpdate = useCallback((id: string, fields: Partial<PaymentLine>) => {
    const key = `${id}-${Object.keys(fields).join(",")}`;
    const existing = debounceRefs.current.get(key);
    if (existing) clearTimeout(existing);
    debounceRefs.current.set(key, setTimeout(async () => {
      debounceRefs.current.delete(key);
      onSaveStart();
      await onUpdate(id, fields);
      onSaveEnd();
    }, 800));
  }, [onUpdate, onSaveStart, onSaveEnd]);

  const immediateUpdate = async (id: string, fields: Partial<PaymentLine>) => {
    onSaveStart();
    await onUpdate(id, fields);
    onSaveEnd();
  };

  const totalDebounce = useRef<ReturnType<typeof setTimeout>>();
  const handleTotalChange = (val: string) => {
    const v = parseFloat(val) || null;
    setLocalTotal(v);
    if (totalDebounce.current) clearTimeout(totalDebounce.current);
    totalDebounce.current = setTimeout(() => {
      onTrackTotalChange(track, v);
    }, 800);
  };

  return (
    <div className="rounded-xl bg-card border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/20 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <p className="font-display text-lg font-light text-foreground shrink-0">{TRACK_LABELS[track]}</p>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-body text-xs text-muted-foreground">$</span>
            <input
              type="number"
              value={localTotal ?? ""}
              onChange={e => handleTotalChange(e.target.value)}
              placeholder="0.00"
              className="border border-border rounded-md pl-5 pr-2.5 py-1.5 font-body text-sm bg-background focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 w-32"
            />
          </div>
        </div>
        <button
          onClick={() => onAdd(track)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-body text-xs hover:opacity-90 transition-opacity shrink-0"
        >
          <Plus size={12} />
          Add
        </button>
      </div>

      <div className="divide-y divide-border">
        {lines.length === 0 ? (
          <p className="px-5 py-6 font-body text-sm text-muted-foreground text-center">No payment items yet.</p>
        ) : lines.map(line => (
          <LineRow
            key={line.id}
            line={line}
            onDebouncedUpdate={debouncedUpdate}
            onImmediateUpdate={immediateUpdate}
            onDelete={onDelete}
          />
        ))}
      </div>

      <div className="px-5 py-4 border-t border-border bg-muted/10 space-y-1.5">
        <div className="flex justify-between font-body text-sm text-muted-foreground">
          <span>Total</span><span>{fmt(total)}</span>
        </div>
        <div className="flex justify-between font-body text-sm text-sage">
          <span>Paid</span><span>{fmt(paid)}</span>
        </div>
        <div className="flex justify-between font-body text-sm font-medium text-foreground border-t border-border pt-2 mt-2">
          <span>Remaining</span><span>{fmt(remaining)}</span>
        </div>
      </div>
    </div>
  );
}

function LineRow({ line, onDebouncedUpdate, onImmediateUpdate, onDelete }: {
  line: PaymentLine;
  onDebouncedUpdate: (id: string, fields: Partial<PaymentLine>) => void;
  onImmediateUpdate: (id: string, fields: Partial<PaymentLine>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [label, setLabel] = useState(line.label);
  const [amount, setAmount] = useState(line.amount);

  return (
    <div className="px-5 py-3 grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 items-center">
      <input
        value={label}
        onChange={e => {
          setLabel(e.target.value);
          onDebouncedUpdate(line.id, { label: e.target.value });
        }}
        className="border border-border rounded-md px-2.5 py-1.5 font-body text-sm bg-background focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 w-full"
      />
      <input
        type="date"
        value={line.due_date || ""}
        onChange={e => onImmediateUpdate(line.id, { due_date: e.target.value || null })}
        className="border border-border rounded-md px-2.5 py-1.5 font-body text-xs bg-background focus:outline-none focus:border-primary/50 w-32"
      />
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-body text-xs text-muted-foreground">$</span>
        <input
          type="number"
          value={amount ?? ""}
          onChange={e => {
            const v = parseFloat(e.target.value) || null;
            setAmount(v);
            onDebouncedUpdate(line.id, { amount: v });
          }}
          placeholder="0.00"
          className="border border-border rounded-md pl-5 pr-2.5 py-1.5 font-body text-sm bg-background focus:outline-none focus:border-primary/50 w-28"
        />
      </div>
      <button
        onClick={() => onImmediateUpdate(line.id, {
          paid: !line.paid,
          paid_date: !line.paid ? new Date().toISOString().split("T")[0] : null,
        })}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-body text-xs transition-colors ${
          line.paid
            ? "bg-sage/15 text-sage border border-sage/30"
            : "bg-muted text-muted-foreground border border-border hover:border-sage/40"
        }`}
      >
        {line.paid && <Check size={10} />}
        {line.paid ? "Paid" : "Mark paid"}
      </button>
      <button onClick={() => onDelete(line.id)} className="text-muted-foreground hover:text-destructive transition-colors">
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export default function FinancialsTab({ eventId, onNavigateNext }: { eventId: string; onNavigateNext?: () => void }) {
  const [lines, setLines] = useState<PaymentLine[]>([]);
  const [financials, setFinancials] = useState<FinancialsRow>({ site_fee_total: null, catering_estimate: null });
  const [decorLines, setDecorLines] = useState<{ id: string; label: string; quantity: number; unit_price: number; total: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const { status, markSaving, markSaved } = useAutosaveStatus();

  useEffect(() => { fetchData(); }, [eventId]);

  const fetchData = async () => {
    const [{ data: linesData }, { data: finData }, { data: decorData }] = await Promise.all([
      supabase.from("payment_schedule").select("*").eq("event_id", eventId).order("due_date", { ascending: true }),
      supabase.from("financials").select("site_fee_total, catering_estimate").eq("event_id", eventId).maybeSingle(),
      supabase.from("financial_line_items").select("id, label, quantity, unit_price, total").eq("event_id", eventId).eq("section", "Décor Rentals").order("created_at"),
    ]);
    if (linesData) setLines(linesData);
    if (decorData) setDecorLines(decorData as any);
    if (finData) {
      setFinancials(finData);
    } else {
      await supabase.from("financials").upsert({ event_id: eventId, site_fee_total: 0, catering_estimate: 0 }, { onConflict: "event_id" });
      setFinancials({ site_fee_total: 0, catering_estimate: 0 });
    }
    setLoading(false);
  };

  const handleTrackTotalChange = async (track: string, value: number | null) => {
    const col = TRACK_COLUMN[track];
    setFinancials(prev => ({ ...prev, [col]: value }));
    markSaving();
    await supabase.from("financials").update({ [col]: value ?? 0 } as any).eq("event_id", eventId);
    markSaved();
  };

  const addLine = async (track: string) => {
    const { data } = await supabase.from("payment_schedule").insert({
      event_id: eventId, track, label: "New payment", paid: false,
    }).select().single();
    if (data) setLines(prev => [...prev, data]);
  };

  const updateLine = async (id: string, fields: Partial<PaymentLine>) => {
    await supabase.from("payment_schedule").update(fields).eq("id", id);
    setLines(prev => prev.map(l => l.id === id ? { ...l, ...fields } : l));
  };

  const deleteLine = async (id: string) => {
    await supabase.from("payment_schedule").delete().eq("id", id);
    setLines(prev => prev.filter(l => l.id !== id));
  };

  if (loading) return <div className="py-12 flex justify-center"><div className="w-6 h-6 rounded-full border-2 border-sage/30 border-t-sage animate-spin" /></div>;

  const decorTotal = decorLines.reduce((s, l) => s + Number(l.total ?? 0), 0);

  return (
    <div className="space-y-6 pb-24 animate-fade-up relative">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {TRACKS.map(track => (
          <TrackPanel
            key={track}
            track={track}
            lines={lines.filter(l => l.track === track)}
            trackTotal={financials[TRACK_COLUMN[track]]}
            onTrackTotalChange={handleTrackTotalChange}
            onAdd={addLine}
            onUpdate={updateLine}
            onDelete={deleteLine}
            onSaveStart={markSaving}
            onSaveEnd={markSaved}
          />
        ))}
      </div>

      {/* Décor Rentals card */}
      <div className="rounded-xl bg-card border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center justify-between">
          <p className="font-display text-lg font-light text-foreground">Décor Rentals</p>
          <p className="font-body text-sm text-muted-foreground">Auto-synced from couple's selections</p>
        </div>
        {decorLines.length === 0 ? (
          <p className="px-5 py-6 font-body text-sm text-muted-foreground text-center">No décor selections yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {decorLines.map(l => (
              <div key={l.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="font-body text-sm text-foreground">{l.label}</p>
                  <p className="font-body text-xs text-muted-foreground">Qty {l.quantity} × ${Number(l.unit_price).toFixed(0)}</p>
                </div>
                <p className="font-body text-sm tabular-nums text-foreground">${Number(l.total).toFixed(2)}</p>
              </div>
            ))}
          </div>
        )}
        <div className="px-5 py-4 border-t border-border bg-muted/10 flex justify-between font-body text-sm font-medium text-foreground">
          <span>Décor Total</span><span className="tabular-nums">{fmt(decorTotal)}</span>
        </div>
      </div>

      <AdminStickyFooter status={status} onSave={() => {}} onSaveAndContinue={() => onNavigateNext?.()} />
    </div>
  );
}
