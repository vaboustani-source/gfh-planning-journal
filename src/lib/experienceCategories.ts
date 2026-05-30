export const EXPERIENCE_CATEGORIES = [
  { key: "friday_experiences", label: "Friday Experiences" },
  { key: "saturday_addons", label: "Saturday Add-ons" },
  { key: "rehearsal_dinner_themes", label: "Rehearsal Dinner Themes" },
  { key: "amenity_upgrades", label: "Amenity Upgrades" },
] as const;

export type ExperienceCategoryKey = (typeof EXPERIENCE_CATEGORIES)[number]["key"];

export const PRICING_TYPES = [
  { key: "flat", label: "Flat Fee", blurb: "one total price regardless of guests or time" },
  { key: "per_person", label: "Per Person", blurb: "price × guest count, set a minimum guest count" },
  { key: "per_hour", label: "Per Hour", blurb: "price × hours, set a minimum hours" },
  { key: "tiered", label: "Tiered", blurb: "multiple named tiers, each with its own price" },
  { key: "custom_quote", label: "Custom Quote", blurb: "no price shown, always requires discussion" },
] as const;

export type PricingType = (typeof PRICING_TYPES)[number]["key"];

export interface PricingConfig {
  rate?: number;
  min_guests?: number;
  min_hours?: number;
  increment?: "30min" | "1hr";
  price_label?: string;
  tiers?: { name: string; price: number; description?: string }[];
}

export function getCategoryLabel(key: string): string {
  return EXPERIENCE_CATEGORIES.find(c => c.key === key)?.label ?? key;
}

export function formatPriceForCouple(item: {
  pricing_type: string | null;
  pricing_config: PricingConfig | null;
  pricing_visible_to_couple: boolean | null;
}): string {
  if (item.pricing_type === "custom_quote") return "Custom — Tell us your vision";
  if (!item.pricing_type || !item.pricing_visible_to_couple) return "Inquire for Pricing";
  const c = item.pricing_config || {};
  const label = c.price_label;
  switch (item.pricing_type) {
    case "flat":
      return c.rate != null ? `$${Number(c.rate).toLocaleString()}${label ? ` ${label}` : ""}` : "Inquire for Pricing";
    case "per_person":
      return c.rate != null ? `$${c.rate} per person` : "Inquire for Pricing";
    case "per_hour":
      return c.rate != null ? `$${c.rate} per hour` : "Inquire for Pricing";
    case "tiered": {
      const tiers = c.tiers ?? [];
      if (!tiers.length) return "Inquire for Pricing";
      const min = Math.min(...tiers.map(t => Number(t.price) || Infinity));
      return `${tiers.length} ${tiers.length === 1 ? "tier" : "tiers"} available — Starting at $${min.toLocaleString()}`;
    }
    default:
      return "Inquire for Pricing";
  }
}

export function isPricingConfigured(pricing_type: string | null, pricing_config: PricingConfig | null): boolean {
  if (!pricing_type) return false;
  if (pricing_type === "custom_quote") return true;
  const c = pricing_config || {};
  if (pricing_type === "tiered") return (c.tiers?.length ?? 0) > 0;
  return c.rate != null && Number(c.rate) > 0;
}
