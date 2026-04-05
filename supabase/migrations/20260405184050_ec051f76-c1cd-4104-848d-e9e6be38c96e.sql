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
      'days', jsonb_build_array(
        jsonb_build_object(
          'id', 'day_1',
          'label', 'Arrival Day',
          'columns', jsonb_build_array('foh', 'boh', 'internal'),
          'custom_columns', '[]'::jsonb,
          'blocks', jsonb_build_array(
            jsonb_build_object('time', '11:00 AM', 'highlight', null, 'foh', 'Guest Arrival', 'boh', 'Golf carts running', 'internal', '', 'custom', '{}'::jsonb),
            jsonb_build_object('time', '1:00 PM', 'highlight', null, 'foh', 'Welcome Lunch', 'boh', 'Milk Barn setup', 'internal', '', 'custom', '{}'::jsonb),
            jsonb_build_object('time', '3:00 PM', 'highlight', null, 'foh', 'Goat Yoga', 'boh', '', 'internal', '', 'custom', '{}'::jsonb),
            jsonb_build_object('time', '5:30 PM', 'highlight', null, 'foh', 'Ceremony Rehearsal', 'boh', '', 'internal', '', 'custom', '{}'::jsonb),
            jsonb_build_object('time', '6:00 PM', 'highlight', null, 'foh', 'Rehearsal Dinner', 'boh', '', 'internal', '', 'custom', '{}'::jsonb),
            jsonb_build_object('time', '9:00 PM', 'highlight', null, 'foh', 'Bonfire', 'boh', '', 'internal', '', 'custom', '{}'::jsonb)
          )
        ),
        jsonb_build_object(
          'id', 'day_2',
          'label', 'Wedding Day',
          'columns', jsonb_build_array('foh', 'boh', 'internal'),
          'custom_columns', '[]'::jsonb,
          'blocks', jsonb_build_array(
            jsonb_build_object('time', '8:00 AM', 'highlight', null, 'foh', 'Golf Carts Start', 'boh', '', 'internal', '', 'custom', '{}'::jsonb),
            jsonb_build_object('time', '9:00 AM', 'highlight', null, 'foh', 'Hair & Makeup', 'boh', '', 'internal', '', 'custom', '{}'::jsonb),
            jsonb_build_object('time', '9:30 AM', 'highlight', null, 'foh', 'Wedding Day Breakfast', 'boh', '', 'internal', '', 'custom', '{}'::jsonb),
            jsonb_build_object('time', '11:00 AM', 'highlight', null, 'foh', 'Guests Free Time', 'boh', '', 'internal', '', 'custom', '{}'::jsonb),
            jsonb_build_object('time', '12:30 PM', 'highlight', null, 'foh', 'Couple Gets Dressed', 'boh', '', 'internal', '', 'custom', '{}'::jsonb),
            jsonb_build_object('time', '1:30 PM', 'highlight', null, 'foh', 'First Look & Photos', 'boh', '', 'internal', '', 'custom', '{}'::jsonb),
            jsonb_build_object('time', '3:30 PM', 'highlight', null, 'foh', 'Welcome Hour', 'boh', '', 'internal', '', 'custom', '{}'::jsonb),
            jsonb_build_object('time', '4:30 PM', 'highlight', null, 'foh', 'Ceremony', 'boh', '', 'internal', '', 'custom', '{}'::jsonb),
            jsonb_build_object('time', '5:00 PM', 'highlight', null, 'foh', 'Cocktail Hour', 'boh', '', 'internal', '', 'custom', '{}'::jsonb),
            jsonb_build_object('time', '6:00 PM', 'highlight', null, 'foh', 'Reception Barn Reveal', 'boh', '', 'internal', '', 'custom', '{}'::jsonb),
            jsonb_build_object('time', '6:15 PM', 'highlight', null, 'foh', 'Introductions & First Dance', 'boh', '', 'internal', '', 'custom', '{}'::jsonb),
            jsonb_build_object('time', '6:30 PM', 'highlight', null, 'foh', 'Dinner', 'boh', '40 minutes uninterrupted service', 'internal', '', 'custom', '{}'::jsonb),
            jsonb_build_object('time', '7:10 PM', 'highlight', null, 'foh', 'Speeches & Parent Dances', 'boh', '', 'internal', '', 'custom', '{}'::jsonb),
            jsonb_build_object('time', '8:00 PM', 'highlight', null, 'foh', 'Dancing', 'boh', '', 'internal', '', 'custom', '{}'::jsonb),
            jsonb_build_object('time', '9:00 PM', 'highlight', null, 'foh', 'Bonfire Lit at Sunset', 'boh', '', 'internal', '', 'custom', '{}'::jsonb),
            jsonb_build_object('time', '9:30 PM', 'highlight', null, 'foh', 'Fireworks (if selected)', 'boh', '', 'internal', '', 'custom', '{}'::jsonb),
            jsonb_build_object('time', '11:00 PM', 'highlight', null, 'foh', 'Bonfire or After Party', 'boh', '', 'internal', '', 'custom', '{}'::jsonb)
          )
        ),
        jsonb_build_object(
          'id', 'day_3',
          'label', 'Farewell Day',
          'columns', jsonb_build_array('foh', 'boh', 'internal'),
          'custom_columns', '[]'::jsonb,
          'blocks', jsonb_build_array(
            jsonb_build_object('time', '9:30 AM', 'highlight', null, 'foh', 'Farewell Brunch', 'boh', 'Hayloft or Milking Parlor based on headcount', 'internal', '', 'custom', '{}'::jsonb),
            jsonb_build_object('time', '11:00 AM', 'highlight', null, 'foh', 'Guest Check-Out', 'boh', '', 'internal', '', 'custom', '{}'::jsonb)
          )
        )
      )
    )
  );
END;
$$;