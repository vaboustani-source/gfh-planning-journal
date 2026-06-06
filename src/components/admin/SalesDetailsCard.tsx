import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermission } from "@/hooks/usePermission";
import { TrendingUp, Lock } from "lucide-react";


interface SalesFields {
  stated_budget: string;
  original_quote: string;
  original_catering_estimate: string;
  original_guest_estimate: string;
  lead_source: string;
  date_booked: string;
}

const EMPTY: SalesFields = {
  stated_budget: "", original_quote: "", original_catering_estimate: "",
  original_guest_estimate: "", lead_source: "", date_booked: "",
};

export default function SalesDetailsCard({ eventId }: { eventId: string }) {
  const { profile } = useAuth();
  const access = usePermission("sales_roster");
  const allowed = access !== "none";
  const canEditCard = access === "full";
  const [fields, setFields] = useState<SalesFields>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!allowed) return;
    (async () => {
      const { data } = await (supabase as any).from("sales_details").select("*").eq("event_id", eventId).maybeSingle();
      if (data) {
        setFields({
          stated_budget: data.stated_budget?.toString() ?? "",
          original_quote: data.original_quote?.toString() ?? "",
          original_catering_estimate: data.original_catering_estimate?.toString() ?? "",
          original_guest_estimate: data.original_guest_estimate?.toString() ?? "",
          lead_source: data.lead_source ?? "",
          date_booked: data.date_booked ?? "",
        });
      }
      setLoaded(true);
    })();
  }, [eventId, allowed]);

  function update<K extends keyof SalesFields>(k: K, v: string) {
    setFields(f => ({ ...f, [k]: v }));
    setSaved(false);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => save({ ...fields, [k]: v }), 800);
  }

  async function save(f: SalesFields) {
    const payload: any = {
      event_id: eventId,
      stated_budget: f.stated_budget === "" ? null : Number(f.stated_budget),
      original_quote: f.original_quote === "" ? null : Number(f.original_quote),
      original_catering_estimate: f.original_catering_estimate === "" ? null : Number(f.original_catering_estimate),
      original_guest_estimate: f.original_guest_estimate === "" ? null : Number(f.original_guest_estimate),
      lead_source: f.lead_source || null,
      date_booked: f.date_booked || null,
    };
    const { error } = await (supabase as any).from("sales_details").upsert(payload, { onConflict: "event_id" });
    if (!error) setSaved(true);
  }

  if (!allowed) return null;

  return (
    <div className="rounded-2xl bg-white border border-sage/25 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-sage/15 flex items-center justify-center">
            <TrendingUp size={16} className="text-sage" />
          </div>
          <div>
            <p className="font-display text-lg font-light text-foreground">Sales Details</p>
            <p className="font-body text-[11px] text-muted-foreground flex items-center gap-1">
              <Lock size={10} /> Visible only to sales, event directors, and CEO/owner
            </p>
          </div>
        </div>
        {loaded && saved && <span className="font-body text-xs text-sage">Saved</span>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Money label="Initial stated budget" value={fields.stated_budget} onChange={v => update("stated_budget", v)} />
        <Money label="Original quote" value={fields.original_quote} onChange={v => update("original_quote", v)} />
        <Money label="Original catering estimate" value={fields.original_catering_estimate} onChange={v => update("original_catering_estimate", v)} />
        <Field label="Original guest count estimate" value={fields.original_guest_estimate} onChange={v => update("original_guest_estimate", v)} type="number" />
        <Field label="Lead source" value={fields.lead_source} onChange={v => update("lead_source", v)} placeholder="e.g. The Knot, Referral, Instagram" />
        <Field label="Date booked" value={fields.date_booked} onChange={v => update("date_booked", v)} type="date" />
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <p className="font-body text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">{label}</p>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full border border-border rounded-lg px-3 py-2 font-body text-sm bg-background focus:outline-none focus:border-sage/50" />
    </div>
  );
}

function Money({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="font-body text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">{label}</p>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
        <input type="number" inputMode="decimal" value={value} onChange={e => onChange(e.target.value)}
          className="w-full border border-border rounded-lg pl-7 pr-3 py-2 font-body text-sm bg-background focus:outline-none focus:border-sage/50" />
      </div>
    </div>
  );
}
