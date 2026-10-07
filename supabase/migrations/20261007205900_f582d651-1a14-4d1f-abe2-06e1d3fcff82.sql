CREATE OR REPLACE FUNCTION public.fn_duplicate_smartops_form(p_form_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_new_id uuid;
  v_src public.smartops_forms;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'nao_autenticado'; END IF;
  SELECT * INTO v_src FROM public.smartops_forms WHERE id = p_form_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'formulario_nao_encontrado'; END IF;

  v_src.id := gen_random_uuid();
  v_src.name := v_src.name || ' (cópia)';
  v_src.slug := v_src.slug || '-copia-' || to_char(now(), 'YYYYMMDDHH24MISS');
  v_src.active := false;
  v_src.ig_trigger_enabled := false;
  v_src.submissions_count := 0;
  v_src.created_at := now();
  v_src.updated_at := now();

  INSERT INTO public.smartops_forms SELECT (v_src).*;
  v_new_id := v_src.id;

  INSERT INTO public.smartops_form_fields (
    form_id, label, field_type, db_column, custom_field_name, options, required,
    placeholder, help_text, order_index, roi_config, workflow_cell_target, conditions,
    show_when_especialidade
  )
  SELECT v_new_id, f.label, f.field_type, f.db_column, f.custom_field_name, f.options, f.required,
         f.placeholder, f.help_text, f.order_index, f.roi_config, f.workflow_cell_target, f.conditions,
         f.show_when_especialidade
  FROM public.smartops_form_fields f
  WHERE f.form_id = p_form_id
  ORDER BY f.order_index;

  RETURN v_new_id;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_duplicate_smartops_form(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_duplicate_smartops_form(uuid) TO authenticated, service_role;