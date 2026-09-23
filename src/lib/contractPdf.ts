import { jsPDF } from "jspdf";
import { parseContract, BLANK_RE } from "@/lib/contractFormat";
import { docTypeLabel, fieldLabel, statusLabel } from "@/lib/contractTemplate";

export interface PdfSignature {
  signer_role?: string | null;
  signer_name: string;
  signer_email: string;
  typed_name: string;
  signed_at: string;
  ip_address?: string | null;
  content_version_hash: string;
}

export interface PdfContract {
  title: string;
  document_type: string;
  status: string;
  content_hash?: string | null;
}

// Letter, 0.75in margins, in points.
const PAGE_W = 612;
const PAGE_H = 792;
const M = 54;
const W = PAGE_W - M * 2;
const INK: [number, number, number] = [44, 62, 45];
const MUTED: [number, number, number] = [107, 107, 107];
const GOLD: [number, number, number] = [201, 168, 76];

// The built-in PDF fonts only cover Windows-1252; swap anything else for a safe look-alike.
const WIN_ANSI_EXTRAS = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
const SUBS: Record<string, string> = { "◦": "-", "○": "-", "✓": "v", "→": "->", "≥": ">=", "≤": "<=", " ": " " };
function pdfSafe(s: string): string {
  let out = "";
  for (const ch of s) {
    if (SUBS[ch] !== undefined) out += SUBS[ch];
    else if (ch.charCodeAt(0) <= 0xff || WIN_ANSI_EXTRAS.includes(ch)) out += ch;
    else out += "?";
  }
  return out;
}

/** Unfilled blanks print as [Label] so a preview PDF makes gaps obvious. */
const showBlanks = (s: string) => pdfSafe(s.replace(BLANK_RE, (_m, k: string) => `[${fieldLabel(k)}]`));

const roleLabel = (r?: string | null) =>
  r === "venue" || r === "countersigner" ? "Gilbertsville Farmhouse" : "Client";

export function buildContractPdf(opts: {
  contract: PdfContract;
  text: string;
  signatures?: PdfSignature[];
  preview?: boolean;
}): jsPDF {
  const { contract, text, signatures = [], preview = false } = opts;
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  let y = M;

  const setFont = (font: "helvetica" | "times" | "courier", style: "normal" | "bold" | "italic", size: number, color = INK) => {
    doc.setFont(font, style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };
  const lineH = (size: number) => size * 1.45;
  const room = (h: number) => {
    if (y + h > PAGE_H - M - 18) { doc.addPage(); y = M; }
  };
  const wrapped = (s: string, x: number, width: number, size: number) => {
    const lines = doc.splitTextToSize(s, width) as string[];
    for (const l of lines) {
      room(lineH(size));
      doc.text(l, x, y + size);
      y += lineH(size);
    }
  };

  // Header
  if (preview) {
    doc.setFillColor(254, 243, 199);
    doc.rect(M, y, W, 22, "F");
    setFont("helvetica", "bold", 9, [120, 53, 15]);
    doc.text("PREVIEW - NOT YET SENT TO THE COUPLE", M + 8, y + 14.5);
    y += 34;
  }
  setFont("helvetica", "normal", 8.5, MUTED);
  doc.text("GILBERTSVILLE FARMHOUSE", M, y + 8.5, { charSpace: 1.2 });
  y += 18;
  setFont("times", "normal", 22);
  wrapped(pdfSafe(contract.title), M, W, 22);
  setFont("helvetica", "normal", 9.5, MUTED);
  doc.text(pdfSafe(`${docTypeLabel(contract.document_type)}  ·  ${preview ? "Draft" : statusLabel(contract.status)}`), M, y + 9.5);
  y += 18;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(1.2);
  doc.line(M, y, M + W, y);
  y += 18;

  // Body
  const BODY = 10.5;
  for (const b of parseContract(text)) {
    switch (b.type) {
      case "gap":
        y += 5;
        break;
      case "title":
        setFont("times", "bold", 15);
        room(lineH(15) + 6);
        for (const l of doc.splitTextToSize(showBlanks(b.text), W) as string[]) {
          doc.text(l, PAGE_W / 2, y + 15, { align: "center" });
          y += lineH(15);
        }
        y += 6;
        break;
      case "heading":
        y += 8;
        room(lineH(BODY) * 2);
        setFont("helvetica", "bold", 10);
        wrapped(showBlanks(b.text), M, W, 10);
        y += 2;
        break;
      case "labeled": {
        const label = showBlanks(b.label) + ": ";
        const value = showBlanks(b.value);
        setFont("helvetica", "normal", BODY, MUTED);
        const lw = doc.getTextWidth(label.trimEnd()) + 4; // trailing spaces aren't measured
        const short = value.length <= 70;
        setFont("helvetica", short ? "bold" : "normal", BODY);
        if (lw + doc.getTextWidth(value) <= W) {
          room(lineH(BODY));
          setFont("helvetica", "normal", BODY, MUTED);
          doc.text(label, M, y + BODY);
          setFont("helvetica", short ? "bold" : "normal", BODY);
          doc.text(value, M + lw, y + BODY);
          y += lineH(BODY);
        } else {
          setFont("helvetica", "normal", BODY, MUTED);
          wrapped(label.trim(), M, W, BODY);
          setFont("helvetica", short ? "bold" : "normal", BODY);
          wrapped(value, M, W, BODY);
        }
        break;
      }
      case "clause": {
        setFont("helvetica", "bold", BODY, MUTED);
        room(lineH(BODY));
        doc.text(pdfSafe(b.marker), M, y + BODY);
        setFont("helvetica", "normal", BODY);
        wrapped(showBlanks(b.text), M + 20, W - 20, BODY);
        y += 2;
        break;
      }
      case "bullet": {
        const indent = b.level === 2 ? 30 : 6;
        setFont("helvetica", "normal", BODY, MUTED);
        room(lineH(BODY));
        doc.text(b.level === 2 ? "-" : "•", M + indent, y + BODY);
        setFont("helvetica", "normal", BODY);
        wrapped(showBlanks(b.text), M + indent + 12, W - indent - 12, BODY);
        break;
      }
      default:
        setFont("helvetica", "normal", BODY);
        wrapped(showBlanks(b.text), M, W, BODY);
        y += 2;
    }
  }

  // Certificate of signature
  if (signatures.length) {
    doc.addPage();
    y = M;
    setFont("times", "normal", 20);
    doc.text("Certificate of Signature", M, y + 20);
    y += 30;
    doc.setDrawColor(...GOLD);
    doc.line(M, y, M + W, y);
    y += 16;

    const ordered = [...signatures].sort((a, b) => Date.parse(a.signed_at) - Date.parse(b.signed_at));
    ordered.forEach((s, i) => {
      room(150);
      setFont("helvetica", "normal", 8.5, MUTED);
      doc.text(`SIGNATURE ${i + 1} OF ${ordered.length}  ·  ${roleLabel(s.signer_role).toUpperCase()}`, M, y + 8.5, { charSpace: 0.6 });
      y += 18;
      setFont("times", "italic", 20);
      doc.text(pdfSafe(s.typed_name), M, y + 18);
      y += 28;
      const rows: Array<[string, string]> = [
        ["Signer", `${s.signer_name} <${s.signer_email}>`],
        ["Signed at", new Date(s.signed_at).toLocaleString("en-US", {
          weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short",
        })],
        ["IP address", s.ip_address || "Not recorded"],
      ];
      for (const [k, v] of rows) {
        setFont("helvetica", "normal", 9.5, MUTED);
        room(lineH(9.5));
        doc.text(k, M, y + 9.5);
        setFont("helvetica", "normal", 9.5);
        wrapped(pdfSafe(v), M + 80, W - 80, 9.5);
      }
      setFont("helvetica", "normal", 9.5, MUTED);
      room(lineH(9.5));
      doc.text("Content hash", M, y + 9.5);
      setFont("courier", "normal", 7.5);
      wrapped(s.content_version_hash, M + 80, W - 80, 7.5);
      y += 14;
    });

    room(80);
    setFont("helvetica", "bold", 10);
    doc.text("Document fingerprint (SHA-256)", M, y + 10);
    y += 16;
    setFont("courier", "normal", 7.5);
    wrapped(contract.content_hash || "Not recorded", M, W, 7.5);
    y += 4;
    setFont("helvetica", "normal", 9, MUTED);
    wrapped(
      "Each signature is bound to a content hash. When a signature's hash matches this fingerprint, the agreement text was not altered after that signature was recorded.",
      M, W, 9,
    );
  }

  // Footer on every page
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    setFont("helvetica", "normal", 8, MUTED);
    doc.text(pdfSafe(`Gilbertsville Farmhouse  ·  ${contract.title}`), M, PAGE_H - M / 2);
    doc.text(`Page ${p} of ${pages}`, PAGE_W - M, PAGE_H - M / 2, { align: "right" });
  }
  return doc;
}

export function downloadContractPdf(opts: Parameters<typeof buildContractPdf>[0]) {
  const doc = buildContractPdf(opts);
  const safe = opts.contract.title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || "contract";
  doc.save(`${safe}${opts.preview ? "-PREVIEW" : ""}.pdf`);
}
