import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Send, CheckCircle2, Lock, Sparkles, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Stage = "sales_setup" | "handed_off" | "in_setup" | "portal_open";

interface HandoffRow {
  lifecycle_stage: Stage | null;
  handed_off_at: string | null;
  portal_opened_at: string | null;
  pending_partner1_email: string | null;
  pending_partner2_email: string | null;
  pending_partner1_name: string | null;
  pending_partner2_name: string | null;
  title: string;
}

const STAGE_STYLES: Record<Stage, { label: string; bg: string; border: string; dot: string; text: string }> = {
  sales_setup: { label: "Sales Setup", bg: "bg-amber-50", border: "border-amber-200", dot: "bg-amber-500", text: "text-amber-900" },
  handed_off:  { label: "Handed Off", bg: "bg-sage/10", border: "border-sage/30", dot: "bg-sage", text: "text-sage-dark" },
  in_setup:    { label: "In Setup", bg: "bg-sage/10", border: "border-sage/30", dot: "bg-sage", text: "text-sage-dark" },
  portal_open: { label: "Portal Open", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500", text: "text-emerald-900" },
};

export function LifecycleBadge({ stage }: { stage: Stage | null }) {
  const s = STAGE_STYLES[stage ?? "sales_setup"];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 border ${s.bg} ${s.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      <span className={`font-body text-[11px] tracking-wide ${s.text}`}>{s.label}</span>
    </span>
  );
}

export default function HandoffPanel({ eventId }: { eventId: string }) {
  const { profile } = useAuth();
  const role = profile?.role ?? "";
  const isAdmin = role === "admin";
  const isDirector = role === "event_director";
  const isSales = role === "sales_manager";

  const [row, setRow] = useState<HandoffRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<null | "handoff" | "open">(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("events")
      .select("title,lifecycle_stage,handed_off_at,portal_opened_at,pending_partner1_email,pending_partner2_email,pending_partner1_name,pending_partner2_name")
      .eq("id", eventId)
      .single();
    setRow(data as any);
    setLoading(false);
  };
  useEffect(() => { void load(); }, [eventId]);

  if (loading || !row) {
    return <div className="rounded-2xl bg-cream/50 border border-sage/20 p-5 text-muted-foreground font-body text-sm">Loading lifecycle…</div>;
  }

  const stage = (row.lifecycle_stage ?? "sales_setup") as Stage;
  const canHandoff = isAdmin || isSales || isDirector;
  const canOpenPortal = isAdmin || isDirector;
  const portalOpen = stage === "portal_open";

  const doHandoff = async () => {
    setBusy("handoff");
    try {
      const { data, error } = await supabase.functions.invoke("mark-event-handoff", { body: { event_id: eventId } });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      const sent = (data as any)?.emailDelivery?.sent ?? 0;
      toast({ title: "Handoff sent", description: `Brandon and the team have been notified (${sent} email${sent === 1 ? "" : "s"} delivered).` });
      await load();
    } catch (e: any) {
      toast({ title: "Couldn't send handoff", description: e?.message ?? "Try again.", variant: "destructive" });
    } finally { setBusy(null); }
  };

  const doOpenPortal = async () => {
    setBusy("open");
    try {
      const { data, error } = await supabase.functions.invoke("open-client-portal", { body: { event_id: eventId } });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      toast({ title: "Portal opened", description: "The couple has been invited and will receive their welcome email shortly." });
      setConfirmOpen(false);
      await load();
    } catch (e: any) {
      toast({ title: "Couldn't open the portal", description: e?.message ?? "Try again.", variant: "destructive" });
    } finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="rounded-2xl bg-white border border-sage/30 p-5 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="font-display text-lg font-light text-foreground">Onboarding Pipeline</p>
              <LifecycleBadge stage={stage} />
            </div>
            <p className="font-body text-xs text-muted-foreground">
              {stage === "sales_setup" && "Sales is preparing this client. The couple has not been invited yet."}
              {stage === "handed_off" && "Handed to the event director. Configure the wedding, then open the portal."}
              {stage === "in_setup" && "Assigned and being configured. The couple still has no access."}
              {stage === "portal_open" && "The couple has been invited and can access their portal."}
            </p>
          </div>
        </div>

        {/* Banner during pre-portal stages */}
        {!portalOpen && (
          <div className="rounded-lg bg-cream border border-sage/20 p-3 flex items-start gap-2.5">
            <Lock size={14} className="text-sage mt-0.5 shrink-0" />
            <div>
              <p className="font-body text-sm text-foreground">The couple does not have portal access yet.</p>
              <p className="font-body text-xs text-muted-foreground mt-0.5">
                Finish setup, then click <span className="font-medium text-foreground">Open Portal for Client</span> to invite them in.
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-1">
          {canHandoff && stage !== "portal_open" && (
            <button
              onClick={doHandoff}
              disabled={busy === "handoff"}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-body text-sm transition-colors ${
                stage === "sales_setup"
                  ? "bg-sage text-white hover:bg-sage-dark"
                  : "bg-cream border border-sage/30 text-foreground hover:bg-sage/10"
              } disabled:opacity-60`}
            >
              {busy === "handoff" ? <Loader2 size={14} className="animate-spin" /> : stage === "sales_setup" ? <Send size={14} /> : <CheckCircle2 size={14} className="text-sage" />}
              {stage === "sales_setup" ? "Ready to Hand Off" : "Handed Off ✓ — Notify Again"}
            </button>
          )}

          {canOpenPortal && stage !== "sales_setup" && !portalOpen && (
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={busy === "open"}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sage text-white font-body text-sm hover:bg-sage-dark transition-colors disabled:opacity-60"
            >
              <Sparkles size={14} />
              Open Portal for Client
            </button>
          )}

          {portalOpen && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 font-body text-xs text-emerald-900">
              <CheckCircle2 size={13} />
              Portal opened {row.portal_opened_at ? `on ${new Date(row.portal_opened_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
            </div>
          )}
        </div>
      </div>

      {/* Confirm dialog */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={() => !busy && setConfirmOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-card border border-sage/30 shadow-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-sage/15 flex items-center justify-center shrink-0"><AlertCircle size={16} className="text-sage" /></div>
              <div>
                <p className="font-display text-lg font-light text-foreground">Invite the couple now?</p>
                <p className="font-body text-sm text-muted-foreground mt-1">
                  This will invite{" "}
                  <span className="text-foreground">{row.pending_partner1_email ?? "Partner 1"}</span>{" "}and{" "}
                  <span className="text-foreground">{row.pending_partner2_email ?? "Partner 2"}</span>{" "}
                  to their planning portal. They'll get an email to set up access.
                </p>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setConfirmOpen(false)} disabled={busy === "open"} className="flex-1 py-2.5 rounded-lg border border-border font-body text-sm text-muted-foreground hover:text-foreground">Not yet</button>
              <button onClick={doOpenPortal} disabled={busy === "open"} className="flex-1 py-2.5 rounded-lg bg-sage text-white font-body text-sm hover:bg-sage-dark inline-flex items-center justify-center gap-2 disabled:opacity-60">
                {busy === "open" ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
