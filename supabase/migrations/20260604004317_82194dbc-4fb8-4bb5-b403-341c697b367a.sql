CREATE TABLE IF NOT EXISTS public.guest_dietary_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id uuid REFERENCES public.guests(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  restriction text NOT NULL,
  restriction_type text,
  severity text,
  applies_to_meals text[] DEFAULT ARRAY['wedding']::text[],
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.guest_dietary_entries TO authenticated;
GRANT ALL ON public.guest_dietary_entries TO service_role;

ALTER TABLE public.guest_dietary_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Event members manage dietary entries"
  ON public.guest_dietary_entries FOR ALL
  USING (public.is_event_member(event_id, auth.uid()))
  WITH CHECK (public.is_event_member(event_id, auth.uid()));

CREATE POLICY "Admins manage all dietary entries"
  ON public.guest_dietary_entries FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS guest_dietary_entries_event_idx ON public.guest_dietary_entries(event_id);
CREATE INDEX IF NOT EXISTS guest_dietary_entries_guest_idx ON public.guest_dietary_entries(guest_id);

CREATE TRIGGER update_guest_dietary_entries_updated_at
  BEFORE UPDATE ON public.guest_dietary_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();