
-- Allow staff with financials view access (admin, event_director, planner, sales_manager, etc per user_access_level) to read budgets across events.
CREATE POLICY "Section viewers read event_budgets"
ON public.event_budgets FOR SELECT
USING (can_view_section(auth.uid(), 'financials'::app_section));

CREATE POLICY "Section viewers read budget_items"
ON public.budget_items FOR SELECT
USING (can_view_section(auth.uid(), 'financials'::app_section));
