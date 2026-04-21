-- Add internal flag to users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_gfh_internal boolean NOT NULL DEFAULT false;

-- Mark Brandon as GFH internal
UPDATE public.users
SET is_gfh_internal = true
WHERE email = 'experience@gilbertsvillefarmhouse.com';

-- Add internal-only tasting notes column on events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS tasting_notes_internal text;