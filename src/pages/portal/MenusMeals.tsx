import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePortalData } from "@/hooks/usePortalData";
import { SectionTabs } from "@/components/portal/SectionTabs";
import { MealPrefs } from "./details/MealPrefs";
import { Headcounts } from "./people/Headcounts";
import { DietaryRestrictions } from "./details/DietaryRestrictions";
import { BarSelections } from "./details/BarSelections";
import { Check, Loader2, Lock, Unlock, ExternalLink } from "lucide-react";

const MENU_BUILDER_URL = "https://menu.gilbertsvillefarmhouse.com";
import MenuSelectionsDisplay from "@/components/menu/MenuSelectionsDisplay";

type ApprovalStatus = "not_started" | "submitted" | "under_review" | "approved" | "declined";
const STATUS_BANNER: Record<ApprovalStatus, { label: string; tone: string }> = {
  not_started: { label: "Not submitted yet", tone: "bg-muted text-muted-foreground border-border" },
  submitted: { label: "Submitted, your team is reviewing", tone: "bg-sage/10 text-sage border-sage/30" },
  under_review: { label: "Your team is reviewing your menu", tone: "bg-amber-50 text-amber-800 border-amber-300" },
  approved: { label: "Approved", tone: "bg-primary/10 text-primary border-primary/30" },
  declined: { label: "Your team has notes, check messages", tone: "bg-red-50 text-red-800 border-red-300" },
};

const TABS = [
  { id: "meals", label: "Meal Preferences" },
  { id: "headcounts", label: "Headcounts" },
  { id: "dietary", label: "Dietary & Kids" },
  { id: "bar", label: "Bar" },
];

function formatStamp(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "long", day: "numeric", year: "numeric",
    });
  } catch { return ""; }
}

export default function MenusMeals() {
  const [tab, setTab] = useState("meals");
  const navigate = useNavigate();
  const { eventId } = usePortalData();

  const [finalized, setFinalized] = useState(false);
  const [finalizedAt, setFinalizedAt] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const rowIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("menu_finalization")
        .select("id, finalized, finalized_at")
        .eq("event_id", eventId)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        rowIdRef.current = data.id;
        setFinalized(!!data.finalized);
        setFinalizedAt(data.finalized_at ?? null);
      }
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [eventId]);

  async function toggle(next: boolean) {
    if (!eventId || saving) return;
    setSaving(true);
    const nowIso = next ? new Date().toISOString() : null;
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes?.user?.id ?? null;
    // optimistic
    setFinalized(next);
    setFinalizedAt(nowIso);
    const payload = {
      event_id: eventId,
      finalized: next,
      finalized_at: nowIso,
      finalized_by: next ? uid : null,
    };
    const { data, error } = await supabase
      .from("menu_finalization")
      .upsert(payload, { onConflict: "event_id" })
      .select("id, finalized, finalized_at")
      .maybeSingle();
    if (!error && data) {
      rowIdRef.current = data.id;
      setFinalized(!!data.finalized);
      setFinalizedAt(data.finalized_at ?? null);
    }
    setSaving(false);
  }

  return (
    <div className="max-w-5xl mx-auto px-5 py-8 lg:px-8 lg:py-10 pb-32">
      <div className="animate-fade-up">
        <p className="font-body text-xs tracking-widest uppercase text-muted-foreground mb-2">
          Food & drink
        </p>
        <h1 className="font-display text-4xl font-light text-foreground mb-6">Menus & Meals</h1>

        {loaded && (
          <div className="mb-8 rounded-xl border border-border bg-white p-5 lg:p-6">
            {finalized ? (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Check size={16} />
                  </div>
                  <div>
                    <p className="font-display text-lg text-foreground">Menus finalized</p>
                    <p className="font-body text-sm text-muted-foreground">
                      Marked complete{finalizedAt ? ` on ${formatStamp(finalizedAt)}` : ""}. You can reopen this anytime if something needs to change.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggle(false)}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 font-body text-sm text-foreground transition-colors hover:bg-muted/40 disabled:opacity-60"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Unlock size={14} />}
                  Reopen
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-display text-lg text-foreground">Ready to wrap up your menu?</p>
                  <p className="font-body text-sm text-muted-foreground">
                    When meals, headcounts, dietary needs, and bar choices feel right, mark this area finalized. You can reopen it later if anything changes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggle(true)}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-body text-sm text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                  Finalize menus
                </button>
              </div>
            )}
          </div>
        )}

        {eventId && <MenuSelectionsPanel eventId={eventId} />}

        <SectionTabs tabs={TABS} active={tab} onChange={setTab} />

        {tab === "meals" && <MealPrefs />}
        {tab === "headcounts" && <Headcounts />}
        {tab === "dietary" && <DietaryRestrictions />}
        {tab === "bar" && <BarSelections />}
      </div>
    </div>
  );
}

function MenuSelectionsPanel({ eventId }: { eventId: string }) {
  const [status, setStatus] = useState<ApprovalStatus>("not_started");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("menu_approvals")
        .select("status")
        .eq("event_id", eventId)
        .maybeSingle();
      if (cancelled) return;
      if (data?.status) setStatus(data.status as ApprovalStatus);
    })();
    return () => { cancelled = true; };
  }, [eventId]);

  const banner = STATUS_BANNER[status];

  return (
    <div className="mb-8 rounded-xl border border-border bg-white p-5 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <p className="font-display text-lg text-foreground">Your menu selections</p>
        <span className={`inline-flex items-center rounded-full border px-3 py-1 font-body text-xs ${banner.tone}`}>
          {banner.label}
        </span>
      </div>
      <MenuSelectionsDisplay eventId={eventId} />
    </div>
  );
}
