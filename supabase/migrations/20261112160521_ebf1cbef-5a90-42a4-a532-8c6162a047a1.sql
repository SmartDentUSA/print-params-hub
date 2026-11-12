ALTER TABLE public.smartops_forms
  ADD COLUMN IF NOT EXISTS capture_buttons_question text,
  ADD COLUMN IF NOT EXISTS capture_group_message text;

CREATE OR REPLACE FUNCTION public.fn_create_form_standard_flow(p_name text, p_kind text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_template uuid := '150e231f-c17c-42ad-95b7-f2ee7a99d9bd'; -- # - FORMS - exocad DentalCad  RMS
  v_new uuid := gen_random_uuid();
  v_name text;
  v_slug text;
  r record;
  v_map jsonb := '{}'::jsonb;
  k text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.fn_is_internal_staff(auth.uid()) THEN
    RAISE EXCEPTION 'sem_permissao';
  END IF;
  IF p_kind NOT IN ('sdr_captacao','grupo_whatsapp','campanha_comercial') THEN RAISE EXCEPTION 'tipo_invalido'; END IF;
  IF coalesce(trim(p_name),'') = '' THEN RAISE EXCEPTION 'nome_obrigatorio'; END IF;

  v_name := trim(p_name);
  IF p_kind = 'grupo_whatsapp' AND v_name !~* '^#\s*-\s*GRUPO WHATSAPP\s*-' THEN
    v_name := '# - GRUPO WHATSAPP - ' || v_name;
  END IF;
  IF p_kind = 'campanha_comercial' AND v_name !~* '^#\s*-\s*CAMPANHA COMERCIAL\s*-' THEN
    v_name := '# - CAMPANHA COMERCIAL - ' || v_name;
  END IF;
  v_slug := regexp_replace(regexp_replace(lower(unaccent_safe(v_name)), '[^a-z0-9]+', '-', 'g'), '(^-+|-+$)', '', 'g')
            || '-' || to_char(now(), 'YYMMDDHH24MISS');

  INSERT INTO public.smartops_forms (id, name, slug, form_purpose, active, capture_buttons_enabled, capture_buttons, capture_buttons_question)
  VALUES (
    v_new, v_name, v_slug, 'sdr_captacao', false,
    p_kind = 'campanha_comercial',
    CASE WHEN p_kind = 'campanha_comercial' THEN jsonb_build_array(
      jsonb_build_object('label','Resinas','workflow_stage_target','3_impressao__resinas','product_catalog_id',null,'product_name',null),
      jsonb_build_object('label','Scanner intraoral','workflow_stage_target','1_captura_digital__scanner_intraoral','product_catalog_id',null,'product_name',null),
      jsonb_build_object('label','Impressora 3D','workflow_stage_target','3_impressao__impressora_3d','product_catalog_id',null,'product_name',null),
      jsonb_build_object('label','Caracterização','workflow_stage_target','5_finalizacao__caracterizacao','product_catalog_id',null,'product_name',null),
      jsonb_build_object('label','Cimentos e adesivos','workflow_stage_target','5_finalizacao__instalacao','product_catalog_id',null,'product_name',null),
      jsonb_build_object('label','Resina direta','workflow_stage_target','5_finalizacao__destistica_orto','product_catalog_id',null,'product_name',null)
    ) ELSE '[]'::jsonb END,
    CASE WHEN p_kind = 'campanha_comercial' THEN 'O que você busca nesta promoção?' ELSE NULL END
  );

  FOR r IN SELECT * FROM public.smartops_form_fields WHERE form_id = v_template ORDER BY order_index LOOP
    v_map := v_map || jsonb_build_object(r.id::text, gen_random_uuid()::text);
  END LOOP;

  INSERT INTO public.smartops_form_fields (
    id, form_id, label, field_type, db_column, custom_field_name, options, required,
    placeholder, help_text, order_index, roi_config, workflow_cell_target, conditions, show_when_especialidade)
  SELECT (v_map->>f.id::text)::uuid, v_new, f.label, f.field_type, f.db_column, f.custom_field_name, f.options, f.required,
         f.placeholder, f.help_text, f.order_index, f.roi_config, f.workflow_cell_target, f.conditions, f.show_when_especialidade
  FROM public.smartops_form_fields f WHERE f.form_id = v_template;

  FOR k IN SELECT jsonb_object_keys(v_map) LOOP
    UPDATE public.smartops_form_fields
       SET conditions = replace(conditions::text, k, v_map->>k)::jsonb
     WHERE form_id = v_new AND conditions IS NOT NULL AND conditions::text LIKE '%' || k || '%';
  END LOOP;

  RETURN v_new;
END $function$;

REVOKE ALL ON FUNCTION public.fn_create_form_standard_flow(text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fn_create_form_standard_flow(text,text) TO authenticated;