import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Upload, X, FileText } from "lucide-react";
import { toast } from "sonner";
import { FormField, ResponseMap, ResponseValue, CoupleNames, fillNames } from "@/lib/formFields";

const UPLOAD_BUCKET = "form-uploads";
const MAX_FILE_MB = 25;

interface Props {
  fields: FormField[];
  responses: ResponseMap;
  onChange: (id: string, value: ResponseValue) => void;
  readOnly?: boolean;
  names?: CoupleNames;
  // "<event_id>/<assignment_id>" — required for file_upload fields to accept files.
  uploadPrefix?: string;
}

export default function FormFiller({ fields, responses, onChange, readOnly, names, uploadPrefix }: Props) {
  return (
    <div className="space-y-5">
      {fields.map((field, idx) => {
        if (field.type === "section") {
          return (
            <div key={field.id} className={idx === 0 ? "pb-1" : "pt-6 pb-1 border-t border-border"}>
              <h2 className="font-display text-xl font-light text-foreground">{fillNames(field.label, names)}</h2>
              {field.help && <p className="font-body text-sm text-muted-foreground mt-1">{fillNames(field.help, names)}</p>}
            </div>
          );
        }
        const v = responses[field.id];
        return (
          <div key={field.id} className="space-y-1.5">
            <label className="block font-body text-sm font-medium text-foreground">
              {field.label ? fillNames(field.label, names) : <span className="italic text-muted-foreground">Untitled</span>}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </label>
            {field.help && <p className="font-body text-xs text-muted-foreground -mt-0.5">{fillNames(field.help, names)}</p>}
            {renderControl(field, v, onChange, readOnly, uploadPrefix)}
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
  uploadPrefix?: string,
) {
  const baseInput =
    "w-full px-3 py-2 rounded-md border border-input bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-70";

  if (field.type === "file_upload") {
    return (
      <FileUploadControl
        paths={Array.isArray(value) ? value : []}
        onChange={(paths) => onChange(field.id, paths)}
        readOnly={readOnly}
        uploadPrefix={uploadPrefix}
      />
    );
  }

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
          placeholder={field.placeholder}
          onChange={(e) => onChange(field.id, e.target.value)}
          className={baseInput}
        />
      );
    case "long_text":
      return (
        <textarea
          value={(value as string) ?? ""}
          placeholder={field.placeholder}
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
    case "yes_no":
      return (
        <div className="flex gap-2">
          {["Yes", "No"].map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(field.id, opt)}
              className={`px-5 py-1.5 rounded-md border font-body text-sm transition-colors ${
                value === opt ? "bg-sage text-white border-sage" : "bg-background border-input hover:border-sage/50"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      );
    case "dropdown":
      return (
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onChange(field.id, e.target.value || null)}
          className={baseInput}
        >
          <option value="">Select…</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
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
  return null;
}

const isImage = (path: string) => /\.(jpe?g|png|gif|webp|heic|heif|avif)$/i.test(path);
const fileLabel = (path: string) => path.split("/").pop()?.replace(/^\d+-/, "") ?? path;

function FileUploadControl({
  paths, onChange, readOnly, uploadPrefix,
}: {
  paths: string[];
  onChange: (paths: string[]) => void;
  readOnly?: boolean;
  uploadPrefix?: string;
}) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const missing = paths.filter(p => !urls[p]);
    if (!missing.length) return;
    supabase.storage.from(UPLOAD_BUCKET).createSignedUrls(missing, 60 * 60).then(({ data }) => {
      if (!data) return;
      setUrls(prev => {
        const next = { ...prev };
        data.forEach(d => { if (d.path && d.signedUrl) next[d.path] = d.signedUrl; });
        return next;
      });
    });
  }, [paths.join("|")]);

  const upload = async (files: FileList | null) => {
    if (!files?.length || !uploadPrefix) return;
    setUploading(true);
    const added: string[] = [];
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        toast.error(`${file.name} is over ${MAX_FILE_MB} MB`);
        continue;
      }
      const safe = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${uploadPrefix}/${Date.now()}-${safe}`;
      const { error } = await supabase.storage.from(UPLOAD_BUCKET).upload(path, file, { contentType: file.type || undefined });
      if (error) { toast.error(`${file.name}: ${error.message}`); continue; }
      added.push(path);
    }
    if (added.length) onChange([...paths, ...added]);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const remove = async (path: string) => {
    onChange(paths.filter(p => p !== path));
    await supabase.storage.from(UPLOAD_BUCKET).remove([path]);
  };

  if (readOnly && paths.length === 0) {
    return <span className="italic text-muted-foreground font-body text-sm">No files</span>;
  }

  return (
    <div className="space-y-3">
      {paths.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {paths.map(p => (
            <div key={p} className="relative group rounded-md border border-border overflow-hidden bg-muted/40 aspect-square">
              <a href={urls[p]} target="_blank" rel="noreferrer" className="block w-full h-full">
                {isImage(p) && urls[p] ? (
                  <img src={urls[p]} alt={fileLabel(p)} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-2 text-center">
                    <FileText size={18} className="text-muted-foreground" />
                    <span className="font-body text-[10px] text-muted-foreground break-all line-clamp-2">{fileLabel(p)}</span>
                  </div>
                )}
              </a>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => remove(p)}
                  className="absolute top-1 right-1 p-1 rounded-full bg-background/90 text-muted-foreground hover:text-destructive"
                  aria-label="Remove file"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {!readOnly && (
        <>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,video/*,.pdf"
            className="hidden"
            onChange={(e) => upload(e.target.files)}
          />
          <button
            type="button"
            disabled={uploading || !uploadPrefix}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-input bg-background font-body text-sm hover:border-sage/50 disabled:opacity-60"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading ? "Uploading…" : paths.length ? "Add more" : "Choose photos"}
          </button>
        </>
      )}
    </div>
  );
}
