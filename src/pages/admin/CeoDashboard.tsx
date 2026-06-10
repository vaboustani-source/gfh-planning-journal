import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { differenceInDays, format, parseISO } from "date-fns";

/* ── Design tokens ── */
const COLORS = {
  bg: "#FAF8F4",
  primary: "#2C3E2D",
  accent: "#C9A84C",
  surface: "#FFFFFF",
  text: "#1A1A1A",
  muted: "#6B6B6B",
  border: "#E8E2D9",
};

type YearFilter = "all" | "this" | "next";

interface EventRow {
  id: string;
  title: string | null;
  partner1_name: string | null;
  partner2_name: string | null;
  wedding_date: string | null;
  lifecycle_stage: string | null;
}

interface LineItem { event_id: string; total: number | null; }
interface PaymentRow {
  id: string;
  event_id: string;
  amount: number | null;
  due_date: string | null;
  paid: boolean | null;
  label: string | null;
}

const STAGES: { key: string; label: string }[] = [
  { key: "sales_setup", label: "Sales setup" },
  { key: "handed_off", label: "Handed off" },
  { key: "in_setup", label: "In setup" },
  { key: "portal_open", label: "Portal open" },
  { key: "complete", label: "Complete" },
];

const BOOKED_STAGES = new Set(["handed_off", "in_setup", "portal_open", "complete"]);
const isBooked = (e: { lifecycle_stage: string | null }) => BOOKED_STAGES.has(e.lifecycle_stage || "");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const usd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

const coupleName = (e: EventRow) =>
  [e.partner1_name, e.partner2_name].filter(Boolean).join(" & ") || e.title || "Untitled event";

