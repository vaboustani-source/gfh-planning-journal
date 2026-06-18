
-- vendor-contracts: drop the overly broad INSERT policy
DROP POLICY IF EXISTS "Authenticated users can upload vendor contracts" ON storage.objects;

-- seating-layouts: drop the 3 unscoped write policies
DROP POLICY IF EXISTS "Authenticated upload seating layouts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update seating layouts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete seating layouts" ON storage.objects;

-- seating-layouts: event-scoped INSERT (admins OR members of event whose id matches first folder segment)
CREATE POLICY "Event members upload seating layouts"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'seating-layouts'
  AND (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.event_users eu
      WHERE eu.user_id = auth.uid()
        AND eu.event_id::text = (storage.foldername(name))[1]
    )
  )
);

-- seating-layouts: event-scoped UPDATE
CREATE POLICY "Event members update seating layouts"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'seating-layouts'
  AND (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.event_users eu
      WHERE eu.user_id = auth.uid()
        AND eu.event_id::text = (storage.foldername(name))[1]
    )
  )
)
WITH CHECK (
  bucket_id = 'seating-layouts'
  AND (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.event_users eu
      WHERE eu.user_id = auth.uid()
        AND eu.event_id::text = (storage.foldername(name))[1]
    )
  )
);

-- seating-layouts: event-scoped DELETE
CREATE POLICY "Event members delete seating layouts"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'seating-layouts'
  AND (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.event_users eu
      WHERE eu.user_id = auth.uid()
        AND eu.event_id::text = (storage.foldername(name))[1]
    )
  )
);
