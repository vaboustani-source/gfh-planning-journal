-- Planning calls, v3: besides their coordinator's calls, couples can book a call directly with
-- staff who opt in (Sharon and Victoria). call_kind 'direct' = "a call with <person>", not billable,
-- no 90/30-day window.

ALTER TABLE public.call_hosts
  ADD COLUMN IF NOT EXISTS open_to_couples boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '';

ALTER TABLE public.planning_calls DROP CONSTRAINT IF EXISTS planning_calls_call_kind_check;
ALTER TABLE public.planning_calls ADD CONSTRAINT planning_calls_call_kind_check
  CHECK (call_kind IN ('post_booking', 'ninety_day', 'thirty_day', 'extra', 'direct'));

DROP INDEX IF EXISTS public.planning_calls_one_included_each;
CREATE UNIQUE INDEX IF NOT EXISTS planning_calls_one_included_each
  ON public.planning_calls (event_id, call_kind)
  WHERE status = 'booked' AND call_kind IN ('post_booking', 'ninety_day', 'thirty_day');

-- Couples can't read call_hosts (it holds staff settings), so they get this short list instead.
CREATE OR REPLACE FUNCTION public.list_open_call_hosts()
RETURNS TABLE (user_id uuid, display_name text, title text, ready boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT h.user_id, h.display_name, h.title,
    (SELECT count(DISTINCT t.provider) = 2 FROM public.call_scheduling_tokens t WHERE t.user_id = h.user_id)
  FROM public.call_hosts h
  WHERE h.open_to_couples AND auth.uid() IS NOT NULL
  ORDER BY h.display_name;
$$;
REVOKE ALL ON FUNCTION public.list_open_call_hosts() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.list_open_call_hosts() TO authenticated;

-- Melissa (events@) hosts every wedding's planning calls unless a wedding says otherwise.
UPDATE public.call_scheduling_settings
  SET default_host_user_id = (SELECT id FROM public.users WHERE email = 'events@gilbertsvillefarmhouse.com'),
      updated_at = now()
  WHERE id = 1 AND default_host_user_id IS NULL;

-- Victoria is open to direct calls from couples.
UPDATE public.call_hosts SET open_to_couples = true, title = 'Owner'
  WHERE user_id = (SELECT id FROM public.users WHERE email = 'victoria@gilbertsvillefarmhouse.com');
