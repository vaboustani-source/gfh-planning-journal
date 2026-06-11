
-- scheduled_emails: config rows
CREATE TABLE public.scheduled_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  anchor text NOT NULL CHECK (anchor IN ('wedding_date','due_date')),
  direction text NOT NULL CHECK (direction IN ('before','after')),
  offset_days int[] NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_emails TO authenticated;
GRANT ALL ON public.scheduled_emails TO service_role;
ALTER TABLE public.scheduled_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage scheduled_emails" ON public.scheduled_emails
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER scheduled_emails_updated_at BEFORE UPDATE ON public.scheduled_emails
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- scheduled_email_log: dedup log
CREATE TABLE public.scheduled_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  target_id uuid NOT NULL,
  marker text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (key, target_id, marker)
);
GRANT SELECT ON public.scheduled_email_log TO authenticated;
GRANT ALL ON public.scheduled_email_log TO service_role;
ALTER TABLE public.scheduled_email_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read scheduled_email_log" ON public.scheduled_email_log
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- Seed scheduled email configs (all disabled)
INSERT INTO public.scheduled_emails (key, name, enabled, anchor, direction, offset_days, description) VALUES
  ('payment_reminder', 'Payment reminder', false, 'due_date', 'before', ARRAY[7],
    'Sent to the couple a set number of days before an unpaid installment is due.'),
  ('wedding_countdown', 'Wedding countdown', false, 'wedding_date', 'before', ARRAY[60,30],
    'Warm check-in sent to the couple as their wedding approaches.'),
  ('post_wedding_thankyou', 'Post-wedding thank you', false, 'wedding_date', 'after', ARRAY[3],
    'Note of thanks sent to the couple a few days after the wedding.');

-- Seed email_templates wording rows
INSERT INTO public.email_templates (key, name, subject, heading, body, cta_label, variables) VALUES
  ('payment_reminder',
    'Payment reminder',
    'A friendly note about your upcoming payment',
    'A friendly reminder.',
    'Hello {{couple_names}},

This is a friendly reminder that your next payment of {{amount}} is scheduled for {{due_date}}.

You can review the full schedule and submit your payment from your Planning Hub. If anything has changed on your end, just reply to this note and we will take care of it together.',
    'Open Your Planning Hub',
    'couple_names, amount, due_date, portal_link'),
  ('wedding_countdown',
    'Wedding countdown',
    'Your wedding at Gilbertsville Farmhouse is {{days_out}} days away',
    'The day is getting close.',
    'Hello {{couple_names}},

We wanted to send a quick note: your wedding on {{wedding_date}} is just {{days_out}} days away. We have been thinking about your weekend and looking forward to welcoming you to the estate.

If anything is sitting on your mind, the Planning Hub is the best place to capture it so we can move on it together.',
    'Open Your Planning Hub',
    'couple_names, days_out, wedding_date, portal_link'),
  ('post_wedding_thankyou',
    'Post-wedding thank you',
    'Thank you for celebrating with us at Gilbertsville',
    'Thank you.',
    'Hello {{couple_names}},

We are still smiling from your weekend at Gilbertsville Farmhouse. Thank you for trusting us with such an important chapter, and for the care you brought to every detail.

Your Planning Hub will stay open for a while so you can revisit notes, vendor contacts, and photos as they come in. If there is anything we can help wrap up, just reply to this note.',
    'Open Your Planning Hub',
    'couple_names, wedding_date, portal_link');
