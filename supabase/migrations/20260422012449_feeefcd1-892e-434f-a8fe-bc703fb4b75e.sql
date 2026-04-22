ALTER TABLE public.event_users 
ADD COLUMN IF NOT EXISTS tab_access jsonb 
DEFAULT '{"overview":true,"vendors":true,"ceremony":true,"timeline":false,"menus":false,"lodging":false,"financials":false,"messages":true,"notes":false,"documents":true}'::jsonb;