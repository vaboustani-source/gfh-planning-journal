// ============================================================
// UNIFIED PERMISSION MATRIX — single source of truth.
// Mirror of the Postgres `user_access_level()` function.
// ============================================================

export type Role =
  | "admin"
  | "event_director"
  | "sales_manager"
  | "marketing"
  | "planner"
  | "couple"
  | "vendor";

export type Access = "full" | "view" | "none";

export type Section =
  | "event_planning"
  | "vendors_experiences_decor"
  | "our_people"
  | "financials"
  | "sales_roster"
  | "marketing_roster"
  | "preferred_vendors_catalog"
  | "other_catalogs"
  | "settings"
  | "tasting_notes"
  | "gmail_inbox";

/** Lowest-privilege fallback for null/unknown role. */
export const DEFAULT_ROLE: Role = "couple";

const M: Record<Section, Record<Role, Access>> = {
  event_planning: {
    admin: "full", event_director: "full", sales_manager: "view",
    marketing: "none", planner: "full", couple: "full", vendor: "view",
  },
  vendors_experiences_decor: {
    admin: "full", event_director: "full", sales_manager: "view",
    marketing: "view", planner: "full", couple: "full", vendor: "view",
  },
  our_people: {
    admin: "full", event_director: "full", sales_manager: "view",
    marketing: "none", planner: "full", couple: "full", vendor: "view",
  },
  financials: {
    admin: "full", event_director: "full", sales_manager: "view",
    marketing: "none", planner: "full", couple: "view", vendor: "none",
  },
  sales_roster: {
    admin: "full", event_director: "full", sales_manager: "full",
    marketing: "none", planner: "none", couple: "none", vendor: "none",
  },
  marketing_roster: {
    admin: "full", event_director: "full", sales_manager: "none",
    marketing: "full", planner: "view", couple: "none", vendor: "none",
  },
  preferred_vendors_catalog: {
    admin: "full", event_director: "view", sales_manager: "none",
    marketing: "view", planner: "view", couple: "view", vendor: "none",
  },
  other_catalogs: {
    admin: "full", event_director: "full", sales_manager: "none",
    marketing: "view", planner: "view", couple: "none", vendor: "none",
  },
  settings: {
    admin: "full", event_director: "full", sales_manager: "none",
    marketing: "none", planner: "none", couple: "none", vendor: "none",
  },
  tasting_notes: {
    admin: "full", event_director: "full", sales_manager: "none",
    marketing: "none", planner: "none", couple: "none", vendor: "none",
  },
  gmail_inbox: {
    admin: "full", event_director: "full", sales_manager: "none",
    marketing: "none", planner: "none", couple: "none", vendor: "none",
  },
};

export const PERMISSIONS = M;

/** Normalise legacy/unknown role strings to a supported Role. */
export function normaliseRole(role: string | null | undefined): Role {
  if (!role) return DEFAULT_ROLE;
  if (role === "ceo_owner") return "event_director"; // back-compat
  if ((["admin","event_director","sales_manager","marketing","planner","couple","vendor"] as const).includes(role as Role)) {
    return role as Role;
  }
  return DEFAULT_ROLE;
}

export function accessLevel(role: string | null | undefined, section: Section): Access {
  const r = normaliseRole(role);
  return M[section]?.[r] ?? "none";
}

export function canView(role: string | null | undefined, section: Section): boolean {
  const a = accessLevel(role, section);
  return a === "full" || a === "view";
}

export function canEdit(role: string | null | undefined, section: Section): boolean {
  return accessLevel(role, section) === "full";
}

/** Best landing page for a role when they're blocked from the requested page. */
export function defaultLandingFor(role: string | null | undefined): string {
  const r = normaliseRole(role);
  if (r === "couple") return "/portal/today";
  if (r === "vendor") return "/portal/today";
  return "/admin";
}
