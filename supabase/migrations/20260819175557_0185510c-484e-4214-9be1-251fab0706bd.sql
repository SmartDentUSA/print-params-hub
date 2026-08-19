CREATE OR REPLACE FUNCTION public.fn_search_testimonial_client(p_query text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  q text := btrim(coalesce(p_query, ''));
  digits text;
  v_lead uuid;
  v_lead_row record;
  v_trainings jsonb := '[]'::jsonb;
  v_equip jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.fn_is_team_member() THEN
    RETURN jsonb_build_object('found', false, 'error', 'acesso restrito à equipe Smart Dent');
  END IF;
  IF q = '' THEN
    RETURN jsonb_build_object('found', false, 'error', 'informe e-mail, celular ou ID do negócio');
  END IF;

  digits := regexp_replace(q, '\D', '', 'g');

  IF position('@' in q) > 0 THEN
    SELECT id INTO v_lead FROM lia_attendances
    WHERE merged_into IS NULL AND lower(email) = lower(q)
    ORDER BY updated_at DESC NULLS LAST LIMIT 1;
  END IF;

  IF v_lead IS NULL AND digits <> '' AND length(digits) BETWEEN 3 AND 12 THEN
    SELECT d.lead_id INTO v_lead FROM deals d
    WHERE d.piperun_deal_id::text = digits AND d.lead_id IS NOT NULL
    ORDER BY d.piperun_updated_at DESC NULLS LAST LIMIT 1;

    IF v_lead IS NULL THEN
      SELECT id INTO v_lead FROM lia_attendances
      WHERE merged_into IS NULL AND (piperun_id::text = digits OR pessoa_piperun_id::text = digits)
      ORDER BY updated_at DESC NULLS LAST LIMIT 1;
    END IF;
  END IF;

  IF v_lead IS NULL AND length(digits) >= 8 THEN
    SELECT id INTO v_lead FROM lia_attendances
    WHERE merged_into IS NULL
      AND right(regexp_replace(coalesce(telefone_normalized, telefone_raw, ''), '\D', '', 'g'), 8) = right(digits, 8)
    ORDER BY updated_at DESC NULLS LAST LIMIT 1;
  END IF;

  IF v_lead IS NULL AND length(q) >= 4 THEN
    SELECT id INTO v_lead FROM lia_attendances
    WHERE merged_into IS NULL AND nome ILIKE '%' || q || '%'
    ORDER BY updated_at DESC NULLS LAST LIMIT 1;
  END IF;

  IF v_lead IS NULL THEN
    RETURN jsonb_build_object('found', false, 'error', 'cliente não encontrado');
  END IF;

  SELECT id, nome, email, telefone_normalized, telefone_raw, cidade, uf, empresa_cidade, empresa_uf,
         especialidade, area_atuacao, empresa_nome, instagram
    INTO v_lead_row
  FROM lia_attendances WHERE id = v_lead;

  SELECT coalesce(jsonb_agg(x ORDER BY x->>'start_date' DESC NULLS LAST), '[]'::jsonb) INTO v_trainings
  FROM (
    SELECT DISTINCT ON (t.id) jsonb_build_object(
             'turma_id', t.id,
             'turma_number', t.turma_number,
             'turma_label', t.label,
             'course_id', t.course_id,
             'course_title', c.title,
             'start_date', t.start_date,
             'end_date', t.end_date,
             'enrollment_id', e.id,
             'companion_id', comp.id,
             'participant_name', coalesce(comp.name, e.person_name, v_lead_row.nome),
             'has_depoimentos_folder', (t.drive_subfolders ->> 'videos_depoimentos') IS NOT NULL
           ) AS x
    FROM smartops_course_turmas t
    JOIN smartops_courses c ON c.id = t.course_id
    LEFT JOIN smartops_course_enrollments e
           ON e.turma_id = t.id AND e.lead_id = v_lead
    LEFT JOIN smartops_enrollment_companions comp
           ON comp.lead_id = v_lead
          AND comp.enrollment_id IN (SELECT id FROM smartops_course_enrollments WHERE turma_id = t.id)
    WHERE e.id IS NOT NULL OR comp.id IS NOT NULL
  ) s;

  SELECT coalesce(jsonb_agg(DISTINCT nome), '[]'::jsonb) INTO v_equip
  FROM (
    SELECT btrim(coalesce(di.product_name, di.nome_produto)) AS nome
    FROM deal_items di
    WHERE di.lead_id = v_lead
      AND coalesce(di.product_name, di.nome_produto) IS NOT NULL
      AND btrim(coalesce(di.product_name, di.nome_produto)) <> ''
    LIMIT 400
  ) i;

  RETURN jsonb_build_object(
    'found', true,
    'lead_id', v_lead_row.id,
    'nome', v_lead_row.nome,
    'email', v_lead_row.email,
    'telefone', coalesce(v_lead_row.telefone_normalized, v_lead_row.telefone_raw),
    'cidade', coalesce(v_lead_row.cidade, v_lead_row.empresa_cidade),
    'estado', coalesce(v_lead_row.uf, v_lead_row.empresa_uf),
    'especialidade', coalesce(v_lead_row.especialidade, v_lead_row.area_atuacao),
    'empresa_nome', v_lead_row.empresa_nome,
    'instagram', v_lead_row.instagram,
    'trainings', v_trainings,
    'equipamentos', v_equip
  );
END;
$function$;