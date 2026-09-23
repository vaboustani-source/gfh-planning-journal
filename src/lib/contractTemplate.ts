// Contract content helpers: placeholder substitution + content hashing.

/** Values the hub fills automatically from the wedding (see loadContractContext). */
export interface ContractContext {
  couple_names?: string | null;
  wedding_date?: string | null;
  venue_name?: string | null;
  guest_count?: number | string | null;
  package_tier?: string | null;
  total_amount?: number | string | null;
  client1_name?: string | null;
  client2_name?: string | null;
  client1_email?: string | null;
  client2_email?: string | null;
  check_in_date?: string | null;
  check_out_date?: string | null;
  site_fee?: number | string | null;
  /** Amendments: the contract being amended. */
  original_contract_title?: string | null;
  original_signed_date?: string | null;
}

/** Per-contract values typed in by staff for any other {blank} in the text. */
export type ContractFields = Record<string, string>;

const AUTO_KEYS: (keyof ContractContext)[] = [
  "couple_names", "wedding_date", "venue_name", "guest_count", "package_tier", "total_amount",
  "client1_name", "client2_name", "client1_email", "client2_email",
  "check_in_date", "check_out_date", "site_fee",
];

export const PLACEHOLDER_TOKENS = AUTO_KEYS.map((k) => `{${k}}`);

const DATE_KEYS = new Set(["wedding_date", "check_in_date", "check_out_date"]);
const MONEY_KEYS = new Set(["total_amount", "site_fee"]);

/** Friendlier labels for blanks staff fill in; anything else is derived from the token. */
const FIELD_LABELS: Record<string, string> = {
  client1_phone: "Client 1 phone",
  client2_phone: "Client 2 phone",
  client_address: "Client mailing address",
  check_in_time: "Check-in time",
  check_out_time: "Check-out time",
  catering_minimum: "Catering minimum (billed to client)",
  lodging_minimum: "Lodging room minimum (billed to guests)",
  required_suites: "Required guesthouse suites (e.g. FIFTY (50))",
  amendment_changes: "The changes (numbered, in contract language)",
};

export const MULTILINE_FIELDS = new Set(["amendment_changes", "client_address"]);

export function fieldLabel(token: string): string {
  if (FIELD_LABELS[token]) return FIELD_LABELS[token];
  const words = token.replace(/_/g, " ").replace(/(\d+)/g, " $1 ").replace(/\s+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function formatValue(key: string, value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (DATE_KEYS.has(key) && typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(value + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });
  }
  if (MONEY_KEYS.has(key) && (typeof value === "number" || typeof value === "string")) {
    const n = Number(value);
    if (!Number.isNaN(n)) return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
  }
  if (key === "package_tier" && typeof value === "string") {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
  return String(value);
}

const TOKEN_RE = /\{([a-z][a-z0-9_]*)\}/g;

/** Every distinct {blank} in the text, in order of first appearance. */
export function templateTokens(content: string): string[] {
  const seen: string[] = [];
  for (const m of (content ?? "").matchAll(TOKEN_RE)) if (!seen.includes(m[1])) seen.push(m[1]);
  return seen;
}

/** Blanks the hub fills itself (and has a value for right now). */
export function isAutoFilled(token: string, ctx: ContractContext): boolean {
  return formatValue(token, (ctx as Record<string, unknown>)[token]) !== null;
}

/** Blanks still empty after auto-fill and staff values. Sending is blocked while any remain. */
export function missingTokens(content: string, ctx: ContractContext, fields: ContractFields = {}): string[] {
  return templateTokens(content).filter((t) => !isAutoFilled(t, ctx) && !(fields[t] ?? "").trim());
}

export function renderContract(content: string, ctx: ContractContext, fields: ContractFields = {}): string {
  return (content ?? "").replace(TOKEN_RE, (whole, key: string) => {
    const auto = formatValue(key, (ctx as Record<string, unknown>)[key]);
    if (auto !== null) return auto;
    const typed = (fields[key] ?? "").trim();
    return typed || whole;
  });
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
    case "addendum": return "Amendment";
    case "beo": return "BEO";
    case "invoice_agreement": return "Invoice Agreement";
    default: return t;
  }
}
