export type FieldType =
  | "section" | "short_text" | "long_text" | "multiple_choice" | "dropdown"
  | "yes_no" | "checkbox" | "date" | "number" | "file_upload";

export interface FormField {
  id: string;
  type: FieldType;
  // Labels and help text may use {partner1} / {partner2}; see fillNames().
  label: string;
  help?: string;
  required?: boolean;
  options?: string[]; // for multiple_choice + dropdown
  placeholder?: string;
}

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  section: "Section heading",
  short_text: "Short text",
  long_text: "Long text",
  multiple_choice: "Multiple choice",
  dropdown: "Dropdown",
  yes_no: "Yes / No",
  checkbox: "Checkbox (Yes/No)",
  date: "Date",
  number: "Number",
  file_upload: "Photo / file upload",
};

export const ALL_FIELD_TYPES: FieldType[] = [
  "section", "short_text", "long_text", "multiple_choice", "dropdown",
  "yes_no", "checkbox", "date", "number", "file_upload",
];

export const HAS_OPTIONS = (t: FieldType) => t === "multiple_choice" || t === "dropdown";

export function newField(type: FieldType): FormField {
  return {
    id: crypto.randomUUID(),
    type,
    label: "",
    required: false,
    ...(HAS_OPTIONS(type) ? { options: ["Option 1"] } : {}),
  };
}

// file_upload answers are arrays of storage paths in the form-uploads bucket.
export type ResponseValue = string | number | boolean | string[] | null;
export type ResponseMap = Record<string, ResponseValue>;

export function isAnswered(field: FormField, v: ResponseValue | undefined): boolean {
  if (field.type === "section") return true;
  if (v === undefined || v === null || v === "") return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "string") return v.trim() !== "";
  return true;
}

export function missingRequired(fields: FormField[], responses: ResponseMap): FormField[] {
  return fields.filter(f => f.required && f.type !== "section" && !isAnswered(f, responses[f.id]));
}

export interface CoupleNames { partner1?: string | null; partner2?: string | null }

export function fillNames(text: string, names?: CoupleNames): string {
  const first = (n?: string | null) => (n ?? "").trim().split(/\s+/)[0] || "";
  return text
    .replace(/\{partner1\}/g, first(names?.partner1) || "Partner one")
    .replace(/\{partner2\}/g, first(names?.partner2) || "Partner two");
}

export type AssignmentStatus = "not_started" | "in_progress" | "submitted";

export const STATUS_LABELS: Record<AssignmentStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  submitted: "Submitted",
};

export const STATUS_COLORS: Record<AssignmentStatus, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-amber-100 text-amber-700",
  submitted: "bg-emerald-100 text-emerald-700",
};
