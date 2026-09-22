// Cancels a planning call: deletes the Zoom meeting and the calendar event (the couple
// gets a cancellation email from the host). Couples must cancel before the notice cutoff.
// Body: { call_id }
import { cancelCall, canAccessEvent, corsHeaders, getCaller, json, loadSettings, serviceClient } from "../_shared/scheduling.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const caller = await getCaller(req);
    if (!caller) return json({ error: "Unauthorized" }, 401);
    const { call_id } = await req.json().catch(() => ({}));
    if (!call_id) return json({ error: "call_id is required" }, 400);

    const admin = serviceClient();
    const { data: call } = await admin.from("planning_calls").select("*").eq("id", call_id).maybeSingle();
    if (!call || !(await canAccessEvent(admin, call.event_id, caller))) return json({ error: "Call not found" }, 404);
    if (call.status !== "booked") return json({ ok: true });

    const s = await loadSettings(admin);
    if (!caller.isAdmin && Date.parse(call.starts_at) - Date.now() < s.cancel_notice_hours * 3_600_000) {
      return json({ error: `Calls can be cancelled up to ${s.cancel_notice_hours} hours ahead. Please message us instead.` }, 400);
    }

    await cancelCall(admin, call, caller.id);
    return json({ ok: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
