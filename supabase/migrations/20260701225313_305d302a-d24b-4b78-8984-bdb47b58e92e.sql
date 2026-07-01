
-- Add is_active to lodging_sections (additive)
ALTER TABLE public.lodging_sections
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Create offsite_accommodations table
CREATE TABLE IF NOT EXISTS public.offsite_accommodations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  drive_time text,
  phone text,
  website_url text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.offsite_accommodations TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.offsite_accommodations TO authenticated;
GRANT ALL ON public.offsite_accommodations TO service_role;

ALTER TABLE public.offsite_accommodations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Any authenticated can read offsite_accommodations"
  ON public.offsite_accommodations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Internal staff can insert offsite_accommodations"
  ON public.offsite_accommodations FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_staff(auth.uid()));

CREATE POLICY "Internal staff can update offsite_accommodations"
  ON public.offsite_accommodations FOR UPDATE TO authenticated
  USING (public.is_internal_staff(auth.uid()))
  WITH CHECK (public.is_internal_staff(auth.uid()));

CREATE POLICY "Internal staff can delete offsite_accommodations"
  ON public.offsite_accommodations FOR DELETE TO authenticated
  USING (public.is_internal_staff(auth.uid()));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_offsite_accommodations_updated_at ON public.offsite_accommodations;
CREATE TRIGGER trg_offsite_accommodations_updated_at
  BEFORE UPDATE ON public.offsite_accommodations
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

DROP TRIGGER IF EXISTS trg_lodging_sections_updated_at ON public.lodging_sections;
CREATE TRIGGER trg_lodging_sections_updated_at
  BEFORE UPDATE ON public.lodging_sections
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
