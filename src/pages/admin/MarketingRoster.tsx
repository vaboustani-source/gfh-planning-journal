import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, parseISO, isValid, differenceInDays } from "date-fns";
import {
  ArrowLeft, Camera, Video, Flower2, ClipboardList, Sparkles, Users,
  DollarSign, Calendar, ArrowUpDown, LayoutGrid, Table as TableIcon,
  ChevronDown, ChevronRight, Instagram, Search,
} from "lucide-react";

// Marketing Roster access comes from the central permission matrix.
// TODO (future): "design shortlist" per wedding (aesthetic / palette / vision) — placement TBD.
// TODO (future): auto-flag "⭐ Marketing Opportunity" badge when floral budget > threshold,
// notable photographer is booked, or 3+ activations are booked.
import { usePermission } from "@/hooks/usePermission";

type SortKey = "date" | "guests" | "floral" | "total" | "activations";
type ViewMode = "table" | "cards";

interface VendorMini {
  business_name: string | null;
  contact_name: string | null;
  instagram: string | null;
  email: string | null;
  phone: string | null;
  category: string;
}

interface Activation {
  id: string;
  title: string;
  category: string | null;
  final_price: number | null;
}

interface RosterRow {
  event_id: string;
  title: string;
  couple_names: string;
  wedding_date: string | null;
  days_away: number | null;
  package_tier: string | null;
  guest_count: number;
  photographer: VendorMini | null;
  videographer: VendorMini | null;
  florist: VendorMini | null;
  planner: VendorMini | null;
  floral_budget: number | null;
  floral_itemized: boolean;
  activations: Activation[];
  has_content_creator: boolean;
  total_value: number;
}

const FLORAL_REGEX = /flor(al|ist)|flower|bloom|bouquet|centerpiece/i;

const fmtMoney = (n: number | null | undefined) =>
  n == null ? "—" : `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const daysLabel = (d: number | null) => {
  if (d == null) return "—";
  if (d < 0) return `${Math.abs(d)}d ago`;
  if (d === 0) return "Today";
  if (d < 60) return `${d}d`;
  if (d < 365) return `${Math.round(d / 7)}w`;
  return `${Math.round(d / 30)}mo`;
};

function igUrl(handle: string | null | undefined) {
  if (!handle) return null;
  const h = handle.replace(/^@/, "").trim();
  if (!h) return null;
  return `https://instagram.com/${h}`;
}

function VendorCell({ v }: { v: VendorMini | null }) {
  if (!v || (!v.business_name && !v.contact_name)) {
    return <span className="text-muted-foreground/60 text-xs italic">Not booked</span>;
  }
  const handle = v.instagram?.replace(/^@/, "").trim();
  return (
    <div className="leading-tight">
      <p className="font-body text-sm text-foreground truncate">
        {v.business_name || v.contact_name}
      </p>
      {handle ? (
        <a
          href={igUrl(handle)!}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="font-body text-[11px] text-sage hover:underline inline-flex items-center gap-1"
        >
          <Instagram size={10} /> @{handle}
        </a>
      ) : (
        <span className="font-body text-[11px] text-muted-foreground/70">no handle</span>
      )}
    </div>
  );
}

function ActivationChip({ a }: { a: Activation }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[11px] font-body border border-amber-200">
      <Sparkles size={10} /> {a.title}
    </span>
  );
}

export default function MarketingRoster() {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [rows, setRows] = useState<RosterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<ViewMode>("table");
  const [scope, setScope] = useState<"upcoming" | "past" | "all">("upcoming");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [ccOnly, setCcOnly] = useState(false);
  const [minActivations, setMinActivations] = useState(0);
  const [minFloral, setMinFloral] = useState(0);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const allowed = !!profile?.role && (ALLOWED_ROLES as readonly string[]).includes(profile.role);

  useEffect(() => {
    if (authLoading) return;
    if (!allowed) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, allowed]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [eventsRes, vendorsRes, expReqRes, expCatRes, finRes, lineRes, guestsRes] =
        await Promise.all([
          supabase
            .from("events")
            .select("id, title, partner1_name, partner2_name, wedding_date, package_tier, estimated_guest_count"),
          supabase
            .from("vendors")
            .select("event_id, category, business_name, contact_name, instagram, email, phone")
            .in("category", ["photographer", "videographer", "florals", "planner"]),
          supabase
            .from("experience_requests")
            .select("id, event_id, catalog_item_id, status, final_price")
            .eq("status", "approved"),
          supabase.from("experience_catalog").select("id, title, category"),
          supabase.from("financials").select("event_id, site_fee_total, catering_estimate"),
          supabase.from("financial_line_items").select("event_id, section, label, total"),
          supabase.from("guests").select("event_id, rsvp_status, party_size"),
        ]);

      const anyErr = [eventsRes, vendorsRes, expReqRes, expCatRes, finRes, lineRes, guestsRes]
        .map((r) => r.error)
        .find(Boolean);
      if (anyErr) throw anyErr;

      const catMap = new Map<string, { title: string; category: string | null }>();
      (expCatRes.data ?? []).forEach((c: any) => catMap.set(c.id, { title: c.title, category: c.category }));

      // vendor by event+category (first match wins, prefer non-empty name)
      const vendorByEvent = new Map<string, Record<string, VendorMini>>();
      (vendorsRes.data ?? []).forEach((v: any) => {
        if (!vendorByEvent.has(v.event_id)) vendorByEvent.set(v.event_id, {});
        const bucket = vendorByEvent.get(v.event_id)!;
        const existing = bucket[v.category];
        const candidate: VendorMini = {
          business_name: v.business_name,
          contact_name: v.contact_name,
          instagram: v.instagram,
          email: v.email,
          phone: v.phone,
          category: v.category,
        };
        if (!existing || (!existing.business_name && candidate.business_name)) {
          bucket[v.category] = candidate;
        }
      });

      // activations by event
      const actByEvent = new Map<string, Activation[]>();
      (expReqRes.data ?? []).forEach((r: any) => {
        const cat = catMap.get(r.catalog_item_id);
        if (!cat) return;
        if (!actByEvent.has(r.event_id)) actByEvent.set(r.event_id, []);
        actByEvent.get(r.event_id)!.push({
          id: r.id,
          title: cat.title,
          category: cat.category,
          final_price: r.final_price,
        });
      });

      // financials
      const finByEvent = new Map<string, { site: number; cater: number }>();
      (finRes.data ?? []).forEach((f: any) => {
        finByEvent.set(f.event_id, {
          site: Number(f.site_fee_total) || 0,
          cater: Number(f.catering_estimate) || 0,
        });
      });

      // line items: total + floral subtotal
      const lineByEvent = new Map<string, { sum: number; floral: number; floralCount: number }>();
      (lineRes.data ?? []).forEach((li: any) => {
        const e = li.event_id;
        if (!lineByEvent.has(e)) lineByEvent.set(e, { sum: 0, floral: 0, floralCount: 0 });
        const t = Number(li.total) || 0;
        const bucket = lineByEvent.get(e)!;
        bucket.sum += t;
        if (
          FLORAL_REGEX.test(li.section || "") ||
          FLORAL_REGEX.test(li.label || "")
        ) {
          bucket.floral += t;
          bucket.floralCount += 1;
        }
      });

      // guest counts (confirmed/yes)
      const guestByEvent = new Map<string, number>();
      (guestsRes.data ?? []).forEach((g: any) => {
        const status = (g.rsvp_status || "").toLowerCase();
        if (status === "yes" || status === "attending" || status === "confirmed") {
          const inc = Number(g.party_size) > 0 ? Number(g.party_size) : 1;
          guestByEvent.set(g.event_id, (guestByEvent.get(g.event_id) || 0) + inc);
        }
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const built: RosterRow[] = (eventsRes.data ?? []).map((e: any) => {
        const vb = vendorByEvent.get(e.id) || {};
        const acts = actByEvent.get(e.id) || [];
        const fin = finByEvent.get(e.id);
        const line = lineByEvent.get(e.id);
        const couple = [e.partner1_name, e.partner2_name].filter(Boolean).join(" & ") || e.title || "Untitled";
        let daysAway: number | null = null;
        if (e.wedding_date) {
          const d = parseISO(e.wedding_date);
          if (isValid(d)) {
            d.setHours(0, 0, 0, 0);
            daysAway = differenceInDays(d, today);
          }
        }
        const totalValue =
          (fin ? fin.site + fin.cater : 0) +
          (line ? line.sum : 0) +
          acts.reduce((s, a) => s + (Number(a.final_price) || 0), 0);
        const liveGuests = guestByEvent.get(e.id) || 0;
        return {
          event_id: e.id,
          title: e.title || couple,
          couple_names: couple,
          wedding_date: e.wedding_date,
          days_away: daysAway,
          package_tier: e.package_tier,
          guest_count: liveGuests || Number(e.estimated_guest_count) || 0,
          photographer: vb.photographer || null,
          videographer: vb.videographer || null,
          florist: vb.florals || null,
          planner: vb.planner || null,
          floral_budget: line && line.floralCount > 0 ? line.floral : null,
          floral_itemized: !!(line && line.floralCount > 0),
          activations: acts,
          has_content_creator: acts.some((a) => /content\s*creator/i.test(a.title)),
          total_value: totalValue,
        };
      });

      setRows(built);
    } catch (err: any) {
      console.error("[MarketingRoster] load error", err);
      setError(err?.message || "Failed to load marketing roster.");
    } finally {
      setLoading(false);
    }
  }

  const years = useMemo(() => {
    const ys = new Set<string>();
    rows.forEach((r) => {
      if (r.wedding_date) ys.add(r.wedding_date.slice(0, 4));
    });
    return Array.from(ys).sort();
  }, [rows]);

  const tiers = useMemo(() => {
    const ts = new Set<string>();
    rows.forEach((r) => r.package_tier && ts.add(r.package_tier));
    return Array.from(ts).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (scope === "upcoming" && (r.days_away == null || r.days_away < 0)) return false;
        if (scope === "past" && (r.days_away == null || r.days_away >= 0)) return false;
        if (yearFilter !== "all" && r.wedding_date?.slice(0, 4) !== yearFilter) return false;
        if (tierFilter !== "all" && r.package_tier !== tierFilter) return false;
        if (ccOnly && !r.has_content_creator) return false;
        if (minActivations > 0 && r.activations.length < minActivations) return false;
        if (minFloral > 0 && (r.floral_budget ?? 0) < minFloral) return false;
        if (q) {
          const hay = [
            r.couple_names,
            r.title,
            r.photographer?.business_name,
            r.videographer?.business_name,
            r.florist?.business_name,
            r.planner?.business_name,
            r.photographer?.instagram,
            r.videographer?.instagram,
            r.florist?.instagram,
            r.package_tier,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const dir = sortDir === "asc" ? 1 : -1;
        switch (sortKey) {
          case "date": {
            const av = a.wedding_date ? Date.parse(a.wedding_date) : Infinity;
            const bv = b.wedding_date ? Date.parse(b.wedding_date) : Infinity;
            return (av - bv) * dir;
          }
          case "guests":
            return (a.guest_count - b.guest_count) * dir;
          case "floral":
            return ((a.floral_budget ?? -1) - (b.floral_budget ?? -1)) * dir;
          case "total":
            return (a.total_value - b.total_value) * dir;
          case "activations":
            return (a.activations.length - b.activations.length) * dir;
        }
      });
  }, [rows, scope, yearFilter, tierFilter, ccOnly, minActivations, minFloral, search, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir(k === "date" ? "asc" : "desc");
    }
  };
  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── access guards ─────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="font-body text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }
  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="max-w-md text-center">
          <h1 className="font-display text-3xl text-foreground mb-2">Restricted</h1>
          <p className="font-body text-sm text-muted-foreground mb-4">
            The Marketing Roster is available to marketing, planning, and leadership team
            members only.
          </p>
          <button
            onClick={() => navigate("/admin")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sage text-white font-body text-sm"
          >
            <ArrowLeft size={14} /> Back to admin
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-20">
        <div className="max-w-[1500px] mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/admin")}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60"
              aria-label="Back to admin"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <p className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">
                Internal · Leadership View
              </p>
              <h1 className="font-display text-2xl font-light text-foreground">Marketing Roster</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-1 bg-muted rounded-lg p-1">
              <button
                onClick={() => setView("table")}
                className={`p-1.5 rounded ${view === "table" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
                aria-label="Table view"
              >
                <TableIcon size={14} />
              </button>
              <button
                onClick={() => setView("cards")}
                className={`p-1.5 rounded ${view === "cards" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
                aria-label="Card view"
              >
                <LayoutGrid size={14} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1500px] mx-auto px-6 py-6">
        {/* Filters */}
        <div className="bg-card border border-border rounded-xl p-4 mb-5 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search couple, vendor, handle…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-sage/30"
            />
          </div>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as any)}
            className="px-3 py-2 rounded-lg border border-border bg-background font-body text-sm"
          >
            <option value="upcoming">Upcoming</option>
            <option value="past">Past</option>
            <option value="all">All</option>
          </select>
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-background font-body text-sm"
          >
            <option value="all">All years</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-background font-body text-sm"
          >
            <option value="all">All packages</option>
            {tiers.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background font-body text-sm cursor-pointer">
            <input type="checkbox" checked={ccOnly} onChange={(e) => setCcOnly(e.target.checked)} />
            Content Creator
          </label>
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background font-body text-sm">
            <span className="text-muted-foreground">Min activations</span>
            <input
              type="number" min={0} value={minActivations}
              onChange={(e) => setMinActivations(Number(e.target.value) || 0)}
              className="w-14 bg-transparent text-foreground focus:outline-none"
            />
          </label>
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background font-body text-sm">
            <span className="text-muted-foreground">Min floral $</span>
            <input
              type="number" min={0} step={500} value={minFloral}
              onChange={(e) => setMinFloral(Number(e.target.value) || 0)}
              className="w-20 bg-transparent text-foreground focus:outline-none"
            />
          </label>
          <span className="ml-auto font-body text-xs text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "wedding" : "weddings"}
          </span>
        </div>

        {/* Status */}
        {loading && (
          <div className="py-20 text-center font-body text-sm text-muted-foreground">
            Loading marketing roster…
          </div>
        )}
        {error && !loading && (
          <div className="py-10 text-center font-body text-sm text-destructive">{error}</div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="py-20 text-center font-body text-sm text-muted-foreground">
            No weddings match these filters.
          </div>
        )}

        {/* Table view */}
        {!loading && !error && filtered.length > 0 && view === "table" && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-sage/8 text-left">
                  <tr className="font-body text-[11px] tracking-wider uppercase text-muted-foreground">
                    <th className="w-6"></th>
                    <th className="px-3 py-3">Couple</th>
                    <Th label="Date" k="date" sortKey={sortKey} dir={sortDir} onClick={toggleSort} />
                    <th className="px-3 py-3">Package</th>
                    <Th label="Guests" k="guests" sortKey={sortKey} dir={sortDir} onClick={toggleSort} />
                    <th className="px-3 py-3">Photo</th>
                    <th className="px-3 py-3">Video</th>
                    <th className="px-3 py-3">Florals</th>
                    <Th label="Floral $" k="floral" sortKey={sortKey} dir={sortDir} onClick={toggleSort} />
                    <Th label="Activations" k="activations" sortKey={sortKey} dir={sortDir} onClick={toggleSort} />
                    <Th label="Total" k="total" sortKey={sortKey} dir={sortDir} onClick={toggleSort} />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const open = expanded.has(r.event_id);
                    return (
                      <Fragment key={r.event_id}>
                        <tr
                          key={r.event_id}
                          className="border-t border-border hover:bg-muted/30 cursor-pointer"
                          onClick={() => toggleExpand(r.event_id)}
                        >
                          <td className="pl-3 text-muted-foreground">
                            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </td>
                          <td className="px-3 py-3">
                            <p className="font-body text-sm font-medium text-foreground">{r.couple_names}</p>
                            <p className="font-body text-[11px] text-muted-foreground">
                              {daysLabel(r.days_away)}
                            </p>
                          </td>
                          <td className="px-3 py-3 font-body text-sm text-foreground whitespace-nowrap">
                            {r.wedding_date && isValid(parseISO(r.wedding_date))
                              ? format(parseISO(r.wedding_date), "MMM d, yyyy")
                              : "TBD"}
                          </td>
                          <td className="px-3 py-3 font-body text-xs text-muted-foreground">
                            {r.package_tier || "—"}
                          </td>
                          <td className="px-3 py-3 font-body text-sm text-foreground">
                            {r.guest_count || "—"}
                          </td>
                          <td className="px-3 py-3 min-w-[140px]"><VendorCell v={r.photographer} /></td>
                          <td className="px-3 py-3 min-w-[140px]"><VendorCell v={r.videographer} /></td>
                          <td className="px-3 py-3 min-w-[140px]"><VendorCell v={r.florist} /></td>
                          <td className="px-3 py-3 font-body text-sm text-foreground whitespace-nowrap">
                            {r.floral_budget != null
                              ? fmtMoney(r.floral_budget)
                              : <span className="text-muted-foreground/70 italic text-xs">not itemized</span>}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1">
                              <span className="font-display text-base font-medium text-foreground">
                                {r.activations.length}
                              </span>
                              {r.has_content_creator && (
                                <span title="Content Creator booked">
                                  <Camera size={14} className="text-amber-600" />
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3 font-body text-sm font-medium text-foreground whitespace-nowrap">
                            {fmtMoney(r.total_value)}
                          </td>
                        </tr>
                        {open && (
                          <tr key={r.event_id + "-x"} className="bg-sage/5 border-t border-border">
                            <td colSpan={11} className="px-6 py-4">
                              <ExpandedDetail r={r} onOpen={() => navigate(`/admin/events/${r.event_id}`)} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Card view */}
        {!loading && !error && filtered.length > 0 && view === "cards" && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((r) => (
              <div
                key={r.event_id}
                className="bg-card border border-border rounded-xl p-5 hover:border-sage/40 hover:shadow-card transition-all cursor-pointer"
                onClick={() => navigate(`/admin/events/${r.event_id}`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-display text-lg text-foreground">{r.couple_names}</p>
                    <p className="font-body text-xs text-muted-foreground">
                      {r.wedding_date && isValid(parseISO(r.wedding_date))
                        ? format(parseISO(r.wedding_date), "EEE MMM d, yyyy")
                        : "Date TBD"}
                      {" · "}{daysLabel(r.days_away)}
                    </p>
                  </div>
                  {r.package_tier && (
                    <span className="font-body text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-sage/15 text-sage">
                      {r.package_tier}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                  <Stat icon={Users} label="Guests" value={String(r.guest_count || "—")} />
                  <Stat
                    icon={Flower2}
                    label="Floral"
                    value={r.floral_budget != null ? fmtMoney(r.floral_budget) : "—"}
                  />
                  <Stat icon={DollarSign} label="Total" value={fmtMoney(r.total_value)} />
                </div>
                <div className="space-y-1.5 mb-3 text-xs">
                  <VendorLine icon={Camera} label="Photo" v={r.photographer} />
                  <VendorLine icon={Video} label="Video" v={r.videographer} />
                  <VendorLine icon={Flower2} label="Florals" v={r.florist} />
                  <VendorLine icon={ClipboardList} label="Planner" v={r.planner} />
                </div>
                {r.activations.length > 0 && (
                  <div className="pt-3 border-t border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-body text-[11px] tracking-wider uppercase text-muted-foreground">
                        {r.activations.length} activation{r.activations.length === 1 ? "" : "s"}
                      </span>
                      {r.has_content_creator && (
                        <Camera size={12} className="text-amber-600" />
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {r.activations.map((a) => <ActivationChip key={a.id} a={a} />)}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function Th({
  label, k, sortKey, dir, onClick,
}: {
  label: string; k: SortKey; sortKey: SortKey; dir: "asc" | "desc"; onClick: (k: SortKey) => void;
}) {
  const active = sortKey === k;
  return (
    <th
      onClick={() => onClick(k)}
      className="px-3 py-3 cursor-pointer select-none"
    >
      <span className={`inline-flex items-center gap-1 ${active ? "text-sage" : ""}`}>
        {label}
        <ArrowUpDown size={11} className={active ? "" : "opacity-40"} />
        {active && <span className="text-[9px]">{dir === "asc" ? "▲" : "▼"}</span>}
      </span>
    </th>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="bg-sage/8 rounded-lg py-2">
      <Icon size={12} className="mx-auto text-sage mb-0.5" />
      <p className="font-display text-sm font-medium text-foreground leading-tight">{value}</p>
      <p className="font-body text-[10px] tracking-wider uppercase text-muted-foreground">{label}</p>
    </div>
  );
}

function VendorLine({ icon: Icon, label, v }: { icon: any; label: string; v: VendorMini | null }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={12} className="text-sage shrink-0" />
      <span className="font-body text-[11px] tracking-wider uppercase text-muted-foreground w-14 shrink-0">
        {label}
      </span>
      <div className="min-w-0 flex-1">
        {!v || (!v.business_name && !v.contact_name) ? (
          <span className="font-body text-xs text-muted-foreground/60 italic">—</span>
        ) : (
          <span className="font-body text-xs text-foreground truncate inline-block max-w-full">
            {v.business_name || v.contact_name}
            {v.instagram && (
              <a
                href={igUrl(v.instagram)!}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="ml-1 text-sage hover:underline"
              >
                @{v.instagram.replace(/^@/, "")}
              </a>
            )}
          </span>
        )}
      </div>
    </div>
  );
}

function ExpandedDetail({ r, onOpen }: { r: RosterRow; onOpen: () => void }) {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div>
        <h4 className="font-body text-[11px] tracking-wider uppercase text-muted-foreground mb-2">
          Vendor Team
        </h4>
        <div className="space-y-1.5">
          <VendorLine icon={Camera} label="Photo" v={r.photographer} />
          <VendorLine icon={Video} label="Video" v={r.videographer} />
          <VendorLine icon={Flower2} label="Florals" v={r.florist} />
          <VendorLine icon={ClipboardList} label="Planner" v={r.planner} />
        </div>
      </div>
      <div>
        <h4 className="font-body text-[11px] tracking-wider uppercase text-muted-foreground mb-2">
          Activations ({r.activations.length})
        </h4>
        {r.activations.length === 0 ? (
          <p className="font-body text-xs text-muted-foreground italic">None booked</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {r.activations.map((a) => <ActivationChip key={a.id} a={a} />)}
          </div>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onOpen(); }}
          className="mt-4 inline-flex items-center gap-1 font-body text-xs text-sage hover:underline"
        >
          Open event <ChevronRight size={12} />
        </button>
      </div>
    </div>
  );
}
