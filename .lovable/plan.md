

# Fix Admin Checklist Tab: Reorder, Notes, and EventId Fallback

## Summary

Reorder the admin checklist tabs (Planning Timeline first, Couple Checklist second, Internal third), add expandable per-item notes with autosave to all tabs, and fix the couple portal's eventId resolution so checklist data actually loads.

## Changes

### 1. Admin Checklist Tab (`src/pages/admin/tabs/Checklist.tsx`)

**Tab reorder:** Change the tab array from `["couple", "timeline", "internal"]` to `["timeline", "couple", "internal"]`. Set default `activeTab` to `"timeline"`.

**Expandable notes per item:** Add an `expandedItems` state (`Set<string>`) tracking which item rows are expanded. Each item row gets a chevron button on the right. When expanded, show a `<textarea>` below the label for `notes`. Autosave notes on blur via `debouncedSave`. Show a small `StickyNote` icon next to items that have existing notes.

**Add item with notes:** The existing "Add item" flow already works. After adding, the new item can be expanded to add notes.

### 2. Couple Portal Planning (`src/pages/portal/Planning.tsx`)

**Notes per item:** Same expandable notes pattern. Each checklist item gets an expand chevron. When expanded, shows a textarea for the couple to add/edit notes. Autosave on blur.

**EventId fallback:** At the top of the component, if `eventId` from `usePortalData()` is null, fall back to `useParams<{ eventId: string }>()` to read it from the URL. This fixes preview mode and edge cases where the context hasn't resolved yet.

### 3. Today Page (`src/pages/portal/Today.tsx`)

**Same eventId fallback:** Import `useParams`, and if `usePortalData()` returns no eventId/nextTask/checklistProgress but URL has an eventId param, fetch checklist data directly as a fallback.

### 4. Files Modified

| File | Change |
|------|--------|
| `src/pages/admin/tabs/Checklist.tsx` | Reorder tabs, add per-item expandable notes with autosave |
| `src/pages/portal/Planning.tsx` | Add per-item notes, eventId fallback from useParams |
| `src/pages/portal/Today.tsx` | EventId fallback for next-step card and progress bar |

### Technical Details

- Notes autosave uses the existing `useAutosaveStatus` hook's `debouncedSave` (admin) or direct `supabase.update` on blur (couple portal)
- The `notes` column already exists on `checklist_items` — no migration needed
- The expandable note row uses a simple conditional render below the item label, not a modal
- The note icon is a small `StickyNote` (lucide) shown inline when `item.notes` is non-empty

