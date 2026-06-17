
-- PHASE A
ALTER TABLE public.builder_selections
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS builder_selections_event_id_idx ON public.builder_selections(event_id);

ALTER TABLE public.couple_selections
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS couple_selections_event_id_idx ON public.couple_selections(event_id);

WITH resolved AS (
  SELECT DISTINCT ON (c.id) c.id AS couple_id, eu.event_id
  FROM public.couples c
  JOIN public.event_users eu ON eu.user_id = c.user_id
  WHERE eu.role_in_event IN ('couple','partner1','partner2')
    AND eu.event_id IS NOT NULL
  ORDER BY c.id, eu.id DESC
)
UPDATE public.builder_selections bs
   SET event_id = r.event_id
  FROM resolved r
 WHERE bs.couple_id = r.couple_id AND bs.event_id IS NULL;

WITH resolved AS (
  SELECT DISTINCT ON (c.id) c.id AS couple_id, eu.event_id
  FROM public.couples c
  JOIN public.event_users eu ON eu.user_id = c.user_id
  WHERE eu.role_in_event IN ('couple','partner1','partner2')
    AND eu.event_id IS NOT NULL
  ORDER BY c.id, eu.id DESC
)
UPDATE public.couple_selections cs
   SET event_id = r.event_id
  FROM resolved r
 WHERE cs.couple_id = r.couple_id AND cs.event_id IS NULL;

-- PHASE B
CREATE TABLE IF NOT EXISTS public.menu_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL UNIQUE REFERENCES public.events(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started','submitted','under_review','approved','declined')),
  final_price numeric,
  final_price_label text,
  admin_notes text,
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_approvals TO authenticated;
GRANT ALL ON public.menu_approvals TO service_role;

ALTER TABLE public.menu_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Event members read menu_approvals"
  ON public.menu_approvals FOR SELECT
  USING (public.is_event_member(event_id, auth.uid()) OR public.is_admin(auth.uid()));

CREATE POLICY "Event members insert menu_approvals"
  ON public.menu_approvals FOR INSERT
  WITH CHECK (public.is_event_member(event_id, auth.uid()) OR public.is_admin(auth.uid()));

CREATE POLICY "Event members update menu_approvals"
  ON public.menu_approvals FOR UPDATE
  USING (public.is_event_member(event_id, auth.uid()) OR public.is_admin(auth.uid()))
  WITH CHECK (public.is_event_member(event_id, auth.uid()) OR public.is_admin(auth.uid()));

CREATE POLICY "Admins delete menu_approvals"
  ON public.menu_approvals FOR DELETE
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER menu_approvals_updated_at
  BEFORE UPDATE ON public.menu_approvals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.sync_builder_submission_to_menu_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'submitted' AND NEW.event_id IS NOT NULL THEN
    INSERT INTO public.menu_approvals (event_id, status, submitted_at)
    VALUES (NEW.event_id, 'submitted', now())
    ON CONFLICT (event_id) DO UPDATE
      SET status = CASE
            WHEN public.menu_approvals.status = 'approved' THEN public.menu_approvals.status
            ELSE 'submitted'
          END,
          submitted_at = now(),
          updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER builder_selections_to_menu_approval
  AFTER INSERT OR UPDATE OF status, event_id ON public.builder_selections
  FOR EACH ROW EXECUTE FUNCTION public.sync_builder_submission_to_menu_approval();

-- PHASE C
CREATE OR REPLACE FUNCTION public.sync_menu_to_financials()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.financial_line_items
      WHERE source_table = 'menu_approvals' AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  IF NEW.status = 'approved' AND NEW.final_price IS NOT NULL THEN
    INSERT INTO public.financial_line_items (event_id, section, source_table, source_id, label, quantity, unit_price)
    VALUES (
      NEW.event_id,
      'catering',
      'menu_approvals',
      NEW.id,
      CASE
        WHEN NEW.final_price_label IS NULL OR NEW.final_price_label = '' THEN 'Catering'
        ELSE 'Catering (' || NEW.final_price_label || ')'
      END,
      1,
      NEW.final_price
    )
    ON CONFLICT (source_table, source_id) DO UPDATE
      SET label = EXCLUDED.label,
          unit_price = EXCLUDED.unit_price,
          updated_at = now();
  ELSE
    DELETE FROM public.financial_line_items
      WHERE source_table = 'menu_approvals' AND source_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER menu_approvals_to_financials
  AFTER INSERT OR UPDATE OR DELETE ON public.menu_approvals
  FOR EACH ROW EXECUTE FUNCTION public.sync_menu_to_financials();
