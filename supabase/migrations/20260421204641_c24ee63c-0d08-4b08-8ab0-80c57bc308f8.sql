ALTER TABLE public.payment_schedule
  ADD COLUMN IF NOT EXISTS payment_number integer,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'upcoming';

-- Allow line items to also live in non-Décor sections (site_fee, catering) without source rows.
-- The existing financial_line_items table is reused; section now stores the category.
-- Add a couple-readable RLS policy if not present (admins already have one).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='financial_line_items' AND policyname='Couples read line items'
  ) THEN
    CREATE POLICY "Couples read line items" ON public.financial_line_items
      FOR SELECT
      USING (EXISTS (SELECT 1 FROM public.event_users WHERE event_id = financial_line_items.event_id AND user_id = auth.uid()));
  END IF;
END $$;