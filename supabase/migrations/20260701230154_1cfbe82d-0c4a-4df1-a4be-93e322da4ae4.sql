ALTER TABLE public.lodging_rooms
  ADD COLUMN IF NOT EXISTS bed_type text,
  ADD COLUMN IF NOT EXISTS ada_compliant boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS floor text;