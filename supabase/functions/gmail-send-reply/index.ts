// Sends a reply from Brandon's Gmail, threaded into the original Gmail conversation.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, gmailApi, parseGmailMessage, refreshAccessToken } from "../_shared/gmail.ts";

function b64url(s: string): string {
  // UTF-8 safe base64url
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

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
    const { event_id, gmail_thread_id, in_reply_to_message_id, to, subject, body_text } = body ?? {};
    if (!event_id || !gmail_thread_id || !to || !body_text) {
      return new Response(JSON.stringify({ error: "event_id, gmail_thread_id, to, body_text required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: conn } = await admin.from("gmail_connections").select("*").eq("user_id", user.id).maybeSingle();
    if (!conn) return new Response(JSON.stringify({ error: "Gmail not connected" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const accessToken = await refreshAccessToken(conn.refresh_token);

    // Look up RFC Message-Id + References from the most recent original message in the thread (for proper threading).
    let inReplyTo = "";
    let references = "";
    let subj = (subject || "").trim();
    try {
      const targetId = in_reply_to_message_id || null;
      if (targetId) {
        const meta = await gmailApi(accessToken, `/messages/${targetId}?format=metadata&metadataHeaders=Message-Id&metadataHeaders=References&metadataHeaders=Subject`);
        const h: Record<string, string> = {};
        for (const x of meta.payload?.headers ?? []) h[x.name.toLowerCase()] = x.value;
        inReplyTo = h["message-id"] || "";
        references = (h["references"] ? h["references"] + " " : "") + inReplyTo;
        if (!subj) subj = (h["subject"] || "").replace(/^\s*(re:\s*)+/i, "Re: ").trim();
      } else {
        const thread = await gmailApi(accessToken, `/threads/${gmail_thread_id}?format=metadata&metadataHeaders=Message-Id&metadataHeaders=References&metadataHeaders=Subject`);
        const msgs = thread.messages ?? [];
        const last = msgs[msgs.length - 1];
        const h: Record<string, string> = {};
        for (const x of last?.payload?.headers ?? []) h[x.name.toLowerCase()] = x.value;
        inReplyTo = h["message-id"] || "";
        references = (h["references"] ? h["references"] + " " : "") + inReplyTo;
        if (!subj) subj = (h["subject"] || "").replace(/^\s*(re:\s*)+/i, "Re: ").trim();
      }
    } catch { /* threading headers optional */ }

    if (!/^re:/i.test(subj)) subj = "Re: " + subj;

    const fromHeader = `Brandon <${conn.email_address}>`;
    const headers = [
      `From: ${fromHeader}`,
      `To: ${to}`,
      `Subject: ${subj}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset="UTF-8"`,
    ];
    if (inReplyTo) headers.push(`In-Reply-To: ${inReplyTo}`);
    if (references) headers.push(`References: ${references}`);
    const raw = headers.join("\r\n") + "\r\n\r\n" + body_text;
    const encoded = b64url(raw);

    const sendRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw: encoded, threadId: gmail_thread_id }),
    });
    if (!sendRes.ok) {
      const t = await sendRes.text();
      throw new Error(`Gmail send failed: ${sendRes.status} ${t}`);
    }
    const sent = await sendRes.json();

    // Fetch full sent message and store it
    const fullSent = await gmailApi(accessToken, `/messages/${sent.id}?format=full`);
    const p = parseGmailMessage(fullSent);
    await admin.from("project_emails").upsert({
      event_id,
      gmail_thread_id: p.threadId,
      gmail_message_id: p.id,
      from_address: p.from_address ?? conn.email_address,
      from_name: p.from_name,
      to_addresses: p.to_addresses ?? to,
      subject: p.subject ?? subj,
      body_text: p.body_text ?? body_text,
      body_html: p.body_html,
      snippet: p.snippet,
      has_attachments: p.has_attachments,
      attachments: p.attachments,
      received_at: p.received_at ?? new Date().toISOString(),
      filed_by: user.id,
      direction: "sent",
    }, { onConflict: "gmail_message_id" });

    return new Response(JSON.stringify({ ok: true, id: sent.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e instanceof Error ? e.message : e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
