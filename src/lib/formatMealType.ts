const MEAL_DISPLAY_NAMES: Record<string, string> = {
  after_party: "After Party",
  arrival_lunch: "Arrival Lunch",
  rehearsal_dinner: "Rehearsal Dinner",
  welcome_hour: "Welcome Hour",
  wedding_breakfast: "Wedding Day Breakfast",
  reception: "Reception Dinner",
  farewell_brunch: "Farewell Brunch",
  goat_yoga: "Goat Yoga",
};

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
