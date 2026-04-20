-- 1. Drop legacy decor_items table
DROP TABLE IF EXISTS public.decor_items CASCADE;

-- 2. Add decor_notes to events
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS decor_notes text;

-- 3. Create financial_line_items table
CREATE TABLE IF NOT EXISTS public.financial_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  section text NOT NULL,
  source_table text,
  source_id uuid,
  label text NOT NULL,
  quantity integer DEFAULT 1,
  unit_price numeric DEFAULT 0,
  total numeric GENERATED ALWAYS AS (COALESCE(quantity,1) * COALESCE(unit_price,0)) STORED,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fli_event ON public.financial_line_items(event_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fli_source ON public.financial_line_items(source_table, source_id) WHERE source_id IS NOT NULL;

ALTER TABLE public.financial_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage line items" ON public.financial_line_items
  FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "Event members manage line items" ON public.financial_line_items
  FOR ALL USING (EXISTS (SELECT 1 FROM event_users WHERE event_id = financial_line_items.event_id AND user_id = auth.uid()));

CREATE TRIGGER fli_updated_at BEFORE UPDATE ON public.financial_line_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Trigger: sync decor_selections to financial_line_items
CREATE OR REPLACE FUNCTION public.sync_decor_to_financials()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_title text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.financial_line_items
    WHERE source_table = 'decor_selections' AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  SELECT title INTO v_title FROM public.decor_catalog WHERE id = NEW.catalog_item_id;

  INSERT INTO public.financial_line_items (event_id, section, source_table, source_id, label, quantity, unit_price)
  VALUES (NEW.event_id, 'Décor Rentals', 'decor_selections', NEW.id, COALESCE(v_title, 'Décor item'), NEW.quantity, NEW.unit_price)
  ON CONFLICT (source_table, source_id) DO UPDATE
    SET label = EXCLUDED.label, quantity = EXCLUDED.quantity, unit_price = EXCLUDED.unit_price, updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_decor_fli ON public.decor_selections;
CREATE TRIGGER trg_sync_decor_fli
AFTER INSERT OR UPDATE OR DELETE ON public.decor_selections
FOR EACH ROW EXECUTE FUNCTION public.sync_decor_to_financials();

-- 5. Storage bucket: public decor-catalog
INSERT INTO storage.buckets (id, name, public) VALUES ('decor-catalog', 'decor-catalog', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Public can view decor catalog photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'decor-catalog');

CREATE POLICY "Admins manage decor catalog photos" ON storage.objects
  FOR ALL USING (bucket_id = 'decor-catalog' AND is_admin(auth.uid()))
  WITH CHECK (bucket_id = 'decor-catalog' AND is_admin(auth.uid()));