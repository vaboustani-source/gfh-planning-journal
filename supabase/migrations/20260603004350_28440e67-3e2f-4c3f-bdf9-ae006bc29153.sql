ALTER TABLE public.contract_signatures
ADD COLUMN IF NOT EXISTS auth_method text NOT NULL DEFAULT 'password';

-- Prevent auto-creation of public.users rows on OAuth signups.
-- Only auto-create when the auth user was created via email/password (invitation flow).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_provider text;
BEGIN
  v_provider := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');

  -- Only auto-provision public.users for password (invited) signups.
  -- OAuth users must already have a public.users row (created during invitation).
  IF v_provider = 'email' THEN
    INSERT INTO public.users (id, email, role)
    VALUES (NEW.id, NEW.email, 'couple')
    ON CONFLICT (id) DO NOTHING;
  ELSE
    -- For OAuth: link by email if a pre-invited users row exists with NULL id-match.
    -- Update the existing row's id to the new auth.users id so the portal recognizes them.
    UPDATE public.users
       SET id = NEW.id
     WHERE lower(email) = lower(NEW.email)
       AND id <> NEW.id
       AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = NEW.id);
  END IF;

  RETURN NEW;
END;
$$;