

# Rebuild Admin Dashboard

## Overview

Rebuild `/admin` (AdminDashboard.tsx) with full situational awareness: quick stats, upcoming events spotlight, upgraded event cards with milestone progress, expanded attention sidebar, season view, and an all-messages page.

## Changes

### 1. AdminDashboard.tsx — Full rewrite

**Quick Stats Bar** (full width, top, next to "New Event" button)
- 4 chips: Active Events, Upcoming This Month, Unread Messages, Overdue Milestones
- Each with icon (Calendar, CalendarClock, MessageCircle, AlertCircle), count, label
- Clicking navigates: Active → scrolls to cards, Upcoming → scrolls to upcoming section, Unread → `/admin/messages`, Overdue → scrolls to attention sidebar
- Style: `bg-sage/10 rounded-xl px-4 py-3`

**Data fetching additions** — fetch milestones per event (for progress bars + status chips), arrival_date from events, working_timeline published status, last message dates per event, payment_schedule for upcoming payments.

**Upcoming Soon section** (full width, below stats)
- Shows events with `arrival_date` within 60 days
- Card per event: couple name, arrival date, days away, "Final prep" badge
- Hidden entirely if no events qualify

**Upgraded Event Cards** — keep grid layout, add:
- Milestone progress bar: query `milestones` count total + completed per event
- Auto-status chip: Onboarding (0–2), Active Planning (3–10), Final Phase (11–14), Ready (15)
- Unread message badge (existing, keep)
- Next upcoming milestone name + date in muted text
- 3 icon buttons at bottom: MessageCircle → `?tab=messages`, Eye → preview, Clock → `?tab=timeline`

**Today's Attention Sidebar** — expand existing to 5 categories with section headers:
- Unread messages per event (existing, keep)
- Overdue milestones (milestone name + couple, link to milestones tab)
- Payments due within 14 days (expand from 7 → 14 days)
- Unpublished timelines where wedding < 90 days
- Couples with no message in 14+ days (query latest message per event)
- Section headers separate categories, empty sections hidden
- Critical items get `border-l-2 border-[#C9A84C]` accent

**Season View** (full width, below event cards)
- Compact list of all events sorted by arrival_date ascending
- Grouped by month ("May 2027", "June 2027")
- Each row: couple name, arrival date, status chip, days away
- Month headers as sticky labels

### 2. New file: `src/pages/admin/AdminAllMessages.tsx`

A page showing all message threads across events. Route: `/admin/messages`.
- List of events with latest message preview, unread count, and timestamp
- Click opens thread inline or navigates to `?tab=messages` on that event
- Reuses AdminMessages component for the thread view

### 3. App.tsx — Add route

Add `/admin/messages` route with `ProtectedRoute requiredRole="admin"` wrapping the new AdminAllMessages page.

### 4. Data queries (all from existing tables, no migrations needed)

- `events`: fetch `arrival_date` in addition to existing fields
- `milestones`: count by event_id where status = 'complete' and total count
- `working_timeline`: fetch `published` flag per event
- `messages`: fetch latest `created_at` per event for "no message in 14 days" check
- `payment_schedule`: expand window to 14 days

### Files modified
- `src/pages/AdminDashboard.tsx` — major rewrite
- `src/App.tsx` — add `/admin/messages` route
- `src/pages/admin/AdminAllMessages.tsx` — new file

