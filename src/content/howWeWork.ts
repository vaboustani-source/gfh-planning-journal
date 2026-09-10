/* ── How We Work ─────────────────────────────────────────
   The Service Expectations document, section by section.
   This text is the same for every couple, so it lives here
   rather than in the database. Edit copy in this file only.

   Anything in [square brackets] renders as a highlighted
   placeholder on the page so it is easy to find and fill.
   ─────────────────────────────────────────────────────── */

export type ListItem = { lead?: string; text: string };

export type Block =
  | { type: "p"; text: string; lead?: string; italic?: boolean }
  | { type: "heading"; text: string }
  | { type: "ul"; items: ListItem[] }
  | { type: "ol"; items: ListItem[] }
  | { type: "quote"; text: string }
  | { type: "note"; text: string }
  | { type: "table"; columns: string[]; rows: string[][]; pillColumn?: number }
  | { type: "cards"; cards: { title: string; items: string[] }[] }
  | { type: "rates" };

export interface Section {
  slug: string;
  title: string;
  blurb: string;
  /** True when the copy was drafted for Victoria to approve, not taken from the document. */
  draft?: boolean;
  blocks: Block[];
}

export interface Rate { item: string; rate: string; when: string }

/* ── Every fee in one place. Other sections quote these numbers; change them here. ── */
export const RATES: Rate[] = [
  { item: "Culinary consultation call", rate: "$100 / hour", when: "Beyond the included menu process" },
  { item: "Culinary emailed revision", rate: "$50 / revision", when: "Requires the culinary team's review" },
  { item: "Coordination planning call", rate: "$100 / hour, per call", when: "Beyond the post-booking, 90-day, and 30-day calls" },
  { item: "Coordination emailed revision", rate: "$50 / revision", when: "Timeline rebuilds, vendor re-coordination, layout changes" },
  { item: "After-hours manager", rate: "$150 / hour", when: "Thursday after 5:00 PM. Sunday after 2:00 PM." },
  { item: "After-hours manager, scissor lift in use", rate: "$200 / hour", when: "Replaces the $150 rate while the lift is in use" },
  { item: "Scissor lift", rate: "$260 / day", when: "Any elevated installation. Friday only." },
  { item: "Thursday design set-up supervision", rate: "$500", when: "A second set-up day, 9:00 AM to 5:00 PM" },
  { item: "Sunday breakdown beyond 2:00 PM", rate: "Supervision charges apply", when: "Standard after-hours manager rate" },
  { item: "Planner golf cart", rate: "Rented through an outside provider", when: "Certificate of insurance must cover its use" },
  { item: "Market-price menu items", rate: "Market", when: "Confirmed 30 days before the wedding" },
  { item: "Resort Coordinator", rate: "Complimentary", when: "Included with your estate buyout" },
  { item: "Vendor feedback and recommendations", rate: "Complimentary", when: "Always" },
];

export const HOW_WE_WORK_INTRO =
  "Nothing about your weekend should be a surprise, least of all how we work.";

export const HOW_WE_WORK_CLOSING =
  "Questions about anything above? Ask your Resort Coordinator. That's exactly what they're for.";

