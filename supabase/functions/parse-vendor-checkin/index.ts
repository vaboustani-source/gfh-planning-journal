// Vendor Check-In reply parser (Phase 2).
// Accepts EITHER a gmail_message_id (fetches body via shared gmail helper)
// OR raw_text + event_id + vendor_id (for testing without an inbox).
// Uses the existing Anthropic setup (ANTHROPIC_API_KEY) to extract structured
// answers from the vendor's reply, then upserts into vendor_checkin_responses
// keyed on gmail_message_id (idempotent).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, gmailApi, parseGmailMessage, refreshAccessToken } from "../_shared/gmail.ts";
import { loadMatchContext, matchVendorForSender } from "../_shared/vendor-match.ts";

const STAFF_ROLES = new Set(["admin", "event_director", "planner", "sales_manager", "marketing"]);

const EXTRACTION_SYSTEM = `You extract structured answers from a wedding vendor's reply email.
The vendor was asked five questions:
1. How many people will be coming, and their names?
2. If you'll be here during dinner service on either day, does anyone have a dietary restriction or allergen?
3. Do you need anything set up by our team?
4. What time will you be arriving and leaving?
5. (informational, not a required field)

Return STRICT JSON with this exact shape and no prose, no code fences:
{
  "headcount": number | null,
  "attendee_names": string[],
  "at_dinner": boolean | null,
  "dietary_allergens": string,
  "setup_needs": string,
  "arrival": string,
  "departure": string,
  "parse_confidence": number
}

Rules:
- headcount: integer count of vendor team members attending. null if unclear.
- attendee_names: array of names mentioned. Empty array if none.
- at_dinner: true if they say they will be present during dinner service, false if they say they will not, null if unclear/not addressed.
- dietary_allergens: verbatim summary of any dietary restrictions or allergens. Empty string if none reported.
- setup_needs: what they need set up by our team. Empty string if nothing.
- arrival / departure: free-form time/day strings as written by the vendor. Empty strings if not given.
- parse_confidence: 0.0-1.0 self-assessment of how clearly the reply answered the questions.
`;

function safeSubjectCode(subject: string | null | undefined): string | null {
  if (!subject) return null;
  const m = subject.match(/\[VCK-([A-Z0-9]{4,10})\]/i);
  return m ? m[1].toUpperCase() : null;
}

async function callAnthropic(apiKey: string, replyText: string): Promise<any> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      system: EXTRACTION_SYSTEM,
      messages: [{ role: "user", content: `Vendor reply:\n\n${replyText}\n\nReturn only the JSON object.` }],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Anthropic ${res.status}: ${t}`);
  }
  const data = await res.json();
  const text: string = (data.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();
  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  const jsonStr = jsonStart >= 0 && jsonEnd > jsonStart ? text.slice(jsonStart, jsonEnd + 1) : text;
  return JSON.parse(jsonStr);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey);

    // Authorization: internal staff via JWT OR service-role (internal caller).
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    let callerUserId: string | null = null;
    let isServiceCall = false;
    if (jwt && jwt === serviceKey) {
      isServiceCall = true;
    } else if (jwt) {
      const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
      });
      const { data: u } = await userClient.auth.getUser();
      if (u?.user) {
        const { data: row } = await admin.from("users").select("role").eq("id", u.user.id).maybeSingle();
        if (STAFF_ROLES.has(row?.role ?? "")) {
          callerUserId = u.user.id;
        }
      }
    }
    if (!isServiceCall && !callerUserId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const gmailMessageId: string | undefined = body?.gmail_message_id;
    const inputRawText: string | undefined = body?.raw_text;
    const inputEventId: string | undefined = body?.event_id;
    const inputVendorId: string | undefined = body?.vendor_id;

    let eventId: string | null = inputEventId ?? null;
    let vendorId: string | null = inputVendorId ?? null;
    let rawText: string | null = inputRawText ?? null;
    let gmailThreadId: string | null = null;
    let subject: string | null = null;
    let fromAddress: string | null = null;

    if (gmailMessageId) {
      // Idempotency: skip if already parsed.
      const { data: existing } = await admin
        .from("vendor_checkin_responses")
        .select("id")
        .eq("gmail_message_id", gmailMessageId)
        .maybeSingle();
      if (existing) {
        return new Response(JSON.stringify({ ok: true, skipped: "already_parsed", id: existing.id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // If the caller already has a project_emails row (from gmail-sync-filed),
      // use that. Otherwise fetch from Gmail directly.
      const { data: pe } = await admin
        .from("project_emails")
        .select("event_id, gmail_thread_id, subject, from_address, body_text, body_html")
        .eq("gmail_message_id", gmailMessageId)
        .maybeSingle();

      if (pe) {
        eventId = eventId ?? pe.event_id;
        gmailThreadId = pe.gmail_thread_id ?? null;
        subject = pe.subject ?? null;
        fromAddress = pe.from_address ?? null;
        rawText = rawText ?? pe.body_text ?? stripHtml(pe.body_html || "");
      } else {
        const { data: conn } = await admin
          .from("gmail_connections")
          .select("*")
          .order("connected_at", { ascending: false })
          .limit(1).maybeSingle();
        if (!conn) throw new Error("No Gmail connection available to fetch message");
        const accessToken = await refreshAccessToken(conn.refresh_token);
        const msg = await gmailApi(accessToken, `/messages/${gmailMessageId}?format=full`);
        const p = parseGmailMessage(msg);
        gmailThreadId = p.threadId;
        subject = p.subject;
        fromAddress = p.from_address;
        rawText = rawText ?? p.body_text ?? stripHtml(p.body_html || "");
      }

      // Resolve event via VCK code in subject if we still don't have one.
      if (!eventId) {
        const code = safeSubjectCode(subject);
        if (code) {
          const { data: ev } = await admin.from("events").select("id").eq("checkin_code", code).maybeSingle();
          if (ev) eventId = ev.id;
        }
      }

      // Resolve vendor via existing match logic if not provided.
      if (eventId && !vendorId && fromAddress) {
        const ctx = await loadMatchContext(admin, eventId);
        const vm = matchVendorForSender(fromAddress, ctx);
        vendorId = vm.vendor_id;
        if (!vendorId) {
          // Fallback: exact email match within event vendors (already handled) then case-insensitive.
          const { data: v } = await admin
            .from("vendors")
            .select("id")
            .eq("event_id", eventId)
            .ilike("email", fromAddress)
            .maybeSingle();
          if (v) vendorId = v.id;
        }
      }
    }

    if (!eventId) {
      return new Response(JSON.stringify({ error: "Could not resolve event_id (no VCK code match and none provided)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!rawText || !rawText.trim()) {
      return new Response(JSON.stringify({ error: "raw_text is empty" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");
    const extracted = await callAnthropic(apiKey, rawText);

    const dietary = String(extracted.dietary_allergens || "").trim();
    const confidence = typeof extracted.parse_confidence === "number" ? extracted.parse_confidence : 0.5;
    // Safety rule: dietary/allergen info OR low confidence => human review.
    const needsReview = !!dietary || confidence < 0.8;

    const row: any = {
      event_id: eventId,
      vendor_id: vendorId,
      gmail_message_id: gmailMessageId ?? null,
      gmail_thread_id: gmailThreadId,
      raw_text: rawText,
      headcount: Number.isFinite(extracted.headcount) ? Math.trunc(extracted.headcount) : null,
      attendee_names: Array.isArray(extracted.attendee_names) ? extracted.attendee_names.map(String) : [],
      at_dinner: typeof extracted.at_dinner === "boolean" ? extracted.at_dinner : null,
      dietary_allergens: dietary,
      setup_needs: String(extracted.setup_needs || ""),
      arrival: String(extracted.arrival || ""),
      departure: String(extracted.departure || ""),
      parse_confidence: confidence,
      needs_review: needsReview,
      status: "parsed",
      parsed_at: new Date().toISOString(),
    };

    let stored: any;
    if (gmailMessageId) {
      const { data, error } = await admin
        .from("vendor_checkin_responses")
        .upsert(row, { onConflict: "gmail_message_id" })
        .select("id").single();
      if (error) throw error;
      stored = data;
    } else {
      const { data, error } = await admin
        .from("vendor_checkin_responses")
        .insert(row).select("id").single();
      if (error) throw error;
      stored = data;
    }

    // Update vendor state.
    if (vendorId) {
      const now = new Date().toISOString();
      await admin.from("vendors").update({
        checkin_replied_at: now,
        checkin_parsed_at: now,
      }).eq("id", vendorId);
    }

    // Activity log.
    try {
      await admin.from("change_history").insert({
        table_name: "vendor_checkin_responses",
        record_id: stored.id,
        action: "checkin_parsed",
        changed_by: callerUserId,
      } as any);
    } catch (logErr) {
      console.error("[parse-vendor-checkin] change_history log failed", logErr);
    }

    return new Response(JSON.stringify({ ok: true, id: stored.id, needs_review: needsReview, parse_confidence: confidence, vendor_id: vendorId, event_id: eventId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[parse-vendor-checkin]", e);
    return new Response(JSON.stringify({ ok: false, error: String(e instanceof Error ? e.message : e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function stripHtml(html: string): string {
  return html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
