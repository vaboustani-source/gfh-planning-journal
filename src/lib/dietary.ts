export const DIETARY_RESTRICTIONS = [
  "GF — Celiac",
  "GF — Intolerance (not Celiac)",
  "Dairy Free — Lactose Intolerance",
  "Dairy Free — Allergy",
  "Tree Nut Allergy",
  "Peanut Allergy",
  "Sesame Allergy",
  "Soy",
  "Shellfish",
  "Egg",
  "Vegetarian",
  "Vegan",
  "Pescatarian",
  "Kosher-style (avoid mixing meat and dairy)",
  "Kosher — fully observant (Hechsher required)",
  "Zabihah Halal",
  "Halal (no pork or alcohol)",
  "No Pork",
  "No Beef",
  "Diabetic",
  "Other",
] as const;

export const RESTRICTION_TYPES = [
  "Ingestion — cannot eat",
  "Proximity — cannot be near",
  "Preference — can eat if necessary",
  "Religious / Cultural",
  "Lifestyle",
  "Other",
] as const;

export const SEVERITIES = [
  { value: "fatal", label: "Fatal — anaphylaxis or severe reaction" },
  { value: "medical", label: "Medically significant — serious but not fatal" },
  { value: "preference", label: "Preference only — no physical reaction" },
] as const;

export type SeverityValue = "fatal" | "medical" | "preference";

export const SEVERITY_BADGE: Record<string, { label: string; cls: string }> = {
  fatal: { label: "Fatal", cls: "bg-red-100 text-red-800 border-red-300" },
  medical: { label: "Medically Significant", cls: "bg-amber-100 text-amber-900 border-amber-300" },
  preference: { label: "Preference", cls: "bg-sage/20 text-sage-dark border-sage/40" },
};

export interface DietaryEntry {
  id: string;
  guest_id: string | null;
  event_id: string;
  restriction: string;
  restriction_type: string | null;
  severity: string | null;
  applies_to_meals: string[];
  notes: string | null;
}

export const isProximity = (t: string | null) => !!t && t.toLowerCase().startsWith("proximity");
