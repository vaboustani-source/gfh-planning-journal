/* ── Marriage License ────────────────────────────────────
   New York State rules for couples marrying at the estate.
   Source: NYS Department of Health "Getting Married in
   New York State" (form 4210, 10/21), the sheet in the
   experience@ Drive. Anything in [square brackets] is a
   placeholder still to fill.
   ─────────────────────────────────────────────────────── */

export const MARRIAGE_LICENSE_DRAFT = false;

export const MARRIAGE_LICENSE_INTRO =
  "Your wedding is in New York, so your license has to be a New York license. The good news: any town or city clerk in the state can issue it, you do not need to live here, and the visit itself takes about twenty minutes.";

export const MARRIAGE_LICENSE_KEY_POINTS = [
  "Apply together, in person, at any New York town or city clerk. The license is valid anywhere in the state.",
  "Wait at least 24 hours after it is issued before the ceremony. It is good for 60 days, starting the day after issue.",
  "Bring photo ID and proof of age for each of you, plus paperwork for any previous marriage. No blood test, no witnesses at the clerk. The fee is $40.",
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
      { lead: "The window.", text: "The license is issued on the spot, but the ceremony may not take place within 24 hours of the exact time it was issued. It is valid for 60 calendar days beginning the day after issue. For most couples that means applying two to six weeks before the wedding." },
      { lead: "Out-of-town couples.", text: "Many couples apply the week of the wedding, once they are in the area. Arriving Thursday leaves the 24-hour wait comfortably covered for a Saturday ceremony. Clerks in small towns keep short hours, so call ahead." },
      { lead: "Active-duty military.", text: "If either of you is active U.S. military, the license can be extended to 180 days. Bring proof to the clerk when you apply." },
      { lead: "Waiving the wait.", text: "Only a judge or justice of the New York State Supreme Court, or the county judge where one of you lives, can waive the 24-hour waiting period. Plan around it rather than on it." },
    ],
  },
  {
    slug: "where",
    title: "Where to go",
    items: [
      { text: "Any town or city clerk in New York State can issue the license, and it is valid in every county. You do not have to apply in Otsego County, and you do not have to be a New York resident." },
      { lead: "Closest to the estate.", text: "Gilbertsville sits in the Town of Butternuts, Otsego County. The Town of Butternuts clerk and the City of Oneonta clerk are the nearest offices. Call for hours before you drive over." },
      { lead: "Near home.", text: "If you live in New York, your own town or city clerk is the easiest option. Apply before you travel and bring the license with you." },
      { lead: "Not New York City.", text: "A license from the City Clerk of New York works anywhere in the state too, but that office has its own fees and process. Anything below about cost and copies applies to clerks outside the city." },
    ],
  },
  {
    slug: "bring",
    title: "What to bring",
    items: [
      { lead: "Both of you.", text: "You must appear together and sign in front of the clerk. No one can apply on your behalf, not even with power of attorney, and a notarized affidavit does not substitute for showing up." },
      { lead: "Proof of age and identity.", text: "Each of you needs documentary proof of age. A passport, a driver's license, or an original or certified birth certificate covers it for nearly every clerk. Other accepted documents include a baptismal record, a naturalization or immigration record, or any government-issued photo ID. Both of you must be 18 or older; no exceptions." },
      { lead: "Previous marriages.", text: "The application asks about every prior marriage: whether the former spouse is living, and if divorced, when, where, and against whom the divorce was granted. Bring a certified copy of each divorce decree or certificate of dissolution. Many clerks require it." },
      { lead: "The fee.", text: "$40 at any town or city clerk outside New York City. It includes your Certificate of Marriage Registration, which the clerk mails to you after the wedding. Small-town clerks may be cash or check only, so ask when you call." },
      { lead: "Your new name, if any.", text: "This is the moment to decide. See the name section below before you go." },
    ],
  },
  {
    slug: "ceremony",
    title: "On the day",
    items: [
      { lead: "Your officiant.", text: "New York accepts clergy and ministers ordained by a governing church body, a minister chosen by a spiritual group to preside over its affairs, judges and justices, town and village justices, mayors, and marriage officers appointed by a town or village board. Your officiant does not have to live in New York, and outside New York City they do not need to register. A friend ordained online generally qualifies; if you want certainty, ask the clerk who issues your license." },
      { lead: "One witness.", text: "You each state, in front of the officiant and at least one other witness, that you take the other as your spouse. There is no minimum age for a witness, but choose someone who could describe what they saw if ever asked. Most couples use two." },
      { lead: "Bring the license to the estate.", text: "Hand it to your Weekend Event Coordinator when you arrive, or keep it with your rings. It gets signed right after the ceremony, and it is the one document that cannot be replaced that day." },
      { lead: "After the ceremony.", text: "Your officiant returns the completed license to the clerk who issued it. Ask yours to confirm when it is sent." },
    ],
  },
  {
    slug: "name",
    title: "Changing a name",
    items: [
      { lead: "Nothing changes on its own.", text: "Neither of you is required to change your last name, and you do not have to take the same one. Your last name does not change automatically by marrying." },
      { lead: "Decide it on the license.", text: "If either of you wants a new last name, you write it in the space on the marriage license when you apply. Options: the other spouse's surname, any former surname of either of you, a single surname combining all or part of both, or a hyphenated or spaced combination of both. A middle name can also become your current or former surname, or your spouse's surname." },
      { lead: "Why it matters.", text: "The marriage certificate with the new name is your legal proof. The license cannot be changed afterward to record a name you decide on later, though you can still adopt a name by consistent use." },
      { lead: "Then the paperwork.", text: "Start with the Social Security Administration, which is free and needs proof of both the old and new name. Then the DMV, your passport, banks, and your employer. Updating Social Security first means you get credit for all your earnings under the new name." },
    ],
  },
  {
    slug: "after",
    title: "After the wedding",
    items: [
      { lead: "Certificate of Marriage Registration.", text: "The issuing clerk mails this to you within 15 calendar days of receiving the completed license from your officiant. It is included in the $40 fee and confirms your marriage is on file. If it has not arrived four weeks after the wedding, contact that clerk." },
      { lead: "Certified copies.", text: "For name changes and anything official, you will need certified copies of the marriage record. They are $10 each from the clerk who issued the license, or $30 from the New York State Department of Health. Order two or three at once." },
      { lead: "Keep one copy untouched.", text: "One certified copy stays in a safe place at home. Everyone else gets the others." },
    ],
  },
];

export const MARRIAGE_LICENSE_CLOSING =
  "This is general information from New York State. Clerks differ on details and hours, so when in doubt, call the clerk you plan to use. Their answer beats ours.";