export const HOW_WE_WORK_SECTIONS: Section[] = [
  {
    slug: "our-roles",
    title: "Our Roles",
    blurb: "three roles, one principle.",
    blocks: [
      { type: "p", text: "Your weekend is supported by three roles: our culinary team, your Weekend Event Coordinator, and your Resort Coordinator. The scope of each role is laid out below." },
      { type: "p", text: "We have developed our planning protocol with a nurturing approach. Our standard planning allocation has been defined with one goal in mind: that you have an easy and successful planning process with us. If responsibilities exceed the allocated planning time or expectations, there is an option to add it at a billed per-hour rate. What falls outside it is available, billed simply and told to you in advance." },
      { type: "quote", text: "We've thoughtfully defined our scope of work to provide clear guidance from day one, so you can feel confident that nothing is left out of the planning process." },
      { type: "p", italic: true, text: "This document accompanies your event agreement. It exists so that nothing about your weekend is ever a surprise, least of all how we work." },
    ],
  },
  {
    slug: "food-beverage",
    title: "Food & Beverage",
    blurb: "how we design and bill your menu.",
    blocks: [
      { type: "p", text: "Our kitchen builds your menu with you. This is one of the great pleasures of the weekend, and we've designed the process to feel that way." },
      { type: "heading", text: "How your menu comes together" },
      { type: "ol", items: [
        { lead: "The introduction call.", text: "We walk you through your menu portal, show you how selections work, and talk through your initial ideas." },
        { lead: "Your selections.", text: "You explore the menu in your portal on your own time. Once selections are made for each event, submit your drafted menu for our review." },
        { lead: "The confirmation meeting.", text: "We review your selections together and book your tasting." },
        { lead: "The tasting.", text: "There are 3 pre-scheduled tasting dates each year. Each date has 10 family seatings, and once we receive 10 reservations for a date, it closes for booking. [Link: the tasting experience]" },
        { lead: "The final menu.", text: "After your tasting we submit your adjusted menu selections and send you a final review of that menu. You have two options at this point: accept it, or take one final revision to perfect it. Then it's done, and your kitchen gets to work." },
      ] },
      { type: "p", text: "This complete process is included in your Food & Beverage engagement." },
      { type: "heading", text: "Please note" },
      { type: "ul", items: [
        { lead: "Menu pricing is set, not negotiated.", text: "Our prices reflect exactly what it costs to source, prepare, and serve food at this standard. We hold that line for every couple equally. It is why the food is what it is." },
        { lead: "Market-price selections.", text: "Discretionary items are priced by the market, not the menu. We confirm the price thirty days before your wedding, when your guest count is final." },
        { lead: "Consultations beyond the process above", text: "are available at $100 per hour for calls and $50 per emailed revision requiring the culinary team's review." },
        { lead: "Nothing changes past 30 days.", text: "There are absolutely no changes, final guest count refunds, or revisions past 30 days, under any circumstances." },
      ] },
    ],
  },
  {
    slug: "dietary-needs",
    title: "Dietary Needs",
    blurb: "how every restriction is met.",
    blocks: [
      { type: "p", text: "Every allergy and restriction shared with us by the 30-day mark is accommodated. A guest with a dietary need should never feel like an exception at your table. Here is how we make that true:" },
      { type: "ul", items: [
        { lead: "Tell us early.", text: "All dietary needs are due with your final guest list, 30 days out. Each one is resolved dish by dish before your weekend begins." },
        { lead: "Ask your dietary guests to make themselves known.", text: "Before the weekend, we ask that you or your planner let these guests know that at each meal they should simply tell a server that an accommodation was made for them. They will be served accordingly." },
        { lead: "When many guests share a restriction, we may recommend a menu shift.", text: "If a significant share of your guests are gluten-free, vegetarian, or otherwise restricted, the most gracious answer is to offer a menu that everyone can enjoy. This reduces cross-contact risk. Our kitchen will advise you when we believe that's the right call, and build a menu accordingly." },
        { lead: "Dietary-friendly by design.", text: "We build menus so accommodation is woven in: courses and family-style spreads composed so that most needs are met by the menu itself." },
      ] },
    ],
  },
  {
    slug: "weekend-coordination",
    title: "Weekend Coordination",
    blurb: "your direct contact for event execution.",
    blocks: [
      { type: "p", text: "Your Weekend Event Coordinator runs the weekend events. They are the person who knows where everything is, when everything happens, and who is responsible for it. This allows for a responsibility-free weekend for you and your families." },
      { type: "heading", text: "Included in your Weekend Event Coordination fee" },
      { type: "ul", items: [
        { text: "Planning calls at the post-booking, 90-day, and 30-day marks" },
        { text: "Your complete weekend timeline, built with you and distributed to your vendors" },
        { text: "Vendor arrival coordination, load-in, and day-of direction" },
        { text: "Coordination of estate spaces: ceremony sites, reception spaces, the grounds" },
        { text: "Ceremony rehearsal direction" },
        { text: "Full on-site coordination from arrival Friday through departure Sunday" },
        { text: "Family and wedding party wrangling for points of interest during your weekend" },
      ] },
      { type: "heading", text: "Please note" },
      { type: "ul", items: [
        { text: "Calls beyond your included allotment are billed at $100 per hour, per call." },
        { text: "Emailed revisions requiring the team (timeline rebuilds, vendor re-coordination, layout changes) are billed at $50 per revision." },
        { lead: "Your coordinator does not plan your wedding; they execute it.", text: "Planning, invitations, vendor sourcing, and etiquette guidance belong to your planner. Your planner may also be responsible for ceremony rehearsal direction, plus vendor and day-of coordination. [Link: how our services adjust when a planner is involved]" },
      ] },
    ],
  },
  {
    slug: "resort-coordination",
    title: "Resort Coordination",
    blurb: "the estate and your guests, complimentary.",
    blocks: [
      { type: "p", text: "Your Resort Coordinator is included with your estate buyout, with our compliments. They are your point of contact for everything about the property itself: lodging, grounds, spaces, on-site experiences, and the logistics of the land." },
      { type: "heading", text: "Included, complimentary" },
      { type: "ul", items: [
        { text: "Guesthouse assignments and lodging coordination for your (up to) 122 on-site guests" },
        { text: "Property walkthroughs at booking and at your tasting visit" },
        { lead: "Guest services, all weekend long.", text: "From the moment your guests arrive until the moment they leave, the estate takes care of them: iced coolers, non-alcoholic beverages stocked, shuttle service running across the property, and amenities refreshed throughout the weekend." },
        { text: "Answers, promptly, about anything concerning the property and lodging" },
      ] },
      { type: "heading", text: "Please note" },
      { type: "ul", items: [
        { text: "This role covers the estate and your guests' comfort on it. It does not extend to vendor management, timeline building, or event design: those belong to your Weekend Event Coordinator and your planner, respectively." },
        { text: "Requests beyond scope are quoted before any work begins. Nothing is ever billed to you unannounced." },
      ] },
    ],
  },
  {
    slug: "design",
    title: "Design",
    blurb: "what we execute, and what we don't create.",
    blocks: [
      { type: "p", lead: "Design is not included in any of our offerings.", text: "Florals, tablescapes, styling, and the visual world of your wedding belong to your designer or planner. We will execute their vision beautifully and as instructed within our scope of work: we do not create it." },
      { type: "p", lead: "Anything installed above reach", text: "(ceiling florals, draping, overhead lighting and the like) must be installed using our scissor lift and never a ladder. This ensures safety and efficiency for all vendors and our staff to execute their projects in a safe and timely manner. The lift is $260 per day. If your team is still installing after hours, the on-site manager rate while the lift is in use is $200 per hour rather than the usual $150." },
      { type: "heading", text: "Set-up and breakdown windows" },
      { type: "ul", items: [
        { lead: "Friday set-up: 11:00 AM to 6:00 PM,", text: "during operating hours only. All elevated installations must be completed on Friday." },
        { lead: "Thursday set-up, if a second day is required: 9:00 AM to 5:00 PM,", text: "at a $500 supervision fee." },
        { lead: "No scissor lift installation work on Saturday.", text: "" },
        { lead: "Sunday breakdown: 8:00 AM to 2:00 PM.", text: "Additional hours of supervision are charged." },
        { lead: "Work should not disrupt events in progress on the property.", text: "Power tools while events are underway are prohibited. We recommend managing your time to work around those events." },
      ] },
    ],
  },
  {
    slug: "vendors",
    title: "Vendors",
    blurb: "our recommendations, your relationships.",
    blocks: [
      { type: "p", text: "After years of weekends here, we have cultivated a list of trusted partners that we recommend for your event." },
      { type: "ul", items: [
        { text: "We will always give our professional feedback about vendors we have experienced, for your assurance." },
        { lead: "The relationship is yours.", text: "We don't broker introductions, manage vendor contracts, or act as intermediary. You hire your vendors directly, your agreements are with them, and their work is their own: Gilbertsville Farmhouse bears no responsibility for it." },
      ] },
      { type: "p", text: "We'll point you toward good people. Choosing them, and everything that follows, belongs to you." },
    ],
  },
  {
    slug: "load-in-hours",
    title: "Load-In & Hours",
    blurb: "the windows, the lift, the golf cart.",
    blocks: [
      { type: "p", text: "Whenever a vendor is working on the estate, one of our managers is on site with them." },
      { type: "ul", items: [
        { lead: "Thursday load-in: 9:00 AM to 5:00 PM, included.", text: "Your designer, florist, and production teams are welcome all day at no charge. After 5:00 PM, a manager remains on site at $150 per hour." },
        { lead: "Sunday load-out: through 2:00 PM, included.", text: "After 2:00 PM, the same $150 per hour applies." },
        { lead: "When the scissor lift is in use after hours,", text: "the manager rate is $200 per hour instead. The lift itself is $260 per day." },
        { lead: "Getting around.", text: "Planners and florists who want their own transportation across the estate rent a golf cart on site through outside services. Your planner's certificate of insurance must cover its use." },
      ] },
      { type: "p", text: "Please share these timings with your vendors early." },
    ],
  },
  {
    slug: "two-dates",
    title: "The Two Dates",
    blurb: "sixty days and thirty days.",
    blocks: [
      { type: "heading", text: "Your planning hub" },
      { type: "p", text: "Your planning portal is private, convenient access to every tool you need to plan your event. Log in as often as you like, adjust selections, update details, and leave notes. This portal is designed to feel like planning home base, housing everything you're coordinating." },
      { type: "p", lead: "60 days before your wedding, your selections are final.", text: "Menus, layouts, and event details close in the portal at the 60-day mark. This is the moment your weekend goes from planned to in production: ordering begins, staffing is set, and our kitchen starts building your event. Changes after this date are not guaranteed and, where possible, are billed at the rates above." },
      { type: "p", lead: "30 days before your wedding, your guest list is final.", text: "Your count at 30 days is the count we prepare for. Dietary needs are due with it. Market-price menu items are confirmed at this date. There are absolutely no changes, final guest count refunds, or revisions past 30 days, under any circumstances." },
      { type: "p", text: "We will remind you well before both dates arrive. Nothing here is designed to catch you; it is designed so that when your weekend comes, everything is simply ready." },
    ],
  },
  {
    slug: "one-voice",
    title: "One Voice",
    blurb: "who we take direction from.",
    blocks: [
      { type: "heading", text: "Who we take direction from" },
      { type: "ul", items: [
        { text: "The individuals named on your agreement, or one designated representative of your choosing, whether a planner, a parent, or someone you trust. You name that person in writing, and they will be our contact for all decision making." },
      ] },
      { type: "heading", text: "How decisions work" },
      { type: "ul", items: [
        { lead: "We honor one answer per decision.", text: "If the two of you are still deciding, please take your time. But once a decision reaches us in writing, signed off by your designated voice or by both of you together, it is confirmed and we act on it." },
        { lead: "We do not relitigate confirmed decisions at the request of anyone else,", text: "a parent, a family member, a member of the wedding party, however lovingly intended. This protects you and us. Your wedding reflects your choices, and we hold that boundary so you don't have to." },
        { lead: "Changes to confirmed decisions follow the same path in:", text: "in writing, signed by your designated voice or both of you, subject to the timeline and revision terms above." },
      ] },
    ],
  },
  {
    slug: "what-to-expect",
    title: "What to Expect",
    blurb: "service for your guests, and for you.",
    blocks: [
      { type: "p", text: "Two sides of the same weekend. What the estate does for the people you bring here, and what makes it possible for us to do it well." },
      { type: "cards", cards: [
        { title: "For your guests", items: [
          "Reservation confirmations, assistance, and pre-check-in communication.",
          "During their stay: coolers iced and restocked periodically. Snacks unlimited and available. Amenities refreshed through the weekend.",
          "Shuttle service all weekend, during and between events.",
          "Every dietary need met.",
          "A manager on the estate at all hours. Any question about the property, answered promptly.",
          "Their contact: our Resort Coordinator and guest experience team, there to cater to all guests all weekend long.",
        ] },
        { title: "For you, and from you", items: [
          "Your contact: our Weekend Event Coordinator is your liaison all weekend, to ensure a question-free weekend for you.",
          "On wedding day: a dedicated guest services member who helps accommodate transportation and your photo and video team during the day.",
        ] },
      ] },
    ],
  },
  {
    slug: "who-to-ask",
    title: "Who to Ask",
    blurb: "your go-to people, by question.",
    blocks: [
      { type: "p", text: "Three roles, each with a clear scope. Bring the question to the person who owns it and you'll have your answer faster." },
      { type: "table", columns: ["Role", "Ask them about", "Not their scope"], rows: [
        ["Culinary Team", "Menu selections, tastings, custom dishes, dietary accommodations, market-price items, bar and beverage.", "Timeline, décor, lodging."],
        ["Weekend Event Coordinator", "The timeline, vendor arrivals and load-in, rehearsal, day-of direction, family and wedding party logistics, changes after 60 days, ceremony and reception spaces, the scissor lift and golf cart, wedding insurance, vendor recommendations.", "Planning your wedding, sourcing vendors, design, etiquette: those belong to your planner."],
        ["Resort Coordinator", "Guesthouse assignments, property walkthroughs, guest services, anything about the land.", "Vendor management, timeline building, event design."],
        ["Your Planner or Designer", "Florals, tablescapes, styling, invitations, vendor contracts, etiquette, the visual world of your wedding.", "Anything the estate provides directly."],
      ] },
      { type: "note", text: "Questions about anything in How We Work? Ask your Resort Coordinator. That's exactly what they're for." },
    ],
  },
  {
    slug: "common-questions",
    title: "Common Questions",
    blurb: "quick answers, and who owns them.",
    draft: true,
    blocks: [
      { type: "p", text: "Short answers to the questions every couple asks. Each one names who owns it." },
      { type: "table", columns: ["Question", "Answer", "Owner"], pillColumn: 2, rows: [
        ["Can we negotiate the menu pricing?", "No. Pricing is set and held equally for every couple.", "Culinary"],
        ["What do market-price items cost?", "Market price, confirmed 30 days before your wedding, when your guest count is final.", "Culinary"],
        ["How do we book our tasting?", "At your confirmation meeting. There are 3 dates each year with 10 family seatings each. A date closes once it is full.", "Culinary"],
        ["Can we change a dish after the tasting?", "Yes, through one final revision. Beyond that, $100 per hour for calls and $50 per emailed revision. Nothing changes past 30 days.", "Culinary"],
        ["A guest just told us they're gluten-free. Is it too late?", "Dietary needs are due with the final guest list at 30 days. After that, nothing is guaranteed.", "Culinary"],
        ["Who builds our timeline?", "Your Weekend Event Coordinator, with you, and distributes it to your vendors.", "Weekend Coordinator"],
        ["Can our coordinator help pick our vendors?", "They execute the weekend; they don't plan it. Vendor sourcing belongs to your planner. We're glad to share feedback on vendors we've worked with.", "Weekend Coordinator"],
        ["Do you do the florals and design?", "No. Design is not included in any offering. We execute your designer's vision as instructed.", "Your Planner"],
        ["Can our florist hang things from the ceiling?", "Yes, on our scissor lift, never a ladder: $260 per day, Friday only between 11:00 AM and 6:00 PM. After hours with the lift in use, the manager rate is $200 per hour.", "Weekend Coordinator"],
        ["Can our design team set up on Thursday?", "Yes, 9:00 AM to 5:00 PM, at a $500 supervision fee. Elevated installations must still be finished on Friday.", "Weekend Coordinator"],
        ["Can our planner have a golf cart?", "Yes, rented on site through an outside provider. Their certificate of insurance must cover it.", "Weekend Coordinator"],
        ["Can vendors stay past 5:00 on Thursday, or past 2:00 on Sunday?", "A manager stays on site at $150 per hour, confirmed with you first.", "Weekend Coordinator"],
        ["Where does everyone sleep?", "Your Resort Coordinator assigns guesthouses for up to 122 on-site guests.", "Resort Coordinator"],
        ["How do guests get around the property?", "A shuttle runs across the estate all weekend, during and between events.", "Resort Coordinator"],
        ["Do we need wedding insurance?", "It is recommended in your agreement. See the Wedding Insurance page for two ways to buy.", "Weekend Coordinator"],
        ["What if our guest count changes after 30 days?", "Your 30-day count is what we prepare for. There are no changes, refunds, or revisions past 30 days.", "Weekend Coordinator"],
        ["Can we change the layout after 60 days?", "Selections close at 60 days. Changes after are not guaranteed and, where possible, billed at $50 per revision.", "Weekend Coordinator"],
        ["My mother wants to change something we already confirmed.", "We only take changes from your designated voice, in writing. That protects you and us.", "Weekend Coordinator"],
        ["Who do we call during the weekend?", "Your Weekend Event Coordinator for the events. Your Resort Coordinator for the property and lodging. Both are on site.", "Both"],
      ] },
    ],
  },
  {
    slug: "rates",
    title: "The Rates",
    blurb: "every fee in one place.",
    blocks: [
      { type: "p", text: "Every figure in this document, in one place. Nothing here is billed without telling you first." },
      { type: "rates" },
    ],
  },
];
