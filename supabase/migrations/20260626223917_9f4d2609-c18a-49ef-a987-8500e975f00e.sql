
DO $$
DECLARE
  v_form_id uuid;
  v_area uuid;
  v_scanner uuid;
  v_contato3d uuid;
BEGIN
  SELECT id INTO v_form_id FROM public.smartops_forms WHERE slug='curso-online-qualificacao';
  IF v_form_id IS NULL THEN RAISE EXCEPTION 'form missing'; END IF;

  SELECT id INTO v_area     FROM public.smartops_form_fields WHERE form_id=v_form_id AND order_index=20;
  SELECT id INTO v_scanner  FROM public.smartops_form_fields WHERE form_id=v_form_id AND order_index=40;
  SELECT id INTO v_contato3d FROM public.smartops_form_fields WHERE form_id=v_form_id AND order_index=50;

  -- #6 Especialidade
  UPDATE public.smartops_form_fields SET conditions = jsonb_build_object(
    'show_if', jsonb_build_object('logic','AND','rules', jsonb_build_array(
      jsonb_build_object('field_id', v_area::text, 'op','not_equals','value','LABORATÓRIO DE PRÓTESE')
    ))
  ) WHERE form_id=v_form_id AND order_index=30;

  -- #8 Contato 3D
  UPDATE public.smartops_form_fields SET conditions = jsonb_build_object(
    'show_if', jsonb_build_object('logic','AND','rules', jsonb_build_array(
      jsonb_build_object('field_id', v_scanner::text, 'op','equals','value','AINDA NÃO DIGITALIZO AS MOLDAGENS')
    ))
  ) WHERE form_id=v_form_id AND order_index=50;

  -- #9 Tipo de clínica
  UPDATE public.smartops_form_fields SET conditions = jsonb_build_object(
    'show_if', jsonb_build_object('logic','AND','rules', jsonb_build_array(
      jsonb_build_object('field_id', v_area::text, 'op','equals','value','CLÍNICA OU CONSULTÓRIO')
    ))
  ) WHERE form_id=v_form_id AND order_index=60;

  -- Scanner Intraoral (#1 7x3)
  UPDATE public.smartops_form_fields SET conditions = jsonb_build_object(
    'show_if', jsonb_build_object('logic','AND','rules', jsonb_build_array(
      jsonb_build_object('field_id', v_scanner::text, 'op','not_equals','value','SIM, COM SCANNER DE BANCADA'),
      jsonb_build_object('field_id', v_scanner::text, 'op','not_equals','value','AINDA NÃO DIGITALIZO AS MOLDAGENS')
    ))
  ) WHERE form_id=v_form_id AND order_index=70;

  -- Scanner Bancada (#2 7x3)
  UPDATE public.smartops_form_fields SET conditions = jsonb_build_object(
    'show_if', jsonb_build_object('logic','AND','rules', jsonb_build_array(
      jsonb_build_object('field_id', v_scanner::text, 'op','equals','value','SIM, COM SCANNER DE BANCADA')
    ))
  ) WHERE form_id=v_form_id AND order_index=80;

  -- CAD (#3 7x3)
  UPDATE public.smartops_form_fields SET conditions = jsonb_build_object(
    'show_if', jsonb_build_object('logic','AND','rules', jsonb_build_array(
      jsonb_build_object('field_id', v_scanner::text, 'op','not_equals','value','AINDA NÃO DIGITALIZO AS MOLDAGENS')
    ))
  ) WHERE form_id=v_form_id AND order_index=90;

  -- Impressora 3D (#4 7x3)
  UPDATE public.smartops_form_fields SET conditions = jsonb_build_object(
    'show_if', jsonb_build_object('logic','OR','rules', jsonb_build_array(
      jsonb_build_object('field_id', v_contato3d::text, 'op','equals','value','SIM, EU TENHO UMA IMPRESSORA'),
      jsonb_build_object('field_id', v_scanner::text,   'op','not_equals','value','AINDA NÃO DIGITALIZO AS MOLDAGENS')
    ))
  ) WHERE form_id=v_form_id AND order_index=100;

  -- Resinas (#5 7x3)
  UPDATE public.smartops_form_fields SET conditions = jsonb_build_object(
    'show_if', jsonb_build_object('logic','AND','rules', jsonb_build_array(
      jsonb_build_object('field_id', v_contato3d::text, 'op','not_in','value', jsonb_build_array('NÃO, NUNCA TIVE'))
    ))
  ) WHERE form_id=v_form_id AND order_index=110;
END $$;
