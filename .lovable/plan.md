

# Full Project Audit — Gilbertsville Farmhouse Wedding Planning Platform

---

## 1. Every Page and Component That Currently Exists

### Pages

| Page | File | Purpose |
|------|------|---------|
| Login | `src/pages/Login.tsx` | Email/password auth |
| Set Password | `src/pages/SetPassword.tsx` | First-time password setup for invited users |
| Admin Dashboard | `src/pages/AdminDashboard.tsx` | List all events, attention items, create new events |
| Admin Event Detail | `src/pages/admin/EventDetail.tsx` | 12-tab event management (Overview through Documents) |
| Admin Settings | `src/pages/admin/AdminSettings.tsx` | Admin account settings |
| Admin Preview Portal | `src/pages/admin/PreviewPortalLayout.tsx` | "View as Couple" mode with amber banner |
| Couple Portal Layout | `src/pages/portal/PortalLayout.tsx` | Sidebar + bottom nav shell for couple pages |
| Today | `src/pages/portal/Today.tsx` | Countdown, next task, progress bar, message CTA |
| Our Wedding | `src/pages/portal/OurWeekend.tsx` | Event details card + milestone timeline |
| Planning | `src/pages/portal/Planning.tsx` | Couple checklist with toggle-to-complete |
| Vendors | `src/pages/portal/Vendors.tsx` | Vendor cards via VendorList component |
| Ceremony & Music | `src/pages/portal/Ceremony.tsx` | Wrapper for CeremonyMusic component |
| Menus & Meals | `src/pages/portal/MenusMeals.tsx` | 4-tab section: Meals, Headcounts, Dietary, Bar |
| Our People | `src/pages/portal/OurPeople.tsx` | 2-tab section: Lodging, Headcounts |
| Financials | `src/pages/portal/Financials.tsx` | Site fee + catering totals, payment schedule |
| Messages | `src/pages/portal/Messages.tsx` | Real-time chat with iMessage-style timestamps |
| Notes | `src/pages/portal/Notes.tsx` | Private notes with share-with-Brandon toggle |
| Weekend Details | `src/pages/portal/WeekendDetails.tsx` | Exists but not wired into nav |
| Not Found | `src/pages/NotFound.tsx` | 404 page |

### Portal Detail/Sub-Components

- `src/pages/portal/details/BarSelections.tsx` — Bar package + drink selections
- `src/pages/portal/details/CeremonyMusic.tsx` — Officiant, processional, DJ, speeches
- `src/pages/portal/details/DecorSelections.tsx` — Decor items by event section
- `src/pages/portal/details/DietaryRestrictions.tsx` — Guest dietary info + kids meals
- `src/pages/portal/details/MealPrefs.tsx` — Meal event headcounts
- `src/pages/portal/people/Headcounts.tsx` — Guest count steppers with direct input
- `src/pages/portal/people/LodgingList.tsx` — 4-section collapsible lodging with room assignments
- `src/pages/portal/people/VendorList.tsx` — Couple-facing vendor cards with edit/view toggle

### Admin Tab Components

- `Overview.tsx` — Event details editing, couple info, participants panel
- `Milestones.tsx` — Timeline milestones with status toggling
- `Checklist.tsx` — Full checklist manager
- `Vendors.tsx` — Vendor management with drag-reorder, delete, edit/view
- `CeremonyTab.tsx` — Ceremony details mirror
- `MenusBarTab.tsx` — Menus & bar admin view
- `DietaryTab.tsx` — Dietary restrictions + kitchen PDF export
- `Lodging.tsx` — 4-section lodging with admin fields (invoices, payment, notes)
- `Financials.tsx` — Financial tracking + payment schedule
- `AdminMessages.tsx` — Admin message thread (iMessage style)
- `AdminNotesTab.tsx` — View couple's shared notes
- `AdminDocumentsTab.tsx` — Document uploads and management

### Shared Components

- `ProtectedRoute.tsx` — Role-based route guard
- `NavLink.tsx` — Reusable nav link
- `PortalStickyFooter.tsx` — Continue/back navigation footer
- `SectionTabs.tsx` — Tab switcher for portal sub-sections
- `CreateEventModal.tsx` — Multi-step event creation with couple account setup
- `AddParticipantModal.tsx` — Invite participants to events
- `ParticipantsPanel.tsx` — Manage event team members
- `AdminStickyFooter.tsx` — Admin navigation footer
- `AutosaveIndicator.tsx` — Save status display
- `SaveButton.tsx` — Explicit save trigger
- `VendorFileUpload.tsx` — Contract upload to Supabase storage
- `VendorCard.tsx` — Shared vendor card component
- `InstructionBlock.tsx` — Ceremony instruction display

---

## 2. Every Supabase Table Connected and Working

