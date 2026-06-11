
CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  subject text NOT NULL,
  heading text,
  body text NOT NULL,
  cta_label text,
  variables text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO authenticated;
GRANT ALL ON public.email_templates TO service_role;

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage email_templates"
  ON public.email_templates
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.email_templates (key, name, subject, heading, body, cta_label, variables) VALUES
(
  'invitation_staff',
  'Invitation: Staff',
  'You''ve been invited to the Gilbertsville Farmhouse team',
  'Welcome.',
  E'{{greeting}}\n\nYou have been invited to join the Gilbertsville Farmhouse Planning Journal team. When you set up your access, you will be able to sign in and begin working alongside us right away.',
  'Set Up Your Access',
  'greeting, invited_name, link'
),
(
  'invitation_couple',
  'Invitation: Couple',
  'Your wedding planning portal is ready',
  'Welcome.',
  E'{{greeting}}\n\nYour private planning portal at Gilbertsville Farmhouse is ready for you. Once you set up your access, you will land directly inside your wedding portal where everything for your weekend lives in one calm place.',
  'Set Up Your Access',
  'greeting, invited_name, link'
),
(
  'invitation_participant',
  'Invitation: Participant',
  '{{inviter_name}} has added you to {{event_title}}',
  'Welcome.',
  E'{{greeting}}\n\nYou have been invited to help with {{event_title}} at Gilbertsville Farmhouse. Setting up your access takes about a minute, then you will land directly inside the parts of the portal that are yours to help with.',
  'Set Up Your Access',
  'greeting, invited_name, inviter_name, event_title, link'
),
(
  'contract_signed_receipt',
  'Contract Signed Receipt',
  'Signature receipt: {{contract_title}}',
  'Signature Confirmed',
  E'Dear {{signer_name}},\n\nThis is your receipt for the agreement you just signed: {{contract_title}}.\n\nSigned on {{signed_date}}.\n\nA copy is saved in your portal under Agreements for your records. If anything looks incorrect, please reply to this email right away.',
  NULL,
  'signer_name, contract_title, signed_date'
);
