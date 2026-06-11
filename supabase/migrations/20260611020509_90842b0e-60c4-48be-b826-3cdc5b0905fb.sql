
INSERT INTO public.email_templates (key, name, subject, heading, body, cta_label, variables) VALUES
(
  'notify_admin_messages',
  'Admin: new messages from a couple',
  '{{status_prefix}}[GFH] {{partner_label}} — {{status_suffix}}',
  '{{partner_label}}',
  '{{subline}}',
  'Open Thread',
  'status_prefix (auto: 🔴 for ≤7 days out, 🟡 for ≤30 days out, empty otherwise)
partner_label (auto: couple names, e.g. "Sam & Alex")
status_suffix (auto: e.g. "5 days out", "planning phase", "post-event")
subline (auto: formatted wedding date and days-out summary)
message bubbles (auto: rendered into the email automatically, one block per queued message)'
),
(
  'notify_couple_message',
  'Couple: a single new note from Brandon',
  'A note from Brandon at Gilbertsville',
  'A note from Brandon.',
  'Reply in your Planning Hub — we will see it and respond.',
  'Open the Planning Hub',
  'message (auto: the quoted note from Brandon is rendered into the email automatically)'
),
(
  'notify_couple_messages_batch',
  'Couple: multiple new notes from Brandon (batched)',
  '{{count}} new notes from Brandon at Gilbertsville',
  'A note from Brandon.',
  'Reply in your Planning Hub — we will see it and respond.',
  'Open the Planning Hub',
  'count (auto: number of new notes in the batch)
messages (auto: the quoted notes from Brandon are rendered into the email automatically, one block per note)'
),
(
  'event_handoff_notice',
  'Staff: a wedding has been handed off for planning',
  'New client to onboard: {{event_title}}',
  'A new client is ready for you.',
  '{{handler_name}} has finished the sales setup and handed this wedding over for planning.

When you''ve finished configuring the wedding, click "Open Portal for Client" to invite the couple in.',
  'Open This Wedding',
  'event_title (auto: couple/event title)
handler_name (auto: name of the sales handler who handed off the wedding)
details box (auto: couple, wedding date, and package tier are rendered into the email automatically)'
)
ON CONFLICT (key) DO NOTHING;
