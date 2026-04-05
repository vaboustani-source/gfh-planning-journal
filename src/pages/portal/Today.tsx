import { useNavigate, useParams } from "react-router-dom";
import { usePortalData } from "@/hooks/usePortalData";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import PortalStickyFooter from "@/components/portal/PortalStickyFooter";

/* ── Sub-components ──────────────────────────── */

function CountdownDisplay({ days }: { days: number | null }) {
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
    </div>
  );
}

function ProgressBar({ percentage, completed, total }: { percentage: number; completed: number; total: number }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <p className="font-body text-xs text-muted-foreground">Planning progress</p>
        <p className="font-body text-xs font-medium text-foreground">{completed} of {total} tasks complete</p>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-primary transition-all duration-700 ease-out" style={{ width: `${percentage}%` }} />
      </div>
      <p className="font-body text-xs text-muted-foreground text-right">{percentage}%</p>
    </div>
  );
}

interface NextTaskData {
  id: string;
  label: string;
  section: string;
  paced_send_date: string | null;
}

function NextTaskCard({ task, onComplete }: { task: NextTaskData; onComplete: () => void }) {
  const [completing, setCompleting] = useState(false);
  const [done, setDone] = useState(false);

  const formatDueDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString("en-US", { month: "long", day: "numeric" });
  };

  const handleComplete = async () => {
    setCompleting(true);
    await supabase
      .from("checklist_items")
      .update({ status: "complete", completed_at: new Date().toISOString() })
      .eq("id", task.id);
    setDone(true);
    setTimeout(() => {
      setCompleting(false);
      onComplete();
    }, 800);
  };

  if (done) {
    return (
      <div className="rounded-xl bg-sage/8 border border-sage/20 p-6 flex items-center justify-center gap-3 min-h-[120px]">
        <CheckCircle2 size={20} className="text-primary" />
        <p className="font-display text-lg italic text-primary">Task completed!</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-card border border-border shadow-soft overflow-hidden">
      <div className="h-0.5 bg-gradient-to-r from-sage/30 via-primary/60 to-sage/30" />
      <div className="p-5">
        <p className="font-body text-[10px] tracking-widest uppercase text-muted-foreground mb-2">
          Up next · {task.section}
        </p>
        <p className="font-display text-2xl font-light text-foreground leading-snug mb-1">{task.label}</p>
        {task.paced_send_date && (
          <p className="font-body text-xs text-muted-foreground mb-4">Due {formatDueDate(task.paced_send_date)}</p>
        )}
        <button
          onClick={handleComplete}
          disabled={completing}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-body text-sm text-primary-foreground hover:bg-sage-dark transition-colors disabled:opacity-60"
        >
          {completing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
          {completing ? "Marking done…" : "Mark complete"}
        </button>
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────── */

const CHECKLIST_SECTIONS = ["arrival", "ceremony", "reception", "attire", "decor", "logistics"];

export default function Today() {
  const {
    daysUntilArrival,
    checklistProgress: ctxProgress,
    nextTask: ctxNextTask,
    loading: ctxLoading,
    refreshChecklist,
    eventId: portalEventId,
  } = usePortalData();
  const { eventId: routeEventId } = useParams<{ eventId: string }>();
  const effectiveEventId = portalEventId || routeEventId || null;

  const navigate = useNavigate();

  // Fallback: fetch checklist data directly if context didn't provide it
  const [fallbackProgress, setFallbackProgress] = useState<{ total: number; completed: number; percentage: number } | null>(null);
  const [fallbackNextTask, setFallbackNextTask] = useState<NextTaskData | null | undefined>(undefined);
  const [fallbackLoading, setFallbackLoading] = useState(false);

  const needsFallback = !ctxLoading && effectiveEventId && ctxProgress.total === 0;

  const fetchFallback = useCallback(async () => {
    if (!effectiveEventId) return;
    setFallbackLoading(true);
    const { data } = await supabase
      .from("checklist_items")
      .select("id, label, section, status, paced_send_date, sort_order")
      .eq("event_id", effectiveEventId)
      .order("sort_order", { ascending: true });

    if (data) {
      const relevant = data.filter(i => CHECKLIST_SECTIONS.includes(i.section));
      const total = relevant.length;
      const completed = relevant.filter(i => i.status === "complete").length;
      const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
      setFallbackProgress({ total, completed, percentage });

      const incomplete = relevant.filter(i => i.status !== "complete");
      setFallbackNextTask(incomplete[0] ?? null);
    }
    setFallbackLoading(false);
  }, [effectiveEventId]);

  useEffect(() => {
    if (needsFallback) fetchFallback();
  }, [needsFallback, fetchFallback]);

  const checklistProgress = needsFallback && fallbackProgress ? fallbackProgress : ctxProgress;
  const nextTask = needsFallback && fallbackNextTask !== undefined ? fallbackNextTask : ctxNextTask;
  const loading = ctxLoading || fallbackLoading;

  const handleTaskComplete = () => {
    refreshChecklist();
    if (needsFallback) fetchFallback();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
    <div className="max-w-5xl mx-auto px-5 py-8 lg:px-8 lg:py-10 pb-32">
      {/* Countdown */}
      <section className="animate-fade-up mb-10">
        <CountdownDisplay days={daysUntilArrival} />
      </section>

      <div className="h-px bg-border mb-8" />

      {/* Next task */}
      <section className="mb-8 animate-fade-up" style={{ animationDelay: "80ms", opacity: 0 }}>
        <h2 className="font-display text-xl font-light text-foreground mb-3">Your next step</h2>
        {nextTask ? (
          <NextTaskCard task={nextTask} onComplete={handleTaskComplete} />
        ) : (
          <div className="rounded-xl bg-sage/6 border border-sage/15 p-6 text-center">
            <CheckCircle2 size={28} className="text-primary mx-auto mb-3" />
            <p className="font-display text-xl italic text-foreground">All caught up!</p>
            <p className="font-body text-sm text-muted-foreground mt-1">No tasks waiting for you right now.</p>
          </div>
        )}
      </section>

      {/* Progress */}
      {checklistProgress.total > 0 && (
        <section className="mb-8 animate-fade-up" style={{ animationDelay: "140ms", opacity: 0 }}>
          <div className="rounded-xl bg-card border border-border p-5 shadow-soft">
            <ProgressBar
              percentage={checklistProgress.percentage}
              completed={checklistProgress.completed}
              total={checklistProgress.total}
            />
          </div>
        </section>
      )}

      {/* Message Brandon */}
      <section className="animate-fade-up" style={{ animationDelay: "200ms", opacity: 0 }}>
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
      </section>

    </div>
    <PortalStickyFooter onContinue={() => navigate("/portal/our-wedding")} nextOnly />
    </>
  );
}
