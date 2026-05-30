CREATE TABLE IF NOT EXISTS public.guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text,
  rsvp_status text DEFAULT 'invited' CHECK (rsvp_status IN ('invited','confirmed','declined','maybe')),
  side text CHECK (side IN ('partner_1','partner_2','both','other')),
  relationship text CHECK (relationship IN ('immediate_family','extended_family','wedding_party','friend','coworker','other')),
  is_plus_one boolean DEFAULT false,
  plus_one_of uuid REFERENCES public.guests(id) ON DELETE SET NULL,
  lodging_preference text CHECK (lodging_preference IN ('on_site','off_site','undecided')) DEFAULT 'undecided',
  dietary_restrictions text[],
  meal_preference text,
  notes text,
  added_by text DEFAULT 'couple',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.guests TO authenticated;
GRANT ALL ON public.guests TO service_role;

ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Event members manage guests" ON public.guests
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.event_users WHERE event_id = guests.event_id AND user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.event_users WHERE event_id = guests.event_id AND user_id = auth.uid())
);

CREATE POLICY "Admins manage all guests" ON public.guests
FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_guests_event ON public.guests(event_id);

CREATE TRIGGER update_guests_updated_at
BEFORE UPDATE ON public.guests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();