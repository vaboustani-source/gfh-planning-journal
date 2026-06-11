
CREATE TABLE public.event_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL UNIQUE REFERENCES public.events(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  target_amount numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_budgets TO authenticated;
GRANT ALL ON public.event_budgets TO service_role;

ALTER TABLE public.event_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access to event_budgets"
  ON public.event_budgets FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Event members can view event_budgets"
  ON public.event_budgets FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.event_users eu WHERE eu.event_id = event_budgets.event_id AND eu.user_id = auth.uid()));

CREATE POLICY "Event members can insert event_budgets"
  ON public.event_budgets FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.event_users eu WHERE eu.event_id = event_budgets.event_id AND eu.user_id = auth.uid()));

CREATE POLICY "Event members can update event_budgets"
  ON public.event_budgets FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.event_users eu WHERE eu.event_id = event_budgets.event_id AND eu.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.event_users eu WHERE eu.event_id = event_budgets.event_id AND eu.user_id = auth.uid()));

CREATE POLICY "Event members can delete event_budgets"
  ON public.event_budgets FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.event_users eu WHERE eu.event_id = event_budgets.event_id AND eu.user_id = auth.uid()));

CREATE TRIGGER update_event_budgets_updated_at
  BEFORE UPDATE ON public.event_budgets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE public.budget_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  category text NOT NULL,
  label text,
  estimated_amount numeric NOT NULL DEFAULT 0,
  booked boolean NOT NULL DEFAULT false,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_items TO authenticated;
GRANT ALL ON public.budget_items TO service_role;

ALTER TABLE public.budget_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access to budget_items"
  ON public.budget_items FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Event members can view budget_items"
  ON public.budget_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.event_users eu WHERE eu.event_id = budget_items.event_id AND eu.user_id = auth.uid()));

CREATE POLICY "Event members can insert budget_items"
  ON public.budget_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.event_users eu WHERE eu.event_id = budget_items.event_id AND eu.user_id = auth.uid()));

CREATE POLICY "Event members can update budget_items"
  ON public.budget_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.event_users eu WHERE eu.event_id = budget_items.event_id AND eu.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.event_users eu WHERE eu.event_id = budget_items.event_id AND eu.user_id = auth.uid()));

CREATE POLICY "Event members can delete budget_items"
  ON public.budget_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.event_users eu WHERE eu.event_id = budget_items.event_id AND eu.user_id = auth.uid()));

CREATE INDEX budget_items_event_id_idx ON public.budget_items(event_id);

CREATE TRIGGER update_budget_items_updated_at
  BEFORE UPDATE ON public.budget_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
