-- Allow couples to delete vendors linked to their event
CREATE POLICY "Couples can delete vendors"
ON public.vendors FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM event_users
    WHERE event_users.event_id = vendors.event_id
    AND event_users.user_id = auth.uid()
  )
);

-- Allow couples to upload files to vendor-contracts bucket scoped to their event folder
CREATE POLICY "Couples upload vendor files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'vendor-contracts'
  AND EXISTS (
    SELECT 1 FROM public.event_users
    WHERE event_users.event_id::text = (storage.foldername(name))[1]
    AND event_users.user_id = auth.uid()
  )
);