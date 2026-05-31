CREATE TABLE IF NOT EXISTS public.rsvp_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL UNIQUE,
  is_live boolean NOT NULL DEFAULT false,
  rsvp_deadline date,
  public_token text UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  color_primary text NOT NULL DEFAULT '#2C3E2D',
  color_secondary text NOT NULL DEFAULT '#C9A84C',
  color_accent text NOT NULL DEFAULT '#FAF8F4',
  welcome_headline text DEFAULT 'We can''t wait to celebrate with you',
  welcome_message text,
  ask_meal_preference boolean NOT NULL DEFAULT true,
  ask_dietary boolean NOT NULL DEFAULT true,
  ask_song_request boolean NOT NULL DEFAULT false,
  onsite_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  offsite_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  custom_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  conditional_reminders jsonb NOT NULL DEFAULT '[]'::jsonb,
  confirmation_message text DEFAULT 'Thank you for your RSVP. We look forward to celebrating with you.',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.rsvp_config TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rsvp_config TO authenticated;
GRANT ALL ON public.rsvp_config TO service_role;

ALTER TABLE public.rsvp_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read rsvp config"
  ON public.rsvp_config FOR SELECT
  USING (true);

CREATE POLICY "Event members manage rsvp config"
  ON public.rsvp_config FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.event_users WHERE event_id = rsvp_config.event_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.event_users WHERE event_id = rsvp_config.event_id AND user_id = auth.uid()));

CREATE POLICY "Admins manage all rsvp config"
  ON public.rsvp_config FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER update_rsvp_config_updated_at
  BEFORE UPDATE ON public.rsvp_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();