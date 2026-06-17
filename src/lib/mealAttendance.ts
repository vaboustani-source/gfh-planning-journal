/**
 * Shared attendance logic for meal events.
 *
 * Rule:
 * - On-site guests attend every meal.
 * - Off-site guests (off_site / undecided / null):
 *   - Always attend welcome_hour, cocktail_hour, reception
 *   - Attend rehearsal_dinner, welcome_party, farewell_brunch ONLY if the code
 *     appears in guest.invited_optional_meals
 *   - Never attend arrival_lunch, wedding_breakfast, after_party, goat_yoga
 *
 * Declined guests are excluded from counts. Pending / confirmed / null are included
 * because counts represent the invited / expected attendance.
 */

export interface AttendanceGuest {
  lodging_preference?: string | null;
  is_child?: boolean | null;
  invited_optional_meals?: string[] | null;
  rsvp_status?: string | null;
}

const AUTO_OFFSITE_MEALS = new Set(["welcome_hour", "cocktail_hour", "reception"]);
const OPTIONAL_OFFSITE_MEALS = new Set(["rehearsal_dinner", "welcome_party", "farewell_brunch"]);

export function guestAttendsMeal(guest: AttendanceGuest, mealType: string): boolean {
  if ((guest.lodging_preference ?? null) === "on_site") return true;
  if (AUTO_OFFSITE_MEALS.has(mealType)) return true;
  if (OPTIONAL_OFFSITE_MEALS.has(mealType)) {
    return (guest.invited_optional_meals ?? []).includes(mealType);
  }
  return false;
}

export function countMealAttendees(
  mealType: string,
  guests: AttendanceGuest[]
): { adults: number; kids: number } {
  let adults = 0;
  let kids = 0;
  for (const g of guests) {
    if (g.rsvp_status === "declined") continue;
    if (!guestAttendsMeal(g, mealType)) continue;
    if (g.is_child) kids++;
    else adults++;
  }
  return { adults, kids };
}
