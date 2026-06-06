
-- Role change audit log
CREATE TABLE IF NOT EXISTS public.role_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  changed_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  old_role text,
  new_role text,
  changed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.role_change_log TO authenticated;
GRANT ALL ON public.role_change_log TO service_role;

ALTER TABLE public.role_change_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read role log" ON public.role_change_log;
CREATE POLICY "Admins read role log" ON public.role_change_log
  FOR SELECT USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins write role log" ON public.role_change_log;
CREATE POLICY "Admins write role log" ON public.role_change_log
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()));

-- Strengthen the existing role-change trigger:
-- - block self role changes (already there)
-- - require caller to be admin
-- - prevent demoting the LAST remaining admin
-- - log every successful change
CREATE OR REPLACE FUNCTION public.prevent_role_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  remaining_admins int;
  caller uuid := auth.uid();
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    -- No self-edits of role
    IF caller = OLD.id THEN
      RAISE EXCEPTION 'You cannot change your own role';
    END IF;

    -- Allow service_role (edge functions / migrations) and admins only
    IF caller IS NOT NULL AND NOT public.is_admin(caller) THEN
      RAISE EXCEPTION 'Only an admin can change roles';
    END IF;

    -- Last-admin guard: cannot demote the final admin
    IF OLD.role = 'admin' AND NEW.role <> 'admin' THEN
      SELECT count(*) INTO remaining_admins
      FROM public.users
      WHERE role = 'admin' AND id <> OLD.id;
      IF remaining_admins = 0 THEN
        RAISE EXCEPTION 'At least one admin must remain';
      END IF;
    END IF;

    -- Audit
    INSERT INTO public.role_change_log (changed_user_id, changed_by, old_role, new_role)
    VALUES (OLD.id, caller, OLD.role, NEW.role);
  END IF;
  RETURN NEW;
END;
$function$;
