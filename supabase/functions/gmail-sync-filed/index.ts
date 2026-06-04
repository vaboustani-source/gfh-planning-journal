// Cron-driven: for every filed thread, pull any new Gmail messages and store them.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, gmailApi, parseGmailMessage, refreshAccessToken } from "../_shared/gmail.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Use the most-recently-connected admin (typically only Brandon)
    const { data: conn } = await admin
      .from("gmail_connections")
      .select("*")
      .order("connected_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!conn) {
      return new Response(JSON.stringify({ ok: true, skipped: "no gmail connection" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const accessToken = await refreshAccessToken(conn.refresh_token);

    const { data: filed } = await admin.from("filed_threads").select("*");
    if (!filed || !filed.length) {
      return new Response(JSON.stringify({ ok: true, threads: 0, new_messages: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Existing message ids to skip
    const { data: existing } = await admin
      .from("project_emails")
      .select("gmail_message_id")
      .in("gmail_thread_id", filed.map((f) => f.gmail_thread_id));
    const seen = new Set((existing ?? []).map((r) => r.gmail_message_id));

    let totalNew = 0;
    const errors: string[] = [];

    for (const f of filed) {
      try {
        const thread = await gmailApi(accessToken, `/threads/${f.gmail_thread_id}?format=full`);
        const messages = thread.messages ?? [];
        const newRows = [];
        for (const m of messages) {
          if (seen.has(m.id)) continue;
          const p = parseGmailMessage(m);
          newRows.push({
            event_id: f.event_id,
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
            filed_by: f.filed_by,
          });
        }
        if (newRows.length) {
          await admin.from("project_emails").upsert(newRows, { onConflict: "gmail_message_id" });
          totalNew += newRows.length;
        }
        await admin.from("filed_threads").update({ last_synced_at: new Date().toISOString() }).eq("id", f.id);
      } catch (e) {
        errors.push(`${f.gmail_thread_id}: ${String(e instanceof Error ? e.message : e)}`);
      }
    }

    return new Response(JSON.stringify({ ok: true, threads: filed.length, new_messages: totalNew, errors }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e instanceof Error ? e.message : e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
