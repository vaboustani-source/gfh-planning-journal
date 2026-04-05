

# Add Due Dates to Admin Internal Checklist & Couple My Checklist

## What changes

Both the admin Internal tab and the couple-facing My Checklist get an optional due date picker on each item. No database changes needed — the `paced_send_date` column already exists on `checklist_items`.

## Changes

### 1. Admin Checklist — Internal tab (`src/pages/admin/tabs/Checklist.tsx`)

**Add item form**: Add an optional date input next to the "New task…" text field so the admin can set a due date when creating items. Save to `paced_send_date`.

**Expanded item detail**: When an item is expanded (chevron click), show a date picker below the notes textarea. On change, autosave `paced_send_date` to Supabase. This applies to all three tabs (timeline, couple, internal) but is most critical for internal.

**Due date display**: The due date line already renders (`item.paced_send_date && ...`) but only when present. No change needed there.

### 2. Couple Portal — My Checklist (`src/pages/portal/Planning.tsx`)

**Add task form**: Add an optional "Due date" date input inside the inline add form (below category select). Save to `paced_send_date`.

**Item row**: Show the due date below the label when present, with overdue styling (text-amber-600) if the date is in the past and item is incomplete.

**Edit mode**: When the pencil icon is clicked and the notes textarea appears, also show a date input to edit the due date. On blur/change, save to Supabase.

### Technical details

- Use `<input type="date">` for simplicity — matches the existing admin style (no need for a full calendar popover for a single optional field).
- Save handler: `supabase.from("checklist_items").update({ paced_send_date: value || null }).eq("id", itemId)`
- Admin add item: extend the `addItem` function to accept an optional date parameter.
- Couple add item: extend the `handleSave` function to include `paced_send_date`.
- Both sides update local state optimistically.

### Files modified
- `src/pages/admin/tabs/Checklist.tsx`
- `src/pages/portal/Planning.tsx`

