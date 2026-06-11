
CREATE TABLE public.menu_finalization (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL UNIQUE REFERENCES public.events(id) ON DELETE CASCADE,
  finalized boolean NOT NULL DEFAULT false,
  finalized_at timestamptz,
  finalized_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_finalization TO authenticated;
GRANT ALL ON public.menu_finalization TO service_role;

ALTER TABLE public.menu_finalization ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access to menu_finalization"
  ON public.menu_finalization FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

CREATE POLICY "Couples manage their menu finalization"
  ON public.menu_finalization FOR ALL
  USING (EXISTS (SELECT 1 FROM event_users WHERE event_users.event_id = menu_finalization.event_id AND event_users.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM event_users WHERE event_users.event_id = menu_finalization.event_id AND event_users.user_id = auth.uid()));

CREATE TRIGGER update_menu_finalization_updated_at
  BEFORE UPDATE ON public.menu_finalization
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.scheduled_emails (key, name, description, enabled, anchor, direction, offset_days)
VALUES (
  'nudge_menu',
  'Nudge: Menus not finalized',
  'Gentle reminder to couples who have not finalized their Menus and Meals area yet. Sends at the configured offsets before the wedding date when the menu finalization flag is not set.',
  false,
  'wedding_date',
  'before',
  ARRAY[45]
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.email_templates (key, name, subject, heading, body, cta_label, variables)
VALUES (
  'nudge_menu',
  'Nudge: Menus not finalized',
  'A gentle nudge about your menu and meal choices',
  'Your menu is waiting for the final touch.',
  E'Hello {{couple_names}},\n\nYour Menus and Meals area at Gilbertsville Farmhouse has not been finalized yet. With {{days_out}} days to go until your wedding on {{wedding_date}}, this is a lovely moment to look it over together and lock in your choices.\n\nThe Menus and Meals section in your Planning Hub gathers everything in one place: meal preferences, headcounts, dietary needs, and bar selections. You can step through each tab at your own pace, save as you go, and then mark the whole area finalized when it feels right. There is still plenty of time, and nothing needs to be perfect on the first pass.\n\nIf any question is making it feel harder than it should, reply to this note and we will walk through it with you.',
  'Open Your Menu',
  ARRAY['couple_names','days_out','wedding_date','portal_link']
)
ON CONFLICT (key) DO NOTHING;
