import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarDays, CheckCircle2, Link2, Loader2, LogOut, Video, X, Plus, CircleDashed } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CALL_TITLES, type CallKind } from "@/content/planningCalls";

const db = supabase as any;

type Hours = Record<string, Array<[string, string]>>;

interface Host {
  user_id: string;
  display_name: string;
  weekly_hours: Hours;
  blocked_dates: string[];
  extra_busy_calendars: string[];
  google_account_email: string | null;
  zoom_account_email: string | null;
  open_to_couples: boolean;
  title: string;
}

interface Rules {
  call_minutes: number;
  buffer_minutes: number;
  min_notice_hours: number;
  max_days_ahead: number;
  cancel_notice_hours: number;
  default_host_user_id: string | null;
}

const DEFAULT_HOURS: Hours = {
  "1": [["10:00", "16:00"]], "2": [["10:00", "16:00"]], "3": [["10:00", "16:00"]],
  "4": [["10:00", "16:00"]], "5": [["10:00", "14:00"]],
};

const WEEKDAYS: Array<[string, string]> = [
  ["1", "Monday"], ["2", "Tuesday"], ["3", "Wednesday"], ["4", "Thursday"], ["5", "Friday"], ["6", "Saturday"], ["7", "Sunday"],
];

const ADMIN_ROLES = ["admin", "event_director"];
const DEFAULT = "__default";

const hostReady = (h?: Host | null) => !!h?.google_account_email && !!h?.zoom_account_email;

