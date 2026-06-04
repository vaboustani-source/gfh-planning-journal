-- gmail_connections
CREATE TABLE IF NOT EXISTS public.gmail_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_address text,
  refresh_token text NOT NULL,
  access_token text,
  access_token_expires_at timestamptz,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gmail_connections TO authenticated;
GRANT ALL ON public.gmail_connections TO service_role;

ALTER TABLE public.gmail_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage gmail connections"
  ON public.gmail_connections FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- project_emails
CREATE TABLE IF NOT EXISTS public.project_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  gmail_thread_id text NOT NULL,
  gmail_message_id text NOT NULL UNIQUE,
  from_address text,
  from_name text,
  to_addresses text,
  subject text,
  body_text text,
  body_html text,
  snippet text,
  has_attachments boolean DEFAULT false,
  attachments jsonb DEFAULT '[]'::jsonb,
  received_at timestamptz,
  filed_by uuid REFERENCES auth.users(id),
  filed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_emails_event ON public.project_emails(event_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_emails_thread ON public.project_emails(gmail_thread_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_emails TO authenticated;
GRANT ALL ON public.project_emails TO service_role;

ALTER TABLE public.project_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage project emails"
  ON public.project_emails FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Default: couples cannot read filed project emails (admin-only archive).
-- Flip this policy later if couples should see vendor emails.

-- filed_threads
CREATE TABLE IF NOT EXISTS public.filed_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  gmail_thread_id text NOT NULL UNIQUE,
  filed_by uuid REFERENCES auth.users(id),
  filed_at timestamptz NOT NULL DEFAULT now(),
  last_synced_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_filed_threads_event ON public.filed_threads(event_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.filed_threads TO authenticated;
GRANT ALL ON public.filed_threads TO service_role;

ALTER TABLE public.filed_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage filed threads"
  ON public.filed_threads FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
