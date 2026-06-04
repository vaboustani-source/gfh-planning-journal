// Draft a reply for Brandon, grounded in the couple's real event data.
// Input: { event_id: string, conversation_id?: string }
// Returns: { draft: string }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT_TEMPLATE = `You are drafting a reply on behalf of Brandon, the event coordinator at Gilbertsville Farmhouse, a private estate wedding venue. You are writing to a couple planning their wedding. Write the way a warm, capable, down-to-earth person actually writes, not the way an AI writes.
You will be given the couple's actual event details below. Use these real facts in your reply when relevant. If the couple asks about something covered by the event details (their dates, payments, vendors, guest count, timeline), answer with the real information. If they ask something the details don't cover, do not invent an answer. Instead write that you'll confirm and follow up, in a natural way.
Voice: Confident and reassuring without being formal or stiff. Warm and human. Unhurried. You have everything handled and the couple should feel that calm.
Hard rules:
- NEVER use em-dashes or en-dashes. Use periods, commas, parentheses, or restructure the sentence instead.
- Vary your sentence length. Mix short sentences with longer ones. Do not write in a steady medium rhythm.
- Be direct. If something matters, just say it. Do not write 'it's worth noting that' or 'I wanted to reach out to let you know.' Just say the thing.
- No corporate filler. Banned words and phrases: leverage, seamless, robust, elevate, navigate (metaphorical), landscape (metaphorical), delve, dive in, unpack, at the end of the day, rest assured, please don't hesitate, we're thrilled, so excited, amazing, magical, unforgettable, rustic, charming, countryside.
- No sycophantic openers like 'Great question!'
- Do not restate everything at the end. Trust the reader.
- Sound like a person who cares about what they're saying, not a model trying to sound polished.
- Sign off as Brandon.
Keep replies concise. Answer what was asked, confirm next steps if relevant, and close warmly but briefly. This is a real message to a real couple, written by a real person.
Here are the couple's actual event details:
{{CONTEXT_PACKET}}`;

function fmtDate(d: string | null | undefined): string {
  if (!d) return "not set";
  try {
    return new Date(d).toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
  } catch { return d; }
}

function fmtMoney(n: number | null | undefined): string {
  if (n === null || n === undefined) return "$0";
  return `$${Number(n).toLocaleString("en-US")}`;
}

async function buildContextPacket(
  supabase: ReturnType<typeof createClient>,
  eventId: string,
): Promise<string> {
  const todayStr = new Date().toISOString().slice(0, 10);

  const [
    eventRes, euRes, guestsRes, vendorsRes, expRes,
    paymentsRes, milestonesRes, checklistRes, ceremonyRes,
    mealsRes, messagesRes,
  ] = await Promise.all([
    supabase.from("events").select("*").eq("id", eventId).maybeSingle(),
    supabase.from("event_users").select("user_id, display_name, role_in_event").eq("event_id", eventId),
    supabase.from("guests").select("rsvp_status").eq("event_id", eventId),
    supabase.from("vendors").select("category, name, contact_name").eq("event_id", eventId),
    supabase.from("experience_requests").select("status, catalog_item_id, preferred_day, guest_count, hours, experience_catalog(name)").eq("event_id", eventId).eq("status", "approved"),
    supabase.from("payment_schedule").select("label, due_date, amount, paid, paid_date, track").eq("event_id", eventId).order("due_date", { ascending: true }),
    supabase.from("milestones").select("title, target_date, status, timeframe_label").eq("event_id", eventId).neq("status", "complete").order("target_date", { ascending: true }).limit(5),
    supabase.from("checklist_items").select("label, owner, section, status").eq("event_id", eventId).neq("status", "complete").limit(15),
    supabase.from("ceremony_details").select("*").eq("event_id", eventId).maybeSingle(),
    supabase.from("meal_events").select("meal_type, location, adult_count, kids_count, vendor_count").eq("event_id", eventId),
    supabase.from("messages").select("body, sender_id, created_at").eq("event_id", eventId).order("created_at", { ascending: false }).limit(5),
  ]);

  const event: any = eventRes.data ?? {};
  const eventUsers: any[] = (euRes.data as any[]) ?? [];
  const couples = eventUsers.filter((u) => u.role_in_event === "couple").map((u) => u.display_name).filter(Boolean);
  const coupleNames = couples.length ? couples.join(" & ") : (event.partner1_name && event.partner2_name ? `${event.partner1_name} & ${event.partner2_name}` : event.title || "the couple");

  const guests: any[] = (guestsRes.data as any[]) ?? [];
  const confirmed = guests.filter((g) => g.rsvp_status === "confirmed").length;
  const declined = guests.filter((g) => g.rsvp_status === "declined").length;
  const awaiting = guests.length - confirmed - declined;

  const vendors: any[] = (vendorsRes.data as any[]) ?? [];
  const vendorLines = vendors
    .filter((v) => v.name)
    .map((v) => `  - ${v.category || "Vendor"}: ${v.name}${v.contact_name ? ` (${v.contact_name})` : ""}`)
    .join("\n") || "  (none assigned yet)";

  const experiences: any[] = (expRes.data as any[]) ?? [];
  const expLines = experiences
    .map((e) => `  - ${e.experience_catalog?.name || "Experience"}${e.preferred_day ? ` on ${e.preferred_day}` : ""}${e.guest_count ? ` for ${e.guest_count} guests` : ""}`)
    .join("\n") || "  (none confirmed)";

  const payments: any[] = (paymentsRes.data as any[]) ?? [];
  const paid = payments.filter((p) => p.paid);
  const unpaid = payments.filter((p) => !p.paid);
  const overdue = unpaid.filter((p) => p.due_date && p.due_date < todayStr);
  const upcoming = unpaid.filter((p) => !p.due_date || p.due_date >= todayStr);
  const paidTotal = paid.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const unpaidTotal = unpaid.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const paymentLines = [
    ...overdue.map((p) => `  - OVERDUE: ${p.label} ${fmtMoney(p.amount)} (was due ${fmtDate(p.due_date)})`),
    ...upcoming.slice(0, 5).map((p) => `  - Upcoming: ${p.label} ${fmtMoney(p.amount)} due ${fmtDate(p.due_date)}`),
    ...paid.slice(-3).map((p) => `  - Paid: ${p.label} ${fmtMoney(p.amount)} on ${fmtDate(p.paid_date)}`),
  ].join("\n") || "  (no payment schedule)";

  const milestones: any[] = (milestonesRes.data as any[]) ?? [];
  const milestoneLines = milestones
    .map((m) => `  - ${m.title}${m.target_date ? ` (target ${fmtDate(m.target_date)})` : ""}`)
    .join("\n") || "  (none upcoming)";

  const checklist: any[] = (checklistRes.data as any[]) ?? [];
  const checklistLines = checklist
    .slice(0, 8)
    .map((c) => `  - ${c.label}${c.owner ? ` [${c.owner}]` : ""}`)
    .join("\n") || "  (nothing outstanding)";

  const ceremony: any = ceremonyRes.data ?? {};
  const meals: any[] = (mealsRes.data as any[]) ?? [];
  const mealLines = meals
    .map((m) => `  - ${m.meal_type}${m.location ? ` at ${m.location}` : ""}${m.adult_count != null ? ` (${m.adult_count} adults${m.kids_count ? `, ${m.kids_count} kids` : ""})` : ""}`)
    .join("\n") || "  (no meals configured)";

  const messages: any[] = (messagesRes.data as any[]) ?? [];
  const recentMessages = messages.slice().reverse();
  const msgLines = recentMessages
    .map((m) => {
      const eu = eventUsers.find((u: any) => u.user_id === m.sender_id);
      const who = eu?.display_name || (eu?.role_in_event === "couple" ? "Couple" : "Brandon");
      const body = (m.body || "").toString().replace(/\s+/g, " ").trim();
      return `  - ${who}: ${body.slice(0, 280)}`;
    })
    .join("\n") || "  (no prior messages)";

  return `COUPLE: ${coupleNames}
WEDDING DATE: ${fmtDate(event.wedding_date)}
ARRIVAL: ${fmtDate(event.arrival_date)}
DEPARTURE: ${fmtDate(event.departure_date)}
PACKAGE: ${event.package_tier || "not set"}
GUEST COUNT: ${confirmed} confirmed, ${declined} declined, ${awaiting} awaiting (estimated ${event.estimated_guest_count ?? "?"})
CEREMONY LOCATION: ${event.ceremony_location || "not finalized"}
COCKTAIL HOUR: ${event.cocktail_hour_location || "not finalized"}
REHEARSAL DINNER: ${event.rehearsal_dinner_location || "not finalized"}
TASTING DATE: ${fmtDate(event.tasting_date)}

ASSIGNED VENDORS:
${vendorLines}

CONFIRMED EXPERIENCES:
${expLines}

MEALS:
${mealLines}

CEREMONY NOTES: officiant ${ceremony.officiant_name || "TBD"}; first dance: ${ceremony.first_dance_song || "TBD"}.

PAYMENT SCHEDULE (paid total ${fmtMoney(paidTotal)}, outstanding ${fmtMoney(unpaidTotal)}):
${paymentLines}

UPCOMING MILESTONES:
${milestoneLines}

OUTSTANDING CHECKLIST ITEMS:
${checklistLines}

LAST 5 MESSAGES IN THIS CONVERSATION (oldest first):
${msgLines}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const eventId: string | undefined = body.event_id || body.conversation_id;
    if (!eventId) {
      return new Response(JSON.stringify({ error: "event_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const contextPacket = await buildContextPacket(supabase, eventId);
    const systemPrompt = SYSTEM_PROMPT_TEMPLATE.replace("{{CONTEXT_PACKET}}", contextPacket);

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: systemPrompt,
        messages: [
          { role: "user", content: "Draft Brandon's next reply to the couple based on their most recent message in the conversation above. Output only the reply text, no preamble." },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error("Anthropic error", anthropicRes.status, errText);
      return new Response(JSON.stringify({ error: "AI request failed", detail: errText }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await anthropicRes.json();
    const draft: string = (data.content || [])
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n")
      .trim();

    return new Response(JSON.stringify({ draft }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("draft-reply error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
