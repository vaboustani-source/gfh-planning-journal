
CREATE TABLE public.message_read_state (
  event_user_id uuid PRIMARY KEY REFERENCES public.event_users(id) ON DELETE CASCADE,
  event_id uuid NOT NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX message_read_state_event_id_idx ON public.message_read_state(event_id);

GRANT SELECT, INSERT, UPDATE ON public.message_read_state TO authenticated;
GRANT ALL ON public.message_read_state TO service_role;

ALTER TABLE public.message_read_state ENABLE ROW LEVEL SECURITY;

-- View: any event member can see read state for their event; admins see all
CREATE POLICY "Members can view read state for their events"
ON public.message_read_state
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.event_users eu
    WHERE eu.event_id = message_read_state.event_id
      AND eu.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'admin'
  )
);

-- Insert: only own event_user row
CREATE POLICY "Users can insert their own read state"
ON public.message_read_state
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.event_users eu
    WHERE eu.id = message_read_state.event_user_id
      AND eu.user_id = auth.uid()
      AND eu.event_id = message_read_state.event_id
  )
);

-- Update: only own event_user row
CREATE POLICY "Users can update their own read state"
ON public.message_read_state
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.event_users eu
    WHERE eu.id = message_read_state.event_user_id
      AND eu.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.event_users eu
    WHERE eu.id = message_read_state.event_user_id
      AND eu.user_id = auth.uid()
  )
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_message_read_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_message_read_state_updated_at
BEFORE UPDATE ON public.message_read_state
FOR EACH ROW EXECUTE FUNCTION public.touch_message_read_state_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_read_state;
ALTER TABLE public.message_read_state REPLICA IDENTITY FULL;
