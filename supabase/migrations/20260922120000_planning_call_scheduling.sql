-- Planning call scheduling: couples book their coordination calls against the
-- events@ Google Calendar, and each booking gets a Zoom meeting + calendar invite.
-- All writes to planning_calls happen in edge functions (scheduling-*), which
-- check free/busy and create the Zoom + Google event before the row is final.

-- One row of settings (the planning-call host). Readable/editable by admins.
CREATE TABLE IF NOT EXISTS public.call_scheduling_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  host_name text NOT NULL DEFAULT 'your Weekend Event Coordinator',
  timezone text NOT NULL DEFAULT 'America/New_York',
  -- ISO weekday (1 = Monday ... 7 = Sunday) -> list of [start, end] in local time
  weekly_hours jsonb NOT NULL DEFAULT '{
    "1": [["10:00","16:00"]],
    "2": [["10:00","16:00"]],
    "3": [["10:00","16:00"]],
    "4": [["10:00","16:00"]],
    "5": [["10:00","14:00"]]
  }'::jsonb,
  call_minutes int NOT NULL DEFAULT 60 CHECK (call_minutes BETWEEN 15 AND 180),
  buffer_minutes int NOT NULL DEFAULT 15 CHECK (buffer_minutes BETWEEN 0 AND 120),
  min_notice_hours int NOT NULL DEFAULT 48 CHECK (min_notice_hours BETWEEN 0 AND 336),
  max_days_ahead int NOT NULL DEFAULT 45 CHECK (max_days_ahead BETWEEN 1 AND 365),
  cancel_notice_hours int NOT NULL DEFAULT 24 CHECK (cancel_notice_hours BETWEEN 0 AND 336),
  blocked_dates date[] NOT NULL DEFAULT '{}',
  -- Extra Google calendars (shared with events@) whose busy times also block slots
  extra_busy_calendars text[] NOT NULL DEFAULT '{}',
  -- Display only; filled by the OAuth callback
  google_account_email text,
  zoom_account_email text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.users(id)
);
INSERT INTO public.call_scheduling_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.call_scheduling_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read call scheduling settings" ON public.call_scheduling_settings
  FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins update call scheduling settings" ON public.call_scheduling_settings
  FOR UPDATE USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- OAuth tokens for Google Calendar + Zoom. RLS on with no policies:
-- only the service role (edge functions) can read or write these.
CREATE TABLE IF NOT EXISTS public.call_scheduling_tokens (
  provider text PRIMARY KEY CHECK (provider IN ('google', 'zoom')),
  account_email text,
  refresh_token text NOT NULL,
  access_token text,
  access_token_expires_at timestamptz,
  connected_by uuid REFERENCES public.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.call_scheduling_tokens ENABLE ROW LEVEL SECURITY;

-- The calls themselves.
CREATE TABLE IF NOT EXISTS public.planning_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  call_kind text NOT NULL CHECK (call_kind IN ('post_booking', 'ninety_day', 'thirty_day', 'extra')),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'cancelled')),
  billable boolean NOT NULL DEFAULT false,
  zoom_meeting_id text,
  zoom_join_url text,
  zoom_passcode text,
  google_event_id text,
  couple_note text,
  booked_by uuid REFERENCES public.users(id),
  cancelled_by uuid REFERENCES public.users(id),
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS planning_calls_event_idx ON public.planning_calls (event_id);
CREATE INDEX IF NOT EXISTS planning_calls_starts_idx ON public.planning_calls (starts_at) WHERE status = 'booked';
-- Two couples can't grab the same start time.
CREATE UNIQUE INDEX IF NOT EXISTS planning_calls_one_per_start
  ON public.planning_calls (starts_at) WHERE status = 'booked';
-- Each included call can be booked once per wedding (extras are unlimited).
CREATE UNIQUE INDEX IF NOT EXISTS planning_calls_one_included_each
  ON public.planning_calls (event_id, call_kind) WHERE status = 'booked' AND call_kind <> 'extra';

ALTER TABLE public.planning_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Event members and admins read planning calls" ON public.planning_calls
  FOR SELECT USING (public.is_event_member(event_id, auth.uid()) OR public.is_admin(auth.uid()));
-- No client insert/update/delete: bookings go through the scheduling edge functions.
