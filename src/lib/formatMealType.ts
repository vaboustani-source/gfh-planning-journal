const MEAL_DISPLAY_NAMES: Record<string, string> = {
  arrival_lunch: "Arrival Lunch",
  rehearsal_dinner: "Rehearsal Dinner",
  wedding_breakfast: "Wedding Day Breakfast",
  welcome_hour: "Welcome Hour",
  cocktail_hour: "Cocktail Hour",
  reception: "Reception Dinner",
  after_party: "After Party",
  farewell_brunch: "Farewell Brunch",
  goat_yoga: "Goat Yoga",
};

/** Canonical display order for meal types */
export const MEAL_SORT_ORDER: string[] = [
  "arrival_lunch",
  "rehearsal_dinner",
  "wedding_breakfast",
  "welcome_hour",
  "cocktail_hour",
  "reception",
  "after_party",
  "farewell_brunch",
];

const PACKAGE_DISPLAY_NAMES: Record<string, string> = {
  base: "Base Package",
  elevated: "Elevated Package",
  full: "Full Package",
  premium: "Premium Package",
  elite: "Elite Package",
};

export function formatPackageTier(raw: string | null): string | null {
  if (!raw) return null;
  return PACKAGE_DISPLAY_NAMES[raw] || raw.charAt(0).toUpperCase() + raw.slice(1) + " Package";
}

export function formatMealType(raw: string): string {
  if (MEAL_DISPLAY_NAMES[raw]) return MEAL_DISPLAY_NAMES[raw];
  // Fallback: capitalize each word
  return raw
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
