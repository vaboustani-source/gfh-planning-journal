CREATE OR REPLACE FUNCTION public.is_event_member(_event_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.event_users eu
    WHERE eu.event_id = _event_id
      AND eu.user_id = _user_id
  );
$$;

CREATE POLICY "Event participants can view people in their event"
ON public.event_users
FOR SELECT
TO public
USING (public.is_event_member(event_id, auth.uid()));