import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarDays, CheckCircle2, Link2, Loader2, LogOut, Video, X, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { CALL_TITLES, type CallKind } from "@/content/planningCalls";

const db = supabase as any;

type Hours = Record<string, Array<[string, string]>>;

interface Settings {
  host_name: string;
  timezone: string;
  weekly_hours: Hours;
  call_minutes: number;
  buffer_minutes: number;
  min_notice_hours: number;
  max_days_ahead: number;
  cancel_notice_hours: number;
  blocked_dates: string[];
  extra_busy_calendars: string[];
  google_account_email: string | null;
  zoom_account_email: string | null;
}

const WEEKDAYS: Array<[string, string]> = [
  ["1", "Monday"], ["2", "Tuesday"], ["3", "Wednesday"], ["4", "Thursday"], ["5", "Friday"], ["6", "Saturday"], ["7", "Sunday"],
];

async function startConnect(provider: "google" | "zoom") {
  const { data, error } = await supabase.functions.invoke("scheduling-connect", {
    body: { provider, return_to: `${window.location.pathname}`, app_origin: window.location.origin },
  });
  if (error || !data?.url) throw new Error(data?.error ?? error?.message ?? "Could not start connection");
  const top = window.top ?? window;
  try {
    top.location.href = data.url;
  } catch {
    window.open(data.url, "_blank", "noopener,noreferrer");
  }
}

function ConnectionRow({
  icon: Icon, name, detail, email, provider, onChanged,
}: {
  icon: React.ElementType; name: string; detail: string; email: string | null; provider: "google" | "zoom"; onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const connect = async () => {
    setBusy(true);
    try { await startConnect(provider); } catch (e: any) { toast.error(e.message); setBusy(false); }
  };
  const disconnect = async () => {
    if (!confirm(`Disconnect ${name}? Couples won't be able to book calls until it's reconnected.`)) return;
    setBusy(true);
    await supabase.functions.invoke("scheduling-connect", { body: { provider, action: "disconnect" } });
    setBusy(false);
    onChanged();
  };
  return (
    <div className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
      <div className="w-10 h-10 rounded-full bg-sage/15 border border-sage/25 flex items-center justify-center shrink-0">
        <Icon size={16} className="text-sage" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-body text-sm text-foreground font-medium">{name}</p>
        {email ? (
          <p className="font-body text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
            <CheckCircle2 size={12} className="text-sage" /> Connected as {email}
          </p>
        ) : (
          <p className="font-body text-xs text-muted-foreground mt-0.5">{detail}</p>
        )}
      </div>
      <div className="shrink-0">
        {email ? (
          <Button size="sm" variant="outline" className="gap-2 text-muted-foreground" onClick={disconnect} disabled={busy}>
            <LogOut size={12} /> Disconnect
          </Button>
        ) : (
          <Button size="sm" className="gap-2" onClick={connect} disabled={busy}>
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />} Connect
          </Button>
        )}
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange, suffix }: { label: string; value: number; onChange: (n: number) => void; suffix: string }) {
  return (
    <label className="block">
      <span className="font-body text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2 mt-1">
        <Input type="number" min={0} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-24" />
        <span className="font-body text-xs text-muted-foreground">{suffix}</span>
      </div>
    </label>
  );
}

