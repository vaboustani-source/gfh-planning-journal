-- Make vendor-contracts bucket public for downloads
UPDATE storage.buckets SET public = true WHERE id = 'vendor-contracts';

-- RLS policies for storage.objects in vendor-contracts bucket
CREATE POLICY "Admins full access vendor contracts"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'vendor-contracts'
  AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  bucket_id = 'vendor-contracts'
  AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Couples can upload to their event vendor contracts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'vendor-contracts'
  AND EXISTS (
    SELECT 1 FROM public.event_users eu
    WHERE eu.user_id = auth.uid()
    AND eu.event_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Couples can view their event vendor contracts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'vendor-contracts'
  AND EXISTS (
    SELECT 1 FROM public.event_users eu
    WHERE eu.user_id = auth.uid()
    AND eu.event_id::text = (storage.foldername(name))[1]
  )
);