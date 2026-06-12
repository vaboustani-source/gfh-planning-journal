import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from "../_shared/send-email.ts";
import { renderTemplate } from "../_shared/email-shell.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(url, serviceKey);
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const vendorId = body?.vendor_id;
    if (!vendorId || typeof vendorId !== "string") {
      return new Response(JSON.stringify({ error: "vendor_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: vendor, error: vErr } = await admin
      .from("vendors")
      .select("id, email, business_name, event_id")
      .eq("id", vendorId)
      .maybeSingle();

    if (vErr || !vendor) {
      return new Response(JSON.stringify({ error: "Vendor not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authorization: admin OR event member
    const { data: userRow } = await admin
      .from("users").select("role").eq("id", userId).maybeSingle();
    const isAdmin = userRow?.role === "admin";

    let allowed = isAdmin;
    if (!allowed) {
      const { data: eu } = await admin
        .from("event_users")
        .select("id")
        .eq("event_id", vendor.event_id)
        .eq("user_id", userId)
        .maybeSingle();
      allowed = !!eu;
    }
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!vendor.email) {
      return new Response(JSON.stringify({ error: "This vendor has no email on file yet" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { subject, html } = await renderTemplate("coi_request", {
      variables: { business_name: vendor.business_name || "there" },
    });

    await sendEmail({
      to: vendor.email,
      subject,
      html,
      replyTo: "experience@gilbertsvillefarmhouse.com",
    });

    await admin
      .from("vendors")
      .update({ coi_requested: true, coi_requested_at: new Date().toISOString() })
      .eq("id", vendorId);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[send-coi-request]", e);
    return new Response(JSON.stringify({ success: false, error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
