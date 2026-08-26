DO $$
DECLARE
  v_target uuid;
  v_source uuid;
BEGIN
  SELECT id INTO v_target FROM public.smartops_forms WHERE slug = 'curso-online-qualificacao';
  SELECT id INTO v_source FROM public.smartops_forms WHERE slug = 'exocad_dentalcad_rms';
  IF v_target IS NULL OR v_source IS NULL THEN
    RAISE EXCEPTION 'forms not found';
  END IF;

  DELETE FROM public.smartops_form_field_responses WHERE field_id IN (
    SELECT id FROM public.smartops_form_fields WHERE form_id = v_target
  );
  DELETE FROM public.smartops_form_fields WHERE form_id = v_target;

  INSERT INTO public.smartops_form_fields
    (form_id, label, field_type, db_column, custom_field_name, options, required, placeholder, order_index, workflow_cell_target, conditions)
  SELECT v_target, label, field_type, db_column, custom_field_name, options, required, placeholder, order_index, workflow_cell_target, conditions
  FROM public.smartops_form_fields
  WHERE form_id = v_source
    AND COALESCE(db_column, '') NOT IN ('nome', 'email', 'telefone_raw', 'telefone')
  ORDER BY order_index;
END $$;