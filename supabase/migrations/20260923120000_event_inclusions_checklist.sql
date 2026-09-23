-- Package tiers (base/elevated/full) are replaced by a per-wedding inclusions
-- checklist. event_addons becomes that checklist: a row per item, included on/off,
-- an optional note ("interested in", "10 tents in village"), and custom one-off items.
ALTER TABLE public.event_addons DROP CONSTRAINT IF EXISTS event_addons_addon_check;
ALTER TABLE public.event_addons
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS note text,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
