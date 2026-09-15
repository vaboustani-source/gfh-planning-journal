/* ── Marriage License ────────────────────────────────────
   New York State rules for couples marrying at the estate.
   Drafted from public NYS Department of Health guidance;
   Victoria to confirm before the "Drafted for review" flag
   comes off. Anything in [square brackets] is a placeholder.
   ─────────────────────────────────────────────────────── */

export const MARRIAGE_LICENSE_DRAFT = true;

export const MARRIAGE_LICENSE_INTRO =
  "Your wedding is in New York, so your license has to be a New York license. The good news: any town or city clerk in the state can issue it, you do not need to live here, and the whole thing takes about twenty minutes in person.";

export const MARRIAGE_LICENSE_KEY_POINTS = [
  "Apply together, in person, at any New York town or city clerk. It is valid anywhere in the state.",
  "Wait at least 24 hours after it is issued before the ceremony. It expires 60 days after issue.",
  "Bring photo ID, proof of age, and paperwork for any previous marriage. No blood test, no witnesses at the clerk.",
];

export interface LicenseSection {
  slug: string;
  title: string;
  items: { lead?: string; text: string }[];
}

export const MARRIAGE_LICENSE_SECTIONS: LicenseSection[] = [
  {
    slug: "when",
    title: "When to get it",
    items: [
      { lead: "The window.", text: "A New York license can be used starting 24 hours after it is issued and expires 60 days later. For most couples that means applying two to six weeks before the wedding." },
      { lead: "Out-of-town couples.", text: "Many couples apply the week of the wedding, once they are in the area. Arriving Thursday leaves the 24-hour wait comfortably covered for a Saturday ceremony. Clerks in small towns keep short hours, so call ahead or book an appointment." },
      { lead: "Active-duty military.", text: "The license is valid for 180 days instead of 60." },
    ],
  },
  {
    slug: "where",
    title: "Where to go",
    items: [
      { text: "Any town, city, or village clerk in New York State can issue the license, and it is valid in every county. You do not have to apply in Otsego County, and you do not have to be a New York resident." },
      { lead: "Closest to the estate.", text: "[Town of Butternuts clerk, Gilbertsville: hours and phone]. [City of Oneonta clerk: hours and phone]. [City of Norwich clerk: hours and phone]." },
      { lead: "Near home.", text: "If you live in New York, your own town or city clerk is the easiest option. Apply before you travel and bring the license with you." },
    ],
  },
  {
    slug: "bring",
    title: "What to bring",
    items: [
      { lead: "Both of you.", text: "You must appear together and sign in front of the clerk. A proxy or a single partner cannot apply alone." },
      { lead: "Photo ID.", text: "A driver's license, passport, or other government-issued photo identification for each of you." },
      { lead: "Proof of age.", text: "A birth certificate, passport, or naturalization record. Some clerks accept the photo ID alone. Ask when you call." },
      { lead: "Social Security number.", text: "You need the number, not the card." },
      { lead: "Previous marriages.", text: "If either of you was married before, bring a certified copy of each divorce decree, annulment, or death certificate. Bring the originals or certified copies, not photocopies." },
      { lead: "The fee.", text: "$35 in most of New York State, payable to the clerk. Some offices take cards; small-town clerks may be cash or check only." },
    ],
  },
  {
    slug: "ceremony",
    title: "On the day",
    items: [
      { lead: "Your officiant.", text: "New York recognizes clergy, judges, mayors, town and village justices, and ministers ordained by a religious organization, including a friend ordained online. If your officiant is a friend, confirm with the clerk that their ordination is accepted. Your officiant does not need to register with the state outside New York City." },
      { lead: "One witness.", text: "At least one witness aged 18 or older must sign the license at the ceremony. Most couples use two." },
      { lead: "Bring the license to the estate.", text: "Hand it to your Weekend Event Coordinator when you arrive, or keep it with your rings. It gets signed right after the ceremony, and it is the one document that cannot be replaced that day." },
      { lead: "After the ceremony.", text: "Your officiant must return the signed license to the clerk who issued it within five days. Most officiants mail it; ask yours to confirm when it is sent." },
    ],
  },
  {
    slug: "after",
    title: "After the wedding",
    items: [
      { lead: "Your marriage certificate.", text: "The clerk who issued the license records the marriage and issues certified copies. Order two or three at once; each is $10 and you will need them for the steps below." },
      { lead: "Changing a name.", text: "The certified certificate is what the Social Security Administration, the DMV, your passport office, banks, and your employer will ask for. Start with Social Security, then the DMV, then everything else." },
      { lead: "Keep one copy untouched.", text: "One certified copy stays in a safe place at home. Everyone else gets the others." },
    ],
  },
];

export const MARRIAGE_LICENSE_CLOSING =
  "Rules change and clerks differ. When in doubt, call the clerk you plan to use. Their answer beats ours.";
