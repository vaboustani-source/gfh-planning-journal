export type FieldType = "short_text" | "long_text" | "multiple_choice" | "checkbox" | "date" | "number";

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  required?: boolean;
  options?: string[]; // for multiple_choice
  placeholder?: string;
}

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  short_text: "Short text",
  long_text: "Long text",
  multiple_choice: "Multiple choice",
  checkbox: "Checkbox (Yes/No)",
  date: "Date",
  number: "Number",
};

export const ALL_FIELD_TYPES: FieldType[] = [
  "short_text", "long_text", "multiple_choice", "checkbox", "date", "number",
];

export function newField(type: FieldType): FormField {
  return {
    id: crypto.randomUUID(),
    type,
    label: "",
    required: false,
    ...(type === "multiple_choice" ? { options: ["Option 1"] } : {}),
  };
}

export type ResponseValue = string | number | boolean | null;
export type ResponseMap = Record<string, ResponseValue>;

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
