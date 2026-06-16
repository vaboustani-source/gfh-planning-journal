
-- Part A.1 & A.2: guests columns
ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS is_child boolean NOT NULL DEFAULT false;

ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS invited_optional_meals text[] NOT NULL DEFAULT '{}'::text[];

-- Part A.3: add welcome_party to allowed meal_types
ALTER TABLE public.meal_events DROP CONSTRAINT IF EXISTS meal_events_meal_type_check;
ALTER TABLE public.meal_events ADD CONSTRAINT meal_events_meal_type_check
  CHECK (meal_type = ANY (ARRAY[
    'arrival_lunch','goat_yoga','rehearsal_dinner','welcome_party',
    'welcome_hour','wedding_breakfast','reception','after_party',
    'farewell_brunch','cocktail_hour'
  ]));

-- Backfill welcome_party for every event that does not have one
INSERT INTO public.meal_events (event_id, meal_type, included_in_package, adult_count, kids_count, vendor_count)
SELECT e.id, 'welcome_party', false, 0, 0, 0
FROM public.events e
WHERE NOT EXISTS (
  SELECT 1 FROM public.meal_events m
  WHERE m.event_id = e.id AND m.meal_type = 'welcome_party'
);

-- Auto-seed canonical meal_events for any newly created event
CREATE OR REPLACE FUNCTION public.seed_meal_events_for_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_types text[] := ARRAY[
    'arrival_lunch','rehearsal_dinner','welcome_party','wedding_breakfast',
    'welcome_hour','cocktail_hour','reception','after_party','farewell_brunch'
  ];
  v_type text;
BEGIN
  FOREACH v_type IN ARRAY v_types LOOP
    INSERT INTO public.meal_events (event_id, meal_type, included_in_package, adult_count, kids_count, vendor_count)
    SELECT NEW.id, v_type, CASE WHEN v_type IN ('after_party','welcome_party') THEN false ELSE true END, 0, 0, 0
    WHERE NOT EXISTS (
      SELECT 1 FROM public.meal_events m WHERE m.event_id = NEW.id AND m.meal_type = v_type
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seed_meal_events_on_event_insert ON public.events;
CREATE TRIGGER seed_meal_events_on_event_insert
  AFTER INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.seed_meal_events_for_event();
