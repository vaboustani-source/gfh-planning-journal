
DO $$ BEGIN
  CREATE TYPE public.access_level AS ENUM ('full','view','none');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.app_section AS ENUM (
    'event_planning','vendors_experiences_decor','our_people','financials',
    'sales_roster','marketing_roster','preferred_vendors_catalog',
    'other_catalogs','settings','tasting_notes','gmail_inbox'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.user_access_level(_user_id uuid, _section public.app_section)
RETURNS public.access_level LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role text;
BEGIN
  IF _user_id IS NULL THEN RETURN 'none'::public.access_level; END IF;
  SELECT role INTO v_role FROM public.users WHERE id = _user_id;
  IF v_role IS NULL THEN v_role := 'couple'; END IF;
  IF v_role NOT IN ('admin','event_director','sales_manager','marketing','planner','couple','vendor','ceo_owner')
    THEN v_role := 'couple'; END IF;
  IF v_role = 'ceo_owner' THEN v_role := 'event_director'; END IF;

  RETURN CASE _section
    WHEN 'event_planning' THEN CASE v_role
      WHEN 'admin' THEN 'full' WHEN 'event_director' THEN 'full'
      WHEN 'sales_manager' THEN 'view' WHEN 'marketing' THEN 'none'
      WHEN 'planner' THEN 'full' WHEN 'couple' THEN 'full' WHEN 'vendor' THEN 'view' END
    WHEN 'vendors_experiences_decor' THEN CASE v_role
      WHEN 'admin' THEN 'full' WHEN 'event_director' THEN 'full'
      WHEN 'sales_manager' THEN 'view' WHEN 'marketing' THEN 'view'
      WHEN 'planner' THEN 'full' WHEN 'couple' THEN 'full' WHEN 'vendor' THEN 'view' END
    WHEN 'our_people' THEN CASE v_role
      WHEN 'admin' THEN 'full' WHEN 'event_director' THEN 'full'
      WHEN 'sales_manager' THEN 'view' WHEN 'marketing' THEN 'none'
      WHEN 'planner' THEN 'full' WHEN 'couple' THEN 'full' WHEN 'vendor' THEN 'view' END
    WHEN 'financials' THEN CASE v_role
      WHEN 'admin' THEN 'full' WHEN 'event_director' THEN 'full'
      WHEN 'sales_manager' THEN 'view' WHEN 'marketing' THEN 'none'
      WHEN 'planner' THEN 'full' WHEN 'couple' THEN 'view' WHEN 'vendor' THEN 'none' END
    WHEN 'sales_roster' THEN CASE v_role
      WHEN 'admin' THEN 'full' WHEN 'event_director' THEN 'full'
      WHEN 'sales_manager' THEN 'full' WHEN 'marketing' THEN 'none'
      WHEN 'planner' THEN 'none' WHEN 'couple' THEN 'none' WHEN 'vendor' THEN 'none' END
    WHEN 'marketing_roster' THEN CASE v_role
      WHEN 'admin' THEN 'full' WHEN 'event_director' THEN 'full'
      WHEN 'sales_manager' THEN 'none' WHEN 'marketing' THEN 'full'
      WHEN 'planner' THEN 'view' WHEN 'couple' THEN 'none' WHEN 'vendor' THEN 'none' END
    WHEN 'preferred_vendors_catalog' THEN CASE v_role
      WHEN 'admin' THEN 'full' WHEN 'event_director' THEN 'view'
      WHEN 'sales_manager' THEN 'none' WHEN 'marketing' THEN 'view'
      WHEN 'planner' THEN 'view' WHEN 'couple' THEN 'view' WHEN 'vendor' THEN 'none' END
    WHEN 'other_catalogs' THEN CASE v_role
      WHEN 'admin' THEN 'full' WHEN 'event_director' THEN 'full'
      WHEN 'sales_manager' THEN 'none' WHEN 'marketing' THEN 'view'
      WHEN 'planner' THEN 'view' WHEN 'couple' THEN 'none' WHEN 'vendor' THEN 'none' END
    WHEN 'settings' THEN CASE v_role
      WHEN 'admin' THEN 'full' WHEN 'event_director' THEN 'full' ELSE 'none' END
    WHEN 'tasting_notes' THEN CASE v_role
      WHEN 'admin' THEN 'full' WHEN 'event_director' THEN 'full' ELSE 'none' END
    WHEN 'gmail_inbox' THEN CASE v_role
      WHEN 'admin' THEN 'full' WHEN 'event_director' THEN 'full' ELSE 'none' END
    ELSE 'none' END;
END $$;

CREATE OR REPLACE FUNCTION public.can_view_section(_user_id uuid, _section public.app_section)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.user_access_level(_user_id, _section) IN ('full','view');
$$;

CREATE OR REPLACE FUNCTION public.can_edit_section(_user_id uuid, _section public.app_section)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.user_access_level(_user_id, _section) = 'full';
$$;

GRANT EXECUTE ON FUNCTION public.user_access_level(uuid, public.app_section) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_section(uuid, public.app_section) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.can_edit_section(uuid, public.app_section) TO authenticated, anon, service_role;

-- sales_details
DROP POLICY IF EXISTS "Sales roles read sales_details" ON public.sales_details;
DROP POLICY IF EXISTS "Sales roles write sales_details" ON public.sales_details;
CREATE POLICY "Sales viewers read sales_details" ON public.sales_details
  FOR SELECT TO authenticated USING (public.can_view_section(auth.uid(), 'sales_roster'));
CREATE POLICY "Sales editors write sales_details" ON public.sales_details
  FOR ALL TO authenticated
  USING (public.can_edit_section(auth.uid(), 'sales_roster'))
  WITH CHECK (public.can_edit_section(auth.uid(), 'sales_roster'));

-- financials + financial_line_items
DROP POLICY IF EXISTS "Marketing viewers read financials" ON public.financials;
CREATE POLICY "Section viewers read financials" ON public.financials
  FOR SELECT TO authenticated USING (public.can_view_section(auth.uid(), 'financials'));
DROP POLICY IF EXISTS "Marketing viewers read financial_line_items" ON public.financial_line_items;
CREATE POLICY "Section viewers read financial_line_items" ON public.financial_line_items
  FOR SELECT TO authenticated USING (public.can_view_section(auth.uid(), 'financials'));

-- events / vendors / experience_catalog / experience_requests / guests:
-- replace marketing-viewer policies with marketing_roster section policies.
DROP POLICY IF EXISTS "Marketing viewers read events" ON public.events;
CREATE POLICY "Marketing roster viewers read events" ON public.events
  FOR SELECT TO authenticated USING (public.can_view_section(auth.uid(), 'marketing_roster'));

DROP POLICY IF EXISTS "Marketing viewers read vendors" ON public.vendors;
CREATE POLICY "Marketing roster viewers read vendors" ON public.vendors
  FOR SELECT TO authenticated USING (public.can_view_section(auth.uid(), 'marketing_roster'));

DROP POLICY IF EXISTS "Marketing viewers read experience_catalog" ON public.experience_catalog;
CREATE POLICY "Marketing roster viewers read experience_catalog" ON public.experience_catalog
  FOR SELECT TO authenticated USING (public.can_view_section(auth.uid(), 'marketing_roster'));

DROP POLICY IF EXISTS "Marketing viewers read experience_requests" ON public.experience_requests;
CREATE POLICY "Marketing roster viewers read experience_requests" ON public.experience_requests
  FOR SELECT TO authenticated USING (public.can_view_section(auth.uid(), 'marketing_roster'));

DROP POLICY IF EXISTS "Marketing viewers read guests" ON public.guests;
CREATE POLICY "Marketing roster viewers read guests" ON public.guests
  FOR SELECT TO authenticated USING (public.can_view_section(auth.uid(), 'marketing_roster'));

-- preferred_vendors: keep authenticated SELECT; consolidate write to catalog editors
DROP POLICY IF EXISTS "Admin manage pv" ON public.preferred_vendors;
DROP POLICY IF EXISTS "Admins manage preferred vendors" ON public.preferred_vendors;
CREATE POLICY "Catalog editors manage preferred vendors" ON public.preferred_vendors
  FOR ALL TO authenticated
  USING (public.can_edit_section(auth.uid(), 'preferred_vendors_catalog'))
  WITH CHECK (public.can_edit_section(auth.uid(), 'preferred_vendors_catalog'));

DROP FUNCTION IF EXISTS public.is_sales_viewer(uuid);
DROP FUNCTION IF EXISTS public.is_marketing_viewer(uuid);
