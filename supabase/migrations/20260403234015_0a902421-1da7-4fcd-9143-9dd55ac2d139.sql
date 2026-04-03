CREATE UNIQUE INDEX unique_venue_per_event ON public.vendors (event_id) WHERE category = 'venue';
CREATE UNIQUE INDEX unique_caterer_per_event ON public.vendors (event_id) WHERE category = 'caterer';