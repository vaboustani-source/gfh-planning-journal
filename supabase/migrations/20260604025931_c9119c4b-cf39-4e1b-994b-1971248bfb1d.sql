
-- email_sender_map (learning memory)
CREATE TABLE IF NOT EXISTS public.email_sender_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_address text NOT NULL,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  times_filed integer DEFAULT 1,
  last_filed_at timestamptz DEFAULT now(),
  UNIQUE(sender_address, event_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_sender_map TO authenticated;
GRANT ALL ON public.email_sender_map TO service_role;
ALTER TABLE public.email_sender_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage sender map"
  ON public.email_sender_map FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Add direction column on project_emails
ALTER TABLE public.project_emails
  ADD COLUMN IF NOT EXISTS direction text DEFAULT 'received'
    CHECK (direction IN ('received','sent'));
