import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Check, AlertCircle, Clock, User } from "lucide-react";
import { useAutosaveStatus } from "@/hooks/useAutosaveStatus";
import AdminStickyFooter from "@/components/admin/AdminStickyFooter";

interface Milestone {
  id: string;
  title: string;
  timeframe_label: string | null;
  target_date: string | null;
  owner: string | null;
  status: string | null;
  completed_date: string | null;
  sort_order: number | null;
  notes: string | null;
}

export default function MilestonesTab({ eventId, onNavigateNext }: { eventId: string; onNavigateNext?: () => void }) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const { status, trackSave } = useAutosaveStatus();
  const seeded = useRef(false);

  useEffect(() => {
    loadMilestones();
  }, [eventId]);

  const loadMilestones = async () => {
    const { data } = await supabase
      .from("milestones")
      .select("*")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true });

    if (data && data.length > 0) {
      setMilestones(data);
      setLoading(false);
    } else if (!seeded.current) {
      // Auto-seed on first load if empty
      seeded.current = true;
      const { data: evt } = await supabase.from("events").select("wedding_date").eq("id", eventId).single();
      const fallback = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      await supabase.rpc("seed_milestones", { p_event_id: eventId, p_wedding_date: evt?.wedding_date || fallback });
      // Re-fetch
      const { data: seededData } = await supabase
        .from("milestones")
        .select("*")
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true });
      if (seededData) setMilestones(seededData);
      setLoading(false);
    } else {
      setLoading(false);
    }
  };

  const toggleComplete = async (m: Milestone) => {
    const next = m.status === "complete" ? "pending" : "complete";
    const today = new Date().toISOString().split("T")[0];
    const updates = {
      status: next,
      completed_date: next === "complete" ? today : null,
    };

    setMilestones(prev => prev.map(x =>
      x.id === m.id ? { ...x, ...updates } : x
    ));

    await trackSave(async () => {
      await supabase.from("milestones").update(updates).eq("id", m.id);
    });
  };

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const isOverdue = (m: Milestone) =>
    m.target_date && new Date(m.target_date) < now && m.status !== "complete";

  const completed = milestones.filter(m => m.status === "complete").length;
  const total = milestones.length;
  const pct = total ? Math.round((completed / total) * 100) : 0;

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-sage/30 border-t-sage animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 animate-fade-up relative">
      {/* Progress bar */}
      <div className="rounded-xl bg-card border border-border p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="font-body text-sm text-foreground">
            {completed} of {total} milestones complete
          </p>
          <p className="font-display text-2xl font-light text-foreground">{pct}%</p>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-sage rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-2">
        {milestones.map(m => {
          const overdue = isOverdue(m);
          const done = m.status === "complete";

          return (
            <div
              key={m.id}
              className={`rounded-xl border p-4 flex items-start gap-4 transition-colors ${
                overdue
                  ? "bg-destructive/5 border-destructive/25"
                  : done
                  ? "bg-sage/5 border-sage/20"
                  : "bg-card border-border"
              }`}
            >
              {/* Checkbox */}
              <button
                onClick={() => toggleComplete(m)}
                className={`mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                  done
                    ? "bg-sage border-sage text-white"
                    : overdue
                    ? "border-destructive/70 hover:border-destructive"
                    : "border-muted-foreground/60 hover:border-sage"
                }`}
              >
                {done && <Check size={12} className="text-white" />}
              </button>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <p className={`font-body text-sm font-semibold ${done ? "line-through text-muted-foreground/70" : "text-foreground"}`}>
                    {m.title}
                  </p>
                  {overdue && (
                    <span className="flex items-center gap-1 font-body text-[10px] text-destructive bg-destructive/10 border border-destructive/20 rounded-full px-2 py-0.5">
                      <AlertCircle size={9} />
                      Overdue
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground font-body">
                  {m.timeframe_label && <span>{m.timeframe_label}</span>}
                  {m.target_date && (
                    <span className="flex items-center gap-1">
                      <Clock size={9} />
                      {fmtDate(m.target_date)}
                    </span>
                  )}
                  {m.owner && (
                    <span className="flex items-center gap-1 capitalize">
                      <User size={9} />
                      {m.owner}
                    </span>
                  )}
                </div>
              </div>

              {/* Status pill */}
              <span className={`shrink-0 inline-flex items-center rounded-full border px-2.5 py-0.5 font-body text-[11px] capitalize ${
                done
                  ? "bg-sage/15 text-sage border-sage/30"
                  : overdue
                  ? "bg-destructive/10 text-destructive border-destructive/20"
                  : "bg-muted text-muted-foreground border-border"
              }`}>
                {done ? "complete" : overdue ? "overdue" : "pending"}
              </span>
            </div>
          );
        })}
      </div>

      <AdminStickyFooter status={status} onSave={() => {}} onSaveAndContinue={() => onNavigateNext?.()} />
    </div>
  );
}
