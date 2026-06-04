// Returns Brandon's most recent 50 inbox messages (metadata only).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, gmailApi, refreshAccessToken } from "../_shared/gmail.ts";

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

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: conn } = await admin.from("gmail_connections").select("*").eq("user_id", user.id).maybeSingle();
    if (!conn) return new Response(JSON.stringify({ error: "Gmail not connected" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const accessToken = await refreshAccessToken(conn.refresh_token);

    const list = await gmailApi(accessToken, "/messages?maxResults=50&labelIds=INBOX");
    const ids: Array<{ id: string; threadId: string }> = list.messages ?? [];

    // Fetch metadata in parallel (with modest concurrency)
    const messages: any[] = [];
    const batchSize = 10;
    for (let i = 0; i < ids.length; i += batchSize) {
      const slice = ids.slice(i, i + batchSize);
      const results = await Promise.all(slice.map(({ id }) =>
        gmailApi(accessToken, `/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`).catch(() => null)
      ));
      for (const m of results) if (m) messages.push(m);
    }

    // Look up already-filed threads
    const threadIds = [...new Set(messages.map(m => m.threadId))];
    const { data: filed } = await admin
      .from("filed_threads")
      .select("gmail_thread_id, event_id, events:events(id, title)")
      .in("gmail_thread_id", threadIds.length ? threadIds : ["__none__"]);
    const filedMap = Object.fromEntries((filed ?? []).map((f: any) => [f.gmail_thread_id, { event_id: f.event_id, event_title: f.events?.title ?? null }]));

    const simplified = messages.map((m) => {
      const headers: Record<string, string> = {};
      for (const h of m.payload?.headers ?? []) headers[h.name.toLowerCase()] = h.value;
      return {
        id: m.id,
        thread_id: m.threadId,
        from: headers["from"] ?? "",
        subject: headers["subject"] ?? "(no subject)",
        snippet: m.snippet ?? "",
        date: m.internalDate ? new Date(Number(m.internalDate)).toISOString() : (headers["date"] ?? null),
        filed: filedMap[m.threadId] ?? null,
      };
    });

    return new Response(JSON.stringify({ email_address: conn.email_address, messages: simplified }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e instanceof Error ? e.message : e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
