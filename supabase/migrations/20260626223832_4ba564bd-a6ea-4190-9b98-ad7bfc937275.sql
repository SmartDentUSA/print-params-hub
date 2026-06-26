
DO $$
DECLARE
  v_form_id uuid;
BEGIN
  SELECT id INTO v_form_id FROM public.smartops_forms WHERE slug = 'curso-online-qualificacao';

  IF v_form_id IS NULL THEN
    INSERT INTO public.smartops_forms (
      slug, name, form_purpose, active, display_mode, show_progress,
      title, subtitle, success_message, cta_text
    ) VALUES (
      'curso-online-qualificacao',
      '# - Qualificação Inscrição Curso Online',
      'sdr_captacao',
      true,
      'step',
      true,
      'Quase lá! Conte um pouco sobre você',
      'Algumas perguntas rápidas para personalizar seu treinamento.',
      'Tudo certo! Sua inscrição está confirmada.',
      'Confirmar inscrição'
    )
    RETURNING id INTO v_form_id;
  END IF;

  -- Wipe existing fields for this form to make seed idempotent on re-run
  DELETE FROM public.smartops_form_fields WHERE form_id = v_form_id;

  INSERT INTO public.smartops_form_fields
    (form_id, label, field_type, db_column, custom_field_name, options, required, placeholder, order_index, workflow_cell_target, conditions)
  VALUES
  -- #4 Cargo (custom field)
  (v_form_id, 'Qual é o seu cargo?', 'select', NULL, 'cargo',
    '["DENTISTA","PROTÉTICO","CADISTA","ESTUDANTE","GESTOR/PROPRIETÁRIO","OUTRO"]'::jsonb,
    true, 'Selecione seu cargo', 10, NULL, NULL),

  -- #5 Área de atuação
  (v_form_id, 'Qual sua área de atuação?', 'select', 'area_atuacao', NULL,
    '["CLÍNICA OU CONSULTÓRIO","LABORATÓRIO DE PRÓTESE","CLÍNICA + LABORATÓRIO","INSTITUIÇÃO DE ENSINO","OUTRO"]'::jsonb,
    true, 'Selecione sua área', 20, NULL, NULL),

  -- #6 Especialidade (condicional: área ≠ LABORATÓRIO DE PRÓTESE)
  (v_form_id, 'Qual sua especialidade principal?', 'select', 'especialidade', NULL,
    '["CLÍNICO GERAL","PRÓTESE","IMPLANTODONTIA","ORTODONTIA","ENDODONTIA","DENTÍSTICA","PERIODONTIA","ODONTOPEDIATRIA","CIRURGIA","HARMONIZAÇÃO FACIAL","OUTRA"]'::jsonb,
    false, 'Selecione', 30, NULL,
    jsonb_build_object('show_if', jsonb_build_object(
      'logic','AND',
      'rules', jsonb_build_array(
        jsonb_build_object('field_id','#5','op','not_equals','value','LABORATÓRIO DE PRÓTESE')
      )
    ))),

  -- #7 Tem scanner
  (v_form_id, 'Atualmente, você digitaliza suas moldagens?', 'select', 'tem_scanner', NULL,
    '["SIM, COM SCANNER INTRAORAL","SIM, COM SCANNER DE BANCADA","AINDA NÃO DIGITALIZO AS MOLDAGENS"]'::jsonb,
    true, 'Selecione', 40, NULL, NULL),

  -- #8 Contato 3D (condicional: scanner = AINDA NÃO DIGITALIZO)
  (v_form_id, 'Você já teve contato com impressão 3D?', 'select', NULL, 'contato_impressao_3d',
    '["SIM, EU TENHO UMA IMPRESSORA","JÁ TIVE CONTATO MAS NUNCA IMPRIMI","NÃO, NUNCA TIVE"]'::jsonb,
    false, 'Selecione', 50, NULL,
    jsonb_build_object('show_if', jsonb_build_object(
      'logic','AND',
      'rules', jsonb_build_array(
        jsonb_build_object('field_id','#7','op','equals','value','AINDA NÃO DIGITALIZO AS MOLDAGENS')
      )
    ))),

  -- #9 Tipo de clínica (condicional: área = CLÍNICA OU CONSULTÓRIO)
  (v_form_id, 'Como é a estrutura da sua clínica?', 'select', NULL, 'tipo_clinica',
    '["CONSULTÓRIO PRÓPRIO (SOZINHO)","CLÍNICA PEQUENA (2-5 PROFISSIONAIS)","CLÍNICA MÉDIA (6-15 PROFISSIONAIS)","CLÍNICA GRANDE (15+ PROFISSIONAIS)","FRANQUIA / REDE"]'::jsonb,
    false, 'Selecione', 60, NULL,
    jsonb_build_object('show_if', jsonb_build_object(
      'logic','AND',
      'rules', jsonb_build_array(
        jsonb_build_object('field_id','#5','op','equals','value','CLÍNICA OU CONSULTÓRIO')
      )
    ))),

  -- Workflow 7x3 #1 Scanner Intraoral (modelo) — scanner ∉ {bancada, ainda não}
  (v_form_id, 'Qual o modelo do seu scanner intraoral?', 'select', 'scanner_modelo', NULL,
    '["MEDIT i700","MEDIT i900","3SHAPE TRIOS","ITERO","PRIMESCAN","AOROL","RUNYES","OUTRO","NÃO TENHO"]'::jsonb,
    false, 'Selecione', 70, '1·Captura Digital / Scanner Intraoral',
    jsonb_build_object('show_if', jsonb_build_object(
      'logic','AND',
      'rules', jsonb_build_array(
        jsonb_build_object('field_id','#7','op','not_equals','value','SIM, COM SCANNER DE BANCADA'),
        jsonb_build_object('field_id','#7','op','not_equals','value','AINDA NÃO DIGITALIZO AS MOLDAGENS')
      )
    ))),

  -- Workflow 7x3 #2 Scanner Bancada (modelo) — scanner = bancada
  (v_form_id, 'Qual o modelo do seu scanner de bancada?', 'select', 'scanner_modelo', NULL,
    '["MEDIT T-SERIES","3SHAPE E-SERIES","SHINING ACCURA","DENTAL WINGS","IDENTICA","OUTRO"]'::jsonb,
    false, 'Selecione', 80, '1·Captura Digital / Scanner Bancada',
    jsonb_build_object('show_if', jsonb_build_object(
      'logic','AND',
      'rules', jsonb_build_array(
        jsonb_build_object('field_id','#7','op','equals','value','SIM, COM SCANNER DE BANCADA')
      )
    ))),

  -- Workflow 7x3 #3 CAD / Software — scanner ≠ ainda não
  (v_form_id, 'Qual software CAD você utiliza?', 'select', NULL, 'cad_software',
    '["EXOCAD","3SHAPE DENTAL SYSTEM","MEDIT DESIGN","BLUE SKY PLAN","NENHUM","OUTRO"]'::jsonb,
    false, 'Selecione', 90, '2·CAD / Software',
    jsonb_build_object('show_if', jsonb_build_object(
      'logic','AND',
      'rules', jsonb_build_array(
        jsonb_build_object('field_id','#7','op','not_equals','value','AINDA NÃO DIGITALIZO AS MOLDAGENS')
      )
    ))),

  -- Workflow 7x3 #4 Impressora 3D — contato 3D = tenho impressora OU scanner ≠ ainda não
  (v_form_id, 'Qual modelo da sua impressora 3D?', 'select', 'impressora_modelo', NULL,
    '["ANYCUBIC","PHROZEN","CREALITY","ELEGOO","FORMLABS","ASIGA","MIICRAFT","OUTRO","NÃO TENHO"]'::jsonb,
    false, 'Selecione', 100, '3·Impressão 3D / Impressora 3D',
    jsonb_build_object('show_if', jsonb_build_object(
      'logic','OR',
      'rules', jsonb_build_array(
        jsonb_build_object('field_id','#8','op','equals','value','SIM, EU TENHO UMA IMPRESSORA'),
        jsonb_build_object('field_id','#7','op','not_equals','value','AINDA NÃO DIGITALIZO AS MOLDAGENS')
      )
    ))),

  -- Workflow 7x3 #5 Resinas (multi) — quem tem ou já imprimiu
  (v_form_id, 'Quais tipos de resina você já utiliza?', 'checkbox', NULL, 'resinas_utiliza',
    '["MODELO","CIRURGIA GUIADA","COROA TEMPORÁRIA","COROA DEFINITIVA","PROVISÓRIA LONGA DURAÇÃO","SPLINT/PLACA","BASE PROTÉTICA","DENTE PROTÉTICO","MOLDEIRA INDIVIDUAL","NENHUMA AINDA"]'::jsonb,
    false, NULL, 110, '3·Impressão 3D / Resinas',
    jsonb_build_object('show_if', jsonb_build_object(
      'logic','AND',
      'rules', jsonb_build_array(
        jsonb_build_object('field_id','#8','op','not_in','value', jsonb_build_array('NÃO, NUNCA TIVE'))
      )
    )));
END $$;
