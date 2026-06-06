
CREATE TABLE IF NOT EXISTS public.sales_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL UNIQUE REFERENCES public.events(id) ON DELETE CASCADE,
  stated_budget numeric(12,2),
  original_quote numeric(12,2),
  original_catering_estimate numeric(12,2),
  original_guest_estimate integer,
  lead_source text,
  date_booked date,
  entered_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_details TO authenticated;
GRANT ALL ON public.sales_details TO service_role;

ALTER TABLE public.sales_details ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_sales_viewer(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = _user_id
      AND role IN ('sales_manager','event_director','ceo_owner','admin')
  )
$$;

CREATE POLICY "Sales roles read sales_details"
  ON public.sales_details FOR SELECT TO authenticated
  USING (public.is_sales_viewer(auth.uid()));

CREATE POLICY "Sales roles write sales_details"
  ON public.sales_details FOR ALL TO authenticated
  USING (public.is_sales_viewer(auth.uid()))
  WITH CHECK (public.is_sales_viewer(auth.uid()));

CREATE TRIGGER trg_sales_details_updated
  BEFORE UPDATE ON public.sales_details
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
