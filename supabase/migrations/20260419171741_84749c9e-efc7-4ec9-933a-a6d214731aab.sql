-- 1. Create the audit_log table
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid,
  table_name text NOT NULL,
  record_id uuid,
  action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  changed_fields text[],
  old_values jsonb,
  new_values jsonb,
  user_id uuid,
  user_email text,
  user_role text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_audit_log_event_id ON public.audit_log(event_id, created_at DESC);
CREATE INDEX idx_audit_log_table ON public.audit_log(table_name, created_at DESC);
CREATE INDEX idx_audit_log_user ON public.audit_log(user_id, created_at DESC);

-- 2. Enable RLS — admins only, read-only via app
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read audit log"
ON public.audit_log
FOR SELECT
USING (public.is_admin(auth.uid()));

-- No insert/update/delete policies → only triggers (SECURITY DEFINER) can write

-- 3. Generic audit trigger function
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_record_id uuid;
  v_old jsonb;
  v_new jsonb;
  v_changed text[];
  v_user_id uuid;
  v_user_email text;
  v_user_role text;
  v_key text;
BEGIN
  v_user_id := auth.uid();

  -- Snapshot user info (best-effort; avoids broken history if a user is later deleted)
  IF v_user_id IS NOT NULL THEN
    SELECT email, role INTO v_user_email, v_user_role
    FROM public.users WHERE id = v_user_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_new := NULL;
    v_record_id := (v_old->>'id')::uuid;
    v_event_id := CASE
      WHEN TG_TABLE_NAME = 'events' THEN v_record_id
      ELSE (v_old->>'event_id')::uuid
    END;
  ELSIF TG_OP = 'INSERT' THEN
    v_old := NULL;
    v_new := to_jsonb(NEW);
    v_record_id := (v_new->>'id')::uuid;
    v_event_id := CASE
      WHEN TG_TABLE_NAME = 'events' THEN v_record_id
      ELSE (v_new->>'event_id')::uuid
    END;
  ELSE -- UPDATE
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_record_id := (v_new->>'id')::uuid;
    v_event_id := CASE
      WHEN TG_TABLE_NAME = 'events' THEN v_record_id
      ELSE (v_new->>'event_id')::uuid
    END;

    -- Compute changed fields
    v_changed := ARRAY[]::text[];
    FOR v_key IN SELECT jsonb_object_keys(v_new) LOOP
      IF v_old->v_key IS DISTINCT FROM v_new->v_key THEN
        v_changed := array_append(v_changed, v_key);
      END IF;
    END LOOP;

    -- Skip no-op updates
    IF array_length(v_changed, 1) IS NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.audit_log (
    event_id, table_name, record_id, action,
    changed_fields, old_values, new_values,
    user_id, user_email, user_role
  ) VALUES (
    v_event_id, TG_TABLE_NAME, v_record_id, TG_OP,
    v_changed, v_old, v_new,
    v_user_id, v_user_email, v_user_role
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- 4. Attach trigger to all 10 tracked tables
CREATE TRIGGER audit_events
AFTER INSERT OR UPDATE OR DELETE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TRIGGER audit_vendors
AFTER INSERT OR UPDATE OR DELETE ON public.vendors
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TRIGGER audit_checklist_items
AFTER INSERT OR UPDATE OR DELETE ON public.checklist_items
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TRIGGER audit_ceremony_details
AFTER INSERT OR UPDATE OR DELETE ON public.ceremony_details
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TRIGGER audit_bar_selections
AFTER INSERT OR UPDATE OR DELETE ON public.bar_selections
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TRIGGER audit_lodging_assignments
AFTER INSERT OR UPDATE OR DELETE ON public.lodging_assignments
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TRIGGER audit_decor_items
AFTER INSERT OR UPDATE OR DELETE ON public.decor_items
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TRIGGER audit_dietary_restrictions
AFTER INSERT OR UPDATE OR DELETE ON public.dietary_restrictions
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TRIGGER audit_financials
AFTER INSERT OR UPDATE OR DELETE ON public.financials
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TRIGGER audit_meal_events
AFTER INSERT OR UPDATE OR DELETE ON public.meal_events
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();