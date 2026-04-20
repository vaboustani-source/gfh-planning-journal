// Categories used in the global `preferred_vendors` table, plus how they
// map to the per-event `vendors.category` enum.

export interface PreferredCategoryDef {
  /** DB value stored in preferred_vendors.category */
  key: string;
  /** Friendly section header on the admin + portal pages */
  label: string;
  /** Optional set of subcategories (only some categories use this) */
  subcategories?: string[];
  /**
   * Per-event vendor category (or categories) this preferred entry can be
   * copied into. First entry is the default target.
   */
  eventCategories: string[];
}

export const PREFERRED_CATEGORIES: PreferredCategoryDef[] = [
  { key: "planner",         label: "Planners & Designers",  eventCategories: ["planner"] },
  { key: "rentals",         label: "Rentals",               eventCategories: ["rentals"] },
  { key: "photographer",    label: "Photography",           eventCategories: ["photographer"] },
  { key: "videographer",    label: "Videography",           eventCategories: ["videographer"] },
  { key: "photo_booth",     label: "Photo Installations",   eventCategories: ["photo_booth"] },
  { key: "florals",         label: "Florals",               eventCategories: ["florals"] },
  { key: "hair_makeup",     label: "Hair & Makeup",         subcategories: ["Hair", "Makeup", "Full Service"], eventCategories: ["hair", "makeup"] },
  { key: "dj",              label: "Music — DJs",           eventCategories: ["dj_band"] },
  { key: "band",            label: "Music — Bands",         eventCategories: ["dj_band"] },
  { key: "ceremony_music",  label: "Music — Ceremony",      eventCategories: ["ceremony_music"] },
  { key: "officiant",       label: "Officiants",            eventCategories: ["officiant"] },
  { key: "cake",            label: "Bakers & Desserts",     eventCategories: ["cake"] },
  { key: "shuttle",         label: "Transportation",        eventCategories: ["shuttle"] },
  { key: "fireworks",       label: "Fireworks",             eventCategories: ["fireworks"] },
  // Legacy combined hair_makeup / dj_band aliases (handled below)
];

// Some legacy data may already exist with `hair_makeup` or `dj_band` keys —
// fall back to a sensible label/mapping.
const LEGACY_MAP: Record<string, PreferredCategoryDef> = {
  dj_band: { key: "dj_band", label: "Music — DJs & Bands", subcategories: ["DJ", "Band", "Hybrid"], eventCategories: ["dj_band"] },
};

export function getCategoryDef(key: string): PreferredCategoryDef {
  return (
    PREFERRED_CATEGORIES.find(c => c.key === key) ||
    LEGACY_MAP[key] ||
    { key, label: key.replace(/_/g, " "), eventCategories: ["other"] }
  );
}

export const TIER_OPTIONS = ["", "$", "$$", "$$$"] as const;
export type TierValue = typeof TIER_OPTIONS[number];

/**
 * Given a per-event vendor category (e.g. "hair", "makeup"), return the
 * preferred_vendors category keys that should appear in the drawer for it.
 */
export function preferredKeysForEventCategory(eventCategory: string): string[] {
  const matches: string[] = [];
  for (const def of PREFERRED_CATEGORIES) {
    if (def.eventCategories.includes(eventCategory)) matches.push(def.key);
  }
  // Legacy combined values
  if (eventCategory === "dj_band") matches.push("dj_band");
  return matches;
}
