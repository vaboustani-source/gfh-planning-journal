import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from "../_shared/send-email.ts";
import { renderTemplate } from "../_shared/email-shell.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Human labels for vendor.category. Mirrors FRIENDLY_CATEGORY in
// src/components/vendor/VendorCard.tsx. Kept in sync manually.
const CATEGORY_LABEL: Record<string, string> = {
  venue: "Venue",
  caterer: "Caterer",
  planner: "Wedding Planner / Designer",
  photographer: "Photographer",
  videographer: "Videographer",
  hair: "Hair Stylist",
  makeup: "Makeup Artist",
  florals: "Florist",
  rentals: "Décor / Rentals",
  officiant: "Officiant",
  ceremony_music: "Ceremony Music",
  dj_band: "DJ / Band",
  photo_booth: "Photo Booth / Installation",
  fireworks: "Fireworks",
  shuttle: "Shuttle / Transportation",
  cake: "Cake / Dessert",
  invitations: "Invitations / Stationery",
  hotel: "Hotel",
  other: "Vendor",
};

const STAFF_ROLES = new Set(["admin", "event_director", "planner", "sales_manager", "marketing"]);

function firstNameOf(full: string | null | undefined): string {
  if (!full) return "there";
  return String(full).trim().split(/\s+/)[0] || "there";
}

function coupleNames(partner1?: string | null, partner2?: string | null): string {
  const a = (partner1 || "").trim();
  const b = (partner2 || "").trim();
  if (a && b) return `${a} & ${b}`;
  return a || b || "the couple";
}

function generateCheckinCode(): string {
  // 6-char base36, no confusable chars
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < 6; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(url, serviceKey);
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const vendorId = body?.vendor_id;
    if (!vendorId || typeof vendorId !== "string") {
      return new Response(JSON.stringify({ error: "vendor_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: vendor, error: vErr } = await admin
      .from("vendors")
      .select("id, email, business_name, contact_name, category, event_id")
      .eq("id", vendorId)
      .maybeSingle();

    if (vErr || !vendor) {
      return new Response(JSON.stringify({ error: "Vendor not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authorization: internal staff OR event member.
    const { data: userRow } = await admin
      .from("users")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    let allowed = STAFF_ROLES.has(userRow?.role ?? "");
    if (!allowed) {
      const { data: eu } = await admin
        .from("event_users")
        .select("id")
        .eq("event_id", vendor.event_id)
        .eq("user_id", userId)
        .maybeSingle();
      allowed = !!eu;
    }
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!vendor.email) {
      return new Response(JSON.stringify({ error: "This vendor has no email on file yet" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Event + director lookup.
    const { data: event } = await admin
      .from("events")
      .select("id, partner1_name, partner2_name, assigned_planner, checkin_code")
      .eq("id", vendor.event_id)
      .maybeSingle();

    if (!event) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ensure a stable per-event check-in code exists.
    let code = event.checkin_code as string | null;
    if (!code) {
      code = generateCheckinCode();
      await admin.from("events").update({ checkin_code: code }).eq("id", event.id);
    }

    // Resolve Event Director. Prefer assigned_planner if their role is
    // event_director/admin; otherwise fall back to any event_director, then
    // any admin.
    let director: { email: string | null; first_name: string | null; last_name: string | null; phone: string | null } | null = null;

    if (event.assigned_planner) {
      const { data: ap } = await admin
        .from("users")
        .select("email, first_name, last_name, phone, role")
        .eq("id", event.assigned_planner)
        .maybeSingle();
      if (ap && (ap.role === "event_director" || ap.role === "admin")) {
        director = ap;
      }
    }
    if (!director) {
      const { data: ed } = await admin
        .from("users")
        .select("email, first_name, last_name, phone")
        .eq("role", "event_director")
        .limit(1)
        .maybeSingle();
      director = ed ?? null;
    }
    if (!director) {
      const { data: adm } = await admin
        .from("users")
        .select("email, first_name, last_name, phone")
        .eq("role", "admin")
        .limit(1)
        .maybeSingle();
      director = adm ?? null;
    }

    const directorName = [director?.first_name, director?.last_name].filter(Boolean).join(" ").trim()
      || "The Gilbertsville Farmhouse Team";
    const directorEmail = director?.email || "experience@gilbertsvillefarmhouse.com";
    const directorCell = director?.phone || "the number in your welcome email";

    const vars = {
      vendor_contact_first_name: firstNameOf(vendor.contact_name || vendor.business_name),
      vendor_role: CATEGORY_LABEL[vendor.category] || "vendor",
      couple_names: coupleNames(event.partner1_name, event.partner2_name),
      event_director_name: directorName,
      event_director_cell: directorCell,
      timeline_link: "link coming soon",
      checkin_code: code,
    };

    const { subject, html } = await renderTemplate("vendor_checkin", { variables: vars });

    // Belt-and-suspenders: guarantee the [VCK-<code>] marker is present in
    // the subject even if an admin edits the template and removes it.
    const finalSubject = subject.includes(`[VCK-${code}]`)
      ? subject
      : `${subject} [VCK-${code}]`;

    await sendEmail({
      to: vendor.email,
      subject: finalSubject,
      html,
      replyTo: directorEmail,
    });

    await admin
      .from("vendors")
      .update({ checkin_sent: true, checkin_sent_at: new Date().toISOString() })
      .eq("id", vendorId);

    // Activity log, mirroring the COI flow.
    try {
      await admin.from("change_history").insert({
        table_name: "vendors",
        record_id: vendorId,
        action: "checkin_sent",
        changed_by: userId,
      } as any);
    } catch (logErr) {
      console.error("[send-vendor-checkin] change_history log failed", logErr);
    }

    return new Response(JSON.stringify({ success: true, checkin_code: code }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[send-vendor-checkin]", e);
    return new Response(JSON.stringify({ success: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
