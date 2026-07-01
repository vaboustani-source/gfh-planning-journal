
CREATE TABLE IF NOT EXISTS public.vendor_checkin_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  gmail_message_id text,
  gmail_thread_id text,
  raw_text text,
  headcount int,
  attendee_names text[],
  at_dinner boolean,
  dietary_allergens text,
  setup_needs text,
  arrival text,
  departure text,
  parse_confidence numeric,
  needs_review boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'parsed',
  parsed_at timestamptz DEFAULT now(),
  confirmed_by uuid,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS vendor_checkin_responses_gmail_message_id_key
  ON public.vendor_checkin_responses(gmail_message_id)
  WHERE gmail_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS vendor_checkin_responses_event_id_idx ON public.vendor_checkin_responses(event_id);
CREATE INDEX IF NOT EXISTS vendor_checkin_responses_vendor_id_idx ON public.vendor_checkin_responses(vendor_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_checkin_responses TO authenticated;
GRANT ALL ON public.vendor_checkin_responses TO service_role;

ALTER TABLE public.vendor_checkin_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal staff can read checkin responses" ON public.vendor_checkin_responses;
CREATE POLICY "Internal staff can read checkin responses"
  ON public.vendor_checkin_responses FOR SELECT
  TO authenticated
  USING (public.is_internal_staff(auth.uid()));

DROP POLICY IF EXISTS "Internal staff can insert checkin responses" ON public.vendor_checkin_responses;
CREATE POLICY "Internal staff can insert checkin responses"
  ON public.vendor_checkin_responses FOR INSERT
  TO authenticated
  WITH CHECK (public.is_internal_staff(auth.uid()));

DROP POLICY IF EXISTS "Internal staff can update checkin responses" ON public.vendor_checkin_responses;
CREATE POLICY "Internal staff can update checkin responses"
  ON public.vendor_checkin_responses FOR UPDATE
  TO authenticated
  USING (public.is_internal_staff(auth.uid()))
  WITH CHECK (public.is_internal_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_vendor_checkin_responses_updated_at ON public.vendor_checkin_responses;
CREATE TRIGGER update_vendor_checkin_responses_updated_at
  BEFORE UPDATE ON public.vendor_checkin_responses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS checkin_replied_at timestamptz;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS checkin_parsed_at timestamptz;

CREATE INDEX IF NOT EXISTS events_checkin_code_idx ON public.events(checkin_code) WHERE checkin_code IS NOT NULL;
