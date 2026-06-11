
-- Attach audit trigger to high-value user-editable tables.
-- log_audit_event() reads event_id/id from to_jsonb via ->>, returning NULL if absent;
-- audit_log.event_id and record_id are nullable, so writes cannot fail from missing columns.

DO $$
DECLARE
  t text;
  candidates text[] := ARRAY[
    'guests','guest_dietary_entries','working_timeline','milestones',
    'decor_selections','experience_requests','financial_line_items',
    'payment_schedule','budget_items','event_budgets',
    'seating_tables','seating_assignments','seating_config',
    'forms','form_assignments','form_responses',
    'menu_finalization','couple_notes','documents'
  ];
BEGIN
  FOREACH t IN ARRAY candidates LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS audit_%1$I ON public.%1$I; '
      'CREATE TRIGGER audit_%1$I AFTER INSERT OR UPDATE OR DELETE ON public.%1$I '
      'FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();',
      t
    );
  END LOOP;
END $$;

-- Per-record history lookup index
CREATE INDEX IF NOT EXISTS idx_audit_log_record_history
  ON public.audit_log (table_name, record_id, created_at DESC);

-- Allow event members (couples) to read audit rows for their own events.
-- Admin policy stays intact; couples get SELECT only, no write access.
CREATE POLICY "Event members can read their event's audit log"
  ON public.audit_log
  FOR SELECT
  TO authenticated
  USING (
    event_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.event_users eu
      WHERE eu.event_id = audit_log.event_id
        AND eu.user_id = auth.uid()
    )
  );
