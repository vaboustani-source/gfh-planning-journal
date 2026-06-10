
CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  email text NOT NULL,
  invite_type text NOT NULL CHECK (invite_type IN ('staff', 'couple', 'participant')),
  assigned_role text,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  tab_access jsonb,
  role_in_event text,
  access_tier int,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_name text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invitations_email_idx ON public.invitations (lower(email));
CREATE INDEX IF NOT EXISTS invitations_event_idx ON public.invitations (event_id);
CREATE INDEX IF NOT EXISTS invitations_status_idx ON public.invitations (status);

GRANT SELECT ON public.invitations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO authenticated;
GRANT ALL ON public.invitations TO service_role;

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all invitations" ON public.invitations
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Event directors manage invitations" ON public.invitations
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'event_director'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'event_director'));

CREATE POLICY "Public can read invitation by token" ON public.invitations
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE TRIGGER set_invitations_updated_at
  BEFORE UPDATE ON public.invitations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
