
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS coi_requested boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS coi_requested_at timestamptz;

INSERT INTO public.email_templates (key, name, subject, heading, body, cta_label)
VALUES (
  'coi_request',
  'Certificate of Insurance request',
  'Certificate of Insurance required to work at Gilbertsville Farmhouse',
  'Certificate of Insurance request',
  'Hello {{business_name}},

Thank you for being part of an upcoming celebration at Gilbertsville Farmhouse. Before your team arrives on the estate, we need a current Certificate of Insurance on file. The exact requirements are below.

In order for a third-party vendor to operate on our venue, we require a Certificate of Insurance evidencing the following:
- Commercial General Liability $1,000,000 per occurrence / $2,000,000 aggregate
- Name the "Gilbertsville Farmhouse, Inc. and Sharon & Aldo Boustani", and its officers, employees, agents, and volunteers added as additional insured with respect to specific project/service/event.
- Automobile Liability $1,000,000 CSL (if applicable)

Ask your insurance agent to email the certificate to Experience@gilbertsvillefarmhouse.com. The certificate is due prior to the actual work start date.

If you have any questions, just reply to this note and we will help.',
  NULL
)
ON CONFLICT (key) DO NOTHING;
