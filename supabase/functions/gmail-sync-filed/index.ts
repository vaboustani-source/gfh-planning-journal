// Cron-driven: for every filed thread, pull any new Gmail messages and store them.
// Also re-runs vendor categorization for all existing project_emails per event so newly
// added vendors apply retroactively.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, gmailApi, parseGmailMessage, refreshAccessToken } from "../_shared/gmail.ts";
import { loadMatchContext, matchVendorForSender } from "../_shared/vendor-match.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

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

    const { data: existing } = await admin
      .from("project_emails")
      .select("gmail_message_id")
      .in("gmail_thread_id", filed.map((f) => f.gmail_thread_id));
    const seen = new Set((existing ?? []).map((r) => r.gmail_message_id));

    // Cache per-event match context so we don't re-load it for every thread
    const ctxByEvent: Record<string, Awaited<ReturnType<typeof loadMatchContext>>> = {};
    const getCtx = async (eventId: string) => {
      if (!ctxByEvent[eventId]) ctxByEvent[eventId] = await loadMatchContext(admin, eventId);
      return ctxByEvent[eventId];
    };

    let totalNew = 0;
    const errors: string[] = [];
    const myAddr = (conn.email_address || "").toLowerCase();

    for (const f of filed) {
      try {
        const thread = await gmailApi(accessToken, `/threads/${f.gmail_thread_id}?format=full`);
        const messages = thread.messages ?? [];
        const newRows = [];
        const ctx = await getCtx(f.event_id);
        for (const m of messages) {
          if (seen.has(m.id)) continue;
          const p = parseGmailMessage(m);
          const fromAddr = (p.from_address || "").toLowerCase();
          const isSent = fromAddr && myAddr && fromAddr === myAddr;
          const vm = matchVendorForSender(isSent ? null : fromAddr, ctx);
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
            direction: isSent ? "sent" : "received",
            vendor_category: vm.vendor_category,
            matched_vendor_id: vm.vendor_id,
            matched_vendor_name: vm.vendor_name,
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

    // Retro-categorize: re-match any previously-uncategorized emails per event
    let recategorized = 0;
    for (const eventId of Object.keys(ctxByEvent)) {
      const ctx = ctxByEvent[eventId];
      const { data: uncat } = await admin
        .from("project_emails")
        .select("id, from_address, direction")
        .eq("event_id", eventId)
        .is("matched_vendor_id", null);
      for (const row of uncat ?? []) {
        if (row.direction === "sent") continue;
        const vm = matchVendorForSender(row.from_address, ctx);
        if (vm.vendor_id || vm.vendor_category) {
          await admin.from("project_emails").update({
            vendor_category: vm.vendor_category,
            matched_vendor_id: vm.vendor_id,
            matched_vendor_name: vm.vendor_name,
          }).eq("id", row.id);
          recategorized++;
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, threads: filed.length, new_messages: totalNew, recategorized, errors }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e instanceof Error ? e.message : e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
