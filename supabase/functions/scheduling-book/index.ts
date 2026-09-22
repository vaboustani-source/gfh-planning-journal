// Books a planning call: re-checks the slot is free, creates the Zoom meeting and the
// events@ Google Calendar event (which emails the couple an invite), and saves the row.
// Body: { event_id, call_kind, starts_at, note?, reschedule_of? }
import {
  bookingWindow, CALL_KINDS, CALL_LABELS, cancelCall, canAccessEvent, corsHeaders, freeSlots, getCaller, googleAccessToken,
  googleApi, json, loadSettings, serviceClient, ymdInTz, zoomAccessToken, zoomApi, type CallKind,
} from "../_shared/scheduling.ts";
import { APP_BASE_URL } from "../_shared/appUrls.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const caller = await getCaller(req);
    if (!caller) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const eventId: string | undefined = body.event_id;
    const note: string | null = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 1000) : null;
    if (!eventId || typeof body.starts_at !== "string") return json({ error: "event_id and starts_at are required" }, 400);

    const admin = serviceClient();
    if (!(await canAccessEvent(admin, eventId, caller))) return json({ error: "Not your wedding" }, 403);
    const s = await loadSettings(admin);

    // Rescheduling keeps the original call's kind and cancels it once the new one is confirmed.
    let previous: any = null;
    let kind: CallKind = body.call_kind;
    if (body.reschedule_of) {
      const { data } = await admin.from("planning_calls").select("*").eq("id", body.reschedule_of).maybeSingle();
      if (!data || data.event_id !== eventId || data.status !== "booked") return json({ error: "That call can't be rescheduled" }, 400);
      if (!caller.isAdmin && Date.parse(data.starts_at) - Date.now() < s.cancel_notice_hours * 3_600_000) {
        return json({ error: `Calls can be moved up to ${s.cancel_notice_hours} hours ahead. Please message us instead.` }, 400);
      }
      previous = data;
      kind = data.call_kind;
    }
    if (!CALL_KINDS.includes(kind)) return json({ error: "Invalid call_kind" }, 400);

    const start = new Date(body.starts_at);
    if (isNaN(start.getTime())) return json({ error: "Invalid starts_at" }, 400);
    const startIso = start.toISOString();
    const end = new Date(start.getTime() + s.call_minutes * 60_000);

    const { data: event } = await admin.from("events").select("id, title, wedding_date").eq("id", eventId).single();
    if (!event) return json({ error: "Wedding not found" }, 404);

    // Included calls: one each.
    if (kind !== "extra") {
      const { data: existing } = await admin.from("planning_calls").select("id")
        .eq("event_id", eventId).eq("call_kind", kind).eq("status", "booked");
      if ((existing ?? []).some((c) => c.id !== previous?.id)) {
        return json({ error: "This call is already booked. You can reschedule it instead." }, 409);
      }
    }

    // Window (couples only; staff can book any time before the wedding).
    const day = ymdInTz(start, s.timezone);
    const w = bookingWindow(kind, event.wedding_date, s);
    if (!caller.isAdmin && (day < w.opens || day > w.closes)) return json({ error: "That date is outside this call's booking window" }, 400);
    if (event.wedding_date && day >= event.wedding_date) return json({ error: "Calls must be before the wedding" }, 400);

    // Is the time still free right now?
    const slots = await freeSlots(admin, s, day, day);
    if (!slots.includes(startIso)) return json({ error: "Sorry, that time was just taken. Please pick another." }, 409);

    // Claim the slot first; the unique index stops a double booking at the same start.
    const { data: row, error: insErr } = await admin.from("planning_calls").insert({
      event_id: eventId,
      call_kind: kind,
      starts_at: startIso,
      ends_at: end.toISOString(),
      billable: kind === "extra",
      couple_note: note ?? previous?.couple_note ?? null,
      booked_by: caller.id,
      status: "booked",
    }).select().single();
    if (insErr) {
      if (insErr.code === "23505") {
        return json({ error: "Sorry, that time was just taken. Please pick another." }, 409);
      }
      throw insErr;
    }

    let zoomId: string | null = null;
    try {
      const label = CALL_LABELS[kind];
      const summary = `${label} · ${event.title}`;

      const zoom = await zoomApi(await zoomAccessToken(admin), "/users/me/meetings", {
        method: "POST",
        body: JSON.stringify({
          topic: `${summary} · Gilbertsville Farmhouse`,
          type: 2,
          start_time: startIso.replace(/\.\d{3}Z$/, "Z"),
          duration: s.call_minutes,
          timezone: s.timezone,
          agenda: note ?? undefined,
          settings: { join_before_host: false, waiting_room: true, host_video: true, participant_video: true },
        }),
      });
      zoomId = String(zoom.id);

      const { data: members } = await admin.from("event_users").select("users!inner(email, role)").eq("event_id", eventId);
      const attendees = (members ?? [])
        .map((m: any) => m.users)
        .filter((u: any) => u?.role === "couple" && u.email)
        .map((u: any) => ({ email: u.email }));

      const description = [
        `Join on Zoom: ${zoom.join_url}`,
        zoom.password ? `Passcode: ${zoom.password}` : null,
        "",
        kind === "extra" ? "This is an additional planning call, billed at $100 per hour." : null,
        note ? `What you'd like to cover:\n${note}` : null,
        "",
        `Reschedule or cancel in your Planning Hub: ${APP_BASE_URL}/portal/calls`,
        "Questions? Write to events@gilbertsvillefarmhouse.com",
      ].filter((l) => l !== null).join("\n");

      const gEvent = await googleApi(await googleAccessToken(admin), "/calendars/primary/events?sendUpdates=all", {
        method: "POST",
        body: JSON.stringify({
          summary,
          description,
          location: zoom.join_url,
          start: { dateTime: startIso, timeZone: s.timezone },
          end: { dateTime: end.toISOString(), timeZone: s.timezone },
          attendees,
          reminders: { useDefault: true },
        }),
      });

      const { data: saved } = await admin.from("planning_calls").update({
        zoom_meeting_id: zoomId,
        zoom_join_url: zoom.join_url,
        zoom_passcode: zoom.password ?? null,
        google_event_id: gEvent?.id ?? null,
      }).eq("id", row.id).select().single();

      if (previous) await cancelCall(admin, previous, caller.id);
      return json({ call: saved });
    } catch (e) {
      // Roll back so the slot isn't stuck and no orphan Zoom meeting is left.
      if (zoomId) {
        try { await zoomApi(await zoomAccessToken(admin), `/meetings/${zoomId}`, { method: "DELETE" }); } catch { /* ignore */ }
      }
      await admin.from("planning_calls").delete().eq("id", row.id);
      throw e;
    }
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
