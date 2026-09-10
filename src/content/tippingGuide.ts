/* ── Tipping Guide ────────────────────────────────────────
   Two parts. Our own team first (the estate's guide, by role,
   no names), then the outside vendors a couple hires.
   The text is the same for every couple, so it lives here.
   Edit copy and ranges in this file only.
   ─────────────────────────────────────────────────────── */

export const TIPPING_INTRO =
  "This is a delicate subject. We do not want you to feel pressured to tip anyone on our staff. We do what we do because we enjoy it, and we love making you and your guests happy. Many couples still want to show their gratitude in the form of a tip and ask us for guidance, so here it is.";

export const TIPPING_BASIS =
  "These suggested ranges are based on what past couples and families have graciously given.";

export const TIPPING_CLOSING =
  "The owners accept hugs and five-star reviews only.";

/* ── Our team ──────────────────────────────────────────── */

export interface Tier {
  /** Short label for the chip, e.g. "$600–800". */
  range: string;
  /** Low end of the range; the planner starts here and the couple can edit it. */
  low: number;
  /** A sample note in the register past couples have used. */
  note: string;
}

export interface TeamRole {
  slug: string;
  title: string;
  description: string;
  /** Roles that are usually more than one person let the couple set a count. */
  perPerson?: boolean;
  countHint?: string;
  tiers: Tier[];
  /** Roles without tiers are informational only (e.g. the catering team). */
  info?: string;
}

export const TEAM_ROLES: TeamRole[] = [
  {
    slug: "weekend-event-coordinator",
    title: "Weekend Event Coordinator",
    description: "Leader of our Experience Team and your day-of planner: your right hand from the moment you book your date to the day of your event.",
    tiers: [
      { range: "$600–800", low: 600, note: "Thank you for your services as our event coordinator." },
      { range: "$800–1,200", low: 800, note: "There is no way we could have done this without you. Thank you so much!" },
      { range: "$1,200–1,600+", low: 1200, note: "This was unforgettable, and the best time of our lives. Your work let us be stress-free through all of it. Thank you for the best wedding ever!" },
    ],
  },
  {
    slug: "resort-coordinator",
    title: "Resort Coordinator",
    description: "Leader of our Guest Services Team: oversees the resort for the entire weekend and makes sure you and your guests have everything you need.",
    tiers: [
      { range: "$100–250", low: 100, note: "Thank you for all of your help as our resort coordinator." },
      { range: "$250–350", low: 250, note: "You were fabulous. Thank you so much!" },
      { range: "$350–500+", low: 350, note: "You went above and beyond, made our weekend stress-free and work-free, and we are forever grateful." },
    ],
  },
  {
    slug: "lead-guest-attendant",
    title: "Lead Guest Attendant",
    description: "Your right hand from the moment you arrive to the moment you leave us.",
    tiers: [
      { range: "$100–200", low: 100, note: "Thank you for all of your help." },
      { range: "$250–350", low: 250, note: "You were awesome. Thank you so much!" },
      { range: "$350–500+", low: 350, note: "You went beyond the call of duty and we could not have done this without you." },
    ],
  },
  {
    slug: "guest-attendants",
    title: "Guest Attendants",
    description: "Part of our Guest Services Team, on site during your entire stay and attending to your every need.",
    perPerson: true,
    countHint: "Your Resort Coordinator can tell you how many attendants will be on your weekend.",
    tiers: [
      { range: "$50–100 each", low: 50, note: "Thank you for all of your help." },
      { range: "$150–200 each", low: 150, note: "You were fantastic. Thank you so much!" },
      { range: "$250+ each", low: 250, note: "You were one of the best parts of our weekend and we are so grateful for everything you did for us." },
    ],
  },
  {
    slug: "cleaning",
    title: "Cleaning Team",
    description: "The people who make our lodging and venue look amazing for you and your guests. They make our barns look like last night never happened, and they keep every space properly cleaned and safe.",
    tiers: [
      { range: "$20–50", low: 20, note: "Thank you for your service. Everything looked great." },
      { range: "$60–100", low: 60, note: "We really appreciate how hard you worked to make every space beautiful. It showed." },
    ],
  },
  {
    slug: "catering",
    title: "Catering Team",
    description: "Chefs, kitchen staff, and waitstaff.",
    info: "You are already tipping our entire catering team through the gratuity included in your catering bill. If you feel so inclined, you are welcome to tip our chefs or any catering team member directly, or the group as a whole. Nothing more is expected.",
    tiers: [],
  },
];

/* ── Before the envelopes ─────────────────────────────── */

export const ENVELOPE_BASICS: { lead: string; text: string }[] = [
  { lead: "Read your contracts first.", text: "Gratuity is often built into catering and transportation agreements. When it is, no additional tip is expected." },
  { lead: "Ask what a service charge covers.", text: "A service charge is a mandatory fee on a venue or catering contract, and it does not always go to the people serving you." },
  { lead: "Owners do not need a tip.", text: "You are already paying what a business owner set as a fair price. Their employees are the ones to tip. A tip for an owner is a kind gesture for exceptional work, not an expectation." },
  { lead: "Prepare the envelopes ahead of time.", text: "Visit the bank before the weekend, put each tip in a labeled envelope, and hand them to your Weekend Event Coordinator at the rehearsal. They will make sure each one reaches the right person at the right moment." },
  { lead: "Tipping is never mandatory.", text: "If funds are tight, a handwritten note, a five-star review, or a recommendation to friends means a great deal." },
];

/* ── Outside vendors ──────────────────────────────────── */

export type Expectation = "expected" | "recommended" | "optional";

export interface VendorGuide {
  slug: string;
  title: string;
  expectation: Expectation;
  /** Shown on the tile. */
  amount: string;
  when: string;
  detail: string[];
}

export const VENDOR_GUIDES: VendorGuide[] = [
  {
    slug: "hair-makeup",
    title: "Hair & Makeup",
    expectation: "expected",
    amount: "15–25% of the fee",
    when: "After the wedding party is styled",
    detail: ["Give it to the lead stylist. They will distribute it among the team."],
  },
  {
    slug: "photo-video",
    title: "Photographer & Videographer",
    expectation: "recommended",
    amount: "$100–200",
    when: "At the end of the reception",
    detail: ["If they own the business, no tip is necessary. A gratuity is a nice gesture if they went above and beyond.", "Second shooters and assistants are employees and appreciate an envelope of their own."],
  },
  {
    slug: "photo-booth",
    title: "Photo Booth Attendant",
    expectation: "recommended",
    amount: "$50–100",
    when: "At the start of the wedding, or at the end of the reception",
    detail: ["Depends on the length of service and the number of guests."],
  },
  {
    slug: "florist",
    title: "Florist",
    expectation: "optional",
    amount: "10–20%",
    when: "At final invoice, or after the honeymoon",
    detail: ["Your florist may not expect a tip. If they were heavily involved in the design, with a lot of back and forth, sourcing specialty items, and revisions, a tip is a thoughtful way to say so."],
  },
  {
    slug: "planner",
    title: "Wedding Planner",
    expectation: "optional",
    amount: "10–20%",
    when: "At the end of the reception, or after the honeymoon",
    detail: ["A gratuity is appreciated if you feel your planner went above and beyond.", "Planner's assistants on site: $50–100 each.", "A day-of coordinator who is not the owner of the business: $50–200."],
  },
  {
    slug: "officiant",
    title: "Officiant",
    expectation: "recommended",
    amount: "$50–300",
    when: "After the rehearsal, or before the ceremony",
    detail: ["If your officiant is affiliated with a house of worship, give a donation of $100–300 to the institution.", "For a civil officiant, $50–100."],
  },
  {
    slug: "ceremony-musicians",
    title: "Ceremony Musicians",
    expectation: "recommended",
    amount: "$25–50 per player",
    when: "Before the ceremony",
    detail: ["Hand it to each musician, or to the lead with the count noted."],
  },
  {
    slug: "band",
    title: "Reception Band or DJ",
    expectation: "expected",
    amount: "$25–50 per player, $100 to the lead",
    when: "At the end of the reception",
    detail: ["Each player receives $25–50. The bandleader, MC, or DJ receives $100."],
  },
  {
    slug: "alterations",
    title: "Attire Alterations",
    expectation: "recommended",
    amount: "$20–40",
    when: "When you pick up your dress or suit",
    detail: ["Usually optional. If your fitter went above and beyond and their shop allows tipping, this is a kind thank-you."],
  },
  {
    slug: "transportation",
    title: "Transportation",
    expectation: "recommended",
    amount: "$50–100 per driver",
    when: "Before the last ride",
    detail: ["Gratuity is often included in the fee. Check your contract first."],
  },
  {
    slug: "valet",
    title: "Valet",
    expectation: "recommended",
    amount: "$1–2 per car",
    when: "At the end of the reception",
    detail: ["More if the weather had them running cars in the rain or snow."],
  },
  {
    slug: "rentals",
    title: "Rental Company",
    expectation: "optional",
    amount: "$25 per crew member",
    when: "After delivery is complete, before the crew departs",
    detail: ["If the setup crew arranges tables and chairs and does an exceptional job, $25 per crew member is appreciated but not expected.", "If the owner delivers and sets up personally, $50–200 at final invoice or after the honeymoon."],
  },
  {
    slug: "outside-catering",
    title: "Outside Caterer or Bar Service",
    expectation: "expected",
    amount: "20% of the bill, or per person",
    when: "At the end of the reception, if not in the bill",
    detail: ["Most caterers include gratuity in their service fee. If not: 20% of the food and drink bill to the catering manager to split, or $30–40 per server and bartender and $100–200 per manager, chef, and kitchen assistant.", "A private bar service: 10–15% of the pre-tax bar tab, split among the team, and not more than $250. Ask them not to set out a tip jar so your guests never feel obligated."],
  },
];

export const EXPECTATION_LABEL: Record<Expectation, string> = {
  expected: "Tip expected",
  recommended: "Tip recommended",
  optional: "Tip optional",
};
