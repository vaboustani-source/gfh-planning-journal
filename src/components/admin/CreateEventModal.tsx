import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermission";
import { X, Loader2, UserPlus, CalendarDays, TrendingUp } from "lucide-react";
import { addDays, subDays, format, parseISO } from "date-fns";


interface Props {
  onClose: () => void;
}

const PACKAGE_TIERS = [
  { value: "base", label: "Base" },
  { value: "elevated", label: "Elevated" },
  { value: "full", label: "Full" },
];

interface FieldProps {
  label: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
}

function Field({ label, type = "text", placeholder, value, onChange }: FieldProps) {
  return (
    <div>
      <p className="font-body text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">{label}</p>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-border rounded-lg px-3 py-2.5 font-body text-sm bg-background text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
      />
    </div>
  );
}

export default function CreateEventModal({ onClose }: Props) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { canView: canSection } = usePermissions();
  const canSeeSales = canSection("sales_roster");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    partner1_first_name: "",
    partner1_last_name: "",
    partner1_email: "",
    partner2_first_name: "",
    partner2_last_name: "",
    partner2_email: "",
    wedding_date: "",
    package_tier: "base",
  });

  const [earlyArrival, setEarlyArrival] = useState(false);
  const [lateDeparture, setLateDeparture] = useState(false);

  const [sales, setSales] = useState({
    stated_budget: "", original_quote: "", original_catering_estimate: "",
    original_guest_estimate: "", lead_source: "", date_booked: "",
  });
  const setSalesField = (k: keyof typeof sales, v: string) => setSales(s => ({ ...s, [k]: v }));

  const set = (field: keyof typeof form, value: string) =>
    setForm(f => ({ ...f, [field]: value }));

  const computedDates = useMemo(() => {
    if (!form.wedding_date) return null;
    const wedding = parseISO(form.wedding_date);
    const arrival = subDays(wedding, earlyArrival ? 2 : 1);
    const departure = addDays(wedding, lateDeparture ? 2 : 1);
    return {
      arrival_date: format(arrival, "yyyy-MM-dd"),
      departure_date: format(departure, "yyyy-MM-dd"),
      arrivalDisplay: format(arrival, "EEEE, MMM d"),
      weddingDisplay: format(wedding, "EEEE, MMM d"),
      departureDisplay: format(departure, "EEEE, MMM d"),
    };
  }, [form.wedding_date, earlyArrival, lateDeparture]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.partner1_email || !form.partner2_email) {
      setError("Both partner emails are required.");
      return;
    }
    if (form.partner1_email === form.partner2_email) {
      setError("Partners must have different email addresses.");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("create-event-and-invite-couple", {
        body: {
          ...form,
          arrival_date: computedDates?.arrival_date || "",
          departure_date: computedDates?.departure_date || "",
        },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      if (canSeeSales && data?.event_id) {
        const hasAny = Object.values(sales).some(v => v !== "");
        if (hasAny) {
          await (supabase as any).from("sales_details").upsert({
            event_id: data.event_id,
            stated_budget: sales.stated_budget === "" ? null : Number(sales.stated_budget),
            original_quote: sales.original_quote === "" ? null : Number(sales.original_quote),
            original_catering_estimate: sales.original_catering_estimate === "" ? null : Number(sales.original_catering_estimate),
            original_guest_estimate: sales.original_guest_estimate === "" ? null : Number(sales.original_guest_estimate),
            lead_source: sales.lead_source || null,
            date_booked: sales.date_booked || null,
          }, { onConflict: "event_id" });
        }
      }

      navigate(`/admin/events/${data.event_id}`);
    } catch (err: any) {
      setError(err.message ?? "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-sage/15 border border-sage/25 flex items-center justify-center shrink-0">
              <UserPlus size={14} className="text-sage" />
            </div>
            <div>
              <p className="font-display text-xl font-light text-foreground">New Wedding Event</p>
              <p className="font-body text-xs text-muted-foreground">Partners will receive a login link by email</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-6 max-h-[70vh] overflow-y-auto">
            {/* Partner 1 */}
            <div>
              <p className="font-display text-base font-light text-foreground mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-sage/15 border border-sage/25 text-sage font-body text-[10px] flex items-center justify-center">1</span>
                Partner One
              </p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <Field label="First Name" value={form.partner1_first_name} onChange={v => set("partner1_first_name", v)} placeholder="Jane" />
                <Field label="Last Name" value={form.partner1_last_name} onChange={v => set("partner1_last_name", v)} placeholder="Smith" />
              </div>
              <Field label="Email Address *" value={form.partner1_email} onChange={v => set("partner1_email", v)} type="email" placeholder="jane@example.com" />
            </div>

            <div className="h-px bg-border" />

            {/* Partner 2 */}
            <div>
              <p className="font-display text-base font-light text-foreground mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-sage/15 border border-sage/25 text-sage font-body text-[10px] flex items-center justify-center">2</span>
                Partner Two
              </p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <Field label="First Name" value={form.partner2_first_name} onChange={v => set("partner2_first_name", v)} placeholder="Alex" />
                <Field label="Last Name" value={form.partner2_last_name} onChange={v => set("partner2_last_name", v)} placeholder="Johnson" />
              </div>
              <Field label="Email Address *" value={form.partner2_email} onChange={v => set("partner2_email", v)} type="email" placeholder="alex@example.com" />
            </div>

            <div className="h-px bg-border" />

            {/* Event dates */}
            <div>
              <p className="font-display text-base font-light text-foreground mb-3 flex items-center gap-2">
                <CalendarDays size={16} className="text-sage" />
                Event Dates
              </p>
              <Field label="Wedding Date *" value={form.wedding_date} onChange={v => set("wedding_date", v)} type="date" />

              {form.wedding_date && (
                <div className="mt-4 space-y-3">
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setEarlyArrival(p => !p)}
                      className={`flex-1 py-2.5 rounded-lg border font-body text-sm transition-colors ${
                        earlyArrival
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:text-foreground bg-background"
                      }`}
                    >
                      Thursday arrival?
                    </button>
                    <button
                      type="button"
                      onClick={() => setLateDeparture(p => !p)}
                      className={`flex-1 py-2.5 rounded-lg border font-body text-sm transition-colors ${
                        lateDeparture
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:text-foreground bg-background"
                      }`}
                    >
                      Monday departure?
                    </button>
                  </div>

                  {computedDates && (
                    <p className="font-body text-xs text-muted-foreground bg-sage/8 border border-sage/15 rounded-lg px-3 py-2.5 text-center">
                      Arrive {computedDates.arrivalDisplay} · Wedding {computedDates.weddingDisplay} · Depart {computedDates.departureDisplay}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Package */}
            <div>
              <p className="font-body text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">Package Tier</p>
              <div className="flex gap-2">
                {PACKAGE_TIERS.map(t => (
                  <button
                    type="button"
                    key={t.value}
                    onClick={() => set("package_tier", t.value)}
                    className={`flex-1 py-2.5 rounded-lg border font-body text-sm transition-colors ${
                      form.package_tier === t.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:text-foreground bg-background"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {canSeeSales && (
              <>
                <div className="h-px bg-border" />
                <div>
                  <p className="font-display text-base font-light text-foreground mb-1 flex items-center gap-2">
                    <TrendingUp size={16} className="text-sage" />
                    Sales Details
                  </p>
                  <p className="font-body text-xs text-muted-foreground mb-3">Pricing intelligence — visible only to sales, event directors, and CEO/owner.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Stated Budget ($)" type="number" value={sales.stated_budget} onChange={v => setSalesField("stated_budget", v)} placeholder="80000" />
                    <Field label="Original Quote ($)" type="number" value={sales.original_quote} onChange={v => setSalesField("original_quote", v)} placeholder="92000" />
                    <Field label="Original Catering Est. ($)" type="number" value={sales.original_catering_estimate} onChange={v => setSalesField("original_catering_estimate", v)} placeholder="35000" />
                    <Field label="Original Guest Estimate" type="number" value={sales.original_guest_estimate} onChange={v => setSalesField("original_guest_estimate", v)} placeholder="120" />
                    <Field label="Lead Source" value={sales.lead_source} onChange={v => setSalesField("lead_source", v)} placeholder="The Knot, Referral…" />
                    <Field label="Date Booked" type="date" value={sales.date_booked} onChange={v => setSalesField("date_booked", v)} />
                  </div>
                </div>
              </>
            )}


            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3">
                <p className="font-body text-sm text-destructive">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-6 py-4 border-t border-border bg-muted/10">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-border font-body text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground font-body text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {submitting ? (
                <><Loader2 size={15} className="animate-spin" /> Creating…</>
              ) : (
                "Create Event & Invite Couple"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
