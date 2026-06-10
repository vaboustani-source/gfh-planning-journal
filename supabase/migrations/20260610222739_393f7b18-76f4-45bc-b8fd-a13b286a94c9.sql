ALTER TABLE public.contract_signatures ADD COLUMN IF NOT EXISTS signer_role text NOT NULL DEFAULT 'couple';
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS requires_countersignature boolean NOT NULL DEFAULT false;
ALTER TABLE public.contract_templates ADD COLUMN IF NOT EXISTS requires_countersignature boolean NOT NULL DEFAULT false;