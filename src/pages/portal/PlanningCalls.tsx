import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import {
  Video, CalendarClock, Check, Loader2, MessageCircle, Clock, ExternalLink, Plus, RotateCcw, X, Phone,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePortalData } from "@/hooks/usePortalData";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  INCLUDED_CALLS, EXTRA_CALL, CALL_TITLES, EXTRA_CALL_RATE, type CallKind, type CallType,
} from "@/content/planningCalls";

const db = supabase as any;

/** Calls an edge function and returns its own error text (not the generic "non-2xx" message). */
async function callFn<T = any>(name: string, body: Record<string, unknown>): Promise<{ data?: T; error?: string }> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let msg = error.message;
    try {
      const j = await (error as any).context?.json();
      if (j?.error) msg = j.error;
    } catch { /* keep generic message */ }
    return { error: msg };
  }
  if (data?.error) return { error: data.error };
  return { data };
}

interface PlanningCall {
  id: string;
  call_kind: CallKind;
  host_user_id: string;
  starts_at: string;
  ends_at: string;
  status: "booked" | "cancelled";
  zoom_join_url: string | null;
  zoom_passcode: string | null;
  couple_note: string | null;
}

/** Staff (Sharon, Victoria) couples can book directly, from list_open_call_hosts(). */
interface OpenHost {
  user_id: string;
  display_name: string;
  title: string;
  ready: boolean;
}

interface Availability {
  ready: boolean;
  reason?: string;
  status?: "open" | "not_open_yet" | "closed";
  window?: { opens: string | null; closes: string | null };
  slots: string[];
  timezone: string;
  call_minutes: number;
  host_name: string;
  cancel_notice_hours: number;
}

/* ── Time helpers: show times in the viewer's own zone ── */

const viewerTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

function tzName(tz: string, at = new Date()) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "long" })
    .formatToParts(at).find((p) => p.type === "timeZoneName")?.value ?? tz;
}

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const fmtDayLong = (iso: string) => new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
const localYmd = (iso: string) => format(new Date(iso), "yyyy-MM-dd");
const fmtYmd = (ymd: string) => format(parseISO(ymd), "MMMM d");

/* ── Booking sheet ── */

function BookingSheet({
  open, onOpenChange, eventId, callType, rescheduling, isStaff, onBooked,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  eventId: string;
  callType: CallType | null;
  rescheduling: PlanningCall | null;
  isStaff: boolean;
  onBooked: () => void;
}) {
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);

  const kind = rescheduling?.call_kind ?? callType?.kind ?? null;
  const hostUserId = kind === "direct" ? (rescheduling?.host_user_id ?? callType?.hostUserId ?? null) : null;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["call-availability", eventId, kind, hostUserId],
    enabled: open && !!kind,
    staleTime: 0,
    queryFn: async (): Promise<Availability> => {
      const { data, error } = await callFn<Availability>("scheduling-availability", { event_id: eventId, call_kind: kind, host_user_id: hostUserId });
      if (error) throw new Error(error);
      return data!;
    },
  });

  const byDay = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const s of data?.slots ?? []) {
      const d = localYmd(s);
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(s);
    }
    return map;
  }, [data?.slots]);
  const days = [...byDay.keys()];
  const activeDay = day && byDay.has(day) ? day : days[0] ?? null;

  const reset = () => { setDay(null); setSlot(null); setNote(""); setAgreed(false); };

  const confirm = async () => {
    if (!slot || !kind) return;
    setSaving(true);
    try {
      const { error: msg } = await callFn("scheduling-book", {
        event_id: eventId,
        call_kind: kind,
        starts_at: slot,
        note: note.trim() || undefined,
        reschedule_of: rescheduling?.id,
        host_user_id: hostUserId ?? undefined,
      });
      if (msg) {
        toast.error(msg);
        if (/taken/i.test(msg)) { setSlot(null); refetch(); }
        return;
      }
      toast.success(rescheduling ? "Your call has been moved. A new invite is on its way." : "You're booked. Your invite and Zoom link are on their way by email.");
      reset();
      onOpenChange(false);
      onBooked();
    } finally {
      setSaving(false);
    }
  };

  const isExtra = kind === "extra";
  const title = rescheduling ? `Move your ${CALL_TITLES[rescheduling.call_kind].toLowerCase()}` : callType?.title ?? "";

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-2xl font-light">{title}</SheetTitle>
          <SheetDescription className="font-body text-sm">
            {data ? `${data.call_minutes} minutes on Zoom with ${data.host_name}.` : "On Zoom with your coordinator."}{" "}
            Times are shown in {tzName(viewerTz)}.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {isStaff && (
            <p className="rounded-lg bg-gold/15 border border-gold/40 px-3 py-2 font-body text-xs text-foreground">
              Booking as staff. The couple's booking windows don't apply to you, and the invite goes to the couple.
            </p>
          )}

          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground font-body text-sm py-8">
              <Loader2 size={14} className="animate-spin" /> Checking the calendar…
            </div>
          )}

          {error && (
            <p className="font-body text-sm text-destructive">Couldn't load times: {(error as Error).message}</p>
          )}

          {data && !data.ready && (
            <EmptyNote>Online booking isn't switched on yet. Send us a message and we'll find a time together.</EmptyNote>
          )}

          {data?.ready && data.status === "not_open_yet" && data.window?.opens && (
            <EmptyNote>This call opens for booking on {fmtYmd(data.window.opens)}.</EmptyNote>
          )}

          {data?.ready && data.status === "closed" && (
            <EmptyNote>The booking window for this call has passed. Send us a message and we'll find a time.</EmptyNote>
          )}

          {data?.ready && data.status === "open" && days.length === 0 && (
            <EmptyNote>No open times right now. Send us a message and we'll make one work.</EmptyNote>
          )}

          {data?.ready && days.length > 0 && (
            <>
              <div>
                <p className="font-body text-[10px] tracking-widest uppercase text-muted-foreground mb-2">Pick a day</p>
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                  {days.map((d) => {
                    const on = d === activeDay;
                    const date = parseISO(d);
                    return (
                      <button
                        key={d}
                        onClick={() => { setDay(d); setSlot(null); }}
                        className={`shrink-0 w-16 rounded-lg border px-2 py-2 text-center transition-colors ${
                          on ? "border-sage bg-sage/10 text-foreground" : "border-border bg-card text-muted-foreground hover:border-sage/40"
                        }`}
                      >
                        <span className="block font-body text-[10px] uppercase tracking-wider">{format(date, "EEE")}</span>
                        <span className="block font-display text-xl font-light leading-tight">{format(date, "d")}</span>
                        <span className="block font-body text-[10px]">{format(date, "MMM")}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {activeDay && (
                <div>
                  <p className="font-body text-[10px] tracking-widest uppercase text-muted-foreground mb-2">
                    {format(parseISO(activeDay), "EEEE, MMMM d")}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {byDay.get(activeDay)!.map((s) => (
                      <button
                        key={s}
                        onClick={() => setSlot(s)}
                        className={`rounded-lg border px-2 py-2 font-body text-sm tabular-nums transition-colors ${
                          slot === s ? "border-sage bg-sage text-white" : "border-border bg-card text-foreground hover:border-sage/50"
                        }`}
                      >
                        {fmtTime(s)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {slot && (
                <div className="space-y-4 border-t border-border pt-5">
                  {!rescheduling && (
                    <div>
                      <label className="font-body text-sm text-foreground" htmlFor="call-note">
                        Anything you'd like to cover? <span className="text-muted-foreground">(optional)</span>
                      </label>
                      <Textarea
                        id="call-note"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        maxLength={1000}
                        rows={3}
                        className="mt-2 font-body text-sm"
                        placeholder="Timeline questions, a vendor you're deciding on, rain plan…"
                      />
                    </div>
                  )}

                  {isExtra && !rescheduling && (
                    <label className="flex items-start gap-3 cursor-pointer">
                      <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} className="mt-0.5" />
                      <span className="font-body text-sm text-muted-foreground leading-relaxed">
                        I understand additional calls are billed at {EXTRA_CALL_RATE}.
                      </span>
                    </label>
                  )}

                  <Button
                    className="w-full gap-2"
                    disabled={saving || (isExtra && !rescheduling && !agreed)}
                    onClick={confirm}
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    {rescheduling ? "Move my call to" : "Book"} {fmtDayLong(slot)} at {fmtTime(slot)}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-5">
      <p className="font-body text-sm text-muted-foreground leading-relaxed">{children}</p>
      <Link to="/portal/messages" className="inline-flex mt-3">
        <Button variant="outline" size="sm" className="gap-2">
          <MessageCircle size={14} /> Message us
        </Button>
      </Link>
    </div>
  );
}

/* ── A booked call ── */

function BookedCall({
  call, onReschedule, onCancel,
}: { call: PlanningCall; onReschedule: () => void; onCancel: () => void }) {
  const past = new Date(call.ends_at).getTime() < Date.now();
  const soon = new Date(call.starts_at).getTime() - Date.now() < 30 * 60_000;
  return (
    <div className="mt-4 rounded-lg bg-sage/10 border border-sage/25 p-4">
      <div className="flex items-start gap-3">
        {past ? <Check size={16} className="text-sage mt-0.5 shrink-0" /> : <CalendarClock size={16} className="text-sage mt-0.5 shrink-0" />}
        <div className="min-w-0">
          <p className="font-body text-sm text-foreground font-medium">
            {fmtDayLong(call.starts_at)} at {fmtTime(call.starts_at)}
          </p>
          <p className="font-body text-xs text-muted-foreground mt-0.5">
            {past ? "Done." : `${tzName(viewerTz)}. The invite is in your email.`}
          </p>
        </div>
      </div>
      {!past && (
        <div className="flex flex-wrap gap-2 mt-3">
          {call.zoom_join_url && (
            <a href={call.zoom_join_url} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant={soon ? "default" : "outline"} className="gap-2">
                <Video size={14} /> Join Zoom <ExternalLink size={12} />
              </Button>
            </a>
          )}
          <Button size="sm" variant="ghost" className="gap-2 text-muted-foreground" onClick={onReschedule}>
            <RotateCcw size={14} /> Reschedule
          </Button>
          <Button size="sm" variant="ghost" className="gap-2 text-muted-foreground" onClick={onCancel}>
            <X size={14} /> Cancel
          </Button>
        </div>
      )}
      {!past && call.zoom_passcode && (
        <p className="font-body text-xs text-muted-foreground mt-2">Zoom passcode: <span className="tabular-nums">{call.zoom_passcode}</span></p>
      )}
    </div>
  );
}

/* ── Page ── */

export default function PlanningCalls() {
  const { eventId, event, isPreviewMode } = usePortalData();
  const qc = useQueryClient();
  const [sheetType, setSheetType] = useState<CallType | null>(null);
  const [rescheduling, setRescheduling] = useState<PlanningCall | null>(null);
  const [cancelling, setCancelling] = useState<PlanningCall | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);

  const { data: calls = [], isLoading } = useQuery({
    queryKey: ["planning-calls", eventId],
    enabled: !!eventId,
    queryFn: async (): Promise<PlanningCall[]> => {
      const { data, error } = await db.from("planning_calls")
        .select("id, call_kind, host_user_id, starts_at, ends_at, status, zoom_join_url, zoom_passcode, couple_note")
        .eq("event_id", eventId).eq("status", "booked").order("starts_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["planning-calls", eventId] });
  const byKind = (k: CallKind) => calls.filter((c) => c.call_kind === k);
  const extras = byKind("extra");
  const directs = byKind("direct");

  const { data: openHosts = [] } = useQuery({
    queryKey: ["open-call-hosts"],
    queryFn: async (): Promise<OpenHost[]> => {
      const { data, error } = await db.rpc("list_open_call_hosts");
      if (error) throw error;
      return data ?? [];
    },
  });
  const bookableHosts = openHosts.filter((h) => h.ready);
  const directType = (h: OpenHost): CallType => ({
    kind: "direct",
    title: `Call with ${h.display_name}`,
    blurb: "",
    included: false,
    hostUserId: h.user_id,
  });

  const windowText = (kind: CallKind) => {
    const w = event?.wedding_date;
    if (!w) return null;
    const d = (n: number) => format(new Date(parseISO(w).getTime() - n * 86_400_000), "MMMM d");
    if (kind === "post_booking") return `Book any time before ${d(105)}.`;
    if (kind === "ninety_day") return `Opens ${d(104)}, book by ${d(76)}.`;
    if (kind === "thirty_day") return `Opens ${d(37)}, book by ${d(23)}.`;
    return null;
  };

  const doCancel = async () => {
    if (!cancelling) return;
    setCancelBusy(true);
    const { error: msg } = await callFn("scheduling-cancel", { call_id: cancelling.id });
    setCancelBusy(false);
    if (msg) { toast.error(msg); return; }
    toast.success("Call cancelled. We've let your coordinator know.");
    setCancelling(null);
    refresh();
  };

  return (
    <div className="max-w-5xl mx-auto px-5 py-8 lg:px-8 lg:py-10 pb-32">
      <div className="animate-fade-up">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Video size={16} className="text-sage" strokeWidth={1.75} />
            <p className="font-body text-xs tracking-widest uppercase text-muted-foreground">Talk it through</p>
          </div>
          <h1 className="font-display text-4xl font-light text-foreground mb-4">Planning Calls</h1>
          <p className="font-body text-base text-muted-foreground leading-relaxed max-w-2xl">
            Your Weekend Event Coordination includes three planning calls on Zoom. Pick a time that suits you,
            and the invite with your Zoom link arrives by email from your coordinator.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground font-body text-sm">
            <Loader2 size={14} className="animate-spin" /> Loading your calls…
          </div>
        ) : (
          <>
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {INCLUDED_CALLS.map((t, i) => {
                const booked = byKind(t.kind)[0];
                return (
                  <div key={t.kind} className="rounded-xl border border-border bg-card p-5 flex flex-col">
                    <p className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">Included · {i + 1} of 3</p>
                    <h2 className="font-display text-xl font-light text-foreground mt-1">{t.title}</h2>
                    <p className="font-body text-sm text-muted-foreground leading-relaxed mt-2">{t.blurb}</p>
                    {booked ? (
                      <BookedCall
                        call={booked}
                        onReschedule={() => setRescheduling(booked)}
                        onCancel={() => setCancelling(booked)}
                      />
                    ) : (
                      <div className="mt-auto pt-4">
                        {windowText(t.kind) && (
                          <p className="font-body text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
                            <Clock size={12} /> {windowText(t.kind)}
                          </p>
                        )}
                        <Button className="w-full gap-2" onClick={() => setSheetType(t)}>
                          <CalendarClock size={14} /> Pick a time
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </section>

            <section className="rounded-xl border border-border bg-card p-5 md:p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h2 className="font-display text-xl font-light text-foreground">Need another call?</h2>
                  <p className="font-body text-sm text-muted-foreground leading-relaxed mt-1 max-w-xl">
                    {EXTRA_CALL.blurb} Additional calls are billed at {EXTRA_CALL_RATE}.
                  </p>
                </div>
                <Button variant="outline" className="gap-2 shrink-0" onClick={() => setSheetType(EXTRA_CALL)}>
                  <Plus size={14} /> Book an additional call
                </Button>
              </div>
              {extras.map((c) => (
                <BookedCall key={c.id} call={c} onReschedule={() => setRescheduling(c)} onCancel={() => setCancelling(c)} />
              ))}
            </section>

            {bookableHosts.length > 0 && (
              <section className="rounded-xl border border-border bg-card p-5 md:p-6 mt-4">
                <h2 className="font-display text-xl font-light text-foreground">Want to talk with the owners?</h2>
                <p className="font-body text-sm text-muted-foreground leading-relaxed mt-1 max-w-xl">
                  Your coordinator handles your planning calls. If there's something you'd like to talk through
                  with {bookableHosts.map((h) => h.display_name.split(" ")[0]).join(" or ")} directly, pick a time here.
                </p>
                <div className="flex flex-wrap gap-2 mt-4">
                  {bookableHosts.map((h) => (
                    <Button key={h.user_id} variant="outline" className="gap-2" onClick={() => setSheetType(directType(h))}>
                      <Phone size={14} /> {h.display_name}{h.title ? ` · ${h.title}` : ""}
                    </Button>
                  ))}
                </div>
                {directs.map((c) => (
                  <div key={c.id}>
                    <p className="font-body text-xs text-muted-foreground mt-4">
                      With {openHosts.find((h) => h.user_id === c.host_user_id)?.display_name ?? "the owners"}
                    </p>
                    <BookedCall call={c} onReschedule={() => setRescheduling(c)} onCancel={() => setCancelling(c)} />
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </div>

      {eventId && (
        <BookingSheet
          open={!!sheetType || !!rescheduling}
          onOpenChange={(v) => { if (!v) { setSheetType(null); setRescheduling(null); } }}
          eventId={eventId}
          callType={sheetType}
          rescheduling={rescheduling}
          isStaff={isPreviewMode}
          onBooked={refresh}
        />
      )}

      <AlertDialog open={!!cancelling} onOpenChange={(v) => { if (!v) setCancelling(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display font-light">Cancel this call?</AlertDialogTitle>
            <AlertDialogDescription className="font-body">
              {cancelling && `${CALL_TITLES[cancelling.call_kind]} on ${fmtDayLong(cancelling.starts_at)} at ${fmtTime(cancelling.starts_at)}. `}
              The Zoom meeting is removed and everyone on the invite gets a cancellation email. You can book a new time whenever you're ready.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-body">Keep it</AlertDialogCancel>
            <AlertDialogAction className="font-body" disabled={cancelBusy} onClick={(e) => { e.preventDefault(); doCancel(); }}>
              {cancelBusy ? "Cancelling…" : "Cancel call"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
