// Staff only. Connects the CALLER's own Google Calendar or Zoom for planning calls,
// or disconnects it. Body: { provider: "google" | "zoom", action?: "disconnect", return_to?, app_origin? }
import { callbackUrl, corsHeaders, getCaller, GOOGLE_CALENDAR_SCOPE, json, serviceClient, signState } from "../_shared/scheduling.ts";

const FALLBACK_APP_ORIGIN = "https://plan.gilbertsvillefarmhouse.com";
const ALLOWED_APP_ORIGINS = new Set([
  FALLBACK_APP_ORIGIN,
  "https://farmhouse-wedding-whisper.lovable.app",
  "https://id-preview--58ba8cd6-9302-4791-9c7e-658300686f9c.lovable.app",
  "https://58ba8cd6-9302-4791-9c7e-658300686f9c.lovableproject.com",
]);

function safeAppOrigin(raw: string | null): string {
  if (!raw) return FALLBACK_APP_ORIGIN;
  try {
    const origin = new URL(raw).origin;
    return ALLOWED_APP_ORIGINS.has(origin) ? origin : FALLBACK_APP_ORIGIN;
  } catch {
    return FALLBACK_APP_ORIGIN;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const caller = await getCaller(req);
    if (!caller) return json({ error: "Unauthorized" }, 401);
    if (!caller.isStaff) return json({ error: "Staff only" }, 403);

    const body = await req.json().catch(() => ({}));
    const provider = body.provider;
    if (provider !== "google" && provider !== "zoom") return json({ error: "provider must be google or zoom" }, 400);

    if (body.action === "disconnect") {
      const admin = serviceClient();
      await admin.from("call_scheduling_tokens").delete().eq("user_id", caller.id).eq("provider", provider);
      await admin.from("call_hosts")
        .update({ [provider === "google" ? "google_account_email" : "zoom_account_email"]: null, updated_at: new Date().toISOString() })
        .eq("user_id", caller.id);
      return json({ ok: true });
    }

    const state = await signState({
      provider,
      user_id: caller.id,
      return_to: typeof body.return_to === "string" && body.return_to.startsWith("/") ? body.return_to : "/admin/settings/integrations",
      app_origin: safeAppOrigin(req.headers.get("origin") || body.app_origin || null),
    });

    if (provider === "google") {
      const clientId = Deno.env.get("GMAIL_CLIENT_ID");
      if (!clientId) throw new Error("GMAIL_CLIENT_ID not configured");
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: callbackUrl(),
        response_type: "code",
        scope: GOOGLE_CALENDAR_SCOPE,
        access_type: "offline",
        prompt: "consent",
        login_hint: caller.email ?? "",
        state,
      });
      return json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
    }

    const zoomId = Deno.env.get("ZOOM_CLIENT_ID");
    if (!zoomId) throw new Error("ZOOM_CLIENT_ID not configured");
    const params = new URLSearchParams({ response_type: "code", client_id: zoomId, redirect_uri: callbackUrl(), state });
    return json({ url: `https://zoom.us/oauth/authorize?${params}` });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