async function startConnect(provider: "google" | "zoom") {
  const { data, error } = await supabase.functions.invoke("scheduling-connect", {
    body: { provider, return_to: window.location.pathname, app_origin: window.location.origin },
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
    if (!confirm(`Disconnect your ${name}? Couples whose calls you host won't be able to book until you reconnect.`)) return;
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

function SectionTitle({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="font-body text-[10px] tracking-widest uppercase text-muted-foreground mb-1">{eyebrow}</p>
      <h3 className="font-display text-2xl font-light text-foreground">{title}</h3>
      {children && <p className="font-body text-sm text-muted-foreground mt-1">{children}</p>}
    </div>
  );
}

/* ── Your own calendar, Zoom, and hours (every staff member) ── */

function MySetup({ me, onSaved }: { me: Host | null; userId: string; onSaved: () => void }) {
  const { user, profile } = useAuth();
  const blank: Host = {
    user_id: user!.id,
    display_name: [profile?.first_name, profile?.last_name].filter(Boolean).join(" "),
    weekly_hours: DEFAULT_HOURS,
    blocked_dates: [],
    extra_busy_calendars: [],
    google_account_email: null,
    zoom_account_email: null,
    open_to_couples: false,
    title: "",
  };
  const [draft, setDraft] = useState<Host>(me ?? blank);
  const [saving, setSaving] = useState(false);
  const [newBlocked, setNewBlocked] = useState("");

  useEffect(() => { if (me) setDraft(me); }, [me]);

  const set = <K extends keyof Host>(k: K, v: Host[K]) => setDraft({ ...draft, [k]: v });
  const setDay = (d: string, range: [string, string] | null) => {
    const hours = { ...draft.weekly_hours };
    if (range) hours[d] = [range]; else delete hours[d];
    set("weekly_hours", hours);
  };

  const save = async () => {
    setSaving(true);
    const { error } = await db.from("call_hosts").upsert({
      user_id: draft.user_id,
      display_name: draft.display_name.trim(),
      weekly_hours: draft.weekly_hours,
      blocked_dates: draft.blocked_dates,
      extra_busy_calendars: draft.extra_busy_calendars,
      open_to_couples: draft.open_to_couples,
      title: draft.title.trim(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Your call hours are saved");
    onSaved();
  };

  return (
    <div>
      <SectionTitle eyebrow="Just for you" title="Your calendar & Zoom">
        Connect your own accounts. Couples whose calls you host see open times from your Google Calendar,
        and each call is created on your Zoom.
      </SectionTitle>

      <div className="rounded-xl border border-border bg-card p-5 divide-y divide-border">
        <ConnectionRow
          icon={CalendarDays}
          name="Google Calendar"
          detail="Your busy times block slots, and the couple's invite comes from you."
          email={me?.google_account_email ?? null}
          provider="google"
          onChanged={onSaved}
        />
        <ConnectionRow
          icon={Video}
          name="Zoom"
          detail="Sign in with your own Zoom login. Check the account shown before you approve."
          email={me?.zoom_account_email ?? null}
          provider="zoom"
          onChanged={onSaved}
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-5 mt-4 space-y-6">
        <label className="block">
          <span className="font-body text-xs text-muted-foreground">Your name as couples see it ("60 minutes on Zoom with …")</span>
          <Input value={draft.display_name} onChange={(e) => set("display_name", e.target.value)} className="mt-1 max-w-sm" />
        </label>

        <div className="rounded-lg border border-border p-4 space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <Switch checked={draft.open_to_couples} onCheckedChange={(on) => set("open_to_couples", on)} className="mt-0.5" />
            <span>
              <span className="font-body text-sm text-foreground block">Couples can book a call with me directly</span>
              <span className="font-body text-xs text-muted-foreground">
                Adds you under "Want to talk with the owners?" on every couple's Planning Calls page. Not billed.
                Leave off if you only host a wedding's planning calls.
              </span>
            </span>
          </label>
          {draft.open_to_couples && (
            <label className="block">
              <span className="font-body text-xs text-muted-foreground">Title shown next to your name (optional)</span>
              <Input value={draft.title} onChange={(e) => set("title", e.target.value)} placeholder="Owner" className="mt-1 max-w-xs" />
            </label>
          )}
        </div>

        <div>
          <p className="font-body text-sm text-foreground font-medium mb-3">When couples can book you (Eastern Time)</p>
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

        <div>
          <span className="font-body text-xs text-muted-foreground">Your days off (no calls, even if your calendar looks open)</span>
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
            Other calendars of yours that should block times (optional, comma separated, e.g. events@ or a personal calendar shared with you)
          </span>
          <Input
            value={draft.extra_busy_calendars.join(", ")}
            onChange={(e) => set("extra_busy_calendars", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
            placeholder="events@gilbertsvillefarmhouse.com"
            className="mt-1"
          />
        </label>

        <Button onClick={save} disabled={saving} className="gap-2">
          {saving && <Loader2 size={14} className="animate-spin" />} Save my hours
        </Button>
      </div>
    </div>
  );
}

/* ── Team: shared rules + who hosts each wedding (admins) ── */

function TeamSetup({ hosts }: { hosts: Host[] }) {
  const qc = useQueryClient();
  const [rules, setRules] = useState<Rules | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: saved } = useQuery({
    queryKey: ["call-scheduling-settings"],
    queryFn: async (): Promise<Rules> => {
      const { data, error } = await db.from("call_scheduling_settings").select("*").eq("id", 1).single();
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => { if (saved) setRules(saved); }, [saved]);

  const { data: weddings = [] } = useQuery({
    queryKey: ["call-host-weddings"],
    queryFn: async () => {
      const { data, error } = await db.from("events")
        .select("id, title, wedding_date, call_host_user_id")
        .gte("wedding_date", new Date().toISOString().slice(0, 10))
        .order("wedding_date");
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; title: string; wedding_date: string; call_host_user_id: string | null }>;
    },
  });

  if (!rules) return null;

  const byId = new Map(hosts.map((h) => [h.user_id, h]));
  const hostLabel = (h: Host) => `${h.display_name || "Unnamed"}${hostReady(h) ? "" : " (not connected)"}`;
  const defaultHost = rules.default_host_user_id ? byId.get(rules.default_host_user_id) : null;

  const saveRules = async () => {
    setSaving(true);
    const { error } = await db.from("call_scheduling_settings").update({
      call_minutes: rules.call_minutes,
      buffer_minutes: rules.buffer_minutes,
      min_notice_hours: rules.min_notice_hours,
      max_days_ahead: rules.max_days_ahead,
      cancel_notice_hours: rules.cancel_notice_hours,
      default_host_user_id: rules.default_host_user_id,
      updated_at: new Date().toISOString(),
    }).eq("id", 1);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Team call rules saved");
    qc.invalidateQueries({ queryKey: ["call-scheduling-settings"] });
  };

  const setWeddingHost = async (eventId: string, value: string) => {
    const { error } = await supabase.from("events")
      .update({ call_host_user_id: value === DEFAULT ? null : value } as any)
      .eq("id", eventId);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["call-host-weddings"] });
  };

  return (
    <div className="mt-10">
      <SectionTitle eyebrow="Admins" title="Who hosts each wedding's calls">
        Couples only see their host's open times. Weddings left on "Default" go to the default host.
      </SectionTitle>

      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-body text-sm text-foreground w-40">Default host</span>
          <Select
            value={rules.default_host_user_id ?? ""}
            onValueChange={(v) => setRules({ ...rules, default_host_user_id: v || null })}
          >
            <SelectTrigger className="w-72"><SelectValue placeholder="Choose a staff member" /></SelectTrigger>
            <SelectContent>
              {hosts.map((h) => <SelectItem key={h.user_id} value={h.user_id}>{hostLabel(h)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {hosts.length === 0 && (
          <p className="font-body text-xs text-muted-foreground">
            No one has connected yet. Staff show up here after they connect their calendar or Zoom above.
          </p>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-2">
          <NumberField label="Call length" value={rules.call_minutes} onChange={(n) => setRules({ ...rules, call_minutes: n })} suffix="minutes" />
          <NumberField label="Gap between calls" value={rules.buffer_minutes} onChange={(n) => setRules({ ...rules, buffer_minutes: n })} suffix="minutes" />
          <NumberField label="Minimum notice" value={rules.min_notice_hours} onChange={(n) => setRules({ ...rules, min_notice_hours: n })} suffix="hours" />
          <NumberField label="Book up to" value={rules.max_days_ahead} onChange={(n) => setRules({ ...rules, max_days_ahead: n })} suffix="days ahead" />
          <NumberField label="Couples can cancel until" value={rules.cancel_notice_hours} onChange={(n) => setRules({ ...rules, cancel_notice_hours: n })} suffix="hours before" />
        </div>

        <Button onClick={saveRules} disabled={saving} className="gap-2">
          {saving && <Loader2 size={14} className="animate-spin" />} Save team rules
        </Button>
      </div>

      {weddings.length > 0 && (
        <div className="rounded-xl border border-border bg-card divide-y divide-border mt-4">
          {weddings.map((w) => {
            const assigned = w.call_host_user_id ? byId.get(w.call_host_user_id) : null;
            const effective = assigned ?? defaultHost;
            return (
              <div key={w.id} className="flex items-center gap-3 px-4 py-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <p className="font-body text-sm text-foreground truncate">{w.title}</p>
                  <p className="font-body text-xs text-muted-foreground flex items-center gap-1.5">
                    {format(new Date(`${w.wedding_date}T12:00:00`), "MMM d, yyyy")}
                    {" · "}
                    {hostReady(effective) ? (
                      <><CheckCircle2 size={11} className="text-sage" /> booking on</>
                    ) : (
                      <><CircleDashed size={11} /> booking off until the host connects</>
                    )}
                  </p>
                </div>
                <Select value={w.call_host_user_id ?? DEFAULT} onValueChange={(v) => setWeddingHost(w.id, v)}>
                  <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DEFAULT}>Default{defaultHost ? ` (${defaultHost.display_name || "Unnamed"})` : ""}</SelectItem>
                    {hosts.map((h) => <SelectItem key={h.user_id} value={h.user_id}>{hostLabel(h)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Card ── */

export default function CallSchedulingCard() {
  const { user, profile } = useAuth();
  const isAdmin = ADMIN_ROLES.includes(profile?.role ?? "");

  const { data: hosts = [], refetch, isLoading } = useQuery({
    queryKey: ["call-hosts"],
    queryFn: async (): Promise<Host[]> => {
      const { data, error } = await db.from("call_hosts").select("*").order("display_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: upcoming = [] } = useQuery({
    queryKey: ["planning-calls-upcoming"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await db.from("planning_calls")
        .select("id, call_kind, starts_at, zoom_join_url, billable, couple_note, host_user_id, events(title)")
        .eq("status", "booked").gte("ends_at", new Date().toISOString()).order("starts_at").limit(25);
      if (error) throw error;
      return data ?? [];
    },
  });

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
  }, [refetch]);

  if (!user || isLoading) {
    return (
      <section className="mt-12">
        <div className="flex items-center gap-2 text-muted-foreground font-body text-sm"><Loader2 size={14} className="animate-spin" /> Loading call scheduling…</div>
      </section>
    );
  }

  const me = hosts.find((h) => h.user_id === user.id) ?? null;
  const nameOf = (id: string) => hosts.find((h) => h.user_id === id)?.display_name || "Staff";

  return (
    <section className="mt-12">
      <div className="mb-6">
        <p className="font-body text-[10px] tracking-widest uppercase text-muted-foreground mb-1">Integrations</p>
        <h2 className="font-display text-3xl font-light text-foreground">Planning call scheduling</h2>
        <p className="font-body text-sm text-muted-foreground mt-1">
          Couples book their post-booking, 90-day, and 30-day calls from Planning Calls in their portal,
          with the staff member who hosts their wedding.
        </p>
      </div>

      <MySetup me={me} userId={user.id} onSaved={refetch} />

      {isAdmin && <TeamSetup hosts={hosts} />}

      {isAdmin && (
        <div className="mt-10">
          <SectionTitle eyebrow="Admins" title="Upcoming planning calls" />
          {upcoming.length === 0 ? (
            <p className="font-body text-sm text-muted-foreground">None booked yet.</p>
          ) : (
            <div className="rounded-xl border border-border bg-card divide-y divide-border">
              {upcoming.map((c: any) => (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-sm text-foreground truncate">{c.events?.title ?? "Wedding"}</p>
                    <p className="font-body text-xs text-muted-foreground">
                      {CALL_TITLES[c.call_kind as CallKind]}{c.billable ? " · billable" : ""} · {format(new Date(c.starts_at), "EEE MMM d, h:mm a")} · with {nameOf(c.host_user_id)}
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
      )}
    </section>
  );
}
