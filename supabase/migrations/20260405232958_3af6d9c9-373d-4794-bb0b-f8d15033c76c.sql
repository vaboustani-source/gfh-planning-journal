ALTER TABLE public.meal_events DROP CONSTRAINT meal_events_meal_type_check;
ALTER TABLE public.meal_events ADD CONSTRAINT meal_events_meal_type_check CHECK (meal_type = ANY (ARRAY['arrival_lunch','goat_yoga','rehearsal_dinner','welcome_hour','wedding_breakfast','reception','after_party','farewell_brunch','cocktail_hour']));

INSERT INTO public.meal_events (event_id, meal_type, location, included_in_package, adult_count, kids_count, vendor_count)
SELECT e.event_id, 'cocktail_hour', NULL, true, 0, 0, 0
FROM (SELECT DISTINCT event_id FROM public.meal_events) e
WHERE NOT EXISTS (
  SELECT 1 FROM public.meal_events m WHERE m.event_id = e.event_id AND m.meal_type = 'cocktail_hour'
);