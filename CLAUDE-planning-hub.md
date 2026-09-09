# CLAUDE.md — GFH Planning Hub

> Save this file as `CLAUDE.md` in the root of the Planning Hub repo (same level as `package.json`).
> This filename is `CLAUDE-planning-hub.md` only so it does not collide with the Menu App's file.

This file briefs Claude Code on how this project works. Read it fully before changing anything.

The person you are helping (Victoria) is a non-coder who vibe-codes. Explain what you are doing in
plain language, decide for her when there is an obvious right answer, and never assume she knows the
technical term for something. She dislikes em dashes and en dashes; write with commas, periods, and
parentheses instead.

**This is a LIVE production app** at `plan.gilbertsvillefarmhouse.com`, used to run real weddings.
Be careful. Prefer additive changes, test in preview before publishing, and confirm before anything
destructive (especially database changes, which also affect a second app, see below).

---

## What this app is

The **Gilbertsville Farmhouse Planning Hub** is the operations and client portal for a luxury wedding
venue. It has two main sides:

1. An **admin / staff side** (`/admin`) where the estate team (owners, planners, coordinators) manage
   each wedding: timeline and Gantt, vendors, experiences, decor, financials, seating, guest list and
   RSVP, menus and bar, messaging, and more.
2. A **couple portal** (`/portal`) where the couple plans their own wedding: their timeline, vendors,
   menus, RSVP, documents, and messaging with the team.

It shares **one Supabase backend** with a separate **Harvest 336 Menu App**. That backend is the single
source of truth for identity (who is who), weddings (events), and menu data. Changes to shared tables
affect both apps.

---

## Tech stack

- **Vite 5** + **React 18** + **TypeScript**. Single-page app.
- **react-router-dom v6** for routing. Routes/pages live under `src/pages/`. The app shell and route
  definitions are in `src/App.tsx`.
- **Tailwind CSS v3** with a real config file: `tailwind.config.ts`. Brand tokens and theme extensions
  live there (plus `@tailwindcss/typography` and `tailwindcss-animate`).
- **shadcn/ui** components (Radix under the hood) in `src/components/ui/`.
- **@tanstack/react-query** for server state and data fetching (not raw fetch in components).
- **react-hook-form + zod** for forms and validation.
- **@dnd-kit** for drag and drop (seating, timeline ordering, etc.).
- **recharts** for charts (financials, analytics). **sonner** for toasts. **date-fns** for dates.
- **@supabase/supabase-js** for the backend. Client lives under `src/integrations/supabase/`.
- Tests exist: **vitest** + **@testing-library/react** (unit/component) and **Playwright** (e2e).

Package manager: npm (this is the standard Vite setup). Bun also works if preferred.

---

## Commands

```
npm run dev        # local dev server (vite)
npm run build      # production build
npm run lint       # eslint .
npm test           # vitest run (unit/component tests)
npm run test:watch # vitest watch
npx tsc --noEmit   # type check (there is no dedicated typecheck script; run this)
```

Run `npx tsc --noEmit` and `npm run lint` before considering work done. If you touched anything with
tests, run `npm test`.

---

## Project layout (high level)

This is a large app. The tree below is the shape, not a complete list. Explore with the file tools
when you need a specific file rather than assuming a path.

```
src/
  App.tsx                  Route definitions + providers (react-router, react-query, auth)
  pages/
    Login.tsx              Sign-in (Google + email/password)
    SetPassword.tsx        First-time password set / reset landing (/set-password)
    AcceptInvite.tsx       Invitation acceptance (/accept-invite)
    admin/                 Admin side (dashboards + per-event management)
      tabs/                Per-event tabs, e.g. MenusBarTab.tsx, MenuSelectionsSubTab.tsx
    portal/                Couple portal pages, e.g. MenusMeals.tsx (/portal/menus)
  components/
    ui/                    shadcn components
    menu/                  Menu display, e.g. MenuSelectionsDisplay.tsx
    (many feature folders)
  hooks/
    useAuth.tsx            Auth state + sign-in/out; the Google sign-out guard lives here
    usePortalData.tsx      Resolves the signed-in couple's event + access from event_users
  lib/
    authUrls.ts            getAppBaseUrl() / getSetPasswordUrl(); reads VITE_APP_URL
  integrations/supabase/   Supabase client + generated types
supabase/
  functions/               Edge functions (server-side). See provisioning list below.
    _shared/appUrls.ts     Shared URL helper for server-side redirects
  migrations/              SQL migrations
```

---

## Routing and roles

Top-level routes: `/login`, `/admin` (staff), `/portal` (couple), `/accept-invite`, `/set-password`.
Admin event management lives under `/admin/events/:eventId` with tabs (timeline, vendors, financials,
menus and bar, seating, guests, messaging, and so on).

After sign-in the redirect is role-based: `users.role === 'admin'` goes to `/admin`, everyone else
(including couples) goes to `/portal`.

---

## Identity model (the most important shared concept)

Identity comes from two tables in the shared Supabase. The legacy `couples` table exists in the schema
but is **NOT used**; do not rely on it.

- **`public.users`** — one row per person, with a global `role`: `admin`, `event_director`, `planner`,
  or `couple`. `users.id` equals the auth user id.
- **`public.event_users`** — links a user to a wedding: `user_id`, `event_id`, `role_in_event`
  (`partner_1`, `partner_2`, `couple`, `participant`, `coordinator`, etc.), `access_tier` (1 to 4;
  couples are tier 3), and `tab_access` (which tabs that user can see).

**Classifying a couple:** `users.role = 'couple'` plus an `event_users` row whose `role_in_event` is one
of `partner_1` / `partner_2` / `couple` (or `access_tier = 3`). Their `event_users.event_id` is the
wedding to load. `usePortalData.tsx` is the canonical place this resolution happens for the portal.

---

## Provisioning (how couples and staff get accounts)

There is **no public sign-up.** Accounts are created by the estate team through an invite flow handled
by edge functions:

1. `create-event-and-invite-couple` — creates the `events` row (with pending partner emails,
   `lifecycle_stage = 'sales_setup'`) and seeds milestones, vendors, checklist, timelines. No auth user
   or invite yet.
2. `open-client-portal` — when an admin opens the portal for the couple, calls `send-invitation` per
   partner (`invite_type = 'couple'`, `role_in_event = partner_1/partner_2`, `access_tier = 3`), flips
   the event to `lifecycle_stage = 'portal_open'`, and creates an `invitations` row.
3. `accept-invitation` — the couple clicks the email link, lands on `/accept-invite`, and this function
   creates the auth user (or matches an already signed-in Google user), upserts `public.users` with
   `role = 'couple'`, upserts `public.event_users`, and marks the invitation accepted.
4. `invite-participant` — separate path to add other people to an existing event.

Tables written during couple provisioning: `auth.users`, `public.users`, `public.event_users`,
`public.invitations`, `public.events`.

---

## Auth and redirect configuration

Sign-in methods (in `Login.tsx` / `useAuth.tsx`):
- Email + password: `supabase.auth.signInWithPassword`.
- Google: `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: <origin>/login } })`.
  **Gotcha:** `useAuth` signs a Google user out if there is no matching `public.users` row and the
  provider is not email. So Google only works for people already provisioned via an invite. Keep that
  guard in mind if Google login "mysteriously" logs someone straight back out.
- Password set/reset: `resetPasswordForEmail` lands on `/set-password`, which does
  `exchangeCodeForSession` then `auth.updateUser({ password })`.

URL config: `src/lib/authUrls.ts` reads `VITE_APP_URL` (production is
`https://plan.gilbertsvillefarmhouse.com`) and falls back to `window.location.origin`. The Supabase
dashboard's Site URL and additional Redirect URLs must include this origin plus `/login`,
`/set-password`, and `/accept-invite`. Redirect errors on auth are almost always a dashboard URL
allow-list issue, not a code bug.

---

## Database notes

- Supabase project ref: `orbzcbnhljpriwuvxsjr`
  (dashboard: `https://supabase.com/dashboard/project/orbzcbnhljpriwuvxsjr`).
