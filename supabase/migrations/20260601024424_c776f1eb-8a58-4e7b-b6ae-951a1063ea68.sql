
-- Add new columns to guests for accessibility flags
ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS needs_wheelchair boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS needs_assistance boolean NOT NULL DEFAULT false;

-- Extend seating_tables with new fields
ALTER TABLE public.seating_tables
  ADD COLUMN IF NOT EXISTS table_number integer,
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS seat_count integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '#2C3E2D';

-- Extend seating_assignments with guest_id FK
ALTER TABLE public.seating_assignments
  ADD COLUMN IF NOT EXISTS guest_id uuid REFERENCES public.guests(id) ON DELETE CASCADE;

ALTER TABLE public.seating_assignments
  ALTER COLUMN guest_name DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS seating_assignments_guest_unique
  ON public.seating_assignments(event_id, guest_id) WHERE guest_id IS NOT NULL;

-- New seating_config table
CREATE TABLE IF NOT EXISTS public.seating_config (
  event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  layout_image_url text,
  table_count integer NOT NULL DEFAULT 0,
  seating_mode text NOT NULL DEFAULT 'table_only' CHECK (seating_mode IN ('table_only','individual_seats')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.seating_config TO authenticated;
GRANT ALL ON public.seating_config TO service_role;

ALTER TABLE public.seating_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage seating config"
  ON public.seating_config FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Event members manage seating config"
  ON public.seating_config FOR ALL
  TO authenticated
  USING (public.is_event_member(event_id, auth.uid()))
  WITH CHECK (public.is_event_member(event_id, auth.uid()));

CREATE TRIGGER trg_seating_config_updated
  BEFORE UPDATE ON public.seating_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for floor plans
INSERT INTO storage.buckets (id, name, public)
VALUES ('seating-layouts', 'seating-layouts', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read seating layouts"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'seating-layouts');

CREATE POLICY "Authenticated upload seating layouts"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'seating-layouts');

CREATE POLICY "Authenticated update seating layouts"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'seating-layouts');

CREATE POLICY "Authenticated delete seating layouts"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'seating-layouts');
