import type { ReactNode } from "react";
import { parseContract, BLANK_RE } from "@/lib/contractFormat";
import { fieldLabel } from "@/lib/contractTemplate";

/** Highlights any blank still left in the text, e.g. {site_fee} → [Site fee]. */
function withBlanks(text: string): ReactNode {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(BLANK_RE)) {
    if (m.index! > last) parts.push(text.slice(last, m.index));
    parts.push(
      <span key={m.index} className="rounded bg-amber-100 text-amber-900 px-1 font-medium">
        [{fieldLabel(m[1])}]
      </span>,
    );
    last = m.index! + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length ? parts : text;
}

/**
 * The contract as the couple reads it: readable on a phone (hanging-indent clauses, wrapped
 * bullets, long URLs break) and on a desktop. Text is shown exactly as written.
 */
export default function ContractDocument({ text, className = "" }: { text: string; className?: string }) {
  const blocks = parseContract(text);
  return (
    <div className={`font-body text-[15px] sm:text-base leading-[1.7] text-foreground break-words ${className}`}>
      {blocks.map((b, i) => {
        switch (b.type) {
          case "title":
            return (
              <h2 key={i} className="font-display text-2xl sm:text-3xl font-light text-center leading-tight mb-6">
                {withBlanks(b.text)}
              </h2>
            );
          case "heading":
            return (
              <h3 key={i} className="font-body text-[13px] sm:text-sm font-semibold tracking-[0.08em] uppercase text-foreground mt-6 mb-2">
                {withBlanks(b.text)}
              </h3>
            );
          case "labeled":
            return (
              <p key={i} className="my-1">
                <span className="text-[13px] sm:text-sm tracking-wide text-muted-foreground">{b.label}: </span>
                <span className={b.value.length <= 70 ? "font-medium" : ""}>{withBlanks(b.value)}</span>
              </p>
            );
          case "clause":
            return (
              <div key={i} className="grid grid-cols-[1.75rem_1fr] sm:grid-cols-[2rem_1fr] my-1.5">
                <span className="font-medium text-muted-foreground">{b.marker}</span>
                <span>{withBlanks(b.text)}</span>
              </div>
            );
          case "bullet":
            return (
              <div key={i} className={`grid grid-cols-[1.25rem_1fr] my-1 ${b.level === 2 ? "ml-6" : "ml-1"}`}>
                <span className="text-muted-foreground">{b.level === 2 ? "◦" : "•"}</span>
                <span>{withBlanks(b.text)}</span>
              </div>
            );
          case "gap":
            return <div key={i} className="h-3" aria-hidden />;
          default:
            return <p key={i} className="my-1.5">{withBlanks(b.text)}</p>;
        }
      })}
    </div>
  );
}

