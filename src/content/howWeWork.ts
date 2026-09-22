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
  /** Three lines at most. The whole section in a glance, shown before the full text. */
  keyPoints: string[];
  /** Short number chips shown on the tile, e.g. "$100/hr calls". */
  facts?: string[];
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
  { item: "Set-up and production crew", rate: "$30 / hour, per person ($300 minimum)", when: "Estimated with you and paid upfront. Actual hours beyond the estimate are billed after." },
  { item: "Scissor lift", rate: "$260 / day", when: "Any elevated installation. Friday only." },
  { item: "Thursday set-up supervision", rate: "$500", when: "9:00 AM to 5:00 PM. After 5:00 PM the hourly manager rate applies." },
  { item: "Sunday breakdown beyond 2:00 PM", rate: "Supervision charges apply", when: "Standard after-hours manager rate" },
  { item: "Planner golf cart", rate: "Rented through an outside provider", when: "Certificate of insurance must cover its use" },
  { item: "Market-price menu items", rate: "Market", when: "Confirmed 30 days before the wedding" },
  { item: "Resort Coordinator", rate: "Complimentary", when: "Included with your estate buyout" },
  { item: "Vendor feedback and recommendations", rate: "Complimentary", when: "Always" },
];

export const HOW_WE_WORK_INTRO =
  "Nothing about your weekend should be a surprise, least of all how we work.";

export const HOW_WE_WORK_CLOSING =
  "Questions about anything above? Ask your Resort Coordinator, your contact for all reservations and experiences. That's exactly what they're for.";

