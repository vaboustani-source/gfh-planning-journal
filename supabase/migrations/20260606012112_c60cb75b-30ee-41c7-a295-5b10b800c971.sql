
ALTER TABLE public.project_emails
  ADD COLUMN IF NOT EXISTS vendor_category text,
  ADD COLUMN IF NOT EXISTS matched_vendor_id uuid,
  ADD COLUMN IF NOT EXISTS matched_vendor_name text;

CREATE INDEX IF NOT EXISTS project_emails_event_category_idx
  ON public.project_emails(event_id, vendor_category);

ALTER TABLE public.email_sender_map
  ADD COLUMN IF NOT EXISTS vendor_id uuid,
  ADD COLUMN IF NOT EXISTS vendor_name text,
  ADD COLUMN IF NOT EXISTS vendor_category text;