export default function CallSchedulingCard() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [newBlocked, setNewBlocked] = useState("");

  const { data: settings, refetch } = useQuery({
    queryKey: ["call-scheduling-settings"],
    queryFn: async (): Promise<Settings> => {
      const { data, error } = await db.from("call_scheduling_settings").select("*").eq("id", 1).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: upcoming = [] } = useQuery({
    queryKey: ["planning-calls-upcoming"],
    queryFn: async () => {
      const { data, error } = await db.from("planning_calls")
        .select("id, call_kind, starts_at, zoom_join_url, billable, couple_note, events(title)")
        .eq("status", "booked").gte("ends_at", new Date().toISOString()).order("starts_at").limit(25);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => { if (settings) setDraft(settings); }, [settings]);

  // Back from Google / Zoom
  useEffect(() => {
    const url = new URL(window.location.href);
    const status = url.searchParams.get("scheduling");
    if (!status) return;
    const provider = url.searchParams.get("provider") === "zoom" ? "Zoom" : "Google Calendar";
    if (status === "connected") toast.success(`${provider} connected as ${url.searchParams.get("email")}`);
    else toast.error(`${provider} connection failed: ${url.searchParams.get("reason") ?? "unknown"}`);
    ["scheduling", "provider", "email", "reason"].forEach((k) => url.searchParams.delete(k));
    window.history.replaceState({}, "", url.toString());
    refetch();
  }, []);

  if (!draft) {
    return (
      <section className="mt-12">
        <div className="flex items-center gap-2 text-muted-foreground font-body text-sm"><Loader2 size={14} className="animate-spin" /> Loading call scheduling…</div>
      </section>
    );
  }

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setDraft({ ...draft, [k]: v });
  const setDay = (d: string, range: [string, string] | null) => {
    const hours = { ...draft.weekly_hours };
    if (range) hours[d] = [range]; else delete hours[d];
    set("weekly_hours", hours);
  };

  const save = async () => {
    setSaving(true);
    const { error } = await db.from("call_scheduling_settings").update({
      host_name: draft.host_name.trim() || "your Weekend Event Coordinator",
      weekly_hours: draft.weekly_hours,
      call_minutes: draft.call_minutes,
      buffer_minutes: draft.buffer_minutes,
      min_notice_hours: draft.min_notice_hours,
      max_days_ahead: draft.max_days_ahead,
      cancel_notice_hours: draft.cancel_notice_hours,
      blocked_dates: draft.blocked_dates,
      extra_busy_calendars: draft.extra_busy_calendars,
      updated_at: new Date().toISOString(),
    }).eq("id", 1);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Call scheduling saved");
    qc.invalidateQueries({ queryKey: ["call-scheduling-settings"] });
  };

  const ready = !!settings?.google_account_email && !!settings?.zoom_account_email;

  return (
    <section className="mt-12">
      <div className="mb-6">
        <p className="font-body text-[10px] tracking-widest uppercase text-muted-foreground mb-1">Integrations</p>
        <h2 className="font-display text-3xl font-light text-foreground">Planning call scheduling</h2>
        <p className="font-body text-sm text-muted-foreground mt-1">
          Couples book their post-booking, 90-day, and 30-day calls from Planning Calls in their portal.
          Open times come from the events@ calendar. Each booking creates a Zoom meeting and a calendar invite.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 divide-y divide-border">
        <ConnectionRow
          icon={CalendarDays}
          name="Google Calendar"
          detail="Sign in as events@gilbertsvillefarmhouse.com. Busy times there block slots, and invites send from it."
          email={settings?.google_account_email ?? null}
          provider="google"
          onChanged={refetch}
        />
        <ConnectionRow
          icon={Video}
          name="Zoom"
          detail="Sign in with the coordinator's Zoom account. Meetings are created on it."
          email={settings?.zoom_account_email ?? null}
          provider="zoom"
          onChanged={refetch}
        />
      </div>
      {!ready && (
        <p className="font-body text-xs text-muted-foreground mt-2">
          Until both are connected, couples see "Message us to find a time" instead of open slots.
        </p>
      )}

      <div className="rounded-xl border border-border bg-card p-5 mt-4 space-y-6">
        <div>
          <p className="font-body text-sm text-foreground font-medium mb-3">When couples can book (Eastern Time)</p>
          <div className="space-y-2">
            {WEEKDAYS.map(([d, name]) => {
              const range = draft.weekly_hours[d]?.[0] ?? null;
              return (
                <div key={d} className="flex items-center gap-3 flex-wrap">
                  <Switch checked={!!range} onCheckedChange={(on) => setDay(d, on ? ["10:00", "16:00"] : null)} />
                  <span className="font-body text-sm w-24">{name}</span>
                  {range ? (
                    <div className="flex items-center gap-2">
                      <Input type="time" step={1800} value={range[0]} onChange={(e) => setDay(d, [e.target.value, range[1]])} className="w-32" />
                      <span className="font-body text-xs text-muted-foreground">to</span>
                      <Input type="time" step={1800} value={range[1]} onChange={(e) => setDay(d, [range[0], e.target.value])} className="w-32" />
                    </div>
                  ) : (
                    <span className="font-body text-xs text-muted-foreground">Not available</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <NumberField label="Call length" value={draft.call_minutes} onChange={(n) => set("call_minutes", n)} suffix="minutes" />
          <NumberField label="Gap between calls" value={draft.buffer_minutes} onChange={(n) => set("buffer_minutes", n)} suffix="minutes" />
          <NumberField label="Minimum notice" value={draft.min_notice_hours} onChange={(n) => set("min_notice_hours", n)} suffix="hours" />
          <NumberField label="Book up to" value={draft.max_days_ahead} onChange={(n) => set("max_days_ahead", n)} suffix="days ahead" />
          <NumberField label="Couples can cancel until" value={draft.cancel_notice_hours} onChange={(n) => set("cancel_notice_hours", n)} suffix="hours before" />
        </div>

        <label className="block">
          <span className="font-body text-xs text-muted-foreground">Host name couples see ("45 minutes on Zoom with …")</span>
          <Input value={draft.host_name} onChange={(e) => set("host_name", e.target.value)} className="mt-1 max-w-sm" />
        </label>

        <div>
          <span className="font-body text-xs text-muted-foreground">Days off (no calls, even if the calendar is open)</span>
          <div className="flex flex-wrap gap-2 mt-2">
            {draft.blocked_dates.map((d) => (
              <span key={d} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 font-body text-xs">
                {format(new Date(`${d}T12:00:00`), "MMM d, yyyy")}
                <button onClick={() => set("blocked_dates", draft.blocked_dates.filter((x) => x !== d))} aria-label={`Remove ${d}`}>
                  <X size={12} className="text-muted-foreground hover:text-foreground" />
                </button>
              </span>
            ))}
            <div className="flex items-center gap-2">
              <Input type="date" value={newBlocked} onChange={(e) => setNewBlocked(e.target.value)} className="w-40 h-8" />
              <Button size="sm" variant="outline" className="h-8 gap-1" disabled={!newBlocked} onClick={() => {
                if (!draft.blocked_dates.includes(newBlocked)) set("blocked_dates", [...draft.blocked_dates, newBlocked].sort());
                setNewBlocked("");
              }}>
                <Plus size={12} /> Add
              </Button>
            </div>
          </div>
        </div>

        <label className="block">
          <span className="font-body text-xs text-muted-foreground">
            Other calendars that should block times (optional, comma separated). Share them with events@ first, e.g. the coordinator's own calendar.
          </span>
          <Input
            value={draft.extra_busy_calendars.join(", ")}
            onChange={(e) => set("extra_busy_calendars", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
            placeholder="melissa@gilbertsvillefarmhouse.com"
            className="mt-1"
          />
        </label>

        <Button onClick={save} disabled={saving} className="gap-2">
          {saving && <Loader2 size={14} className="animate-spin" />} Save
        </Button>
      </div>

      <div className="mt-6">
        <p className="font-body text-sm text-foreground font-medium mb-2">Upcoming planning calls</p>
        {upcoming.length === 0 ? (
          <p className="font-body text-sm text-muted-foreground">None booked yet.</p>
        ) : (
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {upcoming.map((c: any) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-body text-sm text-foreground truncate">{c.events?.title ?? "Wedding"}</p>
                  <p className="font-body text-xs text-muted-foreground">
                    {CALL_TITLES[c.call_kind as CallKind]}{c.billable ? " · billable" : ""} · {format(new Date(c.starts_at), "EEE MMM d, h:mm a")}
                  </p>
                  {c.couple_note && <p className="font-body text-xs text-muted-foreground mt-1 italic line-clamp-2">"{c.couple_note}"</p>}
                </div>
                {c.zoom_join_url && (
                  <a href={c.zoom_join_url} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="gap-1.5"><Video size={12} /> Zoom</Button>
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
