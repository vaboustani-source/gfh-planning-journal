DROP POLICY IF EXISTS "Admins full access vendor contracts" ON storage.objects;
CREATE POLICY "Admins full access vendor contracts" ON storage.objects FOR ALL
USING (bucket_id = 'vendor-contracts' AND public.is_admin(auth.uid()))
WITH CHECK (bucket_id = 'vendor-contracts' AND public.is_admin(auth.uid()));