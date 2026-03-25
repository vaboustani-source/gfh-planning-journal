import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Check, AlertCircle, Clock, User } from "lucide-react";

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

const statusColors: Record<string, string> = {
  complete: "bg-sage/15 text-sage border-sage/30",
  pending: "bg-muted text-muted-foreground border-border",
  "in-progress": "bg-secondary text-secondary-foreground border-border",
};

export default function MilestonesTab({ eventId }: { eventId: string }) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetch(); }, [eventId]);

  const fetch = async () => {
    const { data } = await supabase
      .from("milestones")
      .select("*")
      .eq("event_id", eventId)
      .order("target_date", { ascending: true });
    if (data) setMilestones(data);
    setLoading(false);
  };

  const markComplete = async (m: Milestone) => {
    const next = m.status === "complete" ? "pending" : "complete";
    const today = new Date().toISOString().split("T")[0];
    await supabase.from("milestones").update({
      status: next,
      completed_date: next === "complete" ? today : null,
    }).eq("id", m.id);
    setMilestones(prev => prev.map(x =>
      x.id === m.id ? { ...x, status: next, completed_date: next === "complete" ? today : null } : x
    ));
  };

  const now = new Date(); now.setHours(0, 0, 0, 0);
  const isOverdue = (m: Milestone) =>
    m.target_date && new Date(m.target_date) < now && m.status !== "complete";

  const completed = milestones.filter(m => m.status === "complete").length;
  const pct = milestones.length ? Math.round((completed / milestones.length) * 100) : 0;

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

  if (loading) return <div className="py-12 flex justify-center"><div className="w-6 h-6 rounded-full border-2 border-sage/30 border-t-sage animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Progress */}
      <div className="rounded-xl bg-card border border-border p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="font-body text-sm text-foreground">{completed} of {milestones.length} milestones complete</p>
          <p className="font-display text-2xl font-light text-foreground">{pct}%</p>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-sage rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {milestones.length === 0 ? (
        <div className="text-center py-16">
          <p className="font-body text-muted-foreground">No milestones for this event yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {milestones.map(m => {
            const overdue = isOverdue(m);
            return (
              <div
                key={m.id}
                className={`rounded-xl border p-4 flex items-start gap-4 transition-colors ${
                  overdue
                    ? "bg-red-50/50 border-red-200 dark:bg-red-950/10 dark:border-red-900/30"
                    : "bg-card border-border"
                }`}
              >
                {/* Complete toggle */}
                <button
                  onClick={() => markComplete(m)}
                  className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                    m.status === "complete"
                      ? "bg-sage border-sage text-white"
                      : overdue
                      ? "border-red-400 hover:border-red-500"
                      : "border-border hover:border-sage"
                  }`}
                >
                  {m.status === "complete" && <Check size={11} className="text-white" />}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className={`font-body text-sm font-medium ${m.status === "complete" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      {m.title}
                    </p>
                    {overdue && (
                      <span className="flex items-center gap-1 font-body text-[10px] text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
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
                      <span className="flex items-center gap-1">
                        <User size={9} />
                        {m.owner}
                      </span>
                    )}
                  </div>
                  {m.notes && <p className="mt-1.5 font-body text-xs text-muted-foreground">{m.notes}</p>}
                </div>

                <span className={`shrink-0 inline-flex items-center rounded-full border px-2.5 py-0.5 font-body text-[11px] capitalize ${statusColors[m.status || "pending"] || statusColors.pending}`}>
                  {m.status || "pending"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
