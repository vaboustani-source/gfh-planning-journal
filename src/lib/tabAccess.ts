// Per-tab access control for event participants
export type TabKey =
  | "overview"
  | "vendors"
  | "ceremony"
  | "timeline"
  | "menus"
  | "lodging"
  | "financials"
  | "messages"
  | "notes"
  | "forms"
  | "documents"
  | "experiences";

export const TAB_LABELS: Record<TabKey, string> = {
  overview: "Overview",
  vendors: "Vendors",
  ceremony: "Ceremony & Music",
  timeline: "Timeline",
  menus: "Menus",
  lodging: "Lodging",
  financials: "Financials",
  messages: "Messages",
  notes: "Notes",
  forms: "Forms",
  documents: "Documents",
  experiences: "Experiences",
};

export const TAB_ORDER: TabKey[] = [
  "overview", "vendors", "ceremony", "timeline", "menus",
  "lodging", "financials", "messages", "notes", "forms", "documents", "experiences",
];

export type TabAccess = Record<TabKey, boolean>;

export const DEFAULT_TAB_ACCESS: TabAccess = {
  overview: true, vendors: true, ceremony: true, timeline: false,
  menus: false, lodging: false, financials: false, messages: true,
  notes: false, forms: true, documents: true, experiences: true,
};

/** Map portal route paths -> tab keys for access checks. */
export const PATH_TO_TAB: Record<string, TabKey> = {
  "/portal/today": "overview",
  "/portal/our-wedding": "overview",
  "/portal/vendors": "vendors",
  "/portal/ceremony": "ceremony",
  "/portal/timeline": "timeline",
  "/portal/menus-meals": "menus",
  "/portal/our-people": "lodging",
  "/portal/financials": "financials",
  "/portal/messages": "messages",
  "/portal/notes": "notes",
  "/portal/forms": "forms",
  "/portal/documents": "documents",
  "/portal/decor": "ceremony",
  "/portal/experiences": "experiences",
  "/portal/planning": "overview",
};

export function tabKeyForPath(pathname: string): TabKey | null {
  // Exact match first
  if (PATH_TO_TAB[pathname]) return PATH_TO_TAB[pathname];
  // Prefix match for nested routes like /portal/our-people/lodging
  const match = Object.keys(PATH_TO_TAB).find(p => pathname.startsWith(p + "/"));
  return match ? PATH_TO_TAB[match] : null;
}

/** Normalize raw db value (jsonb may be null/partial) into a complete TabAccess. */
export function normalizeTabAccess(raw: unknown): TabAccess {
  const out: TabAccess = { ...DEFAULT_TAB_ACCESS };
  if (raw && typeof raw === "object") {
    for (const k of TAB_ORDER) {
      const v = (raw as Record<string, unknown>)[k];
      if (typeof v === "boolean") out[k] = v;
    }
  }
  return out;
}

/** Sensible defaults per role. Couples / partners always get full access (handled upstream). */
export function defaultsForRole(role: string): TabAccess {
  const all = (keys: TabKey[]): TabAccess => {
    const t = { ...DEFAULT_TAB_ACCESS };
    for (const k of TAB_ORDER) t[k] = keys.includes(k);
    return t;
  };

  switch (role) {
    case "photographer":
      return all(["overview", "vendors", "timeline", "documents", "messages"]);
    case "videographer":
      return all(["overview", "vendors", "timeline", "documents", "messages"]);
    case "planner":
    case "designer":
      return all(["overview", "vendors", "ceremony", "timeline", "menus", "lodging", "messages", "notes", "documents"]);
    case "day_of_coordinator":
      return all(["overview", "vendors", "ceremony", "timeline", "menus", "lodging", "messages", "documents"]);
    case "catering_manager":
      return all(["overview", "menus", "timeline", "messages", "documents"]);
    case "parent_p1_1":
    case "parent_p1_2":
    case "parent_p2_1":
    case "parent_p2_2":
      return all(["overview", "lodging", "messages"]);
    default:
      return { ...DEFAULT_TAB_ACCESS };
  }
}

/** Roles that always get full access regardless of tab_access values. */
export const FULL_ACCESS_ROLES = new Set([
  "partner_1", "partner_2", "couple", "admin", "coordinator",
]);

export function hasFullAccess(role: string | null | undefined, accessTier: number): boolean {
  if (!role) return false;
  if (FULL_ACCESS_ROLES.has(role)) return true;
  // Tier 4 = Admin Light → full access except financials handled by tab toggle
  return accessTier === 4;
}
