CREATE OR REPLACE FUNCTION public.smart_ops_field_normalize_apply(
  p_field text,
  p_from text[],
  p_to text,
  p_dry_run boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_to_exists boolean := false;
  v_warning text := NULL;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF NOT (p_field = ANY(public.smart_ops_field_normalize_allowed_fields())) THEN
    RAISE EXCEPTION 'field % not allowed', p_field;
  END IF;

  IF p_from IS NULL OR array_length(p_from, 1) IS NULL THEN
    RETURN jsonb_build_object('dry_run', p_dry_run, 'affected', 0, 'to_value_is_new', false, 'warning', 'no source values provided');
  END IF;

  IF p_to IS NOT NULL AND p_to <> '' THEN
    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM public.lia_attendances WHERE merged_into IS NULL AND %I::text = $1)',
      p_field
    ) INTO v_to_exists USING p_to;
    IF NOT v_to_exists THEN
      v_warning := format('target value "%s" does not exist yet in %s — a new variant will be created', p_to, p_field);
    END IF;
  END IF;

  EXECUTE format(
    'SELECT count(*)::int FROM public.lia_attendances
      WHERE merged_into IS NULL AND %1$I::text = ANY($1) AND %1$I::text IS DISTINCT FROM $2',
    p_field
  ) INTO v_count USING p_from, p_to;

  IF p_dry_run THEN
    RETURN jsonb_build_object(
      'dry_run', true, 'affected', v_count,
      'to_value_is_new', NOT v_to_exists, 'warning', v_warning
    );
  END IF;

  -- Single transaction: snapshot the OLD value per lead BEFORE updating,
  -- then join it back so the audit trail keeps "from -> to".
  EXECUTE format($f$
    WITH before AS (
      SELECT t.id, t.%1$I::text AS old_value
        FROM public.lia_attendances t
       WHERE t.merged_into IS NULL
         AND t.%1$I::text = ANY($1)
         AND t.%1$I::text IS DISTINCT FROM $2
       FOR UPDATE
    ), upd AS (
      UPDATE public.lia_attendances t
         SET %1$I = $2
        FROM before b
       WHERE t.id = b.id
      RETURNING t.id, b.old_value
    )
    INSERT INTO public.lead_enrichment_audit
      (lead_id, source, source_priority, fields_updated, previous_values, new_values)
    SELECT upd.id, 'smart_ops_field_normalize_apply', 100, ARRAY[$3],
           jsonb_build_object($3, upd.old_value),
           jsonb_build_object($3, $2)
    FROM upd
  $f$, p_field)
  USING p_from, p_to, p_field;

  IF v_warning IS NOT NULL THEN
    BEGIN
      INSERT INTO public.system_health_logs (function_name, severity, error_type, details)
      VALUES ('smart_ops_field_normalize_apply', 'warning', 'new_variant_created',
              jsonb_build_object('field', p_field, 'to', p_to, 'from', p_from, 'affected', v_count));
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'dry_run', false, 'affected', v_count,
    'to_value_is_new', NOT v_to_exists, 'warning', v_warning
  );
END;
$$;

REVOKE ALL ON FUNCTION public.smart_ops_field_normalize_apply(text, text[], text, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.smart_ops_field_normalize_apply(text, text[], text, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.smart_ops_field_normalize_apply(text, text[], text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.smart_ops_field_normalize_apply(text, text[], text, boolean) TO service_role;