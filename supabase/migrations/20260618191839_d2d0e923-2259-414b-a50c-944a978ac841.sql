
DROP POLICY IF EXISTS "Admins have full access to bar selections" ON public.bar_selections;
CREATE POLICY "Admins have full access to bar selections" ON public.bar_selections
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins have full access to ceremony_details" ON public.ceremony_details;
CREATE POLICY "Admins have full access to ceremony_details" ON public.ceremony_details
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins have full access to checklist_items" ON public.checklist_items;
CREATE POLICY "Admins have full access to checklist_items" ON public.checklist_items
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins see shared notes only" ON public.couple_notes;
CREATE POLICY "Admins see shared notes only" ON public.couple_notes
  FOR SELECT USING (public.is_admin(auth.uid()) AND shared_with_brandon = true);

DROP POLICY IF EXISTS "Admins delete decor catalog" ON public.decor_catalog;
DROP POLICY IF EXISTS "Admins insert decor catalog" ON public.decor_catalog;
DROP POLICY IF EXISTS "Admins update decor catalog" ON public.decor_catalog;
CREATE POLICY "Admins delete decor catalog" ON public.decor_catalog
  FOR DELETE USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins insert decor catalog" ON public.decor_catalog
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins update decor catalog" ON public.decor_catalog
  FOR UPDATE USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins have full access to dietary restrictions" ON public.dietary_restrictions;
CREATE POLICY "Admins have full access to dietary restrictions" ON public.dietary_restrictions
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins have full access to documents" ON public.documents;
CREATE POLICY "Admins have full access to documents" ON public.documents
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins have full access to event_addons" ON public.event_addons;
CREATE POLICY "Admins have full access to event_addons" ON public.event_addons
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins have full access to event_users" ON public.event_users;
CREATE POLICY "Admins have full access to event_users" ON public.event_users
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins have full access to events" ON public.events;
CREATE POLICY "Admins have full access to events" ON public.events
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins have full access to financials" ON public.financials;
CREATE POLICY "Admins have full access to financials" ON public.financials
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins manage form assignments" ON public.form_assignments;
CREATE POLICY "Admins manage form assignments" ON public.form_assignments
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins read all responses" ON public.form_responses;
CREATE POLICY "Admins read all responses" ON public.form_responses
  FOR SELECT USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins manage forms" ON public.forms;
CREATE POLICY "Admins manage forms" ON public.forms
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins manage all invitations" ON public.invitations;
CREATE POLICY "Admins manage all invitations" ON public.invitations
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins have full access to lodging_assignments" ON public.lodging_assignments;
CREATE POLICY "Admins have full access to lodging_assignments" ON public.lodging_assignments
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins have full access to lodging_rooms" ON public.lodging_rooms;
CREATE POLICY "Admins have full access to lodging_rooms" ON public.lodging_rooms
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins have full access to meal_events" ON public.meal_events;
CREATE POLICY "Admins have full access to meal_events" ON public.meal_events
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins have full access to menu_finalization" ON public.menu_finalization;
CREATE POLICY "Admins have full access to menu_finalization" ON public.menu_finalization
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can read message_notification_queue" ON public.message_notification_queue;
CREATE POLICY "Admins can read message_notification_queue" ON public.message_notification_queue
  FOR SELECT USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins have full access to messages" ON public.messages;
DROP POLICY IF EXISTS "Admins can read all messages" ON public.messages;
DROP POLICY IF EXISTS "Admins can insert messages" ON public.messages;
CREATE POLICY "Admins have full access to messages" ON public.messages
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can read all messages" ON public.messages
  FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can insert messages" ON public.messages
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins have full access to milestones" ON public.milestones;
CREATE POLICY "Admins have full access to milestones" ON public.milestones
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins have full access to notification_log" ON public.notification_log;
CREATE POLICY "Admins have full access to notification_log" ON public.notification_log
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins manage offsite hotels" ON public.offsite_hotels;
CREATE POLICY "Admins manage offsite hotels" ON public.offsite_hotels
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins have full access to payment_schedule" ON public.payment_schedule;
CREATE POLICY "Admins have full access to payment_schedule" ON public.payment_schedule
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins have full access to vendors" ON public.vendors;
CREATE POLICY "Admins have full access to vendors" ON public.vendors
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins have full access to working_timeline" ON public.working_timeline;
CREATE POLICY "Admins have full access to working_timeline" ON public.working_timeline
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
