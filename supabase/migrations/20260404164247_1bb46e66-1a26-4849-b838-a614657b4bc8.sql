-- Couples need to see ALL lodging assignments for their event (not just their own email)
CREATE POLICY "Couples see all event lodging assignments"
ON public.lodging_assignments
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM event_users
    WHERE event_users.event_id = lodging_assignments.event_id
    AND event_users.user_id = auth.uid()
  )
);