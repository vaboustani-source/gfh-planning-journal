// Shared helpers for planning-call scheduling (scheduling-* edge functions).
// Google Calendar (events@) supplies free/busy + sends the invite; Zoom hosts the call.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

export const GOOGLE_CALENDAR_SCOPE =
  "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.freebusy";

export const ADMIN_ROLES = ["admin", "event_director"];

/* ── Call kinds. Keep in sync with src/content/planningCalls.ts ── */

export type CallKind = "post_booking" | "ninety_day" | "thirty_day" | "extra";
export const CALL_KINDS: CallKind[] = ["post_booking", "ninety_day", "thirty_day", "extra"];

export const CALL_LABELS: Record<CallKind, string> = {
  post_booking: "Post-booking planning call",
  ninety_day: "90-day planning call",
  thirty_day: "30-day planning call",
  extra: "Additional planning call",
};

/** Booking window as days before the wedding: [opensDaysBefore, closesDaysBefore]. null = no bound. */
export const CALL_WINDOWS: Record<CallKind, [number | null, number | null]> = {
  post_booking: [null, 105],
  ninety_day: [104, 76],
  thirty_day: [37, 23],
  extra: [null, 7],
};

/* ── Supabase clients ── */

export function serviceClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

export async function getCaller(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return null;
  const { data: profile } = await serviceClient().from("users").select("id, role, email, first_name, last_name").eq("id", user.id).single();
  if (!profile) return null;
  return { ...profile, isAdmin: ADMIN_ROLES.includes(profile.role) };
}

export async function canAccessEvent(admin: SupabaseClient, eventId: string, caller: { id: string; isAdmin: boolean }) {
  if (caller.isAdmin) return true;
  const { data } = await admin.from("event_users").select("id").eq("event_id", eventId).eq("user_id", caller.id).maybeSingle();
  return !!data;
}

/* ── Signed OAuth state (so a crafted callback can't attach someone else's account) ── */

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function signState(payload: Record<string, unknown>): Promise<string> {
  const body = btoa(JSON.stringify({ ...payload, exp: Date.now() + 15 * 60_000 }));
  return `${body}.${await hmac(body)}`;
}

export async function verifyState(state: string | null): Promise<Record<string, any> | null> {
  if (!state) return null;
  const [body, sig] = state.split(".");
  if (!body || !sig || (await hmac(body)) !== sig) return null;
  try {
    const parsed = JSON.parse(atob(body));
    return parsed.exp > Date.now() ? parsed : null;
  } catch {
    return null;
  }
}

export function callbackUrl(): string {
  const projectRef = Deno.env.get("SUPABASE_URL")!.replace("https://", "").split(".")[0];
  return `https://${projectRef}.supabase.co/functions/v1/scheduling-oauth-callback`;
}

/* ── Tokens ── */

async function storedToken(admin: SupabaseClient, provider: "google" | "zoom") {
  const { data } = await admin.from("call_scheduling_tokens").select("*").eq("provider", provider).maybeSingle();
  return data;
}

export async function googleAccessToken(admin: SupabaseClient): Promise<string> {
  const row = await storedToken(admin, "google");
  if (!row) throw new Error("Google Calendar is not connected");
  if (row.access_token && row.access_token_expires_at && new Date(row.access_token_expires_at).getTime() > Date.now() + 60_000) {
    return row.access_token;
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GMAIL_CLIENT_ID")!,
      client_secret: Deno.env.get("GMAIL_CLIENT_SECRET")!,
      refresh_token: row.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${res.status} ${await res.text()}`);
  const t = await res.json();
  await admin.from("call_scheduling_tokens").update({
    access_token: t.access_token,
    access_token_expires_at: new Date(Date.now() + ((t.expires_in ?? 3600) - 60) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("provider", "google");
  return t.access_token;
}

export function zoomBasicAuth(): string {
  return "Basic " + btoa(`${Deno.env.get("ZOOM_CLIENT_ID")}:${Deno.env.get("ZOOM_CLIENT_SECRET")}`);
}

export async function zoomAccessToken(admin: SupabaseClient): Promise<string> {
  const row = await storedToken(admin, "zoom");
  if (!row) throw new Error("Zoom is not connected");
  if (row.access_token && row.access_token_expires_at && new Date(row.access_token_expires_at).getTime() > Date.now() + 60_000) {
    return row.access_token;
  }
  const res = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: { Authorization: zoomBasicAuth(), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: row.refresh_token }),
  });
  if (!res.ok) throw new Error(`Zoom token refresh failed: ${res.status} ${await res.text()}`);
  const t = await res.json();
  // Zoom rotates refresh tokens: the old one stops working, so always save the new one.
  await admin.from("call_scheduling_tokens").update({
    access_token: t.access_token,
    refresh_token: t.refresh_token ?? row.refresh_token,
    access_token_expires_at: new Date(Date.now() + ((t.expires_in ?? 3600) - 60) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("provider", "zoom");
  return t.access_token;
}

/* ── Google Calendar ── */

export async function googleApi(token: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (res.status === 204 || res.status === 410) return null; // deleted / already gone
  if (!res.ok) throw new Error(`Google Calendar ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function googleBusy(token: string, calendars: string[], timeMin: Date, timeMax: Date) {
  const data = await googleApi(token, "/freeBusy", {
    method: "POST",
    body: JSON.stringify({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      items: calendars.map((id) => ({ id })),
    }),
  });
  const busy: Array<{ start: number; end: number }> = [];
  for (const cal of Object.values<any>(data?.calendars ?? {})) {
    for (const b of cal.busy ?? []) busy.push({ start: Date.parse(b.start), end: Date.parse(b.end) });
  }
  return busy;
}

/* ── Zoom ── */

export async function zoomApi(token: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`https://api.zoom.us/v2${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (res.status === 204 || res.status === 404) return null;
  if (!res.ok) throw new Error(`Zoom ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

/* ── Time zones (no libraries in the edge runtime) ── */

/** Minutes the zone is ahead of UTC at a given instant (ET summer = -240). */
function tzOffsetMinutes(at: Date, tz: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(at).map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** A wall-clock time in `tz` ("2027-03-04", "10:30") as a UTC instant. */
export function zonedToUtc(ymd: string, hm: string, tz: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const [hh, mm] = hm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const off1 = tzOffsetMinutes(new Date(guess), tz);
  let t = guess - off1 * 60_000;
  const off2 = tzOffsetMinutes(new Date(t), tz);
  if (off2 !== off1) t = guess - off2 * 60_000;
  return new Date(t);
}

/** Calendar date ("YYYY-MM-DD") of an instant in `tz`. */
export function ymdInTz(at: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

export function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

/** ISO weekday 1..7 (Mon..Sun) of a calendar date. */
function isoWeekday(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 0 ? 7 : day;
}

/* ── Availability ── */

export interface Settings {
  timezone: string;
  weekly_hours: Record<string, Array<[string, string]>>;
  call_minutes: number;
  buffer_minutes: number;
  min_notice_hours: number;
  max_days_ahead: number;
  cancel_notice_hours: number;
  blocked_dates: string[];
  extra_busy_calendars: string[];
  host_name: string;
}

export async function loadSettings(admin: SupabaseClient): Promise<Settings> {
  const { data, error } = await admin.from("call_scheduling_settings").select("*").eq("id", 1).single();
  if (error || !data) throw new Error("Call scheduling settings are missing");
  return data as Settings;
}

/** The dates (in the host's zone) a call kind can be booked, or null if the kind has no wedding date to anchor to. */
export function bookingWindow(kind: CallKind, weddingDate: string | null, s: Settings, now = new Date()) {
  const today = ymdInTz(now, s.timezone);
  const [opensBefore, closesBefore] = CALL_WINDOWS[kind];
  let opens = today;
  let closes = addDays(today, s.max_days_ahead);
  if (weddingDate) {
    if (opensBefore != null) { const o = addDays(weddingDate, -opensBefore); if (o > opens) opens = o; }
    if (closesBefore != null) { const c = addDays(weddingDate, -closesBefore); if (c < closes) closes = c; }
  }
  const windowOpens = weddingDate && opensBefore != null ? addDays(weddingDate, -opensBefore) : null;
  const windowCloses = weddingDate && closesBefore != null ? addDays(weddingDate, -closesBefore) : null;
  return { opens, closes, windowOpens, windowCloses, today };
}

/**
 * Free start times between two dates (inclusive), in UTC ISO strings.
 * Busy = Google free/busy on events@ (+ extra calendars) plus booked planning_calls, padded by the buffer.
 */
export async function freeSlots(admin: SupabaseClient, s: Settings, fromYmd: string, toYmd: string, now = new Date()) {
  if (toYmd < fromYmd) return [];
  const rangeStart = zonedToUtc(fromYmd, "00:00", s.timezone);
  const rangeEnd = zonedToUtc(addDays(toYmd, 1), "00:00", s.timezone);

  const token = await googleAccessToken(admin);
  const busy = await googleBusy(token, ["primary", ...(s.extra_busy_calendars ?? [])], rangeStart, rangeEnd);

  const { data: booked } = await admin
    .from("planning_calls")
    .select("starts_at, ends_at")
    .eq("status", "booked")
    .lt("starts_at", rangeEnd.toISOString())
    .gt("ends_at", rangeStart.toISOString());
  for (const b of booked ?? []) busy.push({ start: Date.parse(b.starts_at), end: Date.parse(b.ends_at) });

  const pad = s.buffer_minutes * 60_000;
  const len = s.call_minutes * 60_000;
  const earliest = now.getTime() + s.min_notice_hours * 3_600_000;
  const blocked = new Set(s.blocked_dates ?? []);
  const slots: string[] = [];

  for (let day = fromYmd; day <= toYmd; day = addDays(day, 1)) {
    if (blocked.has(day)) continue;
    for (const [from, to] of s.weekly_hours[String(isoWeekday(day))] ?? []) {
      const dayEnd = zonedToUtc(day, to, s.timezone).getTime();
      for (let t = zonedToUtc(day, from, s.timezone).getTime(); t + len <= dayEnd; t += 30 * 60_000) {
        if (t < earliest) continue;
        const clash = busy.some((b) => t < b.end + pad && t + len > b.start - pad);
        if (!clash) slots.push(new Date(t).toISOString());
      }
    }
  }
  return slots;
}

/* ── Cancelling (shared by scheduling-cancel and reschedules in scheduling-book) ── */

export async function cancelCall(admin: SupabaseClient, call: any, cancelledBy: string) {
  if (call.zoom_meeting_id) {
    try {
      await zoomApi(await zoomAccessToken(admin), `/meetings/${call.zoom_meeting_id}`, { method: "DELETE" });
    } catch (e) { console.error("zoom delete failed", e); }
  }
  if (call.google_event_id) {
    try {
      // sendUpdates=all emails the couple a cancellation from events@.
      await googleApi(await googleAccessToken(admin), `/calendars/primary/events/${call.google_event_id}?sendUpdates=all`, { method: "DELETE" });
    } catch (e) { console.error("google delete failed", e); }
  }
  await admin.from("planning_calls").update({
    status: "cancelled",
    cancelled_by: cancelledBy,
    cancelled_at: new Date().toISOString(),
  }).eq("id", call.id);
}
