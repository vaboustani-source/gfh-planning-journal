-- Fix seed_vendors to not insert duplicates
CREATE OR REPLACE FUNCTION public.seed_vendors(p_event_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
begin
  IF EXISTS (SELECT 1 FROM public.vendors WHERE event_id = p_event_id) THEN
    RETURN;
  END IF;

  insert into public.vendors (event_id, category, business_name, contact_name, phone, email, instagram, status)
  values
    (p_event_id, 'venue', 'Gilbertsville Farmhouse', 'Sharon Boustani', '(607) 783-9443', 'sharon@gilbertsvillefarmhouse.com', 'gilbertsvillefarmhouse', 'done'),
    (p_event_id, 'caterer', 'Gilbertsville Farmhouse', 'Sharon Boustani', '(607) 783-9443', 'sharon@gilbertsvillefarmhouse.com', 'gilbertsvillefarmhouse', 'done'),
    (p_event_id, 'cake', null, null, null, null, null, 'pending'),
    (p_event_id, 'photographer', null, null, null, null, null, 'pending'),
    (p_event_id, 'videographer', null, null, null, null, null, 'pending'),
    (p_event_id, 'hair', null, null, null, null, null, 'pending'),
    (p_event_id, 'makeup', null, null, null, null, null, 'pending'),
    (p_event_id, 'officiant', null, null, null, null, null, 'pending'),
    (p_event_id, 'ceremony_music', null, null, null, null, null, 'pending'),
    (p_event_id, 'dj_band', null, null, null, null, null, 'pending'),
    (p_event_id, 'florals', null, null, null, null, null, 'pending'),
    (p_event_id, 'rentals', null, null, null, null, null, 'pending'),
    (p_event_id, 'photo_booth', null, null, null, null, null, 'pending'),
    (p_event_id, 'fireworks', null, null, null, null, null, 'pending'),
    (p_event_id, 'invitations', null, null, null, null, null, 'pending'),
    (p_event_id, 'shuttle', null, null, null, null, null, 'pending'),
    (p_event_id, 'hotel', null, null, null, null, null, 'pending'),
    (p_event_id, 'planner', null, null, null, null, null, 'pending'),
    (p_event_id, 'other', null, null, null, null, null, 'pending'),
    (p_event_id, 'other', null, null, null, null, null, 'pending');
end;
$function$;

-- Clean up duplicate GF rows
DELETE FROM public.vendors
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (PARTITION BY event_id, category ORDER BY created_at ASC) as rn
    FROM public.vendors
    WHERE business_name = 'Gilbertsville Farmhouse'
      AND category IN ('venue', 'caterer')
  ) sub
  WHERE rn > 1
);

-- Clean up duplicate seeded null rows (except 'other' which allows multiples)
DELETE FROM public.vendors
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (PARTITION BY event_id, category ORDER BY created_at ASC) as rn
    FROM public.vendors
    WHERE business_name IS NULL
      AND category NOT IN ('other')
  ) sub
  WHERE rn > 1
);