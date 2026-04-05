
CREATE OR REPLACE FUNCTION public.seed_working_timeline(p_event_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.working_timeline WHERE event_id = p_event_id) THEN
    RETURN;
  END IF;

  INSERT INTO public.working_timeline (event_id, published, timeline_data)
  VALUES (
    p_event_id,
    false,
    jsonb_build_object(
      'arrival_day', jsonb_build_array(
        jsonb_build_object('time', '11:00 AM', 'foh_label', 'Guest Arrival', 'boh_notes', '', 'internal_notes', ''),
        jsonb_build_object('time', '1:00 PM', 'foh_label', 'Welcome Lunch', 'boh_notes', 'Milk Barn setup', 'internal_notes', ''),
        jsonb_build_object('time', '3:00 PM', 'foh_label', 'Goat Yoga', 'boh_notes', '', 'internal_notes', ''),
        jsonb_build_object('time', '5:30 PM', 'foh_label', 'Ceremony Rehearsal', 'boh_notes', '', 'internal_notes', ''),
        jsonb_build_object('time', '6:00 PM', 'foh_label', 'Rehearsal Dinner', 'boh_notes', '', 'internal_notes', ''),
        jsonb_build_object('time', '9:00 PM', 'foh_label', 'Bonfire', 'boh_notes', '', 'internal_notes', '')
      ),
      'wedding_day', jsonb_build_array(
        jsonb_build_object('time', '8:00 AM', 'foh_label', 'Golf Carts Start', 'boh_notes', '', 'internal_notes', ''),
        jsonb_build_object('time', '9:00 AM', 'foh_label', 'Hair & Makeup', 'boh_notes', '', 'internal_notes', ''),
        jsonb_build_object('time', '9:30 AM', 'foh_label', 'Wedding Day Breakfast', 'boh_notes', '', 'internal_notes', ''),
        jsonb_build_object('time', '11:00 AM', 'foh_label', 'Guests Free Time', 'boh_notes', '', 'internal_notes', ''),
        jsonb_build_object('time', '12:30 PM', 'foh_label', 'Couple Gets Dressed', 'boh_notes', '', 'internal_notes', ''),
        jsonb_build_object('time', '1:30 PM', 'foh_label', 'First Look & Photos', 'boh_notes', '', 'internal_notes', ''),
        jsonb_build_object('time', '3:30 PM', 'foh_label', 'Welcome Hour', 'boh_notes', '', 'internal_notes', ''),
        jsonb_build_object('time', '4:30 PM', 'foh_label', 'Ceremony', 'boh_notes', '', 'internal_notes', ''),
        jsonb_build_object('time', '5:00 PM', 'foh_label', 'Cocktail Hour', 'boh_notes', '', 'internal_notes', ''),
        jsonb_build_object('time', '6:00 PM', 'foh_label', 'Reception Barn Reveal', 'boh_notes', '', 'internal_notes', ''),
        jsonb_build_object('time', '6:15 PM', 'foh_label', 'Introductions & First Dance', 'boh_notes', '', 'internal_notes', ''),
        jsonb_build_object('time', '6:30 PM', 'foh_label', 'Dinner', 'boh_notes', '40 minutes uninterrupted service', 'internal_notes', ''),
        jsonb_build_object('time', '7:10 PM', 'foh_label', 'Speeches & Parent Dances', 'boh_notes', '', 'internal_notes', ''),
        jsonb_build_object('time', '8:00 PM', 'foh_label', 'Dancing', 'boh_notes', '', 'internal_notes', ''),
        jsonb_build_object('time', '9:00 PM', 'foh_label', 'Bonfire Lit at Sunset', 'boh_notes', '', 'internal_notes', ''),
        jsonb_build_object('time', '9:30 PM', 'foh_label', 'Fireworks (if selected)', 'boh_notes', '', 'internal_notes', ''),
        jsonb_build_object('time', '11:00 PM', 'foh_label', 'Bonfire or After Party', 'boh_notes', '', 'internal_notes', '')
      ),
      'farewell_day', jsonb_build_array(
        jsonb_build_object('time', '9:30 AM', 'foh_label', 'Farewell Brunch', 'boh_notes', 'Hayloft or Milking Parlor based on headcount', 'internal_notes', ''),
        jsonb_build_object('time', '11:00 AM', 'foh_label', 'Guest Check-Out', 'boh_notes', '', 'internal_notes', '')
      )
    )
  );
END;
$$;
