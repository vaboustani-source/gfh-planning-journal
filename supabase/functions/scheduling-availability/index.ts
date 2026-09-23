// Open planning-call times for one wedding + call kind.
// Body: { event_id, call_kind, host_user_id? (for "direct") } -> { ready, window, slots[], timezone, call_minutes, host_name }
import {
  addDays, bookingWindow, CALL_KINDS, canAccessEvent, corsHeaders, freeSlots, getCaller, hostForCall, json, loadSettings, serviceClient,
  type CallKind,
} from "../_shared/scheduling.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const caller = await getCaller(req);
    if (!caller) return json({ error: "Unauthorized" }, 401);

    const { event_id, call_kind, host_user_id } = await req.json().catch(() => ({}));
    if (!event_id || !CALL_KINDS.includes(call_kind)) return json({ error: "event_id and a valid call_kind are required" }, 400);

    const admin = serviceClient();
    if (!(await canAccessEvent(admin, event_id, caller))) return json({ error: "Not your wedding" }, 403);

    const s = await loadSettings(admin);
    const { host, ready } = await hostForCall(admin, event_id, s, call_kind, host_user_id);
    const base = {
      timezone: s.timezone,
      call_minutes: s.call_minutes,
      host_name: host?.display_name || "your coordinator",
      cancel_notice_hours: s.cancel_notice_hours,
    };
    if (!host || !ready) {
      return json({ ...base, ready: false, reason: host ? "host_not_connected" : "no_host", slots: [] });
    }

    const { data: event } = await admin.from("events").select("wedding_date").eq("id", event_id).single();
    const w = bookingWindow(call_kind as CallKind, event?.wedding_date ?? null, s);

    // Staff can book any call at any time before the wedding (skipping the 90/30-day windows).
    let from = w.opens;
    let to = w.closes;
    if (caller.isAdmin) {
      from = w.today;
      to = addDays(w.today, s.max_days_ahead);
      if (event?.wedding_date && addDays(event.wedding_date, -1) < to) to = addDays(event.wedding_date, -1);
    }

    const status = !caller.isAdmin && w.windowOpens && w.today < w.windowOpens
      ? "not_open_yet"
      : !caller.isAdmin && w.windowCloses && w.today > w.windowCloses
        ? "closed"
        : "open";

    const slots = status === "open" ? await freeSlots(admin, s, host, from, to) : [];
    return json({
      ...base,
      ready: true,
      status,
      window: { opens: w.windowOpens, closes: w.windowCloses },
      slots,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
