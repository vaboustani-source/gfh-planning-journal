
-- 1. builder_selections: drop broad SELECT, scope to owner + admin
DROP POLICY IF EXISTS "Authenticated can view all builder selections" ON public.builder_selections;
CREATE POLICY "Couples view own builder selections"
  ON public.builder_selections FOR SELECT TO authenticated
  USING (
    couple_id IN (SELECT id FROM public.couples WHERE user_id = auth.uid())
    OR public.is_admin(auth.uid())
  );

-- 2. couple_history: scope SELECT
DROP POLICY IF EXISTS "Authenticated users can view couple history" ON public.couple_history;
DROP POLICY IF EXISTS "Authenticated users can insert couple history" ON public.couple_history;
CREATE POLICY "Couples view own history"
  ON public.couple_history FOR SELECT TO authenticated
  USING (
    couple_id IN (SELECT id FROM public.couples WHERE user_id = auth.uid())
    OR public.is_admin(auth.uid())
  );
CREATE POLICY "Couples insert own history"
  ON public.couple_history FOR INSERT TO authenticated
  WITH CHECK (
    couple_id IN (SELECT id FROM public.couples WHERE user_id = auth.uid())
    OR public.is_admin(auth.uid())
  );

-- 3. couple_selections: drop broad SELECT (existing ALL policy already scopes correctly)
DROP POLICY IF EXISTS "Authenticated can view all selections" ON public.couple_selections;

-- 4. couples: scope all four operations to owner / admin
DROP POLICY IF EXISTS "Authenticated users can view couples" ON public.couples;
DROP POLICY IF EXISTS "Authenticated users can insert couples" ON public.couples;
DROP POLICY IF EXISTS "Authenticated users can update couples" ON public.couples;
DROP POLICY IF EXISTS "Authenticated users can delete couples" ON public.couples;
CREATE POLICY "Couples view own row"
  ON public.couples FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Couples insert own row"
  ON public.couples FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Couples update own row"
  ON public.couples FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Admins delete couples"
  ON public.couples FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- 5. payment_settings: remove broad SELECT, admin only
DROP POLICY IF EXISTS "Authenticated can read payment settings" ON public.payment_settings;
CREATE POLICY "Admins read payment settings"
  ON public.payment_settings FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- 6. Menu catalog tables: restrict writes to admins (keep public SELECT)
-- menu_sections
DROP POLICY IF EXISTS "Authenticated users can insert sections" ON public.menu_sections;
DROP POLICY IF EXISTS "Authenticated users can update sections" ON public.menu_sections;
DROP POLICY IF EXISTS "Authenticated users can delete sections" ON public.menu_sections;
CREATE POLICY "Admins insert sections" ON public.menu_sections FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins update sections" ON public.menu_sections FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins delete sections" ON public.menu_sections FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- menu_items
DROP POLICY IF EXISTS "Authenticated users can insert items" ON public.menu_items;
DROP POLICY IF EXISTS "Authenticated users can update items" ON public.menu_items;
DROP POLICY IF EXISTS "Authenticated users can delete items" ON public.menu_items;
CREATE POLICY "Admins insert items" ON public.menu_items FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins update items" ON public.menu_items FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins delete items" ON public.menu_items FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- menu_accordions
DROP POLICY IF EXISTS "Authenticated users can insert accordions" ON public.menu_accordions;
DROP POLICY IF EXISTS "Authenticated users can update accordions" ON public.menu_accordions;
DROP POLICY IF EXISTS "Authenticated users can delete accordions" ON public.menu_accordions;
CREATE POLICY "Admins insert accordions" ON public.menu_accordions FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins update accordions" ON public.menu_accordions FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins delete accordions" ON public.menu_accordions FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- menu_packages
DROP POLICY IF EXISTS "Authenticated users can insert packages" ON public.menu_packages;
DROP POLICY IF EXISTS "Authenticated users can update packages" ON public.menu_packages;
DROP POLICY IF EXISTS "Authenticated users can delete packages" ON public.menu_packages;
CREATE POLICY "Admins insert packages" ON public.menu_packages FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins update packages" ON public.menu_packages FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins delete packages" ON public.menu_packages FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- menu_guide
DROP POLICY IF EXISTS "Authenticated users manage menu guide" ON public.menu_guide;
CREATE POLICY "Admins manage menu guide" ON public.menu_guide FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- pricing_config
DROP POLICY IF EXISTS "Authenticated users can insert pricing" ON public.pricing_config;
DROP POLICY IF EXISTS "Authenticated users can update pricing" ON public.pricing_config;
DROP POLICY IF EXISTS "Authenticated users can delete pricing" ON public.pricing_config;
CREATE POLICY "Admins insert pricing" ON public.pricing_config FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins update pricing" ON public.pricing_config FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins delete pricing" ON public.pricing_config FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- section_group_limits
DROP POLICY IF EXISTS "Authenticated users manage group limits" ON public.section_group_limits;
CREATE POLICY "Admins manage group limits" ON public.section_group_limits FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- basics_cards
DROP POLICY IF EXISTS "Authenticated users can insert basics cards" ON public.basics_cards;
DROP POLICY IF EXISTS "Authenticated users can update basics cards" ON public.basics_cards;
DROP POLICY IF EXISTS "Authenticated users can delete basics cards" ON public.basics_cards;
CREATE POLICY "Admins insert basics cards" ON public.basics_cards FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins update basics cards" ON public.basics_cards FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins delete basics cards" ON public.basics_cards FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- 7. invitations: drop broad public SELECT, replace with secure RPC by token
DROP POLICY IF EXISTS "Public can read invitation by token" ON public.invitations;

CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_token text)
RETURNS TABLE (
  id uuid,
  email text,
  invite_type text,
  assigned_role text,
  event_id uuid,
  invited_name text,
  status text,
  expires_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, email, invite_type, assigned_role, event_id, invited_name, status, expires_at
  FROM public.invitations
  WHERE token = p_token
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_invitation_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO anon, authenticated;
