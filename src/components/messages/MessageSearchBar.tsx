import { Search, X } from "lucide-react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function MessageSearchBar({ value, onChange, placeholder = "Search messages…" }: Props) {
  return (
    <div className="relative">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-9 py-2 rounded-full border border-border bg-background font-body text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/** Highlight matches of `query` inside `text` with a gold mark. Case-insensitive. */
export function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const q = query.trim();
  const parts: React.ReactNode[] = [];
  const lower = text.toLowerCase();
  const ql = q.toLowerCase();
  let idx = 0;
  let i = 0;
  while ((i = lower.indexOf(ql, idx)) !== -1) {
    if (i > idx) parts.push(text.slice(idx, i));
    parts.push(
      <mark
        key={i}
        style={{ backgroundColor: "rgba(196,154,64,0.35)", color: "inherit", padding: "0 1px", borderRadius: "2px" }}
      >
        {text.slice(i, i + q.length)}
      </mark>
    );
    idx = i + q.length;
  }
  if (idx < text.length) parts.push(text.slice(idx));
  return parts;
}
