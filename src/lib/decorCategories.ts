export const DECOR_CATEGORIES = [
  { key: "tables_seating", label: "Tables & Seating" },
  { key: "linens_textiles", label: "Linens & Textiles" },
  { key: "lighting", label: "Lighting" },
  { key: "ceremony", label: "Ceremony" },
  { key: "signage", label: "Signage & Stationery" },
  { key: "lounge", label: "Lounge Furniture" },
  { key: "barware", label: "Barware & Serving" },
  { key: "candles", label: "Candles & Votives" },
  { key: "arches", label: "Arches & Structures" },
  { key: "misc", label: "Miscellaneous" },
] as const;

export type DecorCategoryKey = (typeof DECOR_CATEGORIES)[number]["key"];

export function getCategoryLabel(key: string | null | undefined) {
  if (!key) return "Miscellaneous";
  return DECOR_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}
