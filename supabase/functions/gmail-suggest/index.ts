// Smart match engine. Given a list of inbox emails, suggest which event each belongs to.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/gmail.ts";

interface InEmail { id: string; from: string; subject?: string | null; snippet?: string | null; thread_id?: string }

function parseAddress(header: string): string {
  if (!header) return "";
  const m = header.match(/<([^>]+)>/);
  return ((m ? m[1] : header) || "").trim().toLowerCase();
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

    const body = await req.json().catch(() => ({}));
    const emails: InEmail[] = body?.emails ?? [];
    if (!emails.length) return new Response(JSON.stringify({ suggestions: {} }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Load all events with couple labels
    const { data: events } = await admin.from("events").select("id, title, partner1_name, partner2_name");
    const eventLabel: Record<string, string> = {};
    for (const e of events ?? []) {
      const couple = [e.partner1_name, e.partner2_name].filter(Boolean).join(" & ");
      eventLabel[e.id] = couple || e.title || "Event";
    }

    // sender_map (learned)
    const { data: senderMap } = await admin.from("email_sender_map").select("sender_address, event_id, times_filed");
    const mapBySender: Record<string, { event_id: string; times_filed: number }> = {};
    for (const r of senderMap ?? []) {
      const k = (r.sender_address || "").toLowerCase();
      if (!k) continue;
      if (!mapBySender[k] || mapBySender[k].times_filed < r.times_filed) {
        mapBySender[k] = { event_id: r.event_id, times_filed: r.times_filed };
      }
    }

    // vendors (per event) — full row so we can return vendor role context
    const { data: vendors } = await admin.from("vendors").select("id, event_id, email, business_name, contact_name, category").not("email", "is", null);
    const vendorBySender: Record<string, { event_id: string; vendor_id: string; vendor_name: string; vendor_category: string | null }> = {};
    const vendorByDomain: Record<string, { event_id: string; vendor_id: string; vendor_name: string; vendor_category: string | null }> = {};
    const GENERIC = new Set(["gmail.com","yahoo.com","outlook.com","hotmail.com","icloud.com","aol.com","me.com","msn.com","live.com","comcast.net","proton.me","protonmail.com","mac.com"]);
    const domOf = (a: string) => { const p = a.split("@"); return p.length===2 ? p[1] : ""; };
    for (const v of vendors ?? []) {
      const k = (v.email || "").toLowerCase().trim();
      if (!k) continue;
      const meta = { event_id: v.event_id, vendor_id: v.id, vendor_name: v.business_name || v.contact_name || "Vendor", vendor_category: v.category };
      vendorBySender[k] = meta;
      const d = domOf(k);
      if (d && !GENERIC.has(d) && !vendorByDomain[d]) vendorByDomain[d] = meta;
    }

    // Learned vendor mapping (manual assigns from sender_map)
    const { data: senderVendor } = await admin
      .from("email_sender_map")
      .select("sender_address, event_id, vendor_id, vendor_name, vendor_category")
      .not("vendor_id", "is", null);
    const learnedVendorBySender: Record<string, { event_id: string; vendor_id: string; vendor_name: string; vendor_category: string | null }> = {};
    for (const r of senderVendor ?? []) {
      const k = (r.sender_address || "").toLowerCase();
      if (k && r.vendor_id) learnedVendorBySender[k] = { event_id: r.event_id, vendor_id: r.vendor_id, vendor_name: r.vendor_name || "Vendor", vendor_category: r.vendor_category };
    }

    // event_users (couples) - join users for email
    const { data: eu } = await admin
      .from("event_users")
      .select("event_id, users:users(email)");
    const coupleBySender: Record<string, string> = {};
    for (const r of eu ?? []) {
      const em = (r as any).users?.email?.toLowerCase().trim();
      if (em) coupleBySender[em] = r.event_id;
    }

    // Build name patterns (first names only, lowercased) for medium match
    const eventNames: Array<{ id: string; names: string[] }> = (events ?? []).map(e => ({
      id: e.id,
      names: [e.partner1_name, e.partner2_name]
        .filter(Boolean)
        .map((n: string) => n.toLowerCase().split(/\s+/)[0])
        .filter(n => n && n.length >= 3),
    }));

    const out: Record<string, { suggested_event_id: string; suggested_couple_name: string; confidence: "high" | "medium" | "low" } | null> = {};
    for (const e of emails) {
      const addr = parseAddress(e.from || "");
      let pick: { event_id: string; confidence: "high" | "medium" | "low" } | null = null;

      if (addr && mapBySender[addr]) {
        pick = { event_id: mapBySender[addr].event_id, confidence: "high" };
      } else if (addr && vendorBySender[addr]) {
        pick = { event_id: vendorBySender[addr], confidence: "high" };
      } else if (addr && coupleBySender[addr]) {
        pick = { event_id: coupleBySender[addr], confidence: "high" };
      } else {
        const hay = `${e.subject || ""} ${e.snippet || ""}`.toLowerCase();
        for (const ev of eventNames) {
          if (ev.names.length === 0) continue;
          const hits = ev.names.filter(n => hay.includes(n)).length;
          if (hits >= 2) { pick = { event_id: ev.id, confidence: "medium" }; break; }
          if (hits === 1 && !pick) pick = { event_id: ev.id, confidence: "low" };
        }
      }

      out[e.id] = pick
        ? { suggested_event_id: pick.event_id, suggested_couple_name: eventLabel[pick.event_id] || "Event", confidence: pick.confidence }
        : null;
    }

    return new Response(JSON.stringify({ suggestions: out }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e instanceof Error ? e.message : e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
