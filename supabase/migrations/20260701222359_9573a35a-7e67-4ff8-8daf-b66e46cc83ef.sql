
CREATE TABLE public.lodging_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key text NOT NULL UNIQUE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  map_image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lodging_sections TO authenticated;
GRANT ALL ON public.lodging_sections TO service_role;

ALTER TABLE public.lodging_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view lodging sections"
  ON public.lodging_sections FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can insert lodging sections"
  ON public.lodging_sections FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update lodging sections"
  ON public.lodging_sections FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can delete lodging sections"
  ON public.lodging_sections FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

CREATE TRIGGER update_lodging_sections_updated_at
  BEFORE UPDATE ON public.lodging_sections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.lodging_sections (section_key, name, sort_order) VALUES
  ('hearth_village', 'The Hearth Village', 1),
  ('farmhouse', 'Farmhouse Residence', 2),
  ('grove', 'The Grove Guesthouses', 3),
  ('victoria', 'The Victoria Cabins', 4);

CREATE TABLE public.change_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid,
  action text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid REFERENCES public.users(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT ON public.change_history TO authenticated;
GRANT ALL ON public.change_history TO service_role;

ALTER TABLE public.change_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view change history"
  ON public.change_history FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can insert change history"
  ON public.change_history FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
