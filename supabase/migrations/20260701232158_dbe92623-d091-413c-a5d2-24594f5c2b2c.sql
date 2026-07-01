
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS checkin_code text;

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS checkin_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checkin_sent_at timestamptz;

INSERT INTO public.email_templates (key, name, subject, heading, body, cta_label, variables)
VALUES (
  'vendor_checkin',
  'Vendor Check-In',
  'GFH Vendor Check-In — {{couple_names}} [VCK-{{checkin_code}}]',
  'Vendor Check-In',
  'Hey {{vendor_contact_first_name}},

I am reaching out as the Event Director for Gilbertsville Farmhouse to coordinate the wedding of {{couple_names}}. You are listed as their {{vendor_role}} for the event. I wanted to check in with you on a few items below to make sure we are on the same page. My direct cell is {{event_director_cell}}, text or call me any time on the day of.

Please reply to this email with the following, and see the attached weekend timeline ({{timeline_link}}):

- How many people will be coming, and their names?
- If you will be here during dinner service on either day, does anyone have a dietary restriction or allergen?
- Do you need anything set up by our team?
- What time will you be arriving and leaving? (If more than the wedding day, let me know those days too.)
- Feel free to text me in the days before the event to confirm you are all set.

Any questions or concerns, let us work them out ahead of time so the day is smooth. Thank you, can not wait to see you!

{{event_director_name}}',
  NULL,
  'vendor_contact_first_name, vendor_role, couple_names, event_director_name, event_director_cell, timeline_link, checkin_code'
)
ON CONFLICT (key) DO NOTHING;
