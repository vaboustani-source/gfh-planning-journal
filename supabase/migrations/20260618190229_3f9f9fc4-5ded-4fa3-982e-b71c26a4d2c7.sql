
-- 1) Replace public SELECT on rsvp_config with a token-scoped security-definer RPC
CREATE OR REPLACE FUNCTION public.lookup_rsvp_config(p_token text)
RETURNS public.rsvp_config
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.rsvp_config
  WHERE public_token = p_token
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.lookup_rsvp_config(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_rsvp_config(text) TO anon, authenticated;

DROP POLICY IF EXISTS "Public can read rsvp config" ON public.rsvp_config;

-- 2) Allow Partner 2 to be optional on events (drop NOT NULL if present; columns are already nullable today,
--    but make sure no CHECK requires both). No-op if already permissive.
ALTER TABLE public.events ALTER COLUMN pending_partner2_email DROP NOT NULL;
ALTER TABLE public.events ALTER COLUMN pending_partner2_name DROP NOT NULL;
ALTER TABLE public.events ALTER COLUMN partner2_name DROP NOT NULL;
