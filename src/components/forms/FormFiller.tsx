import { FormField, ResponseMap, ResponseValue } from "@/lib/formFields";

interface Props {
  fields: FormField[];
  responses: ResponseMap;
  onChange: (id: string, value: ResponseValue) => void;
  readOnly?: boolean;
}

export default function FormFiller({ fields, responses, onChange, readOnly }: Props) {
  return (
    <div className="space-y-5">
      {fields.map((field) => {
        const v = responses[field.id];
        return (
          <div key={field.id} className="space-y-1.5">
            <label className="block font-body text-sm font-medium text-foreground">
              {field.label || <span className="italic text-muted-foreground">Untitled</span>}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </label>
            {renderControl(field, v, onChange, readOnly)}
          </div>
        );
      })}
    </div>
  );
}

function renderControl(
  field: FormField,
  value: ResponseValue | undefined,
  onChange: (id: string, v: ResponseValue) => void,
  readOnly?: boolean,
) {
  const baseInput =
    "w-full px-3 py-2 rounded-md border border-input bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-70";

  if (readOnly) {
    if (field.type === "checkbox") {
      return <p className="font-body text-sm text-foreground">{value ? "Yes" : "No"}</p>;
    }
    const display =
      value === null || value === undefined || value === ""
        ? <span className="italic text-muted-foreground">No answer</span>
        : String(value);
    return (
      <div className={field.type === "long_text" ? "whitespace-pre-wrap font-body text-sm text-foreground" : "font-body text-sm text-foreground"}>
        {display}
      </div>
    );
  }

  switch (field.type) {
    case "short_text":
      return (
        <input
          type="text"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(field.id, e.target.value)}
          className={baseInput}
        />
      );
    case "long_text":
      return (
        <textarea
          value={(value as string) ?? ""}
          onChange={(e) => onChange(field.id, e.target.value)}
          rows={4}
          className={baseInput}
        />
      );
    case "number":
      return (
        <input
          type="number"
          value={value === null || value === undefined ? "" : String(value)}
          onChange={(e) => onChange(field.id, e.target.value === "" ? null : Number(e.target.value))}
          className={baseInput}
        />
      );
    case "date":
      return (
        <input
          type="date"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(field.id, e.target.value)}
          className={baseInput}
        />
      );
    case "checkbox":
      return (
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(field.id, e.target.checked)}
            className="h-4 w-4"
          />
          <span className="font-body text-sm text-foreground">Yes</span>
        </label>
      );
    case "multiple_choice":
      return (
        <div className="space-y-1.5">
          {(field.options ?? []).map((opt) => (
            <label key={opt} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={field.id}
                checked={value === opt}
                onChange={() => onChange(field.id, opt)}
                className="h-4 w-4"
              />
              <span className="font-body text-sm text-foreground">{opt}</span>
            </label>
          ))}
        </div>
      );
  }
}
