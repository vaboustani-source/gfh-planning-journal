-- RLS policies on storage.objects for the email-attachments bucket.
-- Staff roles (admin, event_director, planner) can upload and read attachments.

CREATE POLICY "email_attachments_staff_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'email-attachments'
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('admin','event_director','planner')
  )
);

CREATE POLICY "email_attachments_staff_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'email-attachments'
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('admin','event_director','planner')
  )
);

CREATE POLICY "email_attachments_staff_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'email-attachments'
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('admin','event_director','planner')
  )
);

CREATE POLICY "email_attachments_staff_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'email-attachments'
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('admin','event_director','planner')
  )
);
