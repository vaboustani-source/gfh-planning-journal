// Returns the Google OAuth URL the admin should visit to connect Gmail.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, GMAIL_SCOPE, GMAIL_ALLOWED_ROLES } from "../_shared/gmail.ts";

const FALLBACK_APP_ORIGIN = "https://plan.gilbertsvillefarmhouse.com";
const ALLOWED_APP_ORIGINS = new Set([
  FALLBACK_APP_ORIGIN,
  "https://farmhouse-wedding-whisper.lovable.app",
  "https://id-preview--58ba8cd6-9302-4791-9c7e-658300686f9c.lovable.app",
  "https://58ba8cd6-9302-4791-9c7e-658300686f9c.lovableproject.com",
]);

function safeAppOrigin(rawOrigin: string | null): string {
  if (!rawOrigin) return FALLBACK_APP_ORIGIN;
  try {
    const origin = new URL(rawOrigin).origin;
    return ALLOWED_APP_ORIGINS.has(origin) ? origin : FALLBACK_APP_ORIGIN;
  } catch {
    return FALLBACK_APP_ORIGIN;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Verify admin
    const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
    if (!GMAIL_ALLOWED_ROLES.includes(profile?.role ?? "")) {
      return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const returnTo = body.return_to || "/admin/account";
    const appOrigin = safeAppOrigin(req.headers.get("origin") || body.app_origin || null);

    const clientId = Deno.env.get("GMAIL_CLIENT_ID");
    if (!clientId) throw new Error("GMAIL_CLIENT_ID not configured");

    const projectRef = Deno.env.get("SUPABASE_URL")!.replace("https://", "").split(".")[0];
    const redirectUri = `https://${projectRef}.supabase.co/functions/v1/gmail-oauth-callback`;

    const state = btoa(JSON.stringify({ user_id: user.id, return_to: returnTo, app_origin: appOrigin, nonce: crypto.randomUUID() }));

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: GMAIL_SCOPE,
      access_type: "offline",
      prompt: "consent",
      state,
    });
    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    return new Response(JSON.stringify({ url }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e instanceof Error ? e.message : e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
