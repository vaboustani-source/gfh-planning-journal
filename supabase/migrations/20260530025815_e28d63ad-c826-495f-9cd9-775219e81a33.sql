INSERT INTO storage.buckets (id, name, public)
VALUES ('experience-catalog', 'experience-catalog', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read experience-catalog"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'experience-catalog');

CREATE POLICY "Admins write experience-catalog"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'experience-catalog' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins update experience-catalog"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'experience-catalog' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins delete experience-catalog"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'experience-catalog' AND public.is_admin(auth.uid()));