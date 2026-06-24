// Manual: admin assigns an uncategorized thread to a vendor (or a free-form category).
// Updates every message in the thread on this event and teaches email_sender_map so
// future emails from this sender auto-categorize.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, GMAIL_ALLOWED_ROLES } from "../_shared/gmail.ts";

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
    if (!GMAIL_ALLOWED_ROLES.includes(profile?.role ?? "")) return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { event_id, gmail_thread_id, vendor_id } = await req.json();
    if (!event_id || !gmail_thread_id) {
      return new Response(JSON.stringify({ error: "event_id and gmail_thread_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let vendor_name: string | null = null;
    let vendor_category: string | null = null;
    if (vendor_id) {
      const { data: v } = await admin.from("vendors").select("business_name, contact_name, category").eq("id", vendor_id).maybeSingle();
      if (!v) return new Response(JSON.stringify({ error: "Vendor not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      vendor_name = v.business_name || v.contact_name || "Vendor";
      vendor_category = v.category;
    }

    // Update every message in this thread on this event
    const { error: upErr } = await admin
      .from("project_emails")
      .update({
        vendor_category,
        matched_vendor_id: vendor_id ?? null,
        matched_vendor_name: vendor_name,
      })
      .eq("event_id", event_id)
      .eq("gmail_thread_id", gmail_thread_id);
    if (upErr) throw upErr;

    // Teach sender map for each received sender in this thread
    const { data: msgs } = await admin
      .from("project_emails")
      .select("from_address, direction")
      .eq("event_id", event_id)
      .eq("gmail_thread_id", gmail_thread_id);
    const senders = new Set<string>();
    for (const m of msgs ?? []) {
      if (m.direction === "sent") continue;
      const a = (m.from_address || "").toLowerCase().trim();
      if (a) senders.add(a);
    }
    for (const addr of senders) {
      const { data: existing } = await admin
        .from("email_sender_map")
        .select("id")
        .eq("sender_address", addr)
        .eq("event_id", event_id)
        .maybeSingle();
      if (existing) {
        await admin.from("email_sender_map").update({
          vendor_id: vendor_id ?? null,
          vendor_name,
          vendor_category,
        }).eq("id", existing.id);
      } else {
        await admin.from("email_sender_map").insert({
          sender_address: addr,
          event_id,
          times_filed: 1,
          vendor_id: vendor_id ?? null,
          vendor_name,
          vendor_category,
        });
      }
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e instanceof Error ? e.message : e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
