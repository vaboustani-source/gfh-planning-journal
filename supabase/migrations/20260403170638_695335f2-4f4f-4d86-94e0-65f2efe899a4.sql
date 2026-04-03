
-- Create message notification queue table
CREATE TABLE public.message_notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  recipient_email text NOT NULL,
  recipient_role text NOT NULL CHECK (recipient_role IN ('admin', 'couple')),
  messages_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  scheduled_send_at timestamptz NOT NULL,
  sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.message_notification_queue ENABLE ROW LEVEL SECURITY;

-- Only admins can read
CREATE POLICY "Admins can read message_notification_queue"
  ON public.message_notification_queue
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'
  ));

-- Service role handles insert/update (no authenticated user policy needed for writes)

-- Create unique index for upsert logic
CREATE UNIQUE INDEX idx_queue_event_recipient_unsent 
  ON public.message_notification_queue (event_id, recipient_email) 
  WHERE sent = false;
