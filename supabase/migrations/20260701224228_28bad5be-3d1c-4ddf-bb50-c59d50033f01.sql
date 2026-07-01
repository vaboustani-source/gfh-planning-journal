
-- Helper: internal staff check
CREATE OR REPLACE FUNCTION public.is_internal_staff(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = _uid
      AND role IN ('admin','event_director','ceo_owner','sales_manager','marketing','planner')
  );
$$;

-- Storage: lodging-maps
DROP POLICY IF EXISTS "Admins can upload lodging maps" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update lodging maps" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete lodging maps" ON storage.objects;

CREATE POLICY "Staff can upload lodging maps"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'lodging-maps' AND public.is_internal_staff(auth.uid()));

CREATE POLICY "Staff can update lodging maps"
ON storage.objects FOR UPDATE
USING (bucket_id = 'lodging-maps' AND public.is_internal_staff(auth.uid()));

CREATE POLICY "Staff can delete lodging maps"
ON storage.objects FOR DELETE
USING (bucket_id = 'lodging-maps' AND public.is_internal_staff(auth.uid()));

-- lodging_sections
DROP POLICY IF EXISTS "Admins can insert lodging sections" ON public.lodging_sections;
DROP POLICY IF EXISTS "Admins can update lodging sections" ON public.lodging_sections;
DROP POLICY IF EXISTS "Admins can delete lodging sections" ON public.lodging_sections;

CREATE POLICY "Staff can insert lodging sections"
ON public.lodging_sections FOR INSERT
WITH CHECK (public.is_internal_staff(auth.uid()));

CREATE POLICY "Staff can update lodging sections"
ON public.lodging_sections FOR UPDATE
USING (public.is_internal_staff(auth.uid()))
WITH CHECK (public.is_internal_staff(auth.uid()));

CREATE POLICY "Staff can delete lodging sections"
ON public.lodging_sections FOR DELETE
USING (public.is_internal_staff(auth.uid()));

-- change_history
DROP POLICY IF EXISTS "Admins can insert change history" ON public.change_history;
DROP POLICY IF EXISTS "Admins can view change history" ON public.change_history;

CREATE POLICY "Staff can insert change history"
ON public.change_history FOR INSERT
WITH CHECK (public.is_internal_staff(auth.uid()));

CREATE POLICY "Staff can view change history"
ON public.change_history FOR SELECT
USING (public.is_internal_staff(auth.uid()));
