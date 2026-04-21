
-- Add description (label) and vendor_id columns to documents table
ALTER TABLE public.documents 
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_documents_vendor_id ON public.documents(vendor_id);
CREATE INDEX IF NOT EXISTS idx_documents_event_id ON public.documents(event_id);
