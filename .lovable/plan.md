# Unified Permission System

One matrix, one file, enforced in both the UI and the database. No visual change — only what each role sees/edits.

## 1. The matrix (single source of truth)

New file: `src/lib/permissions.ts`

```ts
export type Role = 'admin' | 'event_director' | 'sales_manager'
                 | 'marketing' | 'planner' | 'couple' | 'vendor';
export type Access = 'full' | 'view' | 'none';
export type Section =
  | 'event_planning' | 'vendors_experiences_decor' | 'our_people'
  | 'financials' | 'sales_roster' | 'marketing_roster'
  | 'preferred_vendors_catalog' | 'other_catalogs' | 'settings'
  | 'tasting_notes' | 'gmail_inbox';

export const PERMISSIONS: Record<Section, Record<Role, Access>> = { /* matrix exactly as specified */ };

export const DEFAULT_ROLE: Role = 'couple'; // graceful fallback for null/unknown
export function accessLevel(role: Role | null | undefined, section: Section): Access;
export function canView(role, section): boolean;
export function canEdit(role, section): boolean;
```

Scoping notes baked in as comments + enforced where they apply:
- `couple` is always limited to their own event (already enforced by `event_users` joins; permission layer just gates the section).
- `vendor` access for a section is `min(matrix, tab_access toggle)` — the per-person tab toggle is the final gate.
- `sales_manager` gets view-everywhere for planning context; `full` only on `sales_roster`.

## 2. Client helpers

New file: `src/hooks/usePermission.ts`

```ts
const { profile } = useAuth();
const access = usePermission('financials');      // 'full' | 'view' | 'none'
const { canView, canEdit } = usePermissions();   // bulk helpers
```

Also export a tiny `<RequireAccess section="..." mode="view|edit">` guard component used by pages.

## 3. Database equivalent (RLS)

Migration adds:

```sql
create type public.app_section as enum (...);          -- same sections
create type public.access_level as enum ('full','view','none');

create or replace function public.user_access_level(_user_id uuid, _section app_section)
returns access_level language sql stable security definer set search_path = public as $$
  -- big CASE matrix matching permissions.ts exactly
$$;

create or replace function public.can_view_section(_user_id uuid, _section app_section) returns boolean ...;
create or replace function public.can_edit_section(_user_id uuid, _section app_section) returns boolean ...;
```

RLS rewrites (keeping couple/vendor event-scoping intact):
- `sales_details` → drop `is_sales_viewer`, use `can_view_section(auth.uid(),'sales_roster')` for SELECT, `can_edit_section(...,'sales_roster')` for write.
- `financials`, `financial_line_items`, `payment_schedule` → admin/event_director/planner full; sales_manager + couple (own event) read-only.
- `preferred_vendors` (catalog) → SELECT for any role whose matrix entry ≠ 'none'; INSERT/UPDATE/DELETE admin-only. Per-event `vendors` table stays editable by event members with planning edit rights.
- Planning tables (`milestones`, `checklist_items`, `ceremony_details`, `decor_selections`, `experience_requests`, `menus_*`, `bar_selections`, `dietary_restrictions`, `guests`, `lodging_assignments`, `seating_*`, `couple_notes`, `messages`, `rsvp_config`, `forms`, `documents`, `working_timeline`, `contracts`) → admin/event_director/planner full; sales_manager + marketing (where allowed) view; couple full on own; vendor gated by `event_users.tab_access` (unchanged).
- `gfh_resources`, `decor_catalog`, `experience_catalog`, `layout_library` → admin full; others view per matrix; non-listed roles blocked.
- `gmail_connections`, `project_emails`, `filed_threads`, `email_sender_map` → admin + event_director only (tasting_notes + gmail_inbox sections both gate to these two roles per spec).

Keep `is_admin`, `is_event_member` (used by event-scoping). Drop `is_sales_viewer`, `is_marketing_viewer` after their callers migrate — or alias them to `can_view_section(...)` for one release; this plan removes them outright and updates the two SQL files that reference them.

## 4. UI refactor

### Nav (`src/pages/PortalLayout.tsx`, `src/pages/AdminDashboard.tsx` header, sidebar)
- Each nav entry declares `section: Section`. Filter with `canView(role, section)`.
- Admin dashboard tabs (Overview, Milestones, Vendors, Financials, etc.) get the same gate.
- Sales Roster icon → `canView('sales_roster')`. Marketing Roster icon → `canView('marketing_roster')`. Settings/Preferred Vendors catalog/etc. follow suit.

### Route guards (`src/components/ProtectedRoute.tsx`)
- New prop `section?: Section`. When set, checks `canView`; if `none`, toast "You don't have access to this section" and redirect to the role's default landing (admin → `/admin`, couple → `/portal/today`, others → `/admin`).
- All `<Route>` definitions in `src/App.tsx` updated to pass `section`. The `requiredRole="admin"` shorthand is replaced with `section`.

### View-only mode
- Each editable page reads `const access = usePermission(section)`. When `'view'`:
  - Inputs render as plain text / `readOnly` + `disabled`.
  - Add/Edit/Delete/Save buttons hidden.
  - Autosave hooks short-circuit (already no-op if nothing changes; we add an explicit guard).
- Targeted: `Financials.tsx` (portal — couple view-only already; admin Financials becomes view for sales_manager), all admin tabs under `src/pages/admin/tabs/*`, portal detail pages, vendor/experience/decor catalogs.

### Preferred Vendors split
- `src/pages/admin/PreferredVendors.tsx` (catalog mgmt) → `section="preferred_vendors_catalog"`, edit only when `canEdit` (admin only). For others with view, render read-only catalog browser.
- `BrowsePreferredDrawer` + "Add to Event" remain available to anyone with edit access on `vendors_experiences_decor` (event_director keeps this).

### Replace old checks
- `MarketingRoster.tsx` and `SalesRoster.tsx` — drop in-page `ALLOWED_ROLES` arrays; rely on route guard + `canView`.
- `SalesDetailsCard.tsx` — gate edit on `canEdit('sales_roster')`.
- `MenusBarTab.tsx` — replace its `role === 'admin'` check with `canEdit('event_planning')`.
- Edge functions (`process-message-queue`, `enqueue-message-notification`, `_shared/appUrls.ts`) — left untouched where they only read `role` for routing logic (no permission decision), otherwise switched to `can_view_section` calls.

## 5. Graceful degradation

- Null/unknown role → treated as `couple` for matrix lookups but still requires `event_users` membership for any event-scoped data, so they effectively see nothing until invited.
- Matrix lookup never throws; missing section → `'none'`.

## 6. Files touched (high level)

- New: `src/lib/permissions.ts`, `src/hooks/usePermission.ts`, `src/components/RequireAccess.tsx`, one migration.
- Edited: `src/App.tsx`, `src/components/ProtectedRoute.tsx`, `src/pages/AdminDashboard.tsx`, `src/pages/portal/PortalLayout.tsx`, `src/pages/admin/EventDetail.tsx` (tab filter), `src/pages/admin/MarketingRoster.tsx`, `src/pages/admin/SalesRoster.tsx`, `src/pages/admin/PreferredVendors.tsx`, `src/components/admin/SalesDetailsCard.tsx`, `src/components/admin/BrowsePreferredDrawer.tsx`, `src/pages/admin/tabs/MenusBarTab.tsx` (+ other admin tabs that need view-mode for sales_manager), `src/pages/portal/Financials.tsx` (already read-only for couple — wired through new hook).
- Migration: section enum + helpers + RLS rewrites on the tables listed above, drop `is_sales_viewer` / `is_marketing_viewer`.

## 7. Out of scope

- No visual redesign. Same sage + cream, same layouts.
- No new pages or features.
- Admin can still do everything; behavior for admin/couple is unchanged end-to-end.

## Verification

- Build passes.
- Manual smoke (preview): sign in as each seeded role, confirm nav contents and edit/view state on financials, sales roster, marketing roster, preferred vendors.
- DB: spot-check `select public.user_access_level('<uuid>','financials');` per role.
