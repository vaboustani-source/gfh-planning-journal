import { useState } from "react";
import { FormField, FieldType, FIELD_TYPE_LABELS, ALL_FIELD_TYPES, newField } from "@/lib/formFields";
import { GripVertical, Plus, Trash2, ChevronDown, X } from "lucide-react";

interface Props {
  fields: FormField[];
  onChange: (fields: FormField[]) => void;
}

export default function FormBuilder({ fields, onChange }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);

  const update = (id: string, patch: Partial<FormField>) =>
    onChange(fields.map(f => (f.id === id ? { ...f, ...patch } : f)));

  const remove = (id: string) => onChange(fields.filter(f => f.id !== id));

  const add = (type: FieldType) => onChange([...fields, newField(type)]);

  const onDragStart = (id: string) => setDragId(id);
  const onDragOver = (e: React.DragEvent, overId: string) => {
    e.preventDefault();
    if (!dragId || dragId === overId) return;
    const fromIdx = fields.findIndex(f => f.id === dragId);
    const toIdx = fields.findIndex(f => f.id === overId);
    if (fromIdx < 0 || toIdx < 0) return;
    const next = [...fields];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {fields.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <p className="font-body text-sm text-muted-foreground">No fields yet. Add one below.</p>
        </div>
      )}

      {fields.map((field) => (
        <div
          key={field.id}
          draggable
          onDragStart={() => onDragStart(field.id)}
          onDragOver={(e) => onDragOver(e, field.id)}
          onDragEnd={() => setDragId(null)}
          className="rounded-lg border border-border bg-card p-3 flex gap-2"
        >
          <div className="flex flex-col items-center pt-2 cursor-grab active:cursor-grabbing text-muted-foreground">
            <GripVertical size={16} />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex gap-2 items-center">
              <input
                value={field.label}
                onChange={(e) => update(field.id, { label: e.target.value })}
                placeholder="Question label"
                className="flex-1 px-3 py-1.5 rounded-md border border-input bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <select
                value={field.type}
                onChange={(e) => update(field.id, { type: e.target.value as FieldType, options: e.target.value === "multiple_choice" ? (field.options ?? ["Option 1"]) : undefined })}
                className="px-2 py-1.5 rounded-md border border-input bg-background font-body text-xs"
              >
                {ALL_FIELD_TYPES.map(t => (
                  <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>
                ))}
              </select>
              <label className="flex items-center gap-1 font-body text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={!!field.required}
                  onChange={(e) => update(field.id, { required: e.target.checked })}
                />
                Required
              </label>
              <button
                onClick={() => remove(field.id)}
                className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                aria-label="Remove field"
              >
                <Trash2 size={14} />
              </button>
            </div>

            {field.type === "multiple_choice" && (
              <div className="space-y-1.5 pl-1">
                {(field.options ?? []).map((opt, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <span className="font-body text-xs text-muted-foreground w-4">{idx + 1}.</span>
                    <input
                      value={opt}
                      onChange={(e) => {
                        const next = [...(field.options ?? [])];
                        next[idx] = e.target.value;
                        update(field.id, { options: next });
                      }}
                      className="flex-1 px-2 py-1 rounded border border-input bg-background font-body text-sm"
                    />
                    <button
                      onClick={() => {
                        const next = (field.options ?? []).filter((_, i) => i !== idx);
                        update(field.id, { options: next.length ? next : ["Option 1"] });
                      }}
                      className="p-1 text-muted-foreground hover:text-destructive"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => update(field.id, { options: [...(field.options ?? []), `Option ${(field.options?.length ?? 0) + 1}`] })}
                  className="font-body text-xs text-sage hover:underline ml-6"
                >
                  + Add option
                </button>
              </div>
            )}
          </div>
        </div>
      ))}

      <div className="relative inline-block">
        <details className="relative">
          <summary className="list-none cursor-pointer inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-card font-body text-sm hover:bg-muted/40">
            <Plus size={14} /> Add field <ChevronDown size={12} />
          </summary>
          <div className="absolute z-10 mt-1 w-48 rounded-md border border-border bg-card shadow-elevated">
            {ALL_FIELD_TYPES.map(t => (
              <button
                key={t}
                onClick={(e) => {
                  add(t);
                  (e.currentTarget.closest("details") as HTMLDetailsElement).open = false;
                }}
                className="block w-full text-left px-3 py-2 font-body text-sm hover:bg-muted/60"
              >
                {FIELD_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}
