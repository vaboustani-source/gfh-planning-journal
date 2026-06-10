
-- STEP 1: rendered_content column
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS rendered_content text;

-- STEP 1: contract_audit_log table
CREATE TABLE public.contract_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL,
  action text NOT NULL,
  actor_user_id uuid,
  actor_label text,
  ip_address text,
  user_agent text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.contract_audit_log TO authenticated;
GRANT ALL ON public.contract_audit_log TO service_role;

ALTER TABLE public.contract_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read audit log"
  ON public.contract_audit_log FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins insert audit log"
  ON public.contract_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

-- STEP 2: replace cascade FKs with restrict FKs (orphans verified = 0)
ALTER TABLE public.contracts DROP CONSTRAINT contracts_event_id_fkey;
ALTER TABLE public.contracts
  ADD CONSTRAINT contracts_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE RESTRICT;

ALTER TABLE public.contract_signatures DROP CONSTRAINT contract_signatures_contract_id_fkey;
ALTER TABLE public.contract_signatures
  ADD CONSTRAINT contract_signatures_contract_id_fkey
  FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE RESTRICT;

-- STEP 6: lock signed content with a trigger
CREATE OR REPLACE FUNCTION public.contracts_lock_signed_content()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status <> 'draft' THEN
    IF NEW.content IS DISTINCT FROM OLD.content
       OR NEW.rendered_content IS DISTINCT FROM OLD.rendered_content
       OR NEW.content_hash IS DISTINCT FROM OLD.content_hash THEN
      RAISE EXCEPTION 'Contract content is locked once status leaves draft (current status: %)', OLD.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contracts_lock_signed_content_trg ON public.contracts;
CREATE TRIGGER contracts_lock_signed_content_trg
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.contracts_lock_signed_content();
