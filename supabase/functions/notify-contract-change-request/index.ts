// Emails the team when a couple asks to change a signed contract.
// Body: { request_id }. Caller must be a member of that wedding.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { APP_BASE_URL } from "../_shared/appUrls.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const TEAM_INBOX = "events@gilbertsvillefarmhouse.com";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/** Same sender as _shared/send-email.ts (Resend). */
async function sendEmail(p: { to: string; subject: string; html: string; replyTo?: string }) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Gilbertsville Farmhouse <noreply@plan.gilbertsvillefarmhouse.com>",
      to: [p.to],
      subject: p.subject,
      html: p.html,
      reply_to: p.replyTo ?? "experience@gilbertsvillefarmhouse.com",
    }),
  });
  if (!res.ok) throw new Error(`Resend API error (${res.status}): ${await res.text()}`);
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { request_id } = await req.json().catch(() => ({}));
    if (!request_id) return json({ error: "request_id is required" }, 400);

    // Read through the caller's own permissions: they only see requests for their wedding.
    const { data: r } = await userClient.from("contract_change_requests")
      .select("id, event_id, request_text, created_at, contracts(title), events(title, wedding_date)")
      .eq("id", request_id).maybeSingle();
    if (!r) return json({ error: "Request not found" }, 404);

    const { data: me } = await userClient.from("users").select("first_name, last_name, email").eq("id", user.id).maybeSingle();
    const who = [me?.first_name, me?.last_name].filter(Boolean).join(" ") || me?.email || "The couple";
    const wedding = (r as any).events?.title ?? "A wedding";
    const contractTitle = (r as any).contracts?.title ?? "their contract";
    const link = `${APP_BASE_URL}/admin/events/${r.event_id}`;

    await sendEmail({
      to: TEAM_INBOX,
      replyTo: me?.email ?? undefined,
      subject: `Contract change request · ${wedding}`,
      html: `<p><strong>${esc(who)}</strong> asked to change <strong>${esc(contractTitle)}</strong> for ${esc(wedding)}:</p>
<blockquote style="border-left:3px solid #C9A84C;margin:12px 0;padding:4px 12px;white-space:pre-wrap">${esc(r.request_text)}</blockquote>
<p>Open the wedding's Contracts tab to draft an amendment or decline: <a href="${link}">${link}</a></p>`,
    });
    return json({ ok: true });
  } catch (e) {
    console.error("[notify-contract-change-request]", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
