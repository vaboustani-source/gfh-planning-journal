import { useEffect, useRef, useState } from "react";
import { Check, ExternalLink, ImagePlus, Loader2, Star, Trash2 } from "lucide-react";
import { MOODBOARD_CATEGORIES, PROVIDER_LABELS, categoryLabel, moodboardImageUrl, type MoodboardItem } from "@/lib/moodboard";

type Props = {
  item: MoodboardItem;
  mode: "couple" | "staff" | "view";
  onUpdate?: (patch: Partial<MoodboardItem>) => void;
  onDelete?: () => void;
  onAttachImage?: (file: File) => Promise<void>;
};

export default function MoodboardCard({ item, mode, onUpdate, onDelete, onAttachImage }: Props) {
  const editable = mode !== "view";
  const img = moodboardImageUrl(item.image_path);
  const [note, setNote] = useState(item.note ?? "");
  const [staffNote, setStaffNote] = useState(item.staff_note ?? "");
  const [attaching, setAttaching] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => setNote(item.note ?? ""), [item.note]);
  useEffect(() => setStaffNote(item.staff_note ?? ""), [item.staff_note]);

  const provider = PROVIDER_LABELS[item.provider] ?? "Link";
  const openLabel = item.provider === "web" ? "Open link" : `Open on ${provider}`;

  const attach = async (file?: File) => {
    if (!file || !onAttachImage) return;
    setAttaching(true);
    try { await onAttachImage(file); } finally { setAttaching(false); }
  };

  const image = img ? (
    <img src={img} alt={item.title ?? `${provider} inspiration`} loading="lazy" className="w-full h-auto block" />
  ) : (
    <div className="aspect-[4/3] w-full flex flex-col items-center justify-center gap-2 bg-muted/50 text-center px-6">
      <span className="font-display text-xl font-light text-foreground/70">{provider}</span>
      {item.provider === "instagram" && editable && (
        <span className="font-body text-xs text-muted-foreground">Instagram didn't share a preview. Add a screenshot so the team can see it.</span>
      )}
    </div>
  );

  return (
    <div className="break-inside-avoid mb-4 rounded-xl bg-card border border-border overflow-hidden group">
      <div className="relative">
        {item.source_url ? (
          <a href={item.source_url} target="_blank" rel="noopener noreferrer" title={openLabel}>{image}</a>
        ) : image}
        <span className="absolute top-2 left-2 rounded-full bg-background/90 backdrop-blur px-2 py-0.5 font-body text-[10px] uppercase tracking-wider text-foreground/80">
          {provider}
        </span>
        {item.approved && (
          <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground px-2 py-0.5 font-body text-[10px] uppercase tracking-wider">
            <Star size={10} fill="currentColor" /> Team favorite
          </span>
        )}
        {editable && item.kind === "link" && onAttachImage && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className={`absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-background/90 backdrop-blur px-2.5 py-1 font-body text-[11px] text-foreground shadow-sm transition-opacity ${img ? "opacity-0 group-hover:opacity-100" : ""}`}
          >
            {attaching ? <Loader2 size={12} className="animate-spin" /> : <ImagePlus size={12} />}
            {img ? "Replace image" : "Add screenshot"}
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { attach(e.target.files?.[0]); e.target.value = ""; }} />
      </div>

      <div className="p-3 space-y-2.5">
        {item.title && <p className="font-body text-xs text-muted-foreground line-clamp-2">{item.title}</p>}

        {editable ? (
          <select
            value={item.category}
            onChange={e => onUpdate?.({ category: e.target.value })}
            className="w-full rounded-md border border-border bg-background px-2 py-1 font-body text-xs text-foreground focus:outline-none focus:border-primary/50"
          >
            {MOODBOARD_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        ) : (
          <p className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">{categoryLabel(item.category)}</p>
        )}

        {mode === "couple" ? (
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            onBlur={() => { if (note.trim() !== (item.note ?? "")) onUpdate?.({ note: note.trim() || null }); }}
            rows={2}
            placeholder="What do you love about this?"
            className="w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 font-body text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
          />
        ) : item.note ? (
          <p className="font-body text-sm text-foreground whitespace-pre-line">
            <span className="text-muted-foreground">{mode === "staff" ? "Couple: " : ""}</span>{item.note}
          </p>
        ) : null}

        {mode === "staff" && (
          <>
            <textarea
              value={staffNote}
              onChange={e => setStaffNote(e.target.value)}
              onBlur={() => { if (staffNote.trim() !== (item.staff_note ?? "")) onUpdate?.({ staff_note: staffNote.trim() || null }); }}
              rows={2}
              placeholder="Note to the couple (they'll see this)"
              className="w-full resize-none rounded-md border border-border bg-sage/5 px-2 py-1.5 font-body text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
            />
            <button
              type="button"
              onClick={() => onUpdate?.({ approved: !item.approved })}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-body text-xs transition-colors ${
                item.approved ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              <Check size={12} /> {item.approved ? "Team favorite" : "Mark as team favorite"}
            </button>
          </>
        )}

        {mode === "couple" && item.staff_note && (
          <p className="rounded-md bg-sage/10 px-2.5 py-2 font-body text-xs text-foreground">
            <span className="font-medium">From the GFH team:</span> {item.staff_note}
          </p>
        )}

        {(item.source_url || (editable && onDelete)) && (
          <div className="flex items-center justify-between pt-0.5">
            {item.source_url ? (
              <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-body text-[11px] text-muted-foreground hover:text-foreground">
                {openLabel} <ExternalLink size={11} />
              </a>
            ) : <span />}
            {editable && onDelete && (
              <button
                type="button"
                onClick={() => { if (confirm("Remove this from the mood board?")) onDelete(); }}
                className="text-muted-foreground/60 hover:text-destructive transition-colors"
                title="Remove"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
