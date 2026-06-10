import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermission } from "@/hooks/usePermission";
import { format, parseISO, isValid } from "date-fns";
import { ArrowLeft, ArrowUpDown, DollarSign, TrendingUp, Users, Calendar } from "lucide-react";
import { MidweekBadge } from "@/components/admin/MidweekBadge";


type SortKey = "date" | "budget_delta" | "catering_delta" | "stated_budget" | "final_total";

interface Row {
  event_id: string;
  title: string;
  couple_names: string;
  wedding_date: string | null;
  stated_budget: number | null;
  original_quote: number | null;
  original_catering: number | null;
  original_guests: number | null;
  lead_source: string | null;
  date_booked: string | null;
  final_guests: number;
  final_catering: number;
  final_total: number;
  catering_delta: number | null;
  budget_delta: number | null;
  budget_delta_pct: number | null;
}

const FB_REGEX = /(food|beverage|catering|bar|wine|beer|cocktail|liquor|menu)/i;

const fmt = (n: number | null | undefined) =>
  n == null || isNaN(Number(n)) ? "—" : `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const fmtSigned = (n: number | null) =>
  n == null ? "—" : `${n >= 0 ? "+" : "−"}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const pctSigned = (n: number | null) =>
  n == null ? "" : ` / ${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(0)}%`;

function deltaTone(n: number | null) {
  if (n == null) return "text-muted-foreground";
  if (n > 0) return "text-emerald-700 font-semibold";
  if (n < 0) return "text-muted-foreground";
  return "text-foreground";
}

