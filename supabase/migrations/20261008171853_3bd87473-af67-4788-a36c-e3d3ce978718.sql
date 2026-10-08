CREATE OR REPLACE FUNCTION public.fn_event_lead_stats(p_event_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(event_id uuid, total_leads bigint, by_seller jsonb, by_product jsonb, by_area jsonb, by_especialidade jsonb, tem_scanner_sim bigint, tem_impressora_sim bigint, imprime_placas_sim bigint, imprime_modelos_sim bigint, imprime_nanohibrida_sim bigint, won_leads bigint, won_deals bigint, won_value numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH submissions AS (
    SELECT DISTINCT ON (a.lead_id, (a.event_data->>'event_id')::uuid)
      a.lead_id,
      (a.event_data->>'event_id')::uuid AS event_id,
      a.event_timestamp AS submitted_at,
      COALESCE(a.event_data->'responses', '[]'::jsonb) AS responses,
      NULLIF(btrim(a.event_data->>'consultor'), '') AS event_consultant,
      NULLIF(btrim(a.event_data->>'produto_interesse'), '') AS event_product
    FROM public.lead_activity_log a
    JOIN public.lia_attendances l
      ON l.id = a.lead_id
     AND l.merged_into IS NULL
    WHERE a.event_type = 'form_submission'
      AND a.event_data->>'event_id' IS NOT NULL
      AND (p_event_id IS NULL OR (a.event_data->>'event_id')::uuid = p_event_id)
    ORDER BY a.lead_id, (a.event_data->>'event_id')::uuid, a.event_timestamp DESC
  ),
  answered AS (
    SELECT
      s.*,
      l.form_data,
      l.event_consultant_team_member_id,
      l.produto_interesse,
      l.produto_interesse_auto,
      l.area_atuacao,
      l.especialidade,
      l.tem_scanner,
      l.tem_impressora,
      l.imprime_placas,
      l.imprime_modelos,
      l.imprime_resinas_ld,
      COALESCE(
        s.event_consultant,
        (SELECT NULLIF(btrim(r->>'value'), '') FROM jsonb_array_elements(s.responses) r WHERE lower(btrim(r->>'label')) = 'consultor' LIMIT 1),
        NULLIF(btrim(tm.nome_completo), ''),
        'Sem vendedor no estande'
      ) AS seller,
      COALESCE(
        s.event_product,
        (SELECT NULLIF(btrim(r->>'value'), '') FROM jsonb_array_elements(s.responses) r WHERE lower(btrim(r->>'label')) = 'produto de interesse' LIMIT 1),
        NULLIF(btrim(l.produto_interesse), ''),
        NULLIF(btrim(l.produto_interesse_auto), ''),
        'Não informado'
      ) AS produto,
      COALESCE(
        (SELECT NULLIF(btrim(r->>'value'), '') FROM jsonb_array_elements(s.responses) r WHERE lower(btrim(r->>'label')) IN ('área de atuação','qual sua área de atuação','qual sua área de atuação?') LIMIT 1),
        NULLIF(btrim(l.area_atuacao), '')
      ) AS area,
      COALESCE(
        (SELECT NULLIF(btrim(r->>'value'), '') FROM jsonb_array_elements(s.responses) r WHERE lower(btrim(r->>'label')) IN ('especialidade','qual sua especialidade?','qual sua especialidade principal?') LIMIT 1),
        NULLIF(btrim(l.especialidade), '')
      ) AS espec,
      COALESCE(
        (SELECT NULLIF(btrim(r->>'value'), '') FROM jsonb_array_elements(s.responses) r WHERE lower(btrim(r->>'label')) IN ('tem scanner','qual scanner?','qual o modelo do seu scanner intraoral?') LIMIT 1),
        NULLIF(btrim(l.tem_scanner), ''),
        public.fn_event_form_answer(l.form_data, ARRAY['tem scanner','qual scanner?','qual o modelo do seu scanner intraoral?'])
      ) AS v_scanner,
      COALESCE(
        (SELECT NULLIF(btrim(r->>'value'), '') FROM jsonb_array_elements(s.responses) r WHERE lower(btrim(r->>'label')) IN ('tem impresora?','tem impressora?','atualmente você utilza qual impressora no seu dia a dia?','qual impressora você teve contato o utiliza no seu dia a dia?','qual modelo da sua impressora 3d?') LIMIT 1),
        NULLIF(btrim(l.tem_impressora), ''),
        public.fn_event_form_answer(l.form_data, ARRAY['tem impresora?','tem impressora?','atualmente você utilza qual impressora no seu dia a dia?','qual impressora você teve contato o utiliza no seu dia a dia?','qual modelo da sua impressora 3d?'])
      ) AS v_impressora,
      COALESCE(
        (SELECT NULLIF(btrim(r->>'value'), '') FROM jsonb_array_elements(s.responses) r WHERE lower(btrim(r->>'label')) = 'você imprimi placas miorrelaxantes?' LIMIT 1),
        NULLIF(btrim(l.imprime_placas), '')
      ) AS v_placas,
      COALESCE(
        (SELECT NULLIF(btrim(r->>'value'), '') FROM jsonb_array_elements(s.responses) r WHERE lower(btrim(r->>'label')) = 'você imprimi modelos?' LIMIT 1),
        NULLIF(btrim(l.imprime_modelos), '')
      ) AS v_modelos,
      COALESCE(
        (SELECT NULLIF(btrim(r->>'value'), '') FROM jsonb_array_elements(s.responses) r WHERE lower(btrim(r->>'label')) = 'você imprimi com resinas de elementos dentários de longa duração?' LIMIT 1),
        NULLIF(btrim(l.imprime_resinas_ld), '')
      ) AS v_nanohibrida
    FROM submissions s
    JOIN public.lia_attendances l ON l.id = s.lead_id AND l.merged_into IS NULL
    LEFT JOIN public.team_members tm ON tm.id = l.event_consultant_team_member_id
  ),
  wins AS (
    SELECT a.lead_id, a.event_id,
      count(d.id)::bigint AS deals_won,
      COALESCE(sum(d.value), 0)::numeric AS value_won
    FROM answered a
    LEFT JOIN public.deals d
      ON d.lead_id = a.lead_id
     AND d.status = 'ganha'
     AND d.closed_at IS NOT NULL
     AND d.closed_at >= a.submitted_at
    GROUP BY a.lead_id, a.event_id
  ),
  flags AS (
    SELECT a.*,
      w.deals_won,
      w.value_won,
      (a.v_scanner IS NOT NULL AND lower(a.v_scanner) !~ '^(não|nao|nenhum)') AS f_scanner,
      (a.v_impressora IS NOT NULL AND lower(a.v_impressora) !~ '^(não|nao|nenhum)') AS f_impressora,
      (a.v_placas IS NOT NULL AND lower(a.v_placas) ~ '^sim') AS f_placas,
      (a.v_modelos IS NOT NULL AND lower(a.v_modelos) ~ '^sim') AS f_modelos,
      (a.v_nanohibrida IS NOT NULL AND lower(a.v_nanohibrida) ~ '^sim') AS f_nanohibrida
    FROM answered a
    JOIN wins w ON w.lead_id = a.lead_id AND w.event_id = a.event_id
  ),
  sellers AS (
    SELECT event_id, seller, count(*) AS qtd, count(*) FILTER (WHERE deals_won > 0) AS ganhos, COALESCE(sum(value_won), 0) AS valor
    FROM flags GROUP BY 1, 2
  ),
  produtos AS (SELECT event_id, produto, count(*) AS qtd FROM flags GROUP BY 1, 2),
  areas AS (SELECT event_id, area, count(*) AS qtd FROM flags WHERE area IS NOT NULL GROUP BY 1, 2),
  especs AS (SELECT event_id, espec, count(*) AS qtd FROM flags WHERE espec IS NOT NULL GROUP BY 1, 2)
  SELECT f.event_id, count(*)::bigint,
    (SELECT COALESCE(jsonb_agg(jsonb_build_object('seller', s.seller, 'qtd', s.qtd, 'ganhos', s.ganhos, 'valor', s.valor) ORDER BY (s.seller = 'Sem vendedor no estande'), s.qtd DESC), '[]'::jsonb) FROM sellers s WHERE s.event_id = f.event_id),
    (SELECT COALESCE(jsonb_agg(jsonb_build_object('produto', p.produto, 'qtd', p.qtd) ORDER BY p.qtd DESC), '[]'::jsonb) FROM produtos p WHERE p.event_id = f.event_id),
    (SELECT COALESCE(jsonb_agg(jsonb_build_object('area', a.area, 'qtd', a.qtd) ORDER BY a.qtd DESC), '[]'::jsonb) FROM areas a WHERE a.event_id = f.event_id),
    (SELECT COALESCE(jsonb_agg(jsonb_build_object('especialidade', sp.espec, 'qtd', sp.qtd) ORDER BY sp.qtd DESC), '[]'::jsonb) FROM especs sp WHERE sp.event_id = f.event_id),
    count(*) FILTER (WHERE f.f_scanner)::bigint,
    count(*) FILTER (WHERE f.f_impressora)::bigint,
    count(*) FILTER (WHERE f.f_placas)::bigint,
    count(*) FILTER (WHERE f.f_modelos)::bigint,
    count(*) FILTER (WHERE f.f_nanohibrida)::bigint,
    count(*) FILTER (WHERE f.deals_won > 0)::bigint,
    COALESCE(sum(f.deals_won), 0)::bigint,
    COALESCE(sum(f.value_won), 0)::numeric
  FROM flags f
  GROUP BY f.event_id
$function$;

REVOKE ALL ON FUNCTION public.fn_event_lead_stats(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_event_lead_stats(uuid) TO authenticated, service_role;