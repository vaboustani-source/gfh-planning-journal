import { useNavigate, useParams, Link } from "react-router-dom";
import { usePortalData } from "@/hooks/usePortalData";
import { supabase } from "@/integrations/supabase/client";
import {
  MessageCircle, ArrowRight, CheckCircle2, Loader2, Circle,
  ChevronRight, Sparkles, Compass
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";

/* ── Types ──────────────────────────────────── */

interface ChecklistItem {
  id: string;
  label: string;
  section: string;
  status: string | null;
}

interface Milestone {
  id: string;
  title: string;
  target_date: string | null;
  status: string | null;
}

interface AttentionCard {
  label: string;
  to: string;
}

/* ── Constants ──────────────────────────────── */

const CHECKLIST_SECTIONS = ["arrival", "ceremony", "reception", "attire", "decor", "logistics"];

function getPhaseText(days: number | null): string {
  if (days === null) return "";
  if (days > 365) return "You're in the early planning phase — lock in your key vendors.";
  if (days >= 180) return "You're in the active planning phase — details are coming together.";
  if (days >= 90) return "Final stretch — time to confirm everything.";
  return "Almost here — focus on the finishing touches.";
}

/* ── Sub-components ─────────────────────────── */

function CountdownHero({ days }: { days: number | null }) {
  if (days === null) {
    return (
      <div className="text-center py-8">
        <p className="font-display text-2xl italic text-muted-foreground">Wedding date coming soon</p>
      </div>
    );
  }
  if (days < 0) {
    return (
      <div className="text-center py-8">
        <p className="font-body text-sm tracking-widest uppercase text-muted-foreground mb-2">Your wedding was</p>
        <p className="font-display text-8xl font-light text-primary leading-none">{Math.abs(days)}</p>
        <p className="font-display text-2xl italic text-muted-foreground mt-2">days ago</p>
        <p className="font-body text-sm text-muted-foreground mt-4">Congratulations! 🎉</p>
      </div>
    );
  }
  if (days === 0) {
    return (
      <div className="text-center py-8">
        <p className="font-display text-5xl italic text-primary animate-pulse">Today is the day!</p>
      </div>
    );
  }
  return (
    <div className="text-center">
      <p className="font-body text-xs tracking-widest uppercase text-muted-foreground mb-4">Your wedding is</p>
      <div className="flex items-end justify-center gap-3">
        <span className="font-display font-light text-[7rem] leading-none text-foreground tabular-nums py-0 my-0 pb-[15px]">{days}</span>
      </div>
      <p className="font-display text-3xl italic text-muted-foreground mt-1">
        {days === 1 ? "day away" : "days away"}
      </p>
      <p className="font-body text-sm text-muted-foreground mt-3">{getPhaseText(days)}</p>
    </div>
  );
}

function ProgressCard({
  items,
  onCheck,
  checking,
}: {
  items: ChecklistItem[];
  onCheck: (id: string) => void;
  checking: string | null;
}) {
  const navigate = useNavigate();
  const total = items.length;
  const completed = items.filter(i => i.status === "complete").length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const incomplete = items.filter(i => i.status !== "complete").slice(0, 3);

  const sectionLabel = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  return (
    <div className="rounded-xl bg-card border border-border shadow-soft p-5">
      <p className="font-body text-[10px] tracking-widest uppercase text-muted-foreground mb-4">Your Planning Progress</p>

      {/* Progress bar */}
      <div className="space-y-2 mb-5">
        <div className="flex justify-between items-center">
          <p className="font-body text-xs text-muted-foreground">{completed} of {total} tasks complete</p>
          <p className="font-body text-xs font-medium text-foreground">{pct}%</p>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-primary transition-all duration-700 ease-out" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Next 3 incomplete tasks */}
      {incomplete.length > 0 && (
        <div className="space-y-1 mb-4">
          {incomplete.map(item => (
            <button
              key={item.id}
              onClick={() => onCheck(item.id)}
              disabled={checking === item.id}
              className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-muted/50 transition-colors group"
            >
              {checking === item.id ? (
                <Loader2 size={16} className="animate-spin text-primary shrink-0" />
              ) : (
                <Circle size={16} className="text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-body text-sm text-foreground truncate">{item.label}</p>
                <p className="font-body text-[10px] text-muted-foreground">{sectionLabel(item.section)}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      <button
        onClick={() => navigate("/portal/planning")}
        className="flex items-center gap-1 font-body text-xs text-primary hover:text-primary/80 transition-colors"
      >
        View all tasks <ArrowRight size={12} />
      </button>
    </div>
  );
}

function MilestonesCard({ milestones }: { milestones: Milestone[] }) {
  const navigate = useNavigate();

  const daysAway = (dateStr: string | null) => {
    if (!dateStr) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
    return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="rounded-xl bg-card border border-border shadow-soft p-5">
      <p className="font-body text-[10px] tracking-widest uppercase text-muted-foreground mb-4">Coming Up</p>
      <div className="space-y-3">
        {milestones.map((m, i) => {
          const d = daysAway(m.target_date);
          return (
            <div key={m.id} className="flex items-start gap-3">
              <div className="mt-1.5 shrink-0 flex flex-col items-center">
                <div className={`w-2.5 h-2.5 rounded-full ${i === 0 ? "bg-primary" : "bg-muted-foreground/30"}`} />
                {i < milestones.length - 1 && <div className="w-px h-6 bg-border mt-1" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-body text-sm text-foreground leading-snug">{m.title}</p>
                <p className="font-body text-[10px] text-muted-foreground mt-0.5">
                  {formatDate(m.target_date)}
                  {d !== null && d > 0 && ` · ${d} days away`}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <button
        onClick={() => navigate("/portal/our-wedding")}
        className="flex items-center gap-1 font-body text-xs text-primary hover:text-primary/80 transition-colors mt-4"
      >
        View all milestones <ArrowRight size={12} />
      </button>
    </div>
  );
}

function AttentionSection({ cards }: { cards: AttentionCard[] }) {
  const navigate = useNavigate();

  if (cards.length === 0) {
    return (
      <div className="rounded-xl bg-card border border-border shadow-soft p-5">
        <p className="font-body text-[10px] tracking-widest uppercase text-muted-foreground mb-4">Needs Your Input</p>
        <div className="text-center py-4">
          <CheckCircle2 size={24} className="text-primary mx-auto mb-2" />
          <p className="font-display text-lg italic text-foreground">You're all caught up! 🎉</p>
          <p className="font-body text-xs text-muted-foreground mt-1">Nothing needs your attention right now.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-card border border-border shadow-soft p-5">
      <p className="font-body text-[10px] tracking-widest uppercase text-muted-foreground mb-4">Needs Your Input</p>
      <div className="space-y-2">
        {cards.map(card => (
          <button
            key={card.to + card.label}
            onClick={() => navigate(card.to)}
            className="w-full flex items-center justify-between rounded-lg border-l-[3px] border-l-[#C9A84C] bg-muted/30 hover:bg-muted/50 px-4 py-3 text-left transition-colors group"
          >
            <p className="font-body text-sm text-foreground">{card.label}</p>
            <ChevronRight size={14} className="text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBrandonCard() {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate("/portal/messages")}
      className="w-full flex items-center justify-between rounded-xl bg-card border border-border hover:border-sage/50 hover:shadow-card p-5 text-left transition-all duration-200 group shadow-soft"
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-sage/10 border border-sage/20 flex items-center justify-center shrink-0">
          <MessageCircle size={16} className="text-sage" />
        </div>
        <div>
          <p className="font-body text-sm font-medium text-foreground">Message Brandon</p>
          <p className="font-body text-xs text-muted-foreground">Questions? We're here to help.</p>
        </div>
      </div>
      <ArrowRight size={16} className="text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
    </button>
  );
}

/* ── Main component ─────────────────────────── */

export default function Today() {
  const {
    daysUntilArrival,
    eventId: portalEventId,
    loading: ctxLoading,
  } = usePortalData();
  const { eventId: routeEventId } = useParams<{ eventId: string }>();
  const effectiveEventId = portalEventId || routeEventId || null;

  const [loading, setLoading] = useState(true);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [attentionCards, setAttentionCards] = useState<AttentionCard[]>([]);
  const [checking, setChecking] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    if (!effectiveEventId) { setLoading(false); return; }
    setLoading(true);

    // Fetch all data in parallel
    const [checklistRes, milestonesRes, ceremonyRes, barRes, dietaryRes, lodgingRes, vendorsRes] = await Promise.all([
      supabase.from("checklist_items")
        .select("id, label, section, status")
        .eq("event_id", effectiveEventId)
        .in("section", CHECKLIST_SECTIONS)
        .order("sort_order", { ascending: true }),
      supabase.from("milestones")
        .select("id, title, target_date, status")
        .eq("event_id", effectiveEventId)
        .order("sort_order", { ascending: true }),
      supabase.from("ceremony_details")
        .select("id")
        .eq("event_id", effectiveEventId)
        .maybeSingle(),
      supabase.from("bar_selections")
        .select("id, bar_package")
        .eq("event_id", effectiveEventId)
        .maybeSingle(),
      supabase.from("dietary_restrictions")
        .select("id")
        .eq("event_id", effectiveEventId)
        .limit(1),
      supabase.from("lodging_assignments")
        .select("id, assigned_guest_name")
        .eq("event_id", effectiveEventId)
        .limit(1),
      supabase.from("vendors")
        .select("id, business_name, category")
        .eq("event_id", effectiveEventId),
    ]);

    setChecklistItems(checklistRes.data ?? []);

    // Next incomplete milestones
    const allMilestones = milestonesRes.data ?? [];
    const incompleteMilestones = allMilestones.filter(m => m.status !== "complete").slice(0, 3);
    setMilestones(incompleteMilestones);

    // Build attention cards
    const cards: AttentionCard[] = [];
    if (!ceremonyRes.data) {
      cards.push({ label: "Add your ceremony details", to: "/portal/ceremony" });
    }
    if (!barRes.data || !barRes.data.bar_package) {
      cards.push({ label: "Choose your bar package", to: "/portal/menus-meals" });
    }
    if (!dietaryRes.data || dietaryRes.data.length === 0) {
      cards.push({ label: "Submit dietary info", to: "/portal/menus-meals" });
    }
    const lodgingData = lodgingRes.data ?? [];
    const hasAssigned = lodgingData.some(l => l.assigned_guest_name);
    if (!hasAssigned) {
      cards.push({ label: "Assign your guest rooms", to: "/portal/our-people" });
    }
    const vendorData = vendorsRes.data ?? [];
    const nonGfVendors = vendorData.filter(v =>
      v.business_name && v.business_name !== "Gilbertsville Farmhouse"
    );
    if (nonGfVendors.length === 0) {
      cards.push({ label: "Add your vendors", to: "/portal/vendors" });
    }
    setAttentionCards(cards);
    setLoading(false);
  }, [effectiveEventId]);

  useEffect(() => {
    if (!ctxLoading) fetchDashboardData();
  }, [ctxLoading, fetchDashboardData]);

  const handleCheck = async (id: string) => {
    setChecking(id);
    await supabase
      .from("checklist_items")
      .update({ status: "complete", completed_at: new Date().toISOString() })
      .eq("id", id);
    setChecklistItems(prev => prev.map(i => i.id === id ? { ...i, status: "complete" } : i));
    setChecking(null);
  };

  if (loading || ctxLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-5 py-8 lg:px-8 lg:py-10">
      {/* Welcome banner */}
      <div className="mb-6 animate-fade-up">
        <Link
          to="/portal/start"
          className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:border-sage/40 hover:shadow-card transition-all duration-200 group"
        >
          <div className="w-8 h-8 rounded-full bg-sage/10 border border-sage/20 flex items-center justify-center shrink-0">
            <Compass size={16} className="text-sage" strokeWidth={1.75} />
          </div>
          <p className="font-body text-sm text-foreground flex-1">
            New here? Start with a quick tour
          </p>
          <ArrowRight
            size={14}
            className="text-muted-foreground group-hover:text-sage group-hover:translate-x-0.5 transition-all shrink-0"
          />
        </Link>
      </div>

      {/* Hero countdown — full width */}
      <section className="animate-fade-up mb-10">
        <CountdownHero days={daysUntilArrival} />
      </section>

      <div className="h-px bg-border mb-8" />

      {/* Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-6">
          <section className="animate-fade-up" style={{ animationDelay: "80ms", opacity: 0 }}>
            <ProgressCard items={checklistItems} onCheck={handleCheck} checking={checking} />
          </section>

          {milestones.length > 0 && (
            <section className="animate-fade-up" style={{ animationDelay: "140ms", opacity: 0 }}>
              <MilestonesCard milestones={milestones} />
            </section>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <section className="animate-fade-up" style={{ animationDelay: "200ms", opacity: 0 }}>
            <AttentionSection cards={attentionCards} />
          </section>

          <section className="animate-fade-up" style={{ animationDelay: "260ms", opacity: 0 }}>
            <MessageBrandonCard />
          </section>
        </div>
      </div>
    </div>
  );
}
