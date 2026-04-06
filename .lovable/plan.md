

# Separate Wedding Timeline into Its Own Portal Tab

## What changes

The wedding timeline (currently embedded at the bottom of "Our Weekend") becomes its own dedicated portal page at `/portal/timeline`. The timeline blocks get redesigned as cards with a side-by-side day layout on desktop.

## Changes

### 1. New file: `src/pages/portal/Timeline.tsx`

- Extract and redesign the `WeekendTimeline` component from `OurWeekend.tsx`
- Each day becomes a card (`bg-card border border-border rounded-xl shadow-soft`) with the day label as a card header
- Days use `lg:grid-cols-2 gap-6` on desktop (side by side), single column on mobile
- Inside each day card, timeline blocks become individual rows with a time badge (sage background chip) and the event description
- Highlighted rows get a `border-l-2 border-gold` accent
- Keep the "being finalized" placeholder when unpublished
- Include `PortalStickyFooter` navigating to the next section (Vendors)

### 2. Update `src/pages/portal/OurWeekend.tsx`

- Remove the `WeekendTimeline` component and its related types/functions (`migrateForPortal`, `TimelineBlock`, etc.)
- Remove the `{eventId && <WeekendTimeline eventId={eventId} />}` render
- Update the sticky footer to navigate to `/portal/timeline` instead of `/portal/planning`

### 3. Update `src/pages/portal/PortalLayout.tsx`

- Add nav item: `{ to: "/portal/timeline", label: "Timeline", icon: Clock, tiers: [1, 3, 4] }` after "Our Wedding"

### 4. Update `src/App.tsx`

- Import `Timeline` from `./pages/portal/Timeline`
- Add `<Route path="timeline" element={<Timeline />} />` under both `/portal` and `/admin/preview/:eventId` route groups

### 5. Update navigation flow

- `OurWeekend` footer → `/portal/timeline`
- `Timeline` footer → `/portal/planning`
- `Planning` footer stays → `/portal/vendors`

### Technical notes

- The `migrateForPortal` function moves to `Timeline.tsx` (handles both legacy 3-key format and new `days[]` format from `working_timeline`)
- Desktop grid: `grid grid-cols-1 lg:grid-cols-2 gap-6` — if there's an odd number of days, the last card spans full width naturally
- Each time block inside a card: horizontal layout with a fixed-width time chip and description text

