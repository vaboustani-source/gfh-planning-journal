
-- Marketing viewer helper: allows users with marketing/planner/event_director/ceo_owner roles
-- to read cross-event data for the Marketing Roster.
CREATE OR REPLACE FUNCTION public.is_marketing_viewer(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = _user_id
      AND role IN ('admin','marketing','planner','event_director','ceo_owner')
  );
$$;

-- Add SELECT policies (admins already covered; this layers in the new roles)
CREATE POLICY "Marketing viewers read events"
  ON public.events FOR SELECT
  USING (public.is_marketing_viewer(auth.uid()));

CREATE POLICY "Marketing viewers read vendors"
  ON public.vendors FOR SELECT
  USING (public.is_marketing_viewer(auth.uid()));

CREATE POLICY "Marketing viewers read experience_requests"
  ON public.experience_requests FOR SELECT
  USING (public.is_marketing_viewer(auth.uid()));

CREATE POLICY "Marketing viewers read experience_catalog"
  ON public.experience_catalog FOR SELECT
  USING (public.is_marketing_viewer(auth.uid()));

CREATE POLICY "Marketing viewers read financials"
  ON public.financials FOR SELECT
  USING (public.is_marketing_viewer(auth.uid()));

CREATE POLICY "Marketing viewers read financial_line_items"
  ON public.financial_line_items FOR SELECT
  USING (public.is_marketing_viewer(auth.uid()));

CREATE POLICY "Marketing viewers read guests"
  ON public.guests FOR SELECT
  USING (public.is_marketing_viewer(auth.uid()));