- This database is **shared with the Harvest 336 Menu App.** A migration here can affect that app and
  vice versa. Make additive changes; do not drop columns or RLS policies the other app may depend on.
- **RLS admin pattern (important):** admin access is determined by `public.users.role = 'admin'`, NOT by
  JWT app_metadata. Write policies as
  `EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')`. Couple/event access
  is gated through `event_users` (membership in the event). Follow these existing patterns when adding
  policies.
- Daily Supabase backups are in place, and the repo is under Git version control. Still, treat
  production data carefully.
- Use the generated Supabase types under `src/integrations/supabase/` rather than hand-writing row
  types where possible.

---

## Menus, and the cross-app integration (open item, confirm before wiring)

The Hub displays menu selections from a **normalized** table, `couple_selections` (one row per chosen
item, referencing the catalog tables `menu_items` and `menu_sections`), keyed by `event_id`. The admin
view is `src/components/menu/MenuSelectionsDisplay.tsx` (used by the Menus and Bar tab and the couple
portal's `/portal/menus`). On submit, a trigger creates a `menu_approvals` row and a sync posts a
catering line into financials.

The separate **Menu App** writes a different shape: a JSON blob in `builder_selections.selections`
keyed by its own builder item IDs (for example `ch-shrimp-cocktail`, `r-filet`), now keyed by
`event_id`. These two do **not** line up yet, because the builder's item IDs are not the catalog's
`menu_items` IDs. Bridging them (so builder selections appear in the Hub menu tab) is a deliberate,
pending decision. The agreed direction is for the Hub to read and render the builder's selections
rather than trying to map every builder item to a catalog item. Do not silently wire this up; confirm
the approach first.

---

## Known open items

- **Gmail integration** (reading/sending email from the Hub) has hit a `redirect_uri_mismatch` (Google
  Error 400). The fix is adding the exact redirect URI to the Google Cloud Console OAuth client; it is
  a console config step, not a code change.
- The menu cross-app bridge above.
- There is a broader product backlog tracked outside the repo (messaging features, RSVP details, etc.).
  Ask Victoria for the current priority rather than guessing from the code.

Victoria also keeps three source-of-truth documents for this app outside the repo: a Tech Stack Guide,
a Smoke Test Checklist, and a Quick Reference. If a decision depends on documented conventions, ask for
those.

---

## Working style and guardrails

- This is production. Confirm before destructive or schema-altering changes. Keep DB changes additive
  and remember the shared backend.
- Test in the Lovable preview, then publish to push the frontend live. Supabase migrations and edge
  functions deploy live immediately; the frontend waits for a publish.
- Run `npx tsc --noEmit` and `npm run lint` (and `npm test` when relevant) before finishing.
- Follow the existing identity and RLS patterns (`users.role` for admin, `event_users` for event
  membership). Do not introduce JWT-metadata-based role checks.
- No public sign-up. People are invited by the estate team.
- Match existing UI patterns and the brand. Tokens live in `tailwind.config.ts`.
- Explain changes in plain language and avoid em/en dashes in anything user-facing.

---

## Quick reference

- Stack: Vite 5, React 18, react-router-dom 6, TypeScript, Tailwind v3 (`tailwind.config.ts`),
  shadcn/ui, react-query, react-hook-form + zod, @dnd-kit, recharts, Supabase.
- Routes: `/login`, `/admin`, `/portal`, `/accept-invite`, `/set-password`. Admin events at
  `/admin/events/:eventId`.
- Identity: `public.users.role` + `public.event_users`. The `couples` table is unused.
- Auth: `src/hooks/useAuth.tsx`, `src/pages/Login.tsx`, `src/lib/authUrls.ts` (VITE_APP_URL).
- Provisioning: edge functions `create-event-and-invite-couple`, `open-client-portal`,
  `send-invitation`, `accept-invitation`, `invite-participant`.
- Supabase project: `orbzcbnhljpriwuvxsjr` (shared with the Menu App).
- Admin RLS pattern: `EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')`.
- Commands: `npm run dev`, `npm run build`, `npm run lint`, `npm test`, `npx tsc --noEmit`.
