
CREATE OR REPLACE FUNCTION public.restore_audit_record(p_audit_id uuid, p_mode text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_audit         public.audit_log%ROWTYPE;
  v_allowed       text[] := ARRAY[
    'vendors','checklist_items','ceremony_details','bar_selections',
    'dietary_restrictions','financials','financial_line_items','budget_items',
    'event_budgets','payment_schedule','decor_selections','experience_requests',
    'milestones','guests','guest_dietary_entries','documents',
    'menu_finalization','seating_tables','seating_assignments','working_timeline'
  ];
  v_cols          text[];
  v_has_updated   boolean;
  v_exists        boolean;
  v_filtered      jsonb;
  v_col_list      text;
  v_summary_keys  text[];
BEGIN
  IF p_mode NOT IN ('revert_update','restore_delete') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unknown restore mode.');
  END IF;

  SELECT * INTO v_audit FROM public.audit_log WHERE id = p_audit_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'History entry not found.');
  END IF;

  IF NOT (v_audit.table_name = ANY(v_allowed)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'This area is not restorable.');
  END IF;

  IF v_audit.record_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'This history entry has no record id and cannot be restored.');
  END IF;

  IF v_audit.old_values IS NULL OR jsonb_typeof(v_audit.old_values) <> 'object' THEN
    RETURN jsonb_build_object('success', false, 'error', 'No previous values are available on this entry.');
  END IF;

  -- Introspect live columns
  SELECT array_agg(column_name::text) INTO v_cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = v_audit.table_name;

  IF v_cols IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target table no longer exists.');
  END IF;

  v_has_updated := 'updated_at' = ANY(v_cols);

  -- Does the row still exist?
  EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE id = $1)', v_audit.table_name)
    INTO v_exists USING v_audit.record_id;

  IF p_mode = 'revert_update' THEN
    IF NOT v_exists THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'This record was later removed. Use its deletion entry to restore it.'
      );
    END IF;

    -- Filter: only existing columns, never id/created_at/updated_at
    SELECT COALESCE(jsonb_object_agg(key, value), '{}'::jsonb) INTO v_filtered
    FROM jsonb_each(v_audit.old_values)
    WHERE key = ANY(v_cols) AND key NOT IN ('id','created_at','updated_at');

    IF v_filtered = '{}'::jsonb THEN
      RETURN jsonb_build_object('success', false, 'error', 'Nothing restorable on this entry.');
    END IF;

    IF v_has_updated THEN
      v_filtered := v_filtered || jsonb_build_object('updated_at', to_jsonb(now()));
    END IF;

    SELECT string_agg(quote_ident(k), ', '),
           array_agg(k)
      INTO v_col_list, v_summary_keys
      FROM jsonb_object_keys(v_filtered) AS k;

    BEGIN
      EXECUTE format(
        'UPDATE public.%1$I AS t SET (%2$s) = (SELECT %2$s FROM jsonb_populate_record(NULL::public.%1$I, $1)) WHERE t.id = $2',
        v_audit.table_name, v_col_list
      ) USING v_filtered, v_audit.record_id;
    EXCEPTION WHEN foreign_key_violation THEN
      RETURN jsonb_build_object('success', false, 'error', 'Cannot revert: a related record it depends on no longer exists.');
    WHEN OTHERS THEN
      RETURN jsonb_build_object('success', false, 'error', 'Restore failed: ' || SQLERRM);
    END;

    RETURN jsonb_build_object(
      'success', true,
      'summary', format('Reverted %s field(s) on %s.', array_length(v_summary_keys,1) - (CASE WHEN v_has_updated THEN 1 ELSE 0 END), v_audit.table_name)
    );
  END IF;

  -- restore_delete
  IF v_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'A record with this id already exists.');
  END IF;

  -- Include id for insert; never created_at; refresh updated_at if present
  SELECT COALESCE(jsonb_object_agg(key, value), '{}'::jsonb) INTO v_filtered
  FROM jsonb_each(v_audit.old_values)
  WHERE key = ANY(v_cols) AND key NOT IN ('created_at','updated_at');

  IF v_filtered = '{}'::jsonb THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nothing restorable on this entry.');
  END IF;

  IF v_has_updated THEN
    v_filtered := v_filtered || jsonb_build_object('updated_at', to_jsonb(now()));
  END IF;

  SELECT string_agg(quote_ident(k), ', ') INTO v_col_list
    FROM jsonb_object_keys(v_filtered) AS k;

  BEGIN
    EXECUTE format(
      'INSERT INTO public.%1$I (%2$s) SELECT %2$s FROM jsonb_populate_record(NULL::public.%1$I, $1)',
      v_audit.table_name, v_col_list
    ) USING v_filtered;
  EXCEPTION WHEN foreign_key_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot restore: a related record it depends on no longer exists.');
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot restore: a conflicting record already exists.');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Restore failed: ' || SQLERRM);
  END;

  RETURN jsonb_build_object(
    'success', true,
    'summary', format('Restored deleted record in %s.', v_audit.table_name)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.restore_audit_record(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restore_audit_record(uuid, text) TO service_role;
