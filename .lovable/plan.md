

# Add Editable Track Totals to Admin Financials

## Current behavior
The "Total" at the bottom of each card is computed by summing all payment line amounts. There's no way to set the overall bill/contract amount independently.

## New behavior
Each card header shows an editable dollar input next to the track title (e.g. "Site Fee — $45,000"). The admin types the contract total directly. The footer then shows:
- **Total**: the admin-set value (from `financials` table)
- **Paid**: sum of payment lines marked paid
- **Remaining**: Total minus Paid

This uses the existing `financials` table (`site_fee_total` and `catering_estimate` columns). No database changes needed.

## Changes — `src/pages/admin/tabs/Financials.tsx`

1. **Fetch financials row** on mount alongside payment lines. If no row exists, insert one with zeros.

2. **Pass `trackTotal` and `onTrackTotalChange` props** to each `TrackPanel`. Map `site_fee` → `site_fee_total` and `catering` → `catering_estimate`.

3. **Card header redesign** — Add an inline editable dollar input next to the title:
```
┌──────────────────────────────────────────────┐
│  Site Fee          $[  45,000  ]    [+ Add]  │
├──────────────────────────────────────────────┤
```
The input uses debounced save to update the `financials` row.

4. **Footer "Total" row** uses the admin-set `trackTotal` instead of summing line amounts. "Paid" remains the sum of paid lines. "Remaining" = trackTotal - paid.

### Technical details
- Field mapping: `{ site_fee: "site_fee_total", catering: "catering_estimate" }`
- On change: `supabase.from("financials").update({ [column]: value }).eq("event_id", eventId)`
- If no financials row exists: `supabase.from("financials").upsert({ event_id: eventId, site_fee_total: 0, catering_estimate: 0 })`
- Local state for the financials totals with optimistic updates
- Debounced save (800ms) same pattern as existing line edits

