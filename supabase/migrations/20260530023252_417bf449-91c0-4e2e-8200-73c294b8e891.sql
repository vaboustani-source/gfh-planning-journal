
-- Replace seed_vendors with the new canonical role template
create or replace function public.seed_vendors(p_event_id uuid)
returns void
language plpgsql
as $function$
begin
  if exists (select 1 from public.vendors where event_id = p_event_id) then
    return;
  end if;

  insert into public.vendors (event_id, category, business_name, contact_name, phone, email, instagram, status)
  values
    -- Venue & Catering (GF locked)
    (p_event_id, 'venue',          'Gilbertsville Farmhouse', 'Sharon Boustani', '(607) 783-9443', 'sharon@gilbertsvillefarmhouse.com', 'gilbertsvillefarmhouse', 'done'),
    (p_event_id, 'caterer',        'Gilbertsville Farmhouse', 'Sharon Boustani', '(607) 783-9443', 'sharon@gilbertsvillefarmhouse.com', 'gilbertsvillefarmhouse', 'done'),
    -- Planning & Design
    (p_event_id, 'planner',        null, null, null, null, null, 'pending'),
    -- Memory Capture
    (p_event_id, 'photographer',   null, null, null, null, null, 'pending'),
    (p_event_id, 'videographer',   null, null, null, null, null, 'pending'),
    -- Beauty
    (p_event_id, 'hair',           null, null, null, null, null, 'pending'),
    (p_event_id, 'makeup',         null, null, null, null, null, 'pending'),
    -- Florals & Decor
    (p_event_id, 'florals',        null, null, null, null, null, 'pending'),
    (p_event_id, 'rentals',        null, null, null, null, null, 'pending'),
    -- Ceremony
    (p_event_id, 'officiant',      null, null, null, null, null, 'pending'),
    (p_event_id, 'ceremony_music', null, null, null, null, null, 'pending'),
    -- Music & Entertainment
    (p_event_id, 'dj_band',        null, null, null, null, null, 'pending'),
    (p_event_id, 'photo_booth',    null, null, null, null, null, 'pending'),
    -- Extras
    (p_event_id, 'fireworks',      null, null, null, null, null, 'pending'),
    (p_event_id, 'shuttle',        null, null, null, null, null, 'pending'),
    (p_event_id, 'cake',           null, null, null, null, null, 'pending'),
    (p_event_id, 'invitations',    null, null, null, null, null, 'pending');
end;
$function$;

-- Idempotent helper: insert blank rows for any standard categories
-- that are missing on this event. Never touches existing rows.
create or replace function public.ensure_standard_vendor_roles(p_event_id uuid)
returns void
language plpgsql
as $function$
declare
  v_cat text;
  v_standard text[] := array[
    'venue','caterer','planner','photographer','videographer',
    'hair','makeup','florals','rentals','officiant','ceremony_music',
    'dj_band','photo_booth','fireworks','shuttle','cake','invitations'
  ];
begin
  -- Make sure venue + caterer GF rows exist
  if not exists (select 1 from public.vendors
                 where event_id = p_event_id and category = 'venue') then
    insert into public.vendors (event_id, category, business_name, contact_name, phone, email, instagram, status)
    values (p_event_id, 'venue', 'Gilbertsville Farmhouse', 'Sharon Boustani', '(607) 783-9443',
            'sharon@gilbertsvillefarmhouse.com', 'gilbertsvillefarmhouse', 'done');
  end if;
  if not exists (select 1 from public.vendors
                 where event_id = p_event_id and category = 'caterer') then
    insert into public.vendors (event_id, category, business_name, contact_name, phone, email, instagram, status)
    values (p_event_id, 'caterer', 'Gilbertsville Farmhouse', 'Sharon Boustani', '(607) 783-9443',
            'sharon@gilbertsvillefarmhouse.com', 'gilbertsvillefarmhouse', 'done');
  end if;

  foreach v_cat in array v_standard loop
    if v_cat in ('venue','caterer') then
      continue;
    end if;
    if not exists (
      select 1 from public.vendors
      where event_id = p_event_id and category = v_cat
    ) then
      insert into public.vendors (event_id, category, status)
      values (p_event_id, v_cat, 'pending');
    end if;
  end loop;
end;
$function$;

-- One-time backfill so every existing event shows the full template
do $$
declare r record;
begin
  for r in select id from public.events loop
    perform public.ensure_standard_vendor_roles(r.id);
  end loop;
end $$;
