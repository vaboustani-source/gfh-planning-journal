
CREATE POLICY "Authenticated can read lodging maps"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'lodging-maps');

CREATE POLICY "Admins can upload lodging maps"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'lodging-maps'
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update lodging maps"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'lodging-maps'
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete lodging maps"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'lodging-maps'
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
