
-- LAYOUT LIBRARY
CREATE TABLE IF NOT EXISTS public.layout_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_count_min integer NOT NULL,
  guest_count_max integer NOT NULL,
  label text NOT NULL,
  image_url text,
  table_config_description text,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

GRANT SELECT ON public.layout_library TO authenticated;
GRANT ALL ON public.layout_library TO service_role;

ALTER TABLE public.layout_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read layouts" ON public.layout_library
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage layouts" ON public.layout_library
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- SEATING TABLES
CREATE TABLE IF NOT EXISTS public.seating_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  layout_id uuid REFERENCES public.layout_library(id),
  table_name text NOT NULL,
  table_type text DEFAULT 'farm' CHECK (table_type IN ('farm','round','sweetheart','cocktail','kids','vendor','other')),
  capacity integer NOT NULL DEFAULT 8,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.seating_tables TO authenticated;
GRANT ALL ON public.seating_tables TO service_role;

ALTER TABLE public.seating_tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage seating tables" ON public.seating_tables
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Event members manage seating tables" ON public.seating_tables
  FOR ALL TO authenticated
  USING (is_event_member(event_id, auth.uid()))
  WITH CHECK (is_event_member(event_id, auth.uid()));

-- SEATING ASSIGNMENTS
CREATE TABLE IF NOT EXISTS public.seating_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  table_id uuid REFERENCES public.seating_tables(id) ON DELETE CASCADE,
  guest_name text NOT NULL,
  guest_email text,
  seat_number integer,
  meal_preference text,
  notes text,
  source text DEFAULT 'manual' CHECK (source IN ('lodging','manual')),
  lodging_room_id uuid REFERENCES public.lodging_rooms(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE (event_id, guest_name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.seating_assignments TO authenticated;
GRANT ALL ON public.seating_assignments TO service_role;

ALTER TABLE public.seating_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage seating assignments" ON public.seating_assignments
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Event members manage seating assignments" ON public.seating_assignments
  FOR ALL TO authenticated
  USING (is_event_member(event_id, auth.uid()))
  WITH CHECK (is_event_member(event_id, auth.uid()));

-- SEED LAYOUT LIBRARY
INSERT INTO public.layout_library (guest_count_min, guest_count_max, label, sort_order) VALUES
(41, 50, '50 Guests', 1),
(51, 60, '60 Guests', 2),
(61, 70, '70 Guests', 3),
(71, 80, '80 Guests', 4),
(81, 90, '90 Guests', 5),
(91, 100, '100 Guests', 6),
(101, 110, '110 Guests', 7),
(111, 120, '120 Guests', 8),
(121, 130, '130 Guests', 9),
(131, 140, '140 Guests', 10),
(141, 150, '150 Guests', 11),
(151, 160, '160 Guests', 12),
(161, 170, '170 Guests', 13),
(171, 180, '180 Guests', 14),
(181, 190, '190 Guests', 15),
(191, 200, '200 Guests', 16),
(201, 210, '210 Guests', 17),
(211, 220, '220 Guests', 18),
(221, 230, '230 Guests', 19),
(231, 240, '240 Guests', 20),
(241, 250, '250 Guests', 21)
ON CONFLICT DO NOTHING;

-- Storage bucket for layout images
INSERT INTO storage.buckets (id, name, public) VALUES ('layout-library', 'layout-library', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read layout images" ON storage.objects
  FOR SELECT USING (bucket_id = 'layout-library');

CREATE POLICY "Admins upload layout images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'layout-library' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins update layout images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'layout-library' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins delete layout images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'layout-library' AND public.is_admin(auth.uid()));
