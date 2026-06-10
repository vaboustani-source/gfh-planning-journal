
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS lifecycle_stage text,
  ADD COLUMN IF NOT EXISTS handed_off_at timestamptz,
  ADD COLUMN IF NOT EXISTS handed_off_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS assigned_planner uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS portal_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS portal_opened_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS pending_partner1_email text,
  ADD COLUMN IF NOT EXISTS pending_partner1_name  text,
  ADD COLUMN IF NOT EXISTS pending_partner2_email text,
  ADD COLUMN IF NOT EXISTS pending_partner2_name  text;

-- Backfill: any existing row gets portal_open so current weddings are unaffected
UPDATE public.events
   SET lifecycle_stage = 'portal_open',
       portal_opened_at = COALESCE(portal_opened_at, created_at)
 WHERE lifecycle_stage IS NULL;

-- Now apply default + check constraint for future rows
ALTER TABLE public.events
  ALTER COLUMN lifecycle_stage SET DEFAULT 'sales_setup';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'events_lifecycle_stage_check'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_lifecycle_stage_check
      CHECK (lifecycle_stage IN ('sales_setup','handed_off','in_setup','portal_open'));
  END IF;
END $$;
