-- Planning calls, v2: every staff member connects their OWN Google Calendar + Zoom.
-- A wedding's calls go to its call host (events.call_host_user_id), falling back to
-- call_scheduling_settings.default_host_user_id. Hours and days off are per host.

-- Tokens are now per staff member.
DELETE FROM public.call_scheduling_tokens;
ALTER TABLE public.call_scheduling_tokens DROP CONSTRAINT IF EXISTS call_scheduling_tokens_pkey;
ALTER TABLE public.call_scheduling_tokens
  ADD COLUMN IF NOT EXISTS user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.call_scheduling_tokens ADD PRIMARY KEY (user_id, provider);
ALTER TABLE public.call_scheduling_tokens DROP COLUMN IF EXISTS connected_by;

-- Per-host availability.
CREATE TABLE IF NOT EXISTS public.call_hosts (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  weekly_hours jsonb NOT NULL DEFAULT '{
    "1": [["10:00","16:00"]],
    "2": [["10:00","16:00"]],
    "3": [["10:00","16:00"]],
    "4": [["10:00","16:00"]],
    "5": [["10:00","14:00"]]
  }'::jsonb,
  blocked_dates date[] NOT NULL DEFAULT '{}',
  extra_busy_calendars text[] NOT NULL DEFAULT '{}',
  google_account_email text,
  zoom_account_email text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.call_hosts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read call hosts" ON public.call_hosts
  FOR SELECT USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "Hosts insert their own row" ON public.call_hosts
  FOR INSERT WITH CHECK (user_id = auth.uid() AND public.is_internal_staff(auth.uid()));
CREATE POLICY "Hosts and admins update host rows" ON public.call_hosts
  FOR UPDATE USING (user_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- Shared rules stay in the settings row; per-host fields move to call_hosts.
ALTER TABLE public.call_scheduling_settings
  DROP COLUMN IF EXISTS weekly_hours,
  DROP COLUMN IF EXISTS blocked_dates,
  DROP COLUMN IF EXISTS extra_busy_calendars,
  DROP COLUMN IF EXISTS google_account_email,
  DROP COLUMN IF EXISTS zoom_account_email,
  DROP COLUMN IF EXISTS host_name,
  ADD COLUMN IF NOT EXISTS default_host_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL;

-- Who hosts this wedding's planning calls (nullable, additive; the Menu App ignores it).
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS call_host_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL;

-- Calls belong to a host; double-booking is per host now.
DELETE FROM public.planning_calls;
ALTER TABLE public.planning_calls
  ADD COLUMN IF NOT EXISTS host_user_id uuid NOT NULL REFERENCES public.users(id);
DROP INDEX IF EXISTS public.planning_calls_one_per_start;
CREATE UNIQUE INDEX IF NOT EXISTS planning_calls_one_per_host_start
  ON public.planning_calls (host_user_id, starts_at) WHERE status = 'booked';
CREATE INDEX IF NOT EXISTS planning_calls_host_idx ON public.planning_calls (host_user_id) WHERE status = 'booked';
