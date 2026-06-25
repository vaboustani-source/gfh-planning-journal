CREATE TABLE IF NOT EXISTS public.gmail_reply_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text,
  body_html text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gmail_reply_templates TO authenticated;
GRANT ALL ON public.gmail_reply_templates TO service_role;

ALTER TABLE public.gmail_reply_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view gmail reply templates"
  ON public.gmail_reply_templates FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','event_director','planner')));

CREATE POLICY "Staff can insert gmail reply templates"
  ON public.gmail_reply_templates FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','event_director','planner')));

CREATE POLICY "Staff can update gmail reply templates"
  ON public.gmail_reply_templates FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','event_director','planner')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','event_director','planner')));

CREATE POLICY "Staff can delete gmail reply templates"
  ON public.gmail_reply_templates FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','event_director','planner')));

CREATE TRIGGER update_gmail_reply_templates_updated_at
  BEFORE UPDATE ON public.gmail_reply_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();