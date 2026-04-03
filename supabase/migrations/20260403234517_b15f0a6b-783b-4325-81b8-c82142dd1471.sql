-- 1. Fix lodging_assignments: couples should only see their own row
DROP POLICY IF EXISTS "Couples see their lodging assignments" ON public.lodging_assignments;

CREATE POLICY "Couples see own lodging assignment"
ON public.lodging_assignments
FOR SELECT
TO authenticated
USING (
  assigned_guest_email = (SELECT email FROM public.users WHERE id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Keep the ALL policy for admins (already exists), but add explicit couple UPDATE for their own row
CREATE POLICY "Couples update own lodging assignment"
ON public.lodging_assignments
FOR UPDATE
TO authenticated
USING (
  assigned_guest_email = (SELECT email FROM public.users WHERE id = auth.uid())
)
WITH CHECK (
  assigned_guest_email = (SELECT email FROM public.users WHERE id = auth.uid())
);

-- 2. Restrict Realtime channel subscriptions for messages
-- Users can only receive realtime events for messages in their own events
ALTER PUBLICATION supabase_realtime SET TABLE public.messages;

CREATE POLICY "Users receive realtime for own event messages"
ON public.messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.event_users
    WHERE event_users.event_id = messages.event_id
      AND event_users.user_id = auth.uid()
  )
  OR public.is_admin(auth.uid())
);