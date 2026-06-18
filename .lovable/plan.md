# Menu Selections — Findings Report (read-only)

## 1. Where the Hub shows menu selections

Two surfaces, both rendered by the same component `src/components/menu/MenuSelectionsDisplay.tsx`:

- **Admin / planner view** — route: `/admin/events/:eventId` → Menus & Bar tab → "Menu Selections" sub-tab.
  - File: `src/pages/admin/tabs/MenusBarTab.tsx` (sub-tab id `selections`) → `src/pages/admin/tabs/MenuSelectionsSubTab.tsx` → embeds `<MenuSelectionsDisplay eventId={eventId} />`.
  - Who sees it: admin-tier roles (Admin, Event Director, etc. — anyone routed through `EventDetail`).
- **Couple portal view** — route: `/portal/menus` (`src/pages/portal/MenusMeals.tsx`), in the "Your menu selections" panel above the section tabs. Also embeds `<MenuSelectionsDisplay eventId={eventId} />`.
  - Who sees it: the couple for that event, plus admins using "View as Couple" preview.

The admin sub-tab additionally reads/writes `menu_approvals` (status, final price, admin notes) and posts a Catering line to Financials on approval. The couple panel reads `menu_approvals.status` only to show a banner.

## 2. How the view READS the selections

`MenuSelectionsDisplay` queries the **`couple_selections`** table — NOT `builder_selections`, NOT `menu_approvals.selections`:

```ts
supabase
  .from("couple_selections")
  .select(`
    id, notes, menu_item_id, section_id,
    menu_items:menu_item_id ( name, sort_order ),
    menu_sections:section_id ( label, section_title, sort_order )
  `)
  .eq("event_id", eventId);
```

- **Keyed by**: `event_id` (uuid) on `couple_selections`.
- **Shape expected**: one row per picked menu item — columns `event_id`, `couple_id`, `menu_item_id` (FK → `menu_items.id`), `section_id` (TEXT FK-ish → `menu_sections.id`), `group_label`, `notes`.
- **Render**: groups rows by `section_id`, sorts sections by `menu_sections.sort_order`, sorts items within a section by `menu_items.sort_order`, renders `menu_items.name` with optional italic `notes` underneath. No JSON keys are read — it is fully relational against the curated `menu_items` / `menu_sections` catalog.

There is **no code anywhere in this app that reads `builder_selections.selections` JSON** (verified via ripgrep — only `src/integrations/supabase/types.ts` references `builder_selections`, plus a DB trigger).

## 3. Database state

### builder_selections
```
id                                    couple_id                             event_id  status        updated_at
6c4c087d-3b3f-4e57-a21e-2517c8114a89  88ee19ef-8886-4c15-a6c1-7ea3f0fc3806  NULL      in_progress   2026-06-18 18:41
```
Only one row total. `event_id` is **NULL**. `selections` JSON top-level keys for that row are just `{ "test": true, "picked": ["a","b"] }` — i.e. a smoke-test payload, not the real builder schema (`rehearsalDinner`, `welcomeHour`, …) you described.

### couples ↔ event link
`couples` has no `event_id` column. Couple→event resolution goes through `event_users.user_id = couples.user_id`. For the only `builder_selections` row:

```
couples.id  = 88ee19ef…  (Avery & Jordan)
couples.user_id = 9292dd2f-5181-437f-9ae0-8a65ff1cf5fd
event_users rows for that user_id: 0
```
So this couple is not linked to any event in `event_users`, and `builder_selections.event_id` is NULL — there is no path today to resolve which event this row belongs to.

### menu_approvals
`SELECT … FROM menu_approvals` → **0 rows**. The trigger `builder_selections_to_menu_approval` (function `sync_builder_submission_to_menu_approval`) fires on insert/update of `status` or `event_id`, but only when `NEW.status = 'submitted' AND NEW.event_id IS NOT NULL`. The current row is `status='in_progress'` with `event_id=NULL`, so nothing was written. `couple_selections` is also empty for this couple/event.

### How they relate
- `builder_selections` is the builder app's working draft (one JSON blob per couple, optional event_id).
- On submit, the trigger only flips/creates a `menu_approvals` row (status + submitted_at). **It does not unpack `selections` JSON into `couple_selections`.**
- `couple_selections` is the table the Hub renders from, and nothing currently writes to it from the builder.

## 4. Bottom line

**No.** If a couple submits selections in the external builder today, the Planning Hub menu tab will display "No menu selections submitted yet." Two independent reasons:

1. **Wrong table.** The Hub renders from `couple_selections` (normalized rows referencing `menu_items` / `menu_sections`). The builder writes a JSON blob to `builder_selections.selections`. Nothing translates one to the other. The submit trigger only touches `menu_approvals` status.
2. **No event linkage.** Even `menu_approvals` and any future projection need `event_id`. The builder is writing `event_id = NULL`, and the couple's `user_id` has no row in `event_users`, so there is no way to resolve which event the selections belong to.

### What it would take to make it work
At least one of the following — pick a direction before any code changes:

- **A. Project builder JSON into `couple_selections` on submit.** Extend `sync_builder_submission_to_menu_approval` (or add a new trigger / edge function) to iterate the JSON keys (`rehearsalDinner`, `welcomeHour`, `cocktailHour`, `reception`, `mealInclusions`, `desserts`, `barPackage`, `stepNotes`) and insert matching rows into `couple_selections` (and probably `bar_selections` for `barPackage`). Requires a mapping from builder item identifiers → `menu_items.id` / `menu_sections.id`, which doesn't exist yet.
- **B. Teach the Hub to read `builder_selections.selections` directly.** Change `MenuSelectionsDisplay` (and the portal panel) to fetch by `event_id` from `builder_selections` and render the JSON shape (`rehearsalDinner`, `welcomeHour`, …) instead of/in addition to the relational data.
- **C. Fix the linkage regardless of approach.** Builder must populate `builder_selections.event_id`, and the couple's auth user must have an `event_users` row for that event (today: zero). Without this, neither A nor B can find the right event.

Suggested fastest minimum to verify end-to-end: ensure builder writes `event_id`, then implement (B) as a read-only JSON fallback panel in the Hub while (A) is built out properly for catalog/pricing fidelity.

No files were changed.