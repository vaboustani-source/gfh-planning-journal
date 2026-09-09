// AI guest list import.
// Takes any pasted spreadsheet text (Google Sheets paste, CSV, TSV, a plain list)
// and organizes it into guest rows that match the Our People guest list.
// Nothing is saved here. The client shows the result in a review grid first.
//
// Input:  { event_id: string, text: string, hint?: string }
// Output: { layout_summary: string, guests: GuestRow[], skipped: { source, reason }[] }

import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.124.0";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk@0.124.0/helpers/zod";
import { z } from "npm:zod@4.5.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_CHARS = 60_000;

const GuestRow = z.object({
  first_name: z.string(),
  last_name: z.string(),
  email: z.string(),
  phone: z.string(),
  is_child: z.boolean(),
  is_plus_one: z.boolean(),
  plus_one_of: z.string(),
  lodging_preference: z.enum(["on_site", "off_site", "undecided"]),
  rsvp_status: z.enum(["invited", "confirmed", "declined", "maybe"]),
  side: z.enum(["partner_1", "partner_2", "both", "other", "unknown"]),
  relationship: z.enum([
    "immediate_family", "extended_family", "wedding_party", "friend", "coworker", "other", "unknown",
  ]),
  notes: z.string(),
  source: z.string(),
});

const ImportResult = z.object({
  layout_summary: z.string(),
  guests: z.array(GuestRow),
  skipped: z.array(z.object({ source: z.string(), reason: z.string() })),
});

