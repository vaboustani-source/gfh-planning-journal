-- Mood Board: couples collect design inspiration (uploaded photos, pasted Pinterest /
-- Instagram / TikTok / web links, and one connected Pinterest board) per wedding.
-- Staff can approve items and leave notes; a view-only share link goes to vendors.

-- 1. Items
CREATE TABLE IF NOT EXISTS public.moodboard_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('photo', 'link')),
  provider text NOT NULL DEFAULT 'upload' CHECK (provider IN ('upload', 'pinterest', 'instagram', 'tiktok', 'web')),
  image_path text,            -- path in the public "moodboard" bucket (uploads + saved link thumbnails)
  source_url text,            -- original post / page for links
  title text,
  category text NOT NULL DEFAULT 'other',
  note text,                  -- the couple's "what we love about this"
  staff_note text,            -- staff only
  approved boolean NOT NULL DEFAULT false,  -- staff only
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS moodboard_items_event_idx ON public.moodboard_items (event_id, created_at DESC);

-- 2. Per-wedding settings: connected Pinterest board + vendor share token
CREATE TABLE IF NOT EXISTS public.moodboard_settings (
  event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  pinterest_board_url text,
  share_token uuid UNIQUE,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.moodboard_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moodboard_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.moodboard_items, public.moodboard_settings FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.moodboard_items, public.moodboard_settings TO authenticated;

DROP POLICY IF EXISTS "moodboard items staff + members" ON public.moodboard_items;
CREATE POLICY "moodboard items staff + members" ON public.moodboard_items FOR ALL TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_event_member(event_id, auth.uid()))
WITH CHECK (public.is_admin(auth.uid()) OR public.is_event_member(event_id, auth.uid()));

DROP POLICY IF EXISTS "moodboard settings staff + members" ON public.moodboard_settings;
CREATE POLICY "moodboard settings staff + members" ON public.moodboard_settings FOR ALL TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_event_member(event_id, auth.uid()))
WITH CHECK (public.is_admin(auth.uid()) OR public.is_event_member(event_id, auth.uid()));

-- Couples can't approve their own items, write staff notes, or mint a share link.
CREATE OR REPLACE FUNCTION public.moodboard_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  IF auth.uid() IS NULL OR public.is_admin(auth.uid()) THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'moodboard_items' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.staff_note := NULL; NEW.approved := false;
    ELSIF NEW.staff_note IS DISTINCT FROM OLD.staff_note OR NEW.approved IS DISTINCT FROM OLD.approved THEN
      RAISE EXCEPTION 'Only the GFH team can approve items or leave team notes';
    END IF;
  ELSE
    IF TG_OP = 'INSERT' THEN
      NEW.share_token := NULL;
    ELSIF NEW.share_token IS DISTINCT FROM OLD.share_token THEN
      RAISE EXCEPTION 'Only the GFH team can create the vendor share link';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_moodboard_items_guard ON public.moodboard_items;
CREATE TRIGGER trg_moodboard_items_guard BEFORE INSERT OR UPDATE ON public.moodboard_items
FOR EACH ROW EXECUTE FUNCTION public.moodboard_guard();
DROP TRIGGER IF EXISTS trg_moodboard_settings_guard ON public.moodboard_settings;
CREATE TRIGGER trg_moodboard_settings_guard BEFORE INSERT OR UPDATE ON public.moodboard_settings
FOR EACH ROW EXECUTE FUNCTION public.moodboard_guard();

-- 3. Storage. Public bucket with unguessable paths so the vendor share page can show
--    images without a login; only staff + that wedding's members can write.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('moodboard', 'moodboard', true, 15728640,
        ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','image/avif'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "moodboard members insert" ON storage.objects;
CREATE POLICY "moodboard members insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'moodboard' AND (
  public.is_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM public.event_users eu
             WHERE eu.user_id = auth.uid() AND eu.event_id::text = (storage.foldername(name))[1])
));

DROP POLICY IF EXISTS "moodboard members delete" ON storage.objects;
CREATE POLICY "moodboard members delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'moodboard' AND (
  public.is_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM public.event_users eu
             WHERE eu.user_id = auth.uid() AND eu.event_id::text = (storage.foldername(name))[1])
));

-- 4. Vendor share page (no login): everything except team notes.
CREATE OR REPLACE FUNCTION public.get_moodboard_by_token(p_token uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'title', e.title,
    'wedding_date', e.wedding_date,
    'pinterest_board_url', s.pinterest_board_url,
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id, 'kind', i.kind, 'provider', i.provider, 'image_path', i.image_path,
        'source_url', i.source_url, 'title', i.title, 'category', i.category,
        'note', i.note, 'approved', i.approved
      ) ORDER BY i.approved DESC, i.sort_order, i.created_at DESC)
      FROM public.moodboard_items i WHERE i.event_id = e.id
    ), '[]'::jsonb)
  )
  FROM public.moodboard_settings s
  JOIN public.events e ON e.id = s.event_id
  WHERE p_token IS NOT NULL AND s.share_token = p_token
$$;
REVOKE ALL ON FUNCTION public.get_moodboard_by_token(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_moodboard_by_token(uuid) TO anon, authenticated;
