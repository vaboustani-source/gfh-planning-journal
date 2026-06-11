# Version History with Rollback — Investigation & Proposal

## 1. Existing change-tracking tables

### `public.audit_log` (primary, suitable for rollback)
Columns: `id, event_id, table_name, record_id, action, changed_fields[], old_values jsonb, new_values jsonb, user_id, user_email, user_role, created_at`.

This is a full before/after audit:
- `table_name` + `record_id` identify the changed row
- `old_values` and `new_values` are full row snapshots as JSONB (not just diffs)
- `changed_fields[]` lists which keys differ on UPDATE
- `action` is INSERT / UPDATE / DELETE
- User attribution (id, email, role) and `event_id` scoping included

Written by the Postgres trigger function `public.log_audit_event()`, which builds the row from `to_jsonb(OLD)` / `to_jsonb(NEW)` and skips no-op updates.

### Other log/history tables (not general-purpose, not before/after)
- `contract_audit_log` — contract lifecycle events (action + metadata), no row snapshots.
- `couple_history` — couple actions (action + details jsonb), not field-level.
- `role_change_log`, `lb_sync_log`, `lb_activity_log`, `scheduled_email_log`, `notification_log` — domain event logs, not row snapshots.

None of these support rollback. Only `audit_log` does.

## 2. Coverage

Audit triggers (`log_audit_event`) are attached to **9 tables only**:

```
bar_selections, ceremony_details, checklist_items, dietary_restrictions,
events, financials, lodging_assignments, meal_events, vendors
```

The Planning Hub has ~80 public tables. Major areas NOT audited today include:
- People & guests: `guests`, `guest_invitations`, `guest_dietary_entries`, `couples`, `couple_notes`
- Menus: `menu_packages`, `menu_sections`, `menu_items`, `menu_accordions`, `menu_finalization`
- Decor: `decor_selections`, `decor_catalog`
- Experiences: `experience_requests`, `experience_catalog`
- Timeline & milestones: `working_timeline`, `milestones`
- Forms: `forms`, `form_assignments`, `form_responses`
- Financials detail: `financial_line_items`, `budget_items`, `payment_schedule`, `event_budgets`
- Seating: `seating_tables`, `seating_assignments`, `seating_config`
- Docs/contracts: `documents`, `contracts`, `contract_signatures`
- Messaging, RSVP, lodging rooms, preferred vendors, basics_cards, etc.

Live data confirms this is mostly idle: only ~78 rows total across `lodging_assignments`, `vendors`, `events`, `checklist_items`. Coverage today is roughly **~10% of mutable user-facing tables**.

## 3. Where logging lives

- **Database triggers** for general row history (the 9 tables above via `log_audit_event`). No application code writes to `audit_log`.
- **Application code** writes the domain logs: `sign-contract` and `countersign-contract` edge functions write `contract_audit_log`; `ContractsManager.tsx` / `SignedCertificate.tsx` read it.
- No application-side double-logging for `audit_log` — it is purely trigger-driven, which is the right pattern for rollback.

## 4. Existing UI

- `src/pages/admin/tabs/ActivityTab.tsx` (admin event view): a read-only feed of `audit_log` for the current event. Shows INSERT/UPDATE/DELETE, table label, changed field labels, user, timestamp, and expands to a per-field old → new diff. Filters by table and action. Limited to latest 500.
- `src/lib/auditLabels.ts` maps raw table/column names to friendly labels and value formatters used by ActivityTab.
- `ContractsManager` / `SignedCertificate` render `contract_audit_log` as a contract-specific timeline.
- No rollback / restore UI anywhere.

## 5. Proposed approach for Version History + Rollback

### What we already have for free
Because `audit_log.new_values` and `old_values` are **full row snapshots**, any audited row can be reconstructed at any point in time without replaying diffs. The trigger also skips no-op updates, so each audit row is a meaningful version.

### Minimum viable rollback (audited tables only)
1. **Per-record version history view** — for any row in an audited table, query `audit_log WHERE table_name=? AND record_id=? ORDER BY created_at DESC`. Each row is a version; render side-by-side or field-by-field diffs (we already format these in ActivityTab).
2. **Restore action** — an admin-only edge function `restore-record(table_name, record_id, audit_id)` that:
   - Loads the target audit row
   - For UPDATE/INSERT → `UPDATE <table> SET <columns from new_values or old_values> WHERE id = record_id`
   - For DELETE → re-`INSERT` from `old_values`
   - Runs as service role so RLS doesn't block it, but gates on `is_admin(auth.uid())`
   - The restore itself fires the audit trigger again, so the rollback is itself a new audit entry — natural forward/back history.
3. **UI** — add a "History" button on each audited record (vendor card, checklist item, ceremony details, etc.) opening a drawer that lists versions with a "Restore this version" CTA and a confirm dialog. Reuse `ActivityTab`'s diff renderer.

### Gaps and risks to address before shipping
- **Coverage** — most user-facing tables are NOT audited. Before promising "version history" broadly, attach `log_audit_event` triggers to the high-value tables listed in §2. This is a one-line `CREATE TRIGGER` per table; no app changes needed.
- **Related-record integrity** — many "records" are actually parent + children (e.g. ceremony_details + meal_events; menu_packages + sections + items; guests + dietary entries; working_timeline jsonb blob; financials + line_items). A naive single-row restore can leave orphans or stale joins. Options:
  - Scope rollback to "leaf" tables only (vendors, checklist items, ceremony_details, individual line items). Document this limit.
  - For composite areas, group an audit "snapshot" by `(event_id, created_at window, user_id)` and offer "restore this save" across multiple tables in one transaction.
- **Foreign keys & deletes** — restoring a DELETE may fail if children were cascade-deleted or if FK targets no longer exist. The restore function must run in a transaction and surface clear errors.
- **Schema drift** — `old_values`/`new_values` are snapshots of columns that existed at write time. If columns were added/removed since, the restore must filter to columns that currently exist in the table (introspect `information_schema.columns`).
- **Generated / sensitive columns** — `created_at`, computed columns, and `id` must be excluded from the UPDATE SET list; `updated_at` should be set to `now()`.
- **Retention & size** — `old_values` + `new_values` per change is heavy. Add a retention policy (e.g. keep last N versions per record, or 12 months) and an index on `(table_name, record_id, created_at DESC)`.
- **Permissions** — restore is admin-only; couples should see history (read-only) for their own event's records but never restore.
- **Non-audited writes today** — current `audit_log` rows only exist for the 9 audited tables. Until coverage is expanded, "version history" is misleading elsewhere. Recommend phase 1 = expand triggers, phase 2 = build restore.

### Phased rollout
1. **Phase 1 (schema-only):** add `log_audit_event` triggers to the priority unaudited tables; add the `(table_name, record_id, created_at DESC)` index; add a retention job.
2. **Phase 2 (read-only UI):** per-record History drawer reusing ActivityTab's diff renderer, available on vendor / checklist / ceremony / financials / lodging / menu / decor records.
3. **Phase 3 (restore):** `restore-record` edge function + admin-only "Restore this version" button, leaf tables first.
4. **Phase 4 (composite restore):** grouped snapshots for parent+children areas (ceremony + meal_events, menu package tree, working_timeline jsonb), with a transactional multi-table restore.

### Decisions needed from you before building
1. Is admin-only restore acceptable, or should couples also be able to roll back their own edits?
2. Which areas are highest priority for both audit coverage and rollback (guests, menus, decor, working_timeline, financial_line_items, etc.)?
3. Retention policy — keep everything, or cap (e.g. 90 days / last 50 versions per record)?
4. For composite areas, do you want true multi-row "restore this save" or are leaf-row restores enough for v1?
