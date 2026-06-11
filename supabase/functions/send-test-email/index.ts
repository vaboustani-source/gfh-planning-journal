// Admin-only Email Test sender. Renders any registered email template with
// realistic sample variables and sends it to a single recipient via the same
// renderTemplate + sendEmail helpers the real senders use. Subject is
// prefixed with "[Test] " for clarity.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { renderTemplate } from "../_shared/email-shell.ts";
import { sendEmail } from "../_shared/send-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PORTAL_URL = "https://plan.gilbertsvillefarmhouse.com";

// Realistic sample values covering every variable name used across the
// templates. Unused keys are harmless — renderTemplate only substitutes
// tokens that actually appear in the template strings.
const SAMPLE_VARS: Record<string, string> = {
  // people
  couple_names: "Jordan and Taylor",
  partner_label: "Jordan and Taylor",
  invited_name: "Jordan",
  inviter_name: "Brandon",
  signer_name: "Jordan Rivera",
  sender_name: "Brandon",
  handler_name: "Brandon",
  // event
  event_title: "Jordan and Taylor's Wedding",
  contract_title: "Gilbertsville Farmhouse Wedding Agreement",
  wedding_date: "October 12, 2026",
  signed_date: "June 1, 2026 at 2:14 PM",
  // timing
  days_out: "30",
  count: "3",
  // money
  amount: "$2,500.00",
  amount_due: "$2,500.00",
  due_date: "October 5, 2026",
  // links and copy
  link: PORTAL_URL,
  portal_link: PORTAL_URL,
  url: PORTAL_URL,
  cta: PORTAL_URL,
  greeting: "Hello Jordan,",
  message: "Just wanted to share a quick note from this morning — everything is on track and looking lovely.",
  subline: "Wedding on October 12, 2026 — 30 days out",
  status_prefix: "🟡 ",
  status_suffix: "30 days out",
};

// Small trusted contentHtml block for templates that render a dynamic body
// section (message bubbles, handoff details). Sample only.
const SAMPLE_CONTENT_HTML = `
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0;">
    <tr><td style="background:#FAF8F4;border:1px solid #E8E2D9;border-radius:10px;padding:14px 16px;font-family:Georgia,'Times New Roman',serif;font-size:14px;line-height:1.6;color:#2C3E2D;">
      <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#9aa097;margin-bottom:6px;">Sample block</div>
      This is a sample content block rendered to show how the email looks when it carries dynamic content.
    </td></tr>
  </table>
`;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Authn
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) {
      return json(401, { success: false, error: "Not authenticated" });
    }
    const { data: userData, error: userErr } = await supabase.auth.getUser(
      auth.replace("Bearer ", ""),
    );
    if (userErr || !userData?.user) {
      return json(401, { success: false, error: "Not authenticated" });
    }

    // Authz: admin only
    const { data: profile } = await supabase
      .from("users").select("role, email").eq("id", userData.user.id).maybeSingle();
    if (profile?.role !== "admin") {
      return json(403, { success: false, error: "Not authorized" });
    }

    // Input
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json(400, { success: false, error: "Invalid request body" });
    }
    const key = typeof body.key === "string" ? body.key.trim() : "";
    const recipientRaw = typeof body.recipient === "string" ? body.recipient.trim() : "";
    if (!key) return json(400, { success: false, error: "Template key required" });

    const recipient = recipientRaw || profile.email || userData.user.email || "";
    if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      return json(400, { success: false, error: "Valid recipient email required" });
    }

    // Confirm template exists
    const { data: tmpl, error: tmplErr } = await supabase
      .from("email_templates").select("key, name").eq("key", key).maybeSingle();
    if (tmplErr || !tmpl) {
      return json(404, { success: false, error: `Template "${key}" not found` });
    }

    // Templates that benefit from a sample contentHtml block.
    const wantsContent = key === "notify_admin_messages"
      || key === "notify_couple_message"
      || key === "notify_couple_messages_batch"
      || key === "event_handoff_notice";

    const { subject, html } = await renderTemplate(key, {
      variables: SAMPLE_VARS,
      ctaUrl: PORTAL_URL,
      contentHtml: wantsContent ? SAMPLE_CONTENT_HTML : undefined,
    });

    await sendEmail({
      to: recipient,
      subject: `[Test] ${subject}`,
      html,
    });

    return json(200, { success: true });
  } catch (e) {
    console.error("[send-test-email]", e);
    return json(500, { success: false, error: (e as Error).message ?? "Unknown error" });
  }
});
