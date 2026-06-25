CREATE TABLE IF NOT EXISTS public.email_signatures (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  html text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_signatures TO authenticated;
GRANT ALL ON public.email_signatures TO service_role;

ALTER TABLE public.email_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own signature"
  ON public.email_signatures FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all signatures"
  ON public.email_signatures FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));

CREATE TRIGGER update_email_signatures_updated_at
  BEFORE UPDATE ON public.email_signatures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();