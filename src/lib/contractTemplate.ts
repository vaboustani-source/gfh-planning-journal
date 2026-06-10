// Contract content helpers: placeholder substitution + content hashing.

export interface ContractContext {
  couple_names?: string | null;
  wedding_date?: string | null;
  venue_name?: string | null;
  guest_count?: number | string | null;
  package_tier?: string | null;
  total_amount?: number | string | null;
}

const PLACEHOLDERS: (keyof ContractContext)[] = [
  "couple_names",
  "wedding_date",
  "venue_name",
  "guest_count",
  "package_tier",
  "total_amount",
];

export const PLACEHOLDER_TOKENS = PLACEHOLDERS.map((k) => `{${k}}`);

function formatValue(key: keyof ContractContext, value: unknown): string {
  if (value === null || value === undefined || value === "") return `{${key}}`;
  if (key === "wedding_date" && typeof value === "string") {
    try {
      return new Date(value + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return String(value);
    }
  }
  if (key === "total_amount" && (typeof value === "number" || typeof value === "string")) {
    const n = Number(value);
    if (!Number.isNaN(n)) return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
  }
  if (key === "package_tier" && typeof value === "string") {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
  return String(value);
}

export function renderContract(content: string, ctx: ContractContext): string {
  let out = content ?? "";
  for (const key of PLACEHOLDERS) {
    const token = `{${key}}`;
    out = out.split(token).join(formatValue(key, ctx[key]));
  }
  return out;
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function statusLabel(s: string): string {
  switch (s) {
    case "draft": return "Draft";
    case "sent": return "Sent";
    case "partially_signed": return "Partially Signed";
    case "fully_signed": return "Fully Signed";
    case "executed": return "Executed";
    case "voided": return "Voided";
    default: return s;
  }
}

export function statusPillClass(s: string): string {
  switch (s) {
    case "draft": return "bg-muted text-muted-foreground border-border";
    case "sent": return "bg-amber-50 text-amber-800 border-amber-200";
    case "partially_signed": return "bg-blue-50 text-blue-800 border-blue-200";
    case "fully_signed": return "bg-sage/15 text-sage-dark border-sage/30";
    case "executed": return "bg-sage/20 text-sage-dark border-[#C9A84C]";
    case "voided": return "bg-red-50 text-red-700 border-red-200";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

export function docTypeLabel(t: string): string {
  switch (t) {
    case "contract": return "Contract";
    case "addendum": return "Addendum";
    case "beo": return "BEO";
    case "invoice_agreement": return "Invoice Agreement";
    default: return t;
  }
}
