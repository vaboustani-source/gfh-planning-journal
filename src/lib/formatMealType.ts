const MEAL_DISPLAY_NAMES: Record<string, string> = {
  after_party: "After Party",
  arrival_lunch: "Arrival Lunch",
  rehearsal_dinner: "Rehearsal Dinner",
  welcome_hour: "Welcome Hour",
  wedding_breakfast: "Wedding Day Breakfast",
  reception: "Reception Dinner",
  farewell_brunch: "Farewell Brunch",
};

export function formatMealType(raw: string): string {
  if (MEAL_DISPLAY_NAMES[raw]) return MEAL_DISPLAY_NAMES[raw];
  // Fallback: capitalize each word
  return raw
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
