
-- Broaden is_admin to include event_director (event coordinator staff).
-- Section-level visibility is still enforced by user_access_level / can_view_section.
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = _user_id
      AND role IN ('admin', 'event_director')
  )
$$;
