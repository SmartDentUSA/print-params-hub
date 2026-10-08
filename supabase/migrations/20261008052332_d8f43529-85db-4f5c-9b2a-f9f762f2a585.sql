CREATE OR REPLACE FUNCTION public.fn_duplicate_smartops_form(p_form_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Manter o vínculo KOL: profissionais que referenciavam o formulário original
  -- passam a referenciar também a cópia, para ela permanecer no grupo de indicações.
  UPDATE public.lia_attendances la
  SET prof_kol_form_ids = la.prof_kol_form_ids || to_jsonb(v_new_id::text)
  WHERE la.merged_into IS NULL
    AND la.prof_kol_form_ids IS NOT NULL
    AND la.prof_kol_form_ids <> '[]'::jsonb
    AND la.prof_kol_form_ids @> to_jsonb(p_form_id::text)
    AND NOT la.prof_kol_form_ids @> to_jsonb(v_new_id::text);

  RETURN v_new_id;
END;
$function$;