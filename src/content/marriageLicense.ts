/* ── Marriage License ────────────────────────────────────
   New York State rules for couples marrying at the estate.
   Source: NYS Department of Health "Getting Married in
   New York State" (form 4210, 10/21), the sheet in the
   experience@ Drive.

   Built to be scanned, not read: four numbers, four steps,
   one checklist. Long text lives under "details" and only
   shows when a couple opens it.
   ─────────────────────────────────────────────────────── */

export const MARRIAGE_LICENSE_INTRO =
  "Your wedding is in New York, so the license has to be a New York license. Any clerk in the state can issue it. Twenty minutes, in person, together.";

/** The four numbers that matter. Big type on the page. */
export const FACTS: { big: string; label: string }[] = [
  { big: "$40", label: "at any NY town or city clerk" },
  { big: "24 hrs", label: "wait between license and ceremony" },
  { big: "60 days", label: "until the license expires" },
  { big: "Both", label: "of you, in person, together" },
];

export interface Step {
  n: number;
  title: string;
  /** Timing pill, e.g. "2–6 weeks out". */
  when: string;
  /** One sentence. This is all most couples will read. */
  oneLiner: string;
  /** The rest, behind a "details" toggle. */
  details: string[];
}

export const STEPS: Step[] = [
  {
    n: 1,
    title: "Pick a clerk and call ahead",
    when: "2–6 weeks out",
    oneLiner: "Any town or city clerk in New York State works, and the license is valid statewide. Small-town clerks keep short hours, so call first.",
    details: [
      "You do not have to apply in Otsego County, and you do not have to live in New York.",
      "Closest to the estate: the Town of Butternuts clerk (Gilbertsville is in Butternuts) and the City of Oneonta clerk.",
      "Live in New York? Your own town or city clerk is easiest. Apply before you travel and bring the license with you.",
      "Coming from out of state? Many couples apply the week of the wedding. Arriving Thursday covers the 24-hour wait for a Saturday ceremony.",
      "New York City's clerk works too, but has its own fees and process. Everything here is for clerks outside the city.",
    ],
  },
  {
    n: 2,
    title: "Go together with your ID",
    when: "At least 1 day before",
    oneLiner: "You both sign in front of the clerk. Bring photo ID and proof of age each, $40, and paperwork for any prior marriage.",
    details: [
      "No one can apply for you, not even with power of attorney. A notarized affidavit does not count.",
      "Proof of age: a passport, driver's license, or birth certificate covers it for nearly every clerk. Baptismal, naturalization, or immigration records also count. Both of you must be 18 or older.",
      "Prior marriages: the form asks whether the former spouse is living and, if divorced, when, where, and against whom. Bring a certified divorce decree or certificate of dissolution. Many clerks require it.",
      "The $40 includes your Certificate of Marriage Registration, mailed to you after the wedding. Some small-town clerks are cash or check only.",
      "Active-duty military? The license can be extended to 180 days. Bring proof.",
      "Only a New York Supreme Court judge or the county judge where one of you lives can waive the 24-hour wait. Plan around it.",
    ],
  },
  {
    n: 3,
    title: "Say I do",
    when: "24+ hours after issue",
    oneLiner: "An authorized officiant, at least one witness, and the license in the room. Give it to your Weekend Event Coordinator when you arrive.",
    details: [
      "New York accepts ordained clergy and ministers, a minister chosen by a spiritual group, judges and justices, town and village justices, mayors, and marriage officers appointed by a town or village board.",
      "A friend ordained online generally qualifies. Outside New York City, officiants do not register with anyone, and they do not have to live in New York. If you want certainty, ask the clerk who issues your license.",
      "The ceremony itself has no required form. You each state, in front of the officiant and at least one other witness, that you take the other as your spouse. Most couples use two witnesses.",
      "The license is the one thing that cannot be replaced that day. Hand it to your Weekend Event Coordinator on arrival, or keep it with your rings.",
      "Afterward, your officiant returns the completed license to the clerk who issued it. Ask them to confirm when it is sent.",
    ],
  },
  {
    n: 4,
    title: "Paperwork arrives",
    when: "About 2 weeks after",
    oneLiner: "The clerk mails your Certificate of Marriage Registration. Order two or three certified copies at $10 each for name changes and anything official.",
    details: [
      "The certificate arrives within 15 calendar days of the clerk receiving the license back from your officiant. It confirms the marriage is on file.",
      "Not there four weeks after the wedding? Contact the clerk who issued the license.",
      "Certified copies: $10 each from that clerk, or $30 from the New York State Department of Health.",
      "Keep one certified copy untouched at home. Everyone else gets the others.",
    ],
  },
];

/** What to bring. Interactive on the page; checked state stays in the couple's browser. */
export const CHECKLIST: { id: string; label: string; note?: string }[] = [
  { id: "call", label: "Called the clerk for hours and payment types" },
  { id: "id", label: "Photo ID for each of you", note: "passport or driver's license" },
  { id: "age", label: "Proof of age for each of you", note: "the passport or license usually covers it" },
  { id: "divorce", label: "Certified divorce decree, if either of you was married before" },
  { id: "fee", label: "$40", note: "cash or check to be safe" },
  { id: "name", label: "Decided on names", note: "see below" },
];

/** Name change, as a question with three answers. */
export const NAME_CHANGE = {
  question: "Changing a name?",
  yes: [
    "You write the new last name on the license itself, at the clerk. That is the legal record.",
    "Options: your spouse's surname, any former surname of either of you, a combined single surname, or a hyphenated or spaced combination. A middle name can become a current or former surname too.",
    "Afterward: Social Security first (free, bring proof of old and new name), then the DMV, passport, banks, and work.",
  ],
  no: "Nothing to do. Nobody's name changes by marrying, and you do not have to share one.",
  unsure: "Decide before you go to the clerk. The license cannot be changed later to add a name, though you can always adopt one by consistent use.",
};

export const MARRIAGE_LICENSE_CLOSING =
  "General information from New York State. Clerks differ on hours and details, so when in doubt, call the one you plan to use. Their answer beats ours.";
