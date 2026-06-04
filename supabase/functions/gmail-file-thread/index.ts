// Files an entire Gmail thread into a project. Stores all messages and marks
// the thread as "filed" so the cron sync keeps it up to date.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, gmailApi, parseGmailMessage, refreshAccessToken } from "../_shared/gmail.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: profile } = await userClient.from("users").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const { event_id, gmail_thread_id } = body;
    if (!event_id || !gmail_thread_id) {
      return new Response(JSON.stringify({ error: "event_id and gmail_thread_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: conn } = await admin.from("gmail_connections").select("*").eq("user_id", user.id).maybeSingle();
    if (!conn) return new Response(JSON.stringify({ error: "Gmail not connected" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const accessToken = await refreshAccessToken(conn.refresh_token);

    const thread = await gmailApi(accessToken, `/threads/${gmail_thread_id}?format=full`);
    const messages = thread.messages ?? [];

    const rows = messages.map((m: any) => {
      const p = parseGmailMessage(m);
      return {
        event_id,
        gmail_thread_id: p.threadId,
        gmail_message_id: p.id,
        from_address: p.from_address,
        from_name: p.from_name,
        to_addresses: p.to_addresses,
        subject: p.subject,
        body_text: p.body_text,
        body_html: p.body_html,
        snippet: p.snippet,
        has_attachments: p.has_attachments,
        attachments: p.attachments,
        received_at: p.received_at,
        filed_by: user.id,
      };
    });

    if (rows.length) {
      const { error: upErr } = await admin
        .from("project_emails")
        .upsert(rows, { onConflict: "gmail_message_id" });
      if (upErr) throw upErr;
    }

    const { error: ftErr } = await admin
      .from("filed_threads")
      .upsert({
        event_id,
        gmail_thread_id,
        filed_by: user.id,
        last_synced_at: new Date().toISOString(),
      }, { onConflict: "gmail_thread_id" });
    if (ftErr) throw ftErr;

    return new Response(JSON.stringify({ ok: true, count: rows.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e instanceof Error ? e.message : e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
