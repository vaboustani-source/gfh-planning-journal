
DROP POLICY IF EXISTS "Section viewers read event_budgets" ON public.event_budgets;
DROP POLICY IF EXISTS "Section viewers read budget_items" ON public.budget_items;

CREATE POLICY "Event directors read event_budgets"
ON public.event_budgets FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.users
  WHERE users.id = auth.uid() AND users.role = 'event_director'
));

CREATE POLICY "Event directors read budget_items"
ON public.budget_items FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.users
  WHERE users.id = auth.uid() AND users.role = 'event_director'
));