| Table | Used By | Status |
|-------|---------|--------|
| `users` | Auth, profile display | Working |
| `events` | Dashboard, event detail, portal | Working |
| `event_users` | Role/tier mapping, data scoping | Working |
| `event_addons` | Overview tab | Working |
| `milestones` | Milestones tab, Our Wedding timeline | Working |
| `checklist_items` | Planning tab (both sides) | Working |
| `vendors` | Vendor management (both sides) | Working |
| `ceremony_details` | Ceremony tab (both sides) | Working |
| `bar_selections` | Bar tab | Working |
| `meal_events` | Meal headcounts | Working |
| `dietary_restrictions` | Dietary tab (both sides) | Working |
| `decor_items` | Decor selections | Working |
| `lodging_rooms` | Room metadata (static list) | Working |
| `lodging_assignments` | Guest room assignments | Working |
| `financials` | Financial summary | Working |
| `payment_schedule` | Payment tracking | Working |
| `couple_notes` | Notes (both sides) | Working |
| `documents` | Document management | Working |
| `messages` | Real-time messaging | Working |
| `message_notification_queue` | Email notification batching | Working |
| `notification_log` | Notification tracking | Working |
| `working_timeline` | Day-of timeline (admin only) | Working |

---

## 3. Features That Are Fully Functional

- **Authentication**: Login, set-password flow, role-based routing (admin vs couple)
- **Admin Dashboard**: Event cards with countdown, unread badges, attention items, create event modal with couple account provisioning
- **Admin Event Detail**: All 12 tabs wired and functional with URL-persisted tab state
- **Admin Preview Mode**: "View as Couple" with amber banner, read-only, full portal mirror
- **Couple Portal Navigation**: Desktop sidebar + mobile hamburger drawer + bottom tab bar, tier-based filtering
- **Today Page**: Countdown, next task card with complete action, progress bar, message CTA
- **Our Wedding**: Event details display + milestone timeline with realtime updates
- **Planning**: Checklist with toggle complete/incomplete
- **Vendors**: Edit/view mode toggle, GF rows locked with badge, drag-to-reorder, delete with confirmation, file upload for contracts
- **Ceremony & Music**: Full ceremony details form (officiant, processional, songs, DJ, speeches, introductions)
- **Menus & Meals**: 4 sub-tabs (Meals, Headcounts, Dietary, Bar) all wired
- **Our People**: Lodging (4-section collapsible with 41 rooms, payment preferences, Fenimore locked) + Headcounts with stepper + direct input
- **Financials**: Site fee/catering summary + payment schedule timeline
- **Messages**: Real-time chat, iMessage-style timestamps, time gap dividers, tap-to-reveal, sender grouping, read receipts, mark-as-read
- **Notes**: Create/edit/delete with autosave, share-with-Brandon toggle
- **Documents**: Upload/download/delete with Supabase storage
- **Dietary & Kids**: Guest list with restrictions, severity, children flagging, kitchen PDF export (admin)
- **Edge Functions**: `create-couple-accounts`, `invite-participant`, `invite-admin-user`, `enqueue-message-notification`, `process-message-queue`

---

## 4. Features That Are Partially Built or Potentially Broken

- **WeekendDetails.tsx**: File exists but is not wired into any navigation or route — orphaned component
- **CouplePortal.tsx** (`src/pages/CouplePortal.tsx`): Legacy file that may be unused now that `PortalLayout.tsx` handles the portal shell
- **Index.tsx**: Redirects to `/login` — no landing page (may be intentional)
- **Lodging RLS**: Has multiple overlapping policies for couples (email-based + event_users-based UPDATE policies) which could cause confusion, though both are permissive so they should work
- **Lodging INSERT policy**: Couples have no INSERT policy on `lodging_assignments` — they can only UPDATE existing rows. If no rows exist for an event, couples can't create assignments (admin must seed them)
- **Vendor couple RLS**: Couples have SELECT-only on vendors — they cannot INSERT or UPDATE, which means the couple-side edit mode may fail on save
- **Messages RLS**: Has redundant SELECT policies (3 separate ones for admin). Works but cluttered
- **Vite dual-React issue**: Was recently patched in `vite.config.ts` with dedupe config — fragile if new deps are added

---

## 5. What Is Missing Entirely

- **No "Decor Selections" in couple portal navigation**: `DecorSelections.tsx` exists but isn't accessible from any portal tab or route
- **No working timeline view for couples**: `working_timeline` table exists with a `published` flag and RLS for couples to see published timelines, but there's no couple-facing UI to display it
- **No email notification delivery**: Edge functions exist for queuing and processing, but there's no visible trigger or cron configuration to actually send batched emails
- **No push notifications or in-app notification center**: Unread badges exist for messages only
- **No couple profile editing**: Couples can't update their own name/phone from within the portal
- **No admin user management page**: `AdminSettings.tsx` exists but its contents haven't been audited — likely minimal
- **No data export for admin**: No CSV/Excel export of guest lists, lodging assignments, vendor lists, etc. (only the dietary kitchen PDF exists)
- **No file uploads for couples**: Only admin can upload vendor contracts — couples have no document upload capability
- **No "Our Weekend" detail pages**: The `WeekendDetails.tsx` file exists but isn't connected — couples can't see a detailed itinerary or day-of schedule
- **No table layouts / seating chart feature**: Not built at all
- **No RSVP or guest management system**: No guest list table or RSVP tracking
- **No mobile bottom nav for preview mode**: Admin preview only has desktop sidebar, no mobile nav

