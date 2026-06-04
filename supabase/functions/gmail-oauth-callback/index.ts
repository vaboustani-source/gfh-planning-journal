// Handles Google's OAuth redirect. Exchanges code for tokens, stores refresh token,
// then redirects the admin back to the app.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, gmailApi } from "../_shared/gmail.ts";

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

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const projectRef = Deno.env.get("SUPABASE_URL")!.replace("https://", "").split(".")[0];
  const redirectUri = `https://${projectRef}.supabase.co/functions/v1/gmail-oauth-callback`;

  let returnTo = "/admin/account";
  let userId: string | null = null;
  let appOrigin = FALLBACK_APP_ORIGIN;
  try {
    if (stateRaw) {
      const parsed = JSON.parse(atob(stateRaw));
      returnTo = parsed.return_to || returnTo;
      userId = parsed.user_id ?? null;
      appOrigin = safeAppOrigin(parsed.app_origin ?? null);
    }
  } catch { /* ignore */ }

  const baseOrigin = appOrigin;

  if (error || !code || !userId) {
    const dest = `${baseOrigin}${returnTo}?gmail=error&reason=${encodeURIComponent(error || "missing_code")}`;
    return Response.redirect(dest, 302);
  }

  try {
    const clientId = Deno.env.get("GMAIL_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET")!;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) {
      const t = await tokenRes.text();
      throw new Error(`Token exchange failed: ${tokenRes.status} ${t}`);
    }
    const tokens = await tokenRes.json();
    const accessToken: string = tokens.access_token;
    const refreshToken: string | undefined = tokens.refresh_token;
    const expiresIn: number = tokens.expires_in ?? 3600;

    // Get the connected mailbox address
    const profile = await gmailApi(accessToken, "/profile");
    const emailAddress: string = profile.emailAddress;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Upsert connection. If no refresh_token came back (user previously consented),
    // preserve the existing stored one.
    const { data: existing } = await admin
      .from("gmail_connections")
      .select("refresh_token")
      .eq("user_id", userId)
      .maybeSingle();

    const finalRefresh = refreshToken || existing?.refresh_token;
    if (!finalRefresh) {
      const dest = `${baseOrigin}${returnTo}?gmail=error&reason=no_refresh_token`;
      return Response.redirect(dest, 302);
    }

    const expiresAt = new Date(Date.now() + (expiresIn - 60) * 1000).toISOString();

    await admin.from("gmail_connections").upsert({
      user_id: userId,
      email_address: emailAddress,
      refresh_token: finalRefresh,
      access_token: accessToken,
      access_token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    const dest = `${baseOrigin}${returnTo}?gmail=connected&email=${encodeURIComponent(emailAddress)}`;
    return Response.redirect(dest, 302);
  } catch (e) {
    const dest = `${baseOrigin}${returnTo}?gmail=error&reason=${encodeURIComponent(String(e instanceof Error ? e.message : e))}`;
    return Response.redirect(dest, 302);
  }
});
