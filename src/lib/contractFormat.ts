/* Turns plain contract text into typed blocks so the screen view and the PDF lay it out
   the same way: headings, lettered clauses with a hanging indent, bullets, and
   "LABEL: value" lines. The text itself is never changed, only how it's arranged. */

export type ContractBlock =
  | { type: "title"; text: string }
  | { type: "heading"; text: string }
  | { type: "labeled"; label: string; value: string }
  | { type: "clause"; marker: string; text: string }
  | { type: "bullet"; text: string; level: 1 | 2 }
  | { type: "para"; text: string }
  | { type: "gap" };

const hasLetters = (s: string) => /[A-Za-z]/.test(s);
const isUpper = (s: string) => hasLetters(s) && s === s.toUpperCase();

export function parseContract(text: string): ContractBlock[] {
  const blocks: ContractBlock[] = [];
  const lines = (text ?? "").replace(/\r\n/g, "\n").split("\n");
  let sawTitle = false;

  for (const raw of lines) {
    const line = raw.trimEnd();
    const t = line.trim();
    if (!t) {
      if (blocks.length && blocks[blocks.length - 1].type !== "gap") blocks.push({ type: "gap" });
      continue;
    }

    // Sub-bullet: "   ◦ Check-In Time: 3PM"
    const sub = /^\s*[◦○]\s+(.*)$/.exec(line);
    if (sub) { blocks.push({ type: "bullet", text: sub[1], level: 2 }); continue; }

    // Bullet: "• text", "- text", "* text"
    const bul = /^\s*[•\-*]\s+(.*)$/.exec(line);
    if (bul) { blocks.push({ type: "bullet", text: bul[1], level: 1 }); continue; }

    // First all-caps line is the document title.
    if (!sawTitle && isUpper(t) && t.length <= 90) {
      blocks.push({ type: "title", text: t });
      sawTitle = true;
      continue;
    }
    sawTitle = true;

    // Numbered section heading: "6. CANCELLATION POLICY – PLEASE READ CAREFULLY!!"
    if (/^\d+\.\s+/.test(t) && isUpper(t.replace(/^\d+\.\s+/, "")) && t.length <= 90) {
      blocks.push({ type: "heading", text: t });
      continue;
    }

    // Lettered clause: "A. The booking deposit is non-refundable."
    const clause = /^([A-Z]|\d{1,2})\.\s+(.*)$/.exec(t);
    if (clause && !isUpper(clause[2])) {
      blocks.push({ type: "clause", marker: `${clause[1]}.`, text: clause[2] });
      continue;
    }

    // "LABEL: value", e.g. "VENUE SITE FEE: $45,000.00" or "Routing Number: 021303618"
    const labeled = /^([^:]{2,60}):\s*(.+)$/.exec(t);
    if (labeled && (isUpper(labeled[1]) || /^[A-Z][A-Za-z0-9 &()\/'-]{1,40}$/.test(labeled[1])) && !isUpper(labeled[2])) {
      blocks.push({ type: "labeled", label: labeled[1], value: labeled[2] });
      continue;
    }

    // A short all-caps line on its own is a heading: "PAYMENT SCHEDULE", "BY WIRE:"
    if (isUpper(t) && t.length <= 70 && !/[.;]$/.test(t)) {
      blocks.push({ type: "heading", text: t.replace(/:$/, "") });
      continue;
    }

    blocks.push({ type: "para", text: t });
  }
  while (blocks.length && blocks[blocks.length - 1].type === "gap") blocks.pop();
  return blocks;
}

/** Unfilled blanks look like {site_fee}; used to flag them in the preview. */
export const BLANK_RE = /\{([a-z][a-z0-9_]*)\}/g;
