-- Add updated_at column to preferred_vendors for "Last updated" display
ALTER TABLE public.preferred_vendors
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

-- Reusable trigger function (no-op if already exists)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS preferred_vendors_set_updated_at ON public.preferred_vendors;
CREATE TRIGGER preferred_vendors_set_updated_at
BEFORE UPDATE ON public.preferred_vendors
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();