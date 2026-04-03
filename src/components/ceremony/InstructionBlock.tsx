import { useState } from "react";
import { ChevronRight } from "lucide-react";

interface InstructionBlockProps {
  title: string;
  instruction: string;
  tip?: string;
  example?: { lines: string[] };
  exampleLabel?: string;
}

export default function InstructionBlock({ title, instruction, tip, example, exampleLabel = "See a common example →" }: InstructionBlockProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl bg-sage/8 border border-sage/20 px-5 py-4 space-y-3">
      <p className="font-display text-base font-light text-foreground">{title}</p>
      <p className="font-body text-sm text-muted-foreground italic leading-relaxed">{instruction}</p>

      {example && (
        <div>
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className="flex items-center gap-1.5 font-body text-xs font-medium text-sage hover:text-sage-dark transition-colors"
          >
            <ChevronRight size={12} className={`transition-transform ${open ? "rotate-90" : ""}`} />
            {exampleLabel}
          </button>
          {open && (
            <div className="mt-3 rounded-lg bg-background/60 border border-sage/15 px-4 py-3 space-y-1.5">
              {example.lines.map((line, i) => (
                <p key={i} className="font-body text-xs text-muted-foreground leading-relaxed">{line}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {tip && (
        <p className="font-body text-[11px] text-muted-foreground/70 leading-relaxed">{tip}</p>
      )}
    </div>
  );
}

export const PROCESSIONAL_INSTRUCTIONS = {
  title: "Who's walking in?",
  instruction: "List everyone who will be formally introduced or walk in during your ceremony and reception — in the order they'll enter. Start with the first person who walks in and end with you two. Don't overthink it — you can always change this before Brandon locks it in.",
  example: {
    lines: [
      'Parents of Partner 1 — Mom & Dad Smith — Escorted together — "A Thousand Years"',
      'Parents of Partner 2 — Mom & Dad Johnson — Escorted together — "Can\'t Help Falling in Love"',
      'Maid of Honor — Sarah Smith — Unescorted — same song continues',
      'Best Man — Mike Johnson — Unescorted — same song continues',
      'Flower Girl — Emma Smith — Unescorted — "Here Comes the Sun"',
      'Ring Bearer — Jack Johnson — Unescorted — same song',
      'Partner 1 (Bride) — Jane Smith — Escorted by both parents — "Marry Me"',
      'Partner 2 (Groom) — Already at altar — N/A',
    ],
  },
  tip: "Tip: Brandon will walk through this with you on your 90-day planning call — so if you're not sure yet, just leave it blank and come back to it.",
};

export const PARENT_DANCES_INSTRUCTIONS = {
  title: "Parent Dances",
  instruction: "List any parent dances you'd like — for example, a Father-Daughter dance or Mother-Son dance. Add as many or as few as you like. If you're skipping parent dances entirely, just leave this blank.",
};