export const HOW_WE_WORK_SECTIONS: Section[] = [
  {
    slug: "our-roles",
    title: "Our Roles",
    blurb: "three roles, one principle.",
    keyPoints: [
      "Three roles: the Culinary Team, your Weekend Event Coordinator, your Resort Coordinator.",
      "Planning time is allocated. Anything beyond it is billed hourly and told to you first.",
      "This document goes with your agreement so nothing is a surprise.",
    ],
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
    keyPoints: [
      "Five steps: intro call, your selections, confirmation meeting, tasting, final menu.",
      "Pricing is set. Market-price items are confirmed at 30 days.",
      "One final revision after the tasting is included.",
    ],
    facts: ["$100/hr extra calls", "$50/revision", "3 tasting dates", "10 seatings each"],
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
    keyPoints: [
      "All dietary needs are due with the final guest list, 30 days out.",
      "Guests just tell a server. The kitchen has already prepared for them.",
      "If many guests share one need, we may shift the whole menu.",
    ],
    facts: ["Due at 30 days"],
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
    keyPoints: [
      "The director of your weekend: timeline, vendors, and every fire put out.",
      "Three planning calls: post-booking, 90 days, 30 days.",
      "Has a planner? Your coordinator supports them. Design belongs to them.",
    ],
    facts: ["3 calls included", "$100/hr extra calls", "$50/revision"],
    blocks: [
      { type: "p", text: "Your Weekend Event Coordinator makes sure your weekend is carried out exactly as you envisioned it. They are the person who knows where everything is, when everything happens, and who is responsible for it. They are also the point person for your vendors, so questions go to them instead of to you and your families." },
      { type: "p", text: "If you already have a third-party planner, your coordinator's role is to support that planner in carrying out your vision." },
      { type: "heading", text: "Included in your Weekend Event Coordination fee" },
      { type: "ul", items: [
        { text: "Planning calls at the post-booking, 90-day, and 30-day marks" },
        { text: "A review of your wedding checklist, so every detail is addressed" },
        { text: "Your complete weekend timeline, built with you and distributed to your vendors and wedding party" },
        { text: "A record of each vendor's services and what they are contracted to deliver" },
        { text: "A check-in with every vendor 48 hours before your wedding" },
        { text: "Vendor arrival coordination, load-in, and day-of direction: your coordinator is the manager on duty for every vendor" },
        { text: "Coordination of estate spaces: ceremony sites, reception spaces, the grounds" },
        { text: "Your ceremony rehearsal, organized and directed" },
        { text: "Oversight of décor and table set-up to your specifications" },
        { text: "Your timeline, run on the day: guest seating, the ceremony, and every major moment" },
        { text: "Wedding party introductions and dances, coordinated with your DJ or band" },
        { text: "Every major photo moment, coordinated with your photographer" },
        { text: "Family and wedding party wrangling for points of interest during your weekend" },
        { text: "Problem solving on the day and just before it, so none of it reaches you" },
        { text: "Full on-site coordination from arrival Friday through departure Sunday" },
      ] },
      { type: "heading", text: "Please note" },
      { type: "ul", items: [
        { text: "Calls beyond your included allotment are billed at $100 per hour, per call." },
        { text: "Emailed revisions requiring the team (timeline rebuilds, vendor re-coordination, layout changes) are billed at $50 per revision." },
        { lead: "Your coordinator directs your wedding; they don't design it.", text: "Design, invitations, vendor sourcing, and etiquette guidance belong to you or your planner. See Us & Your Planner below for exactly where the line falls." },
        { lead: "Coordination is not set-up.", text: "Your coordinator directs the day. Setting out your décor, rentals, and props is production work, covered under Set-Up & Production." },
      ] },
    ],
  },
  {
    slug: "resort-coordination",
    title: "Resort Coordination",
    blurb: "the estate and your guests, complimentary.",
    keyPoints: [
      "Complimentary with your estate buyout.",
      "Lodging and guest services for up to 122 on-site guests, all weekend.",
      "Anything beyond scope is quoted before work begins.",
    ],
    facts: ["Complimentary", "Up to 122 on-site guests"],
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
    keyPoints: [
      "Design is not included. We execute your designer's vision.",
      "Anything above reach goes up on our scissor lift, never a ladder.",
      "Friday 11 to 6 is set-up. Thursday adds $500. No lift on Saturday.",
    ],
    facts: ["$260/day lift", "Fri 11–6 set-up", "Thu +$500"],
    blocks: [
      { type: "p", lead: "Design is not included in any of our offerings.", text: "Florals, tablescapes, styling, and the visual world of your wedding belong to your designer or planner. We will execute their vision beautifully and as instructed within our scope of work: we do not create it." },
      { type: "p", lead: "Anything installed above reach", text: "(ceiling florals, draping, overhead lighting and the like) must be installed using our scissor lift and never a ladder. This ensures safety and efficiency for all vendors and our staff to execute their projects in a safe and timely manner. The lift is $260 per day. If your team is still installing after hours, the on-site manager rate while the lift is in use is $200 per hour rather than the usual $150." },
      { type: "heading", text: "Set-up and breakdown windows" },
      { type: "ul", items: [
        { lead: "Friday set-up: 11:00 AM to 6:00 PM,", text: "during operating hours only. All elevated installations must be completed on Friday." },
        { lead: "Thursday set-up, if a second day is required: 9:00 AM to 5:00 PM,", text: "at a $500 supervision fee. After 5:00 PM, the after-hours manager rate applies: $150 per hour, or $200 per hour while the lift is in use." },
        { lead: "No scissor lift installation work on Saturday.", text: "" },
        { lead: "Sunday breakdown: 8:00 AM to 2:00 PM.", text: "Additional hours of supervision are charged." },
        { lead: "Work should not disrupt events in progress on the property.", text: "Power tools while events are underway are prohibited. We recommend managing your time to work around those events." },
      ] },
    ],
  },
  {
    slug: "set-up-production",
    title: "Set-Up & Production",
    blurb: "the director, and the backstage crew.",
    keyPoints: [
      "Your coordinator directs the day. Production sets the stage.",
      "Tables, chairs, place settings, and a few small details are included.",
      "Rentals, detail boxes, and centerpieces: $30/hr per person, $300 minimum.",
    ],
    facts: ["$30/hr per person", "$300 minimum", "Estimated upfront"],
    blocks: [
      { type: "p", text: "Event coordination is different from event set-up and production. Think of your wedding as a performance: your Weekend Event Coordinator is the director. The stage, the props, and the scenes are set by the production team, the backstage crew. This section helps you understand whether your weekend will need production services." },
      { type: "heading", text: "What we do" },
      { type: "ul", items: [
        { lead: "Your coordinator", text: "plans your day so no moment is left out, and is there to direct it and make sure it all goes according to plan." },
        { lead: "Our estate team", text: "greets, welcomes, and guides your vendors and guests, and helps the day flow from one event to the next." },
        { lead: "Our catering team", text: "sets up and breaks down tables and chairs, sets place settings, buses tables, and takes out the trash. At the end of the reception, they gather all table décor in one place for vendor pick-up or for you to take home." },
        { lead: "A few small details, as a team:", text: "your guest book, gift box, lighting candles, preparing the cake table, and minor adjustments to décor already in place." },
      ] },
      { type: "heading", text: "What falls outside that scope" },
      { type: "ul", items: [
        { lead: "Moving rentals.", text: "Rental furniture, lounge sets, shelving units, and large props, moved from the drop-off area into place. If your rental company delivers the day before, someone must move and set it up on the day, and that takes extra hands while our team is occupied with its usual duties." },
        { lead: "Detail boxes and décor.", text: "Unpacking boxes delivered by you, your family, or your vendors, setting out centerpieces and accents you bring, assembling props, and packing it all back up when the party is over." },
      ] },
      { type: "p", text: "A few details or a couple of boxes is reasonable. Trouble starts when our idea of a few details and yours differ, or when there turn out to be far more on the day than anyone discussed. So your coordinator reviews every accent that needs setting up with you in advance." },
      { type: "heading", text: "How production is priced" },
      { type: "ul", items: [
        { text: "$30 per hour, per person, with a $300 minimum. Estimated and paid upfront." },
        { text: "Your coordinator estimates it with you from your décor list and your furniture and prop rentals: how many items sit on each dinner table, and how many stations you have (a photo backdrop is one station, a lounge area is a second)." },
        { text: "If set-up takes more hours than estimated, the balance is billed after." },
      ] },
      { type: "note", text: "Your planner or designer's own crew can handle production instead. If they do, no production estimate is needed." },
    ],
  },
  {
    slug: "your-planner",
    title: "Us & Your Planner",
    blurb: "where our role ends and a full planner's begins.",
    draft: true,
    keyPoints: [
      "We run the weekend. A full planner designs it.",
      "Have a planner? Your coordinator supports them, not the other way around.",
      "Design, vendor sourcing, invitations, and etiquette are always yours or your planner's.",
    ],
    blocks: [
      { type: "p", text: "Your Weekend Event Coordinator is not a full-service wedding planner. They make sure the wedding you plan is carried out perfectly. A full planner helps you decide what that wedding is. Many of our couples plan with us alone. Others bring a planner, and when they do, your coordinator supports that planner in executing your vision." },
      { type: "table", columns: ["Task", "Gilbertsville Farmhouse", "A full planner"], rows: [
        ["Your weekend timeline", "Built with you, distributed, and run on the day", "Shapes it with you; we run it on the day"],
        ["Vendors", "Tracks what each is contracted for, checks in 48 hours out, directs them on site", "Sources, recommends, and negotiates contracts"],
        ["Vendor recommendations", "Honest feedback on who we've worked with", "Full sourcing and booking"],
        ["Rehearsal", "Organized and directed", "Supported by us"],
        ["Day-of", "Runs every major moment: ceremony, introductions, dances, photos", "Supported by us"],
        ["Design: florals, tablescapes, styling", "Not included. We execute it as instructed.", "Creates it"],
        ["Décor and rental set-up", "Overseen by us. Hands-on production is quoted separately.", "Often their own crew"],
        ["Invitations, etiquette, budgeting", "Not included", "Included"],
      ] },
      { type: "note", text: "Not sure whether you need a planner? Ask your Weekend Event Coordinator at your post-booking call. We'll tell you honestly." },
    ],
  },
  {
    slug: "vendors",
    title: "Vendors",
    blurb: "our recommendations, your relationships.",
    keyPoints: [
      "We'll tell you honestly who we've loved working with.",
      "You hire directly. The contract and the relationship are yours.",
      "On your weekend, your coordinator is their point of contact.",
    ],
    facts: ["Recommendations free"],
    blocks: [
      { type: "p", text: "After years of weekends here, we have cultivated a list of trusted partners that we recommend for your event." },
      { type: "ul", items: [
        { text: "We will always give our professional feedback about vendors we have experienced, for your assurance." },
        { lead: "The relationship is yours.", text: "We don't broker introductions or negotiate vendor contracts. You hire your vendors directly, your agreements are with them, and their work is their own: Gilbertsville Farmhouse bears no responsibility for it." },
        { lead: "On your weekend, we're their point of contact.", text: "Your Weekend Event Coordinator keeps a record of what each vendor is contracted to provide, checks in with every one of them 48 hours before, and oversees their work on site, so their questions come to us instead of to you." },
      ] },
      { type: "p", text: "We'll point you toward good people. Choosing them, and everything that follows, belongs to you." },
    ],
  },
  {
    slug: "load-in-hours",
    title: "Load-In & Hours",
    blurb: "the windows, the lift, the golf cart.",
    keyPoints: [
      "Thursday 9 to 5 at a $500 supervision fee. Sunday until 2 is included.",
      "After hours a manager stays: $150/hr, or $200/hr with the lift in use.",
      "Golf carts are rented outside. Your planner's insurance must cover it.",
    ],
    facts: ["Thu 9–5", "Sun until 2", "$150–200/hr after"],
    blocks: [
      { type: "p", text: "Whenever a vendor is working on the estate, one of our managers is on site with them." },
      { type: "ul", items: [
        { lead: "Thursday load-in: 9:00 AM to 5:00 PM, at a $500 supervision fee.", text: "Your designer, florist, and production teams are welcome all day. After 5:00 PM, a manager remains on site at $150 per hour, or $200 per hour while the scissor lift is in use." },
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
    keyPoints: [
      "60 days out: menus, layouts, and details are final.",
      "30 days out: guest list, dietary needs, and market prices are final.",
      "We remind you before both dates.",
    ],
    facts: ["60 days", "30 days"],
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
    keyPoints: [
      "One designated voice, named in writing.",
      "One answer per decision. Once it reaches us in writing, we act on it.",
      "We don't take changes from anyone else, however well meant.",
    ],
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
    keyPoints: [
      "Guests: check-in help, stocked coolers, shuttle, a manager at all hours.",
      "You: your coordinator all weekend, plus a guest services member on wedding day.",
    ],
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
        { title: "For you", items: [
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
    keyPoints: [
      "Culinary Team: menu, tastings, dietary.",
      "Weekend Event Coordinator: timeline, vendors, day-of, the lift.",
      "Resort Coordinator: lodging, reservations, experiences, the land.",
    ],
    blocks: [
      { type: "p", text: "Three roles, each with a clear scope. Bring the question to the person who owns it and you'll have your answer faster." },
      { type: "table", columns: ["What it's about", "Who to ask"], pillColumn: 1, rows: [
        ["Menu selections, tastings, custom dishes", "Culinary"],
        ["Dietary accommodations", "Culinary"],
        ["Market-price items, bar and beverage", "Culinary"],
        ["Your weekend timeline", "Weekend Coordinator"],
        ["Vendor arrivals and load-in", "Weekend Coordinator"],
        ["Rehearsal and day-of direction", "Weekend Coordinator"],
        ["Family and wedding party logistics", "Weekend Coordinator"],
        ["Changes after the 60-day mark", "Weekend Coordinator"],
        ["Ceremony and reception spaces", "Weekend Coordinator"],
        ["Wedding party introductions, dances, and photo moments", "Weekend Coordinator"],
        ["Décor set-up and your production estimate", "Weekend Coordinator"],
        ["The scissor lift and golf cart", "Weekend Coordinator"],
        ["Wedding insurance", "Weekend Coordinator"],
        ["Vendor recommendations", "Weekend Coordinator"],
        ["Reservations and guesthouse assignments", "Resort Coordinator"],
        ["Property walkthroughs", "Resort Coordinator"],
        ["Guest services during the weekend", "Resort Coordinator"],
        ["On-site experiences", "Resort Coordinator"],
        ["Anything about the land", "Resort Coordinator"],
        ["Florals, tablescapes, styling, the visual world of your wedding", "Your Planner"],
        ["Invitations and etiquette", "Your Planner"],
        ["Sourcing vendors and vendor contracts", "Your Planner"],
        ["Planning your wedding", "Your Planner"],
      ] },
      { type: "note", text: "Questions about anything in How We Work? Ask your Resort Coordinator, your contact for all reservations and experiences. That's exactly what they're for." },
    ],
  },
  {
    slug: "common-questions",
    title: "Common Questions",
    blurb: "quick answers, and who owns them.",
    keyPoints: [
      "Twenty-one quick answers, each with the person who owns it.",
    ],
    facts: ["21 questions"],
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
        ["Do we need a full wedding planner?", "Not necessarily. Your coordinator runs the weekend, but doesn't design it or source vendors. See Us & Your Planner.", "Weekend Coordinator"],
        ["Will your team set up our décor?", "Tables, chairs, place settings, and a few small details, yes. Rentals, detail boxes, and centerpieces are production: $30 per hour per person, $300 minimum, estimated with you upfront.", "Weekend Coordinator"],
        ["Do you do the florals and design?", "No. Design is not included in any offering. We execute your designer's vision as instructed.", "Your Planner"],
        ["Can our florist hang things from the ceiling?", "Yes, on our scissor lift, never a ladder: $260 per day, Friday only between 11:00 AM and 6:00 PM. After hours with the lift in use, the manager rate is $200 per hour.", "Weekend Coordinator"],
        ["Can our design team set up on Thursday?", "Yes, 9:00 AM to 5:00 PM, at a $500 supervision fee. After 5:00 PM it is $150 per hour, or $200 with the lift in use. Elevated installations must still be finished on Friday.", "Weekend Coordinator"],
        ["Can our planner have a golf cart?", "Yes, rented on site through an outside provider. Their certificate of insurance must cover it.", "Weekend Coordinator"],
        ["Can vendors stay past 5:00 on Thursday, or past 2:00 on Sunday?", "A manager stays on site at $150 per hour, or $200 per hour while the scissor lift is in use, confirmed with you first.", "Weekend Coordinator"],
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
    keyPoints: [
      "Every fee in one table. Nothing is billed without telling you first.",
    ],
    facts: ["$100/hr calls", "$50/revision", "$150–200/hr after hours", "$260/day lift"],
    blocks: [
      { type: "p", text: "Every figure in this document, in one place. Nothing here is billed without telling you first." },
      { type: "rates" },
    ],
  },
];
