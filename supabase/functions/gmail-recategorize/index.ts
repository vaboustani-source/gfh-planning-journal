// Re-runs vendor matching for all filed emails on a given event.
// Useful after vendors are added/edited so older emails inherit the new category.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/gmail.ts";
import { loadMatchContext, matchVendorForSender } from "../_shared/vendor-match.ts";

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

    const { event_id, only_uncategorized = true } = await req.json();
    if (!event_id) return new Response(JSON.stringify({ error: "event_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const ctx = await loadMatchContext(admin, event_id);

    let q = admin.from("project_emails").select("id, from_address, direction, matched_vendor_id").eq("event_id", event_id);
    if (only_uncategorized) q = q.is("matched_vendor_id", null);
    const { data: rows } = await q;

    let updated = 0;
    for (const r of rows ?? []) {
      if (r.direction === "sent") continue;
      const vm = matchVendorForSender(r.from_address, ctx);
      if (vm.vendor_id || vm.vendor_category) {
        await admin.from("project_emails").update({
          vendor_category: vm.vendor_category,
          matched_vendor_id: vm.vendor_id,
          matched_vendor_name: vm.vendor_name,
        }).eq("id", r.id);
        updated++;
      }
    }

    return new Response(JSON.stringify({ ok: true, updated }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e instanceof Error ? e.message : e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
