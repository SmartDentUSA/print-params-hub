CREATE OR REPLACE FUNCTION public.fn_kol_ensure_credenciamento_form(_course_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _course record;
  _prof_name text;
  _form_id uuid;
  _base_slug text;
  _slug text;
  _i int;
  _field_count int;
BEGIN
  PERFORM public.fn_kol_staff_guard();

  SELECT id, title, slug, credenciamento_form_id, producer_lead_id
    INTO _course
    FROM public.professional_courses
   WHERE id = _course_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'course_not_found';
  END IF;

  _form_id := _course.credenciamento_form_id;

  IF _form_id IS NULL THEN
    SELECT nome INTO _prof_name FROM public.lia_attendances WHERE id = _course.producer_lead_id;
    _prof_name := NULLIF(TRIM(COALESCE(_prof_name, '')), '');

    _base_slug := lower(regexp_replace(
      translate(COALESCE(_course.slug, _course.title, _course_id::text),
        'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
        'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'),
      '[^a-z0-9]+', '-', 'g'));
    _base_slug := trim(both '-' from left('credenciamento-' || _base_slug, 60));
    _slug := _base_slug;
    FOR _i IN 2..20 LOOP
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.smartops_forms WHERE slug = _slug);
      _slug := _base_slug || '-' || _i;
    END LOOP;

    INSERT INTO public.smartops_forms (name, slug, active, form_purpose, description)
    VALUES (
      '# CHAT - Qualificação Curso - ' || COALESCE(_prof_name, _course.title),
      _slug,
      true,
      'credenciamento',
      'Formulário de participação do curso ' || _course.title
    )
    RETURNING id INTO _form_id;

    UPDATE public.professional_courses
       SET credenciamento_form_id = _form_id
     WHERE id = _course_id;
  END IF;

  -- Completa os campos se o formulário estiver vazio (criação anterior incompleta)
  SELECT count(*) INTO _field_count FROM public.smartops_form_fields WHERE form_id = _form_id;
  IF _field_count = 0 THEN
    INSERT INTO public.smartops_form_fields (form_id, label, db_column, field_type, required, order_index, options) VALUES
      (_form_id, 'Seu nome completo', 'nome', 'text', true, 1, NULL),
      (_form_id, 'Seu e-mail', 'email', 'email', true, 2, NULL),
      (_form_id, 'Seu WhatsApp (com DDD)', 'telefone', 'phone', true, 3, NULL),
      (_form_id, 'Qual é a sua área de atuação?', 'area_atuacao', 'select', true, 4,
        to_jsonb(ARRAY['CLÍNICA OU CONSULTÓRIO','LABORATÓRIO DE PRÓTESE','RADIOLOGIA ODONTOLÓGICA','PLANNING CENTER','EMPRESA DE ALINHADORES','GESTOR DE REDE DE CLÍNICAS','GESTOR DE FRANQUIAS','CENTRAL DE IMPRESSÕES','EDUCAÇÃO'])),
      (_form_id, 'Qual é a sua especialidade?', 'especialidade', 'text', false, 5, NULL),
      (_form_id, 'Atualmente, você digitaliza suas moldagens?', 'tem_scanner', 'select', false, 6,
        to_jsonb(ARRAY['AINDA NÃO DIGITALIZO AS MOLDAGENS','SIM, COM SCANNER INTRA ORAL PRÓPRIO','SIM, COM SCANNER INTRAORAL ALUGADO','SIM, COM SCANNER INTRAORAL DA RADIOLOGIA PARCERIA','SIM, COM SCANNER INTRAORAL DA LABORATORIO PARCEIRO','SIM, COM SCANNER DE BANCADA'])),
      (_form_id, 'Qual impressora você teve contato ou utiliza no seu dia a dia?', 'impressora_modelo', 'select', false, 7,
        to_jsonb(ARRAY['RAYSHAPE','PHROZEN','ANYCUBIC','FLASHFORGE','WANHAO','MIICRAFT','MOONRAY','SPRINTRAY','STRAUMAN','FORMLABS','STRATASYS','ELEGOO','ENVISIONTEC','3DSYSTEM','PIONEXT','CREALITY','ACKURETTA','PHOTOCENTRIC','KULZER','WILCOS','OUTRAS']));
  END IF;

  RETURN _form_id;
END;
$$;