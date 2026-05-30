-- Catalog table
CREATE TABLE IF NOT EXISTS public.experience_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL CHECK (category IN (
    'friday_experiences',
    'saturday_addons',
    'rehearsal_dinner_themes',
    'amenity_upgrades'
  )),
  description text,
  photo_url text,
  pricing_type text CHECK (pricing_type IN (
    'flat', 'per_person', 'per_hour', 'tiered', 'custom_quote'
  )),
  pricing_config jsonb,
  pricing_visible_to_couple boolean DEFAULT false,
  requires_discussion boolean DEFAULT true,
  available boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

GRANT SELECT ON public.experience_catalog TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.experience_catalog TO authenticated;
GRANT ALL ON public.experience_catalog TO service_role;

ALTER TABLE public.experience_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read experience catalog"
  ON public.experience_catalog FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage experience catalog"
  ON public.experience_catalog FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER experience_catalog_updated_at
  BEFORE UPDATE ON public.experience_catalog
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Requests table
CREATE TABLE IF NOT EXISTS public.experience_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  catalog_item_id uuid REFERENCES public.experience_catalog(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN (
    'requested', 'under_review', 'approved', 'declined', 'cancelled'
  )),
  guest_count integer,
  preferred_day text,
  hours numeric,
  selected_tier text,
  couple_notes text,
  brandon_notes text,
  decline_reason text,
  final_price numeric(10,2),
  final_price_label text,
  approved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.experience_requests TO authenticated;
GRANT ALL ON public.experience_requests TO service_role;

ALTER TABLE public.experience_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Event members read requests"
  ON public.experience_requests FOR SELECT
  TO authenticated
  USING (public.is_event_member(event_id, auth.uid()) OR public.is_admin(auth.uid()));

CREATE POLICY "Event members insert requests"
  ON public.experience_requests FOR INSERT
  TO authenticated
  WITH CHECK (public.is_event_member(event_id, auth.uid()) OR public.is_admin(auth.uid()));

CREATE POLICY "Event members update requests"
  ON public.experience_requests FOR UPDATE
  TO authenticated
  USING (public.is_event_member(event_id, auth.uid()) OR public.is_admin(auth.uid()))
  WITH CHECK (public.is_event_member(event_id, auth.uid()) OR public.is_admin(auth.uid()));

CREATE POLICY "Admins delete requests"
  ON public.experience_requests FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER experience_requests_updated_at
  BEFORE UPDATE ON public.experience_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS experience_requests_event_id_idx ON public.experience_requests(event_id);
CREATE INDEX IF NOT EXISTS experience_catalog_category_idx ON public.experience_catalog(category, sort_order);

-- Auto sync approved request -> financial_line_items
CREATE OR REPLACE FUNCTION public.sync_experience_to_financials()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.financial_line_items
      WHERE source_table = 'experience_requests' AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  IF NEW.status = 'approved' AND NEW.final_price IS NOT NULL THEN
    SELECT title INTO v_title FROM public.experience_catalog WHERE id = NEW.catalog_item_id;
    INSERT INTO public.financial_line_items (event_id, section, source_table, source_id, label, quantity, unit_price)
    VALUES (
      NEW.event_id,
      'Site Fee',
      'experience_requests',
      NEW.id,
      COALESCE(v_title, 'Experience') || COALESCE(' — ' || NEW.final_price_label, ''),
      1,
      NEW.final_price
    )
    ON CONFLICT (source_table, source_id) DO UPDATE
      SET label = EXCLUDED.label,
          unit_price = EXCLUDED.unit_price,
          updated_at = now();
  ELSE
    DELETE FROM public.financial_line_items
      WHERE source_table = 'experience_requests' AND source_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER experience_requests_to_financials
  AFTER INSERT OR UPDATE OR DELETE ON public.experience_requests
  FOR EACH ROW EXECUTE FUNCTION public.sync_experience_to_financials();

-- Seed catalog (no pricing)
INSERT INTO public.experience_catalog (category, title, requires_discussion, sort_order) VALUES
  ('friday_experiences', 'Goat Yoga', false, 1),
  ('friday_experiences', 'Fireworks', true, 2),
  ('friday_experiences', 'Yoga Class', false, 3),
  ('friday_experiences', 'Moonlight Cinema', false, 4),
  ('friday_experiences', 'Beer Burro', false, 5),
  ('friday_experiences', 'Sound Bath', true, 6),
  ('friday_experiences', 'Cooking Class', true, 7),
  ('friday_experiences', 'Live Musician at Bonfire', true, 8),
  ('friday_experiences', 'Flower Market Experience', true, 9),
  ('friday_experiences', 'Archery', true, 10),
  ('friday_experiences', 'Foraging Class', true, 11),
  ('saturday_addons', 'Mimosa Bar for Getting Ready', false, 20),
  ('saturday_addons', 'Craft Beer Bar for Getting Ready', false, 21),
  ('saturday_addons', 'Lawn Games & Bathroom Baskets', false, 22),
  ('saturday_addons', 'Content Creator', true, 23),
  ('saturday_addons', 'Cigar Bar Display', false, 24),
  ('saturday_addons', 'Scotch / Bourbon Bar', false, 25),
  ('saturday_addons', 'Fireworks', true, 26),
  ('saturday_addons', 'Silent Disco After Party', true, 27),
  ('saturday_addons', 'After-Party Extension & Room Rental', true, 28),
  ('rehearsal_dinner_themes', 'Picnic', true, 30),
  ('rehearsal_dinner_themes', 'Farmers Market', true, 31),
  ('rehearsal_dinner_themes', 'Western', true, 32),
  ('amenity_upgrades', 'Turndown Service', true, 40)
ON CONFLICT DO NOTHING;