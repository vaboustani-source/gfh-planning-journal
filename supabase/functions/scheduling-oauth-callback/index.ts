// OAuth redirect target for both Google Calendar and Zoom (planning-call scheduling).
// Exchanges the code, stores tokens (service role only), and sends the admin back to the app.
import { callbackUrl, googleApi, serviceClient, verifyState, zoomApi, zoomBasicAuth } from "../_shared/scheduling.ts";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const state = await verifyState(url.searchParams.get("state"));
  const code = url.searchParams.get("code");

  const origin = state?.app_origin ?? "https://plan.gilbertsvillefarmhouse.com";
  const returnTo = state?.return_to ?? "/admin/settings/integrations";
  const back = (params: Record<string, string>) =>
    Response.redirect(`${origin}${returnTo}${returnTo.includes("?") ? "&" : "?"}${new URLSearchParams(params)}`, 302);

  if (!state) return back({ scheduling: "error", reason: "expired_or_invalid_state" });
  if (!code) return back({ scheduling: "error", provider: state.provider, reason: url.searchParams.get("error") ?? "missing_code" });

  try {
    let tokens: any;
    let email: string | null = null;

    if (state.provider === "google") {
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: Deno.env.get("GMAIL_CLIENT_ID")!,
          client_secret: Deno.env.get("GMAIL_CLIENT_SECRET")!,
          redirect_uri: callbackUrl(),
          grant_type: "authorization_code",
        }),
      });
      if (!res.ok) throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
      tokens = await res.json();
      const granted = String(tokens.scope ?? "");
      if (!granted.includes("calendar.events") || !granted.includes("calendar.freebusy")) {
        return back({ scheduling: "error", provider: "google", reason: "calendar_permissions_not_granted" });
      }
      // The primary calendar's summary is the account address.
      const list = await googleApi(tokens.access_token, "/calendars/primary/events?maxResults=1");
      email = list?.summary ?? null;
    } else if (state.provider === "zoom") {
      const res = await fetch("https://zoom.us/oauth/token", {
        method: "POST",
        headers: { Authorization: zoomBasicAuth(), "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: callbackUrl() }),
      });
      if (!res.ok) throw new Error(`Zoom token exchange failed: ${res.status} ${await res.text()}`);
      tokens = await res.json();
      const me = await zoomApi(tokens.access_token, "/users/me");
      email = me?.email ?? null;
    } else {
      return back({ scheduling: "error", reason: "unknown_provider" });
    }

    const admin = serviceClient();
    const { data: existing } = await admin.from("call_scheduling_tokens").select("refresh_token").eq("provider", state.provider).maybeSingle();
    const refresh = tokens.refresh_token ?? existing?.refresh_token;
    if (!refresh) return back({ scheduling: "error", provider: state.provider, reason: "no_refresh_token" });

    await admin.from("call_scheduling_tokens").upsert({
      provider: state.provider,
      account_email: email,
      refresh_token: refresh,
      access_token: tokens.access_token,
      access_token_expires_at: new Date(Date.now() + ((tokens.expires_in ?? 3600) - 60) * 1000).toISOString(),
      connected_by: state.user_id,
      updated_at: new Date().toISOString(),
    }, { onConflict: "provider" });

    await admin.from("call_scheduling_settings").update({
      [state.provider === "google" ? "google_account_email" : "zoom_account_email"]: email,
      updated_at: new Date().toISOString(),
      updated_by: state.user_id,
    }).eq("id", 1);

    return back({ scheduling: "connected", provider: state.provider, email: email ?? "" });
  } catch (e) {
    return back({ scheduling: "error", provider: state.provider, reason: e instanceof Error ? e.message.slice(0, 200) : "unknown" });
  }
});