export default function CeoDashboard() {
  const navigate = useNavigate();
  const { profile, loading: authLoading } = useAuth();
  const [year, setYear] = useState<YearFilter>("this");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);

  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    if (!authLoading && !isAdmin) navigate("/admin");
  }, [authLoading, isAdmin, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(false);
      const [evRes, liRes, pmRes] = await Promise.all([
        supabase.from("events").select("id,title,partner1_name,partner2_name,wedding_date,lifecycle_stage"),
        supabase.from("financial_line_items").select("event_id,total"),
        supabase.from("payment_schedule").select("id,event_id,amount,due_date,paid,label"),
      ]);
      if (cancelled) return;
      if (evRes.error || liRes.error || pmRes.error) {
        setLoadError(true);
        setLoading(false);
        return;
      }
      setEvents((evRes.data || []) as EventRow[]);
      setLineItems((liRes.data || []) as LineItem[]);
      setPayments((pmRes.data || []) as PaymentRow[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [isAdmin]);

  /* ── Year scoping ──
     scopedEvents: events constrained to the selected year (used for the stage chart and
     for counting booked events with/without dates). All Years includes everything. */
  const now = new Date();
  const thisYear = now.getFullYear();
  const targetYear = year === "this" ? thisYear : year === "next" ? thisYear + 1 : null;

  const scopedEvents = useMemo(() => {
    if (targetYear === null) return events;
    // For year filters, include events whose wedding_date falls in the year, AND booked
    // events without a date so we can count them for the "dateless" notice.
    return events.filter((e) => {
      if (!e.wedding_date) return isBooked(e);
      return parseISO(e.wedding_date).getFullYear() === targetYear;
    });
  }, [events, targetYear]);

  /* Events that contribute to financial figures: booked AND in-year-with-date. */
  const financialEvents = useMemo(
    () => scopedEvents.filter((e) => isBooked(e) && !!e.wedding_date),
    [scopedEvents],
  );
  const financialEventIds = useMemo(
    () => new Set(financialEvents.map((e) => e.id)),
    [financialEvents],
  );
  const eventById = useMemo(() => {
    const m = new Map<string, EventRow>();
    events.forEach((e) => m.set(e.id, e));
    return m;
  }, [events]);

  const bookedLineItems = useMemo(
    () => lineItems.filter((l) => financialEventIds.has(l.event_id)),
    [lineItems, financialEventIds],
  );
  const bookedPayments = useMemo(
    () => payments.filter((p) => financialEventIds.has(p.event_id)),
    [payments, financialEventIds],
  );

  /* ── KPIs ── */
  const bookedRevenue = bookedLineItems.reduce((s, l) => s + Number(l.total || 0), 0);
  const collected = bookedPayments
    .filter((p) => p.paid)
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  const outstanding = bookedRevenue - collected;

  const weekendsBooked = financialEvents.length;

  /* ── Missing financials count (booked, in scope, no line items) ── */
  const lineItemsByEvent = useMemo(() => {
    const m = new Map<string, number>();
    bookedLineItems.forEach((l) => m.set(l.event_id, (m.get(l.event_id) || 0) + 1));
    return m;
  }, [bookedLineItems]);
  const missingFinancials = financialEvents.filter((e) => !lineItemsByEvent.has(e.id)).length;

  /* ── Dateless booked events (only meaningful under year filters) ── */
  const datelessBooked =
    targetYear === null
      ? 0
      : scopedEvents.filter((e) => isBooked(e) && !e.wedding_date).length;

  /* ── Charts ── */
  const monthlyRevenue = useMemo(() => {
    const buckets = MONTHS.map((m, i) => ({ month: m, idx: i, value: 0 }));
    bookedLineItems.forEach((l) => {
      const ev = eventById.get(l.event_id);
      if (!ev?.wedding_date) return;
      const m = parseISO(ev.wedding_date).getMonth();
      buckets[m].value += Number(l.total || 0);
    });
    return buckets;
  }, [bookedLineItems, eventById]);

  /* Stage chart: unchanged behavior, shows ALL stages including sales setup. */
  const stageBreakdown = useMemo(() => {
    return STAGES.map((s) => ({
      label: s.label,
      count: scopedEvents.filter((e) => (e.lifecycle_stage || "sales_setup") === s.key).length,
    }));
  }, [scopedEvents]);

  /* ── Cash flow & upcoming (booked events only) ── */
  const today = new Date();
  const unpaidUpcoming = useMemo(() => {
    return bookedPayments
      .filter((p) => !p.paid && p.due_date)
      .map((p) => ({ ...p, days: differenceInDays(parseISO(p.due_date as string), today) }))
      .sort((a, b) => (a.days as number) - (b.days as number));
  }, [bookedPayments]);

  const sumWithin = (days: number) =>
    unpaidUpcoming
      .filter((p) => (p.days as number) >= 0 && (p.days as number) <= days)
      .reduce((s, p) => s + Number(p.amount || 0), 0);

  const due30 = sumWithin(30);
  const due60 = sumWithin(60);
  const due90 = sumWithin(90);

  if (authLoading || !isAdmin) {
    return <div style={{ background: COLORS.bg }} className="min-h-screen" />;
  }

  return (
    <div style={{ background: COLORS.bg, color: COLORS.text }} className="min-h-screen font-body">
      {/* Header */}
      <header style={{ background: COLORS.primary }} className="text-white">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/admin")}
              className="text-white/70 hover:text-white transition-colors flex items-center gap-1.5 text-sm"
              aria-label="Back to admin"
            >
              <ArrowLeft size={16} /> Back
            </button>
            <h1
              className="text-3xl md:text-4xl font-light tracking-wide"
              style={{ fontFamily: "'Cormorant Garamond', serif" }}
            >
              CEO Dashboard
            </h1>
          </div>
          <YearFilter value={year} onChange={setYear} />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-8">
        {loadError ? (
          <div className="py-20 text-center space-y-3">
            <p style={{ color: COLORS.primary, fontFamily: "'Cormorant Garamond', serif", fontSize: "1.75rem", fontWeight: 300 }}>
              We could not load the dashboard data.
            </p>
            <p className="text-sm" style={{ color: COLORS.muted }}>
              Refresh to try again.
            </p>
          </div>
        ) : (
        <>
        {/* KPI row */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi label="Booked Revenue" value={loading ? null : usd(bookedRevenue)} />
          <Kpi label="Collected" value={loading ? null : usd(collected)} />
          <Kpi label="Outstanding" value={loading ? null : usd(outstanding)} />
          <Kpi
            label="Weekends Booked"
            value={loading ? null : `${weekendsBooked} of 27`}
            sub="Annual target"
          />
        </section>

        {!loading && datelessBooked > 0 && (
          <p className="text-sm" style={{ color: COLORS.muted }}>
            {datelessBooked} booked {datelessBooked === 1 ? "event has" : "events have"} no date set and {datelessBooked === 1 ? "is" : "are"} not shown for this year.
          </p>
        )}

        {!loading && missingFinancials > 0 && (
          <p className="text-sm" style={{ color: COLORS.muted }}>
            {missingFinancials} booked {missingFinancials === 1 ? "event has" : "events have"} no financials entered yet.
          </p>
        )}

        {/* Charts */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card title="Booked Revenue by Month">
            {loading ? (
              <ChartSkeleton />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthlyRevenue} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={COLORS.border} vertical={false} />
                  <XAxis dataKey="month" stroke={COLORS.muted} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis
                    stroke={COLORS.muted}
                    tick={{ fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => (v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`)}
                  />
                  <Tooltip
                    formatter={(v: number) => [usd(v), "Revenue"]}
                    contentStyle={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, fontFamily: "Jost, sans-serif" }}
                  />
                  <Bar dataKey="value" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card title="Events by Lifecycle Stage">
            {loading ? (
              <ChartSkeleton />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart layout="vertical" data={stageBreakdown} margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
                  <CartesianGrid stroke={COLORS.border} horizontal={false} />
                  <XAxis type="number" stroke={COLORS.muted} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="label" stroke={COLORS.muted} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} width={100} />
                  <Tooltip
                    contentStyle={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, fontFamily: "Jost, sans-serif" }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {stageBreakdown.map((_, i) => (
                      <Cell key={i} fill={i % 2 === 0 ? COLORS.primary : COLORS.accent} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </section>

        {/* Cash flow */}
        <Card title="Cash Flow">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            <CashCell label="Due in 30 days" value={loading ? null : usd(due30)} />
            <CashCell label="Due in 60 days" value={loading ? null : usd(due60)} />
            <CashCell label="Due in 90 days" value={loading ? null : usd(due90)} />
          </div>
        </Card>

        {/* Upcoming table */}
        <Card title="Upcoming Payments">
          {loading ? (
            <div className="h-32 animate-pulse rounded" style={{ background: COLORS.bg }} />
          ) : unpaidUpcoming.length === 0 ? (
            <p className="py-10 text-center" style={{ color: COLORS.muted, fontFamily: "'Cormorant Garamond', serif", fontSize: "1.25rem" }}>
              Nothing due. The books are current.
            </p>
          ) : (
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr style={{ color: COLORS.muted, borderBottom: `1px solid ${COLORS.border}` }}>
                    <th className="text-left font-medium py-3 pr-4">Event / Couple</th>
                    <th className="text-right font-medium py-3 px-4">Amount</th>
                    <th className="text-left font-medium py-3 px-4">Due Date</th>
                    <th className="text-right font-medium py-3 pl-4">Days Until Due</th>
                  </tr>
                </thead>
                <tbody>
                  {unpaidUpcoming.map((p) => {
                    const ev = eventById.get(p.event_id);
                    return (
                      <tr
                        key={p.id}
                        onClick={() => navigate(`/admin/events/${p.event_id}?tab=financials`)}
                        className="cursor-pointer transition-colors"
                        style={{ borderBottom: `1px solid ${COLORS.border}` }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.bg)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <td className="py-3 pr-4">
                          <div className="font-medium">{ev ? coupleName(ev) : "Not set"}</div>
                          {p.label && <div className="text-xs" style={{ color: COLORS.muted }}>{p.label}</div>}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums">{usd(Number(p.amount || 0))}</td>
                        <td className="py-3 px-4">{p.due_date ? format(parseISO(p.due_date), "MMM d, yyyy") : "Not set"}</td>
                        <td className="py-3 pl-4 text-right tabular-nums" style={{ color: (p.days as number) < 0 ? COLORS.accent : COLORS.text }}>
                          {(p.days as number) < 0 ? `${Math.abs(p.days as number)} overdue` : p.days}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        </>
        )}
      </main>
    </div>
  );
}

/* ── Subcomponents ── */
function YearFilter({ value, onChange }: { value: YearFilter; onChange: (v: YearFilter) => void }) {
  const opts: { v: YearFilter; label: string }[] = [
    { v: "this", label: "This Year" },
    { v: "next", label: "Next Year" },
    { v: "all", label: "All Years" },
  ];
  return (
    <div className="inline-flex rounded-md overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.25)" }}>
      {opts.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className="px-3 py-1.5 text-xs md:text-sm transition-colors"
          style={{
            background: value === o.v ? COLORS.accent : "transparent",
            color: value === o.v ? COLORS.primary : "rgba(255,255,255,0.85)",
            fontWeight: value === o.v ? 500 : 400,
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string | null; sub?: string }) {
  return (
    <div
      style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
      className="rounded-lg p-5"
    >
      <div className="text-xs uppercase tracking-wider" style={{ color: COLORS.muted, letterSpacing: "0.08em" }}>
        {label}
      </div>
      {value === null ? (
        <div className="mt-3 h-9 w-32 animate-pulse rounded" style={{ background: COLORS.bg }} />
      ) : (
        <div
          className="mt-2 font-light"
          style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "2rem", color: COLORS.primary }}
        >
          {value}
        </div>
      )}
      {sub && <div className="text-xs mt-1" style={{ color: COLORS.muted }}>{sub}</div>}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }} className="rounded-lg p-6">
      <h2
        className="mb-4 font-light"
        style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.5rem", color: COLORS.primary }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

function CashCell({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider" style={{ color: COLORS.muted, letterSpacing: "0.08em" }}>{label}</div>
      {value === null ? (
        <div className="mt-2 h-8 w-28 animate-pulse rounded" style={{ background: COLORS.bg }} />
      ) : (
        <div className="mt-1 font-light" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.75rem", color: COLORS.primary }}>
          {value}
        </div>
      )}
    </div>
  );
}

function ChartSkeleton() {
  return <div className="h-[280px] w-full animate-pulse rounded" style={{ background: COLORS.bg }} />;
}
