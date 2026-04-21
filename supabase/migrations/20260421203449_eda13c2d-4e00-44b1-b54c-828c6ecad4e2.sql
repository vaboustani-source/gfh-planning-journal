-- Admins can fully manage notes (needed so Brandon can create his own internal notes)
CREATE POLICY "Admins manage all notes"
ON public.couple_notes
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));