
-- 1. Create a security definer function to check admin role (avoids recursive RLS)
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = _user_id AND role = 'admin'
  )
$$;

-- 2. Fix handle_new_user to set search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, role)
  VALUES (new.id, new.email, 'couple');
  RETURN new;
END;
$$;

-- 3. Drop the insecure admin policy on users that references user_metadata
DROP POLICY IF EXISTS "Admins full access" ON public.users;

-- 4. Create a secure admin policy using the security definer function
CREATE POLICY "Admins full access" ON public.users
FOR ALL
TO public
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- 5. Add trigger to prevent users from changing their own role
CREATE OR REPLACE FUNCTION public.prevent_role_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    IF auth.uid() = OLD.id THEN
      RAISE EXCEPTION 'You cannot change your own role';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_role_self_update
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.prevent_role_self_update();