const SYSTEM_PROMPT = `You organize wedding guest lists for Gilbertsville Farmhouse, a private estate wedding venue. Couples keep their guest lists in spreadsheets of every possible shape: address lists for invitations, lodging and room assignment sheets, RSVP trackers, headcount grids, or a plain list of names. You will be given the raw text of one of those sheets, pasted straight out of a spreadsheet, and you turn it into one clean row per person for the venue's guest list.

Output rules:
- One row per individual person. Split households and couples into separate people. "Edgardo and Maria Kramer" is two rows, Edgardo Kramer and Maria Kramer. "Aldo, Sharon, Olivia, Aldo Boustani" is four rows, all with last name Boustani. "Mr. and Mrs. Dakota Festian" is two rows: Dakota Festian and a second Festian whose first name you do not know, so use first_name "Mrs." only if nothing better is available and mention it in notes.
- When a last name is only written once for a group, apply it to everyone in the group unless the text clearly shows different surnames.
- "and Guest", "+1", "and a guest" means a plus-one. Add a row with first_name "Guest", the primary person's last name, is_plus_one true, and plus_one_of set to the primary person's full name.
- "& Daughters", "& Family", "and kids" with no names: do not invent people. Keep the named person, set notes to say the row mentioned unnamed family members, and put any headcount you can see in notes.
- Children: set is_child true only when the sheet says child, kid, daughter, son, or a similar clear signal.
- Names in ALL CAPS or all lowercase should be written in normal Title Case.
- Do not invent emails or phone numbers. Leave them as empty strings when the sheet has none.
- lodging_preference: "on_site" when the sheet marks the person as on-site, staying on the property, or assigns them a room, cabin, suite, inn room, or village unit. "off_site" when the sheet marks them as off-site, hotel, or not staying. Otherwise "undecided".
- rsvp_status: "confirmed" for yes, attending, accepted, or confirmed. "declined" for no or regrets. "maybe" for maybe or tentative. Otherwise "invited".
- side: use partner names given in the context to decide partner_1 or partner_2 when the sheet says whose guest someone is (for example "Shaw's friends" when a partner's name is Shaw). Use "both" for shared friends, "other" for vendors or staff. Use "unknown" when you cannot tell.
- relationship: choose the closest option only when the sheet gives a clear signal (Mom & Dad, parents, sister, grandparents are immediate_family; aunt, uncle, cousin are extended_family; groomsman, bridesmaid, GM, BM, best man, maid of honor are wedding_party; friend or BFF is friend; coworker or work is coworker). Otherwise "unknown".
- notes: keep every useful detail that has no column of its own, written as short readable phrases separated by periods. Examples: "Room: Village 4." "Staying Friday night only." "Mailing address: 58 Mallard Road, Manhasset, NY 11030." "Groomsman 7 of 8." "Row was highlighted in the original sheet." Do not repeat the person's name in notes.
- source: the original line or cell text the row came from, trimmed, so a human can check your work.
- Skip header rows, section labels, totals, blank lines, and column titles. Skip the couple themselves if a row is clearly the couple getting married, and list it under skipped with the reason. List anything else you could not turn into a person under skipped with a short reason.
- layout_summary: two or three plain sentences describing what kind of sheet this was and how you read the columns, so the person importing can confirm you understood it. No em dashes or en dashes anywhere in your output.`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "ANTHROPIC_API_KEY not configured" }, 500);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Who is calling, and may they touch this event?
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Not signed in" }, 401);

    const body = await req.json().catch(() => ({}));
    const eventId: string | undefined = body.event_id;
    const text: string = typeof body.text === "string" ? body.text : "";
    const hint: string = typeof body.hint === "string" ? body.hint.trim() : "";
    if (!eventId) return json({ error: "event_id required" }, 400);
    if (!text.trim()) return json({ error: "Paste or upload a guest list first" }, 400);
    if (text.length > MAX_CHARS) {
      return json({ error: `That is a lot of text (${text.length.toLocaleString()} characters). Paste it in a few smaller batches.` }, 413);
    }

    const svc = createClient(supabaseUrl, serviceKey);
    const { data: caller } = await svc.from("users").select("role").eq("id", user.id).maybeSingle();
    const isAdmin = caller?.role === "admin";
    if (!isAdmin) {
      const { data: membership } = await svc
        .from("event_users").select("user_id").eq("event_id", eventId).eq("user_id", user.id).maybeSingle();
      if (!membership) return json({ error: "You do not have access to this wedding" }, 403);
    }

    const { data: event } = await svc
      .from("events").select("partner1_name, partner2_name, wedding_date").eq("id", eventId).maybeSingle();

    const context = [
      `Partner 1: ${event?.partner1_name || "unknown"}`,
      `Partner 2: ${event?.partner2_name || "unknown"}`,
      `Wedding date: ${event?.wedding_date || "unknown"}`,
    ].join("\n");

    const userContent =
      `EVENT CONTEXT\n${context}\n\n` +
      (hint ? `NOTE FROM THE PERSON IMPORTING\n${hint}\n\n` : "") +
      `SPREADSHEET TEXT (tabs separate columns)\n<sheet>\n${text}\n</sheet>\n\n` +
      `Organize this into guest rows.`;

    const client = new Anthropic({ apiKey });
    const stream = client.messages.stream({
      model: "claude-opus-5",
      max_tokens: 64000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
      output_config: { effort: "medium", format: zodOutputFormat(ImportResult) },
    });
    const message = await stream.finalMessage();

    if (message.stop_reason === "refusal") {
      return json({ error: "The AI declined to process this text. Try a smaller or cleaner paste." }, 502);
    }
    if (message.stop_reason === "max_tokens") {
      return json({ error: "That list is too long to organize in one go. Paste it in smaller batches." }, 413);
    }

    const raw = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      console.error("ai-guest-import: response was not JSON", raw.slice(0, 500));
      return json({ error: "The AI response could not be read. Please try again." }, 502);
    }
    const result = ImportResult.safeParse(parsedJson);
    if (!result.success) {
      console.error("ai-guest-import: schema mismatch", result.error.issues.slice(0, 5));
      return json({ error: "The AI response did not match the expected shape. Please try again." }, 502);
    }

    return json({
      ...result.data,
      usage: {
        input_tokens: message.usage.input_tokens,
        output_tokens: message.usage.output_tokens,
      },
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) {
      return json({ error: "The AI is busy right now. Wait a minute and try again." }, 429);
    }
    if (e instanceof Anthropic.APIError) {
      console.error("ai-guest-import: Anthropic error", e.status, e.message);
      return json({ error: `AI request failed (${e.status})` }, 502);
    }
    console.error("ai-guest-import error", e);
    return json({ error: String(e) }, 500);
  }
});
