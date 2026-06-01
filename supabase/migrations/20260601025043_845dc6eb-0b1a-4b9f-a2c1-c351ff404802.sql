
-- Add columns to guests for RSVP responses
ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS rsvp_responses jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS party_size integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rsvp_lodging_details jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Public lookup: event info for a valid RSVP token
CREATE OR REPLACE FUNCTION public.lookup_rsvp_event(p_token text)
RETURNS TABLE(
  event_id uuid,
  event_title text,
  partner1_name text,
  partner2_name text,
  wedding_date date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.title, e.partner1_name, e.partner2_name, e.wedding_date
  FROM public.rsvp_config c
  JOIN public.events e ON e.id = c.event_id
  WHERE c.public_token = p_token AND c.is_live = true
  LIMIT 1;
$$;

-- Public lookup: guests for a valid token (returns only the fields needed for RSVP)
CREATE OR REPLACE FUNCTION public.lookup_rsvp_guests(p_token text)
RETURNS TABLE(
  id uuid,
  first_name text,
  last_name text,
  email text,
  is_plus_one boolean,
  plus_one_of uuid,
  lodging_preference text,
  rsvp_status text,
  party_size integer,
  meal_preference text,
  dietary_restrictions text[],
  rsvp_responses jsonb,
  rsvp_lodging_details jsonb,
  rsvp_submitted_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT g.id, g.first_name, g.last_name, g.email, g.is_plus_one, g.plus_one_of,
         g.lodging_preference, g.rsvp_status, g.party_size, g.meal_preference,
         g.dietary_restrictions, g.rsvp_responses, g.rsvp_lodging_details,
         g.rsvp_submitted_at
  FROM public.guests g
  JOIN public.rsvp_config c ON c.event_id = g.event_id
  WHERE c.public_token = p_token AND c.is_live = true
  ORDER BY g.last_name, g.first_name;
$$;

-- Public lookup: meal events for token
CREATE OR REPLACE FUNCTION public.lookup_rsvp_meal_events(p_token text)
RETURNS TABLE(
  id uuid,
  meal_type text,
  location text,
  included_in_package boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m.meal_type, m.location, m.included_in_package
  FROM public.meal_events m
  JOIN public.rsvp_config c ON c.event_id = m.event_id
  WHERE c.public_token = p_token AND c.is_live = true;
$$;

-- Submit RSVP (public)
CREATE OR REPLACE FUNCTION public.submit_rsvp(
  p_token text,
  p_guest_id uuid,
  p_payload jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_deadline date;
  v_is_live boolean;
BEGIN
  SELECT event_id, rsvp_deadline, is_live
    INTO v_event_id, v_deadline, v_is_live
  FROM public.rsvp_config
  WHERE public_token = p_token
  LIMIT 1;

  IF v_event_id IS NULL OR v_is_live IS NOT TRUE THEN
    RAISE EXCEPTION 'Invalid or inactive RSVP link';
  END IF;

  IF v_deadline IS NOT NULL AND v_deadline < CURRENT_DATE THEN
    RAISE EXCEPTION 'RSVP deadline has passed';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.guests WHERE id = p_guest_id AND event_id = v_event_id) THEN
    RAISE EXCEPTION 'Guest does not belong to this event';
  END IF;

  UPDATE public.guests SET
    rsvp_status = COALESCE(p_payload->>'rsvp_status', rsvp_status),
    party_size = COALESCE(NULLIF(p_payload->>'party_size','')::integer, party_size),
    meal_preference = COALESCE(p_payload->>'meal_preference', meal_preference),
    dietary_restrictions = COALESCE(
      (SELECT array_agg(value::text) FROM jsonb_array_elements_text(p_payload->'dietary_restrictions')),
      dietary_restrictions
    ),
    rsvp_responses = COALESCE(p_payload->'rsvp_responses', rsvp_responses),
    rsvp_lodging_details = COALESCE(p_payload->'rsvp_lodging_details', rsvp_lodging_details),
    rsvp_submitted_at = now(),
    rsvp_source = 'rsvp_app'
  WHERE id = p_guest_id;
END;
$$;

-- Submit RSVP for an unmatched guest (creates a guest record flagged for admin)
CREATE OR REPLACE FUNCTION public.submit_rsvp_unmatched(
  p_token text,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_payload jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_is_live boolean;
  v_id uuid;
BEGIN
  SELECT event_id, is_live INTO v_event_id, v_is_live
  FROM public.rsvp_config WHERE public_token = p_token LIMIT 1;

  IF v_event_id IS NULL OR v_is_live IS NOT TRUE THEN
    RAISE EXCEPTION 'Invalid or inactive RSVP link';
  END IF;

  INSERT INTO public.guests (
    event_id, first_name, last_name, email,
    rsvp_status, party_size, meal_preference,
    dietary_restrictions, rsvp_responses, rsvp_lodging_details,
    rsvp_submitted_at, rsvp_source, added_by
  ) VALUES (
    v_event_id,
    COALESCE(NULLIF(trim(p_first_name),''), 'Unknown'),
    COALESCE(NULLIF(trim(p_last_name),''), ''),
    NULLIF(trim(p_email),''),
    COALESCE(p_payload->>'rsvp_status', 'confirmed'),
    COALESCE(NULLIF(p_payload->>'party_size','')::integer, 1),
    p_payload->>'meal_preference',
    COALESCE(
      (SELECT array_agg(value::text) FROM jsonb_array_elements_text(p_payload->'dietary_restrictions')),
      ARRAY[]::text[]
    ),
    COALESCE(p_payload->'rsvp_responses', '{}'::jsonb),
    COALESCE(p_payload->'rsvp_lodging_details', '{}'::jsonb),
    now(),
    'rsvp_app_unmatched',
    'rsvp_app'
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_rsvp_event(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_rsvp_guests(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_rsvp_meal_events(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_rsvp(text, uuid, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_rsvp_unmatched(text, text, text, text, jsonb) TO anon, authenticated;
