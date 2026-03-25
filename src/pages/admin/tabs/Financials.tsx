import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Check, Trash2 } from "lucide-react";

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

const TRACKS = ["site_fee", "catering"] as const;
const TRACK_LABELS: Record<string, string> = { site_fee: "Site Fee", catering: "Catering" };

function fmt(n: number | null) {
  if (n == null) return "—";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function TrackPanel({
  track, lines, eventId, onAdd, onUpdate, onDelete,
}: {
  track: string;
  lines: PaymentLine[];
  eventId: string;
  onAdd: (track: string) => Promise<void>;
  onUpdate: (id: string, fields: Partial<PaymentLine>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const total = lines.reduce((s, l) => s + (l.amount ?? 0), 0);
  const paid = lines.filter(l => l.paid).reduce((s, l) => s + (l.amount ?? 0), 0);
  const remaining = total - paid;

  return (
    <div className="rounded-xl bg-card border border-border overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/20">
        <p className="font-display text-lg font-light text-foreground">{TRACK_LABELS[track]}</p>
        <button
          onClick={() => onAdd(track)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-body text-xs hover:opacity-90 transition-opacity"
        >
          <Plus size={12} />
          Add
        </button>
      </div>

      {/* Lines */}
      <div className="divide-y divide-border">
        {lines.length === 0 ? (
          <p className="px-5 py-6 font-body text-sm text-muted-foreground text-center">No payment items yet.</p>
        ) : lines.map(line => (
          <div key={line.id} className="px-5 py-3 grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 items-center">
            {/* Label */}
            <input
              value={line.label}
              onChange={e => onUpdate(line.id, { label: e.target.value })}
              className="border border-border rounded-md px-2.5 py-1.5 font-body text-sm bg-background focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 w-full"
            />
            {/* Due date */}
            <input
              type="date"
              value={line.due_date || ""}
              onChange={e => onUpdate(line.id, { due_date: e.target.value || null })}
              className="border border-border rounded-md px-2.5 py-1.5 font-body text-xs bg-background focus:outline-none focus:border-primary/50 w-32"
            />
            {/* Amount */}
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-body text-xs text-muted-foreground">$</span>
              <input
                type="number"
                value={line.amount ?? ""}
                onChange={e => onUpdate(line.id, { amount: parseFloat(e.target.value) || null })}
                placeholder="0.00"
                className="border border-border rounded-md pl-5 pr-2.5 py-1.5 font-body text-sm bg-background focus:outline-none focus:border-primary/50 w-28"
              />
            </div>
            {/* Paid toggle */}
            <button
              onClick={() => onUpdate(line.id, {
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
            {/* Delete */}
            <button onClick={() => onDelete(line.id)} className="text-muted-foreground hover:text-destructive transition-colors">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Totals */}
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

export default function FinancialsTab({ eventId }: { eventId: string }) {
  const [lines, setLines] = useState<PaymentLine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchLines(); }, [eventId]);

  const fetchLines = async () => {
    const { data } = await supabase
      .from("payment_schedule")
      .select("*")
      .eq("event_id", eventId)
      .order("due_date", { ascending: true });
    if (data) setLines(data);
    setLoading(false);
  };

  const addLine = async (track: string) => {
    const { data } = await supabase.from("payment_schedule").insert({
      event_id: eventId,
      track,
      label: "New payment",
      paid: false,
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

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {TRACKS.map(track => (
          <TrackPanel
            key={track}
            track={track}
            lines={lines.filter(l => l.track === track)}
            eventId={eventId}
            onAdd={addLine}
            onUpdate={updateLine}
            onDelete={deleteLine}
          />
        ))}
      </div>
    </div>
  );
}