export default function SalesRoster() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [yearFilter, setYearFilter] = useState<string>("all");

  const access = usePermission("sales_roster");
  const allowed = access !== "none";

  useEffect(() => {
    if (!allowed) { setLoading(false); return; }
    load();
  }, [allowed]);

  async function load() {
    setLoading(true);
    const [evRes, salesRes, finRes, lineRes, guestRes] = await Promise.all([
      supabase.from("events").select("id, title, partner1_name, partner2_name, wedding_date").order("wedding_date", { ascending: false }),
      (supabase as any).from("sales_details").select("*"),
      supabase.from("financials").select("event_id, site_fee_total, catering_estimate, site_fee_paid, catering_paid"),
      supabase.from("financial_line_items").select("event_id, section, label, total, quantity, unit_price"),
      supabase.from("guests").select("event_id, rsvp_status, party_size"),
    ]);

    const events = evRes.data || [];
    const salesMap = new Map<string, any>();
    (salesRes.data || []).forEach((s: any) => salesMap.set(s.event_id, s));

    const finMap = new Map<string, any>();
    (finRes.data || []).forEach((f: any) => finMap.set(f.event_id, f));

    const cateringByEvent = new Map<string, number>();
    const totalByEvent = new Map<string, number>();
    (lineRes.data || []).forEach((li: any) => {
      const total = Number(li.total ?? (li.quantity || 0) * (li.unit_price || 0)) || 0;
      totalByEvent.set(li.event_id, (totalByEvent.get(li.event_id) || 0) + total);
      const section = String(li.section || "");
      const label = String(li.label || "");
      if (FB_REGEX.test(section) || FB_REGEX.test(label)) {
        cateringByEvent.set(li.event_id, (cateringByEvent.get(li.event_id) || 0) + total);
      }
    });

    const guestsByEvent = new Map<string, number>();
    (guestRes.data || []).forEach((g: any) => {
      const status = String(g.rsvp_status || "").toLowerCase();
      if (status === "confirmed" || status === "yes" || status === "attending") {
        guestsByEvent.set(g.event_id, (guestsByEvent.get(g.event_id) || 0) + (g.party_size || 1));
      }
    });

    const built: Row[] = events.map((e: any) => {
      const s = salesMap.get(e.id) || {};
      const fin = finMap.get(e.id) || {};
      const lineCatering = cateringByEvent.get(e.id) || 0;
      const lineTotal = totalByEvent.get(e.id) || 0;
      const finCatering = Number(fin.catering_estimate || 0);
      const finSite = Number(fin.site_fee_total || 0);
      const finalCatering = lineCatering > 0 ? lineCatering : finCatering;
      const finalTotal = lineTotal > 0 ? lineTotal : finSite + finCatering;
      const stated = s.stated_budget != null ? Number(s.stated_budget) : null;
      const origCatering = s.original_catering_estimate != null ? Number(s.original_catering_estimate) : null;
      const cateringDelta = origCatering != null && finalCatering > 0 ? finalCatering - origCatering : null;
      const budgetDelta = stated != null && finalTotal > 0 ? finalTotal - stated : null;
      const budgetDeltaPct = budgetDelta != null && stated && stated > 0 ? (budgetDelta / stated) * 100 : null;
      const coupleNames = [e.partner1_name, e.partner2_name].filter(Boolean).join(" & ") || e.title || "Untitled";
      return {
        event_id: e.id,
        title: e.title || "Untitled",
        couple_names: coupleNames,
        wedding_date: e.wedding_date,
        stated_budget: stated,
        original_quote: s.original_quote != null ? Number(s.original_quote) : null,
        original_catering: origCatering,
        original_guests: s.original_guest_estimate ?? null,
        lead_source: s.lead_source ?? null,
        date_booked: s.date_booked ?? null,
        final_guests: guestsByEvent.get(e.id) || 0,
        final_catering: finalCatering,
        final_total: finalTotal,
        catering_delta: cateringDelta,
        budget_delta: budgetDelta,
        budget_delta_pct: budgetDeltaPct,
      };
    });
    setRows(built);
    setLoading(false);
  }

  const years = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => { if (r.wedding_date) set.add(r.wedding_date.slice(0, 4)); });
    return Array.from(set).sort().reverse();
  }, [rows]);

  const filtered = useMemo(() => {
    let r = rows;
    if (yearFilter !== "all") r = r.filter(x => x.wedding_date?.startsWith(yearFilter));
    const dir = sortDir === "asc" ? 1 : -1;
    return [...r].sort((a, b) => {
      const av = a[sortKey === "date" ? "wedding_date" : sortKey] as any;
      const bv = b[sortKey === "date" ? "wedding_date" : sortKey] as any;
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [rows, sortKey, sortDir, yearFilter]);

  const stats = useMemo(() => {
    const withBudget = filtered.filter(r => r.budget_delta_pct != null);
    const withCatering = filtered.filter(r => r.catering_delta != null && r.original_catering && r.original_catering > 0);
    const avgBudgetPct = withBudget.length
      ? withBudget.reduce((s, r) => s + (r.budget_delta_pct || 0), 0) / withBudget.length : null;
    const avgBudgetDelta = withBudget.length
      ? withBudget.reduce((s, r) => s + (r.budget_delta || 0), 0) / withBudget.length : null;
    const avgCateringPct = withCatering.length
      ? withCatering.reduce((s, r) => s + ((r.catering_delta! / r.original_catering!) * 100), 0) / withCatering.length : null;
    const avgCateringDelta = withCatering.length
      ? withCatering.reduce((s, r) => s + (r.catering_delta || 0), 0) / withCatering.length : null;
    return { avgBudgetPct, avgBudgetDelta, avgCateringPct, avgCateringDelta, count: filtered.length };
  }, [filtered]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  }

  if (!allowed) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <p className="font-display text-2xl text-foreground mb-2">Restricted</p>
          <p className="font-body text-sm text-muted-foreground">
            The Sales Roster is only available to sales managers, event directors, and the CEO/owner.
          </p>
          <button onClick={() => navigate("/admin")} className="mt-6 text-sage hover:underline font-body text-sm">
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-border bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/admin")} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="font-display text-2xl font-light text-foreground">Sales Roster</h1>
              <p className="font-body text-xs text-muted-foreground">Cross-wedding budget intelligence</p>
            </div>
          </div>
          <select
            value={yearFilter}
            onChange={e => setYearFilter(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 font-body text-sm bg-white"
          >
            <option value="all">All years</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Insight banner */}
        <div className="rounded-2xl bg-gradient-to-br from-sage/15 to-cream border border-sage/25 p-6">
          <p className="font-body text-[11px] uppercase tracking-wider text-sage mb-2">Key insight</p>
          <p className="font-display text-2xl font-light text-foreground leading-snug">
            {stats.avgBudgetPct != null ? (
              <>
                On average, couples spend <span className="font-semibold text-sage">{stats.avgBudgetPct >= 0 ? "+" : ""}{stats.avgBudgetPct.toFixed(0)}%</span> {stats.avgBudgetPct >= 0 ? "above" : "below"} their initial stated budget.
                {stats.avgCateringPct != null && (
                  <> Catering invoices run <span className="font-semibold text-sage">{stats.avgCateringPct >= 0 ? "+" : ""}{stats.avgCateringPct.toFixed(0)}%</span> {stats.avgCateringPct >= 0 ? "above" : "below"} original estimates.</>
                )}
              </>
            ) : (
              <>Enter sales details and finalize financials to surface predictive trends.</>
            )}
          </p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<Users size={16} />} label="Weddings" value={String(stats.count)} />
          <StatCard icon={<DollarSign size={16} />} label="Avg budget delta" value={stats.avgBudgetDelta != null ? fmtSigned(stats.avgBudgetDelta) : "—"} sub={stats.avgBudgetPct != null ? `${stats.avgBudgetPct >= 0 ? "+" : ""}${stats.avgBudgetPct.toFixed(0)}% over stated` : undefined} />
          <StatCard icon={<TrendingUp size={16} />} label="Avg catering upsell" value={stats.avgCateringDelta != null ? fmtSigned(stats.avgCateringDelta) : "—"} sub={stats.avgCateringPct != null ? `${stats.avgCateringPct >= 0 ? "+" : ""}${stats.avgCateringPct.toFixed(0)}% over estimate` : undefined} />
          <StatCard icon={<Calendar size={16} />} label="Year filter" value={yearFilter === "all" ? "All" : yearFilter} />
        </div>

        {/* Table */}
        <div className="bg-white border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-sage/8 border-b border-border">
                <tr className="text-left font-body text-[11px] uppercase tracking-wider text-muted-foreground">
                  <Th onClick={() => toggleSort("date")} active={sortKey === "date"}>Couple · Date</Th>
                  <Th onClick={() => toggleSort("stated_budget")} active={sortKey === "stated_budget"}>Stated budget</Th>
                  <Th>Original quote</Th>
                  <Th>Guests (est → final)</Th>
                  <Th>Orig. catering</Th>
                  <Th>Final catering</Th>
                  <Th onClick={() => toggleSort("catering_delta")} active={sortKey === "catering_delta"}>Catering Δ</Th>
                  <Th onClick={() => toggleSort("final_total")} active={sortKey === "final_total"}>Final total</Th>
                  <Th onClick={() => toggleSort("budget_delta")} active={sortKey === "budget_delta"}>Budget Δ</Th>
                  <Th>Lead source</Th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={10} className="p-8 text-center text-muted-foreground font-body text-sm">Loading…</td></tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={10} className="p-8 text-center text-muted-foreground font-body text-sm">No weddings match the filter.</td></tr>
                )}
                {!loading && filtered.map(r => {
                  const guestDiff = r.original_guests != null ? r.final_guests - r.original_guests : null;
                  return (
                    <tr
                      key={r.event_id}
                      onClick={() => navigate(`/admin/events/${r.event_id}`)}
                      className="border-b border-border hover:bg-sage/5 cursor-pointer transition-colors"
                    >
                      <td className="p-3 align-top">
                        <p className="font-display text-base text-foreground">{r.couple_names}</p>
                        <p className="font-body text-xs text-muted-foreground">
                          {r.wedding_date && isValid(parseISO(r.wedding_date)) ? format(parseISO(r.wedding_date), "MMM d, yyyy") : "Date TBD"}
                        </p>
                      </td>
                      <td className="p-3 font-body text-foreground">{fmt(r.stated_budget)}</td>
                      <td className="p-3 font-body text-muted-foreground">{fmt(r.original_quote)}</td>
                      <td className="p-3 font-body text-foreground">
                        <span className="text-muted-foreground">{r.original_guests ?? "—"}</span>
                        <span className="mx-1 text-muted-foreground/50">→</span>
                        <span className="font-medium">{r.final_guests}</span>
                        {guestDiff != null && guestDiff !== 0 && (
                          <span className={`ml-2 text-xs ${guestDiff > 0 ? "text-emerald-700" : "text-muted-foreground"}`}>
                            ({guestDiff > 0 ? "+" : ""}{guestDiff})
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-body text-muted-foreground">{fmt(r.original_catering)}</td>
                      <td className="p-3 font-body text-foreground">{r.final_catering > 0 ? fmt(r.final_catering) : "—"}</td>
                      <td className={`p-3 font-body ${deltaTone(r.catering_delta)}`}>
                        {r.catering_delta != null ? (
                          <>
                            {fmtSigned(r.catering_delta)}
                            {r.original_catering ? (
                              <span className="text-xs ml-1 opacity-75">
                                ({r.catering_delta >= 0 ? "+" : "−"}{Math.abs((r.catering_delta / r.original_catering) * 100).toFixed(0)}%)
                              </span>
                            ) : null}
                          </>
                        ) : "—"}
                      </td>
                      <td className="p-3 font-body text-foreground">{r.final_total > 0 ? fmt(r.final_total) : "—"}</td>
                      <td className={`p-3 font-body ${deltaTone(r.budget_delta)}`}>
                        {r.budget_delta != null ? (
                          <>
                            {fmtSigned(r.budget_delta)}
                            <span className="text-xs ml-1 opacity-75">{pctSigned(r.budget_delta_pct)}</span>
                          </>
                        ) : "—"}
                      </td>
                      <td className="p-3 font-body text-xs text-muted-foreground">{r.lead_source || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Th({ children, onClick, active }: { children: React.ReactNode; onClick?: () => void; active?: boolean }) {
  return (
    <th
      onClick={onClick}
      className={`p-3 ${onClick ? "cursor-pointer select-none hover:text-foreground" : ""} ${active ? "text-sage" : ""}`}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {onClick && <ArrowUpDown size={10} className="opacity-50" />}
      </span>
    </th>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        {icon}
        <p className="font-body text-[10px] uppercase tracking-wider">{label}</p>
      </div>
      <p className="font-display text-xl font-light text-foreground">{value}</p>
      {sub && <p className="font-body text-[11px] text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}
