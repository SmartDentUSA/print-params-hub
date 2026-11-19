CREATE OR REPLACE FUNCTION public.fn_event_lead_stats(p_event_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(event_id uuid, total_leads bigint, by_seller jsonb, by_product jsonb, by_area jsonb, by_especialidade jsonb, tem_scanner_sim bigint, tem_impressora_sim bigint, imprime_placas_sim bigint, imprime_modelos_sim bigint, imprime_nanohibrida_sim bigint, won_leads bigint, won_deals bigint, won_value numeric, imprime_guias_sim bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH submissions AS (
    SELECT DISTINCT ON (l.id, COALESCE((a.event_data->>'event_id')::uuid, ef.event_id))
      l.id AS lead_id, COALESCE((a.event_data->>'event_id')::uuid, ef.event_id) AS event_id, a.event_timestamp AS submitted_at,
      COALESCE(a.event_data->'responses', '[]'::jsonb) AS responses,
      NULLIF(btrim(a.event_data->>'consultor'), '') AS event_consultant,
      NULLIF(btrim(a.event_data->>'produto_interesse'), '') AS event_product
    FROM public.lead_activity_log a
    JOIN public.lia_attendances l0 ON l0.id = a.lead_id
    JOIN public.lia_attendances l ON l.id = COALESCE(l0.merged_into, l0.id) AND l.merged_into IS NULL
    LEFT JOIN public.smartops_forms ef ON ef.name = a.event_data->>'form_name' AND ef.event_id IS NOT NULL
    WHERE a.event_type = 'form_submission'
      AND COALESCE((a.event_data->>'event_id')::uuid, ef.event_id) IS NOT NULL
      AND (p_event_id IS NULL OR COALESCE((a.event_data->>'event_id')::uuid, ef.event_id) = p_event_id)
    ORDER BY l.id, COALESCE((a.event_data->>'event_id')::uuid, ef.event_id), a.event_timestamp DESC
  ),
  answered AS (
    SELECT s.*,
      CASE WHEN ev.event_type = 'campanha_promocional' THEN
        COALESCE(
          (SELECT NULLIF(btrim(d.owner_name), '') FROM public.deals d
            WHERE d.lead_id = s.lead_id AND d.piperun_created_at >= s.submitted_at - interval '10 minutes'
              AND NULLIF(btrim(d.owner_name), '') IS NOT NULL AND d.owner_name !~ '^[0-9]+$'
            ORDER BY d.piperun_created_at ASC LIMIT 1),
          NULLIF(btrim(l.proprietario_lead_crm), ''), 'Sem vendedor no CRM')
      ELSE
        COALESCE(s.event_consultant,
          (SELECT NULLIF(btrim(r->>'value'), '') FROM jsonb_array_elements(s.responses) r WHERE lower(btrim(r->>'label')) = 'consultor' LIMIT 1),
          NULLIF(btrim(tm.nome_completo), ''), 'Sem vendedor no estande')
      END AS seller,
      COALESCE(s.event_product,
        (SELECT NULLIF(btrim(r->>'value'), '') FROM jsonb_array_elements(s.responses) r WHERE lower(btrim(r->>'label')) = 'produto de interesse' LIMIT 1),
        NULLIF(btrim(l.produto_interesse), ''), NULLIF(btrim(l.produto_interesse_auto), ''), 'Não informado') AS produto,
      COALESCE(
        (SELECT NULLIF(btrim(r->>'value'), '') FROM jsonb_array_elements(s.responses) r WHERE lower(btrim(r->>'label')) IN ('área de atuação','qual sua área de atuação','qual sua área de atuação?') LIMIT 1),
        NULLIF(btrim(l.area_atuacao), '')) AS area,
      COALESCE(
        (SELECT NULLIF(btrim(r->>'value'), '') FROM jsonb_array_elements(s.responses) r WHERE lower(btrim(r->>'label')) IN ('especialidade','qual sua especialidade?','qual sua especialidade principal?') LIMIT 1),
        NULLIF(btrim(l.especialidade), '')) AS espec,
      COALESCE(
        (SELECT NULLIF(btrim(r->>'value'), '') FROM jsonb_array_elements(s.responses) r WHERE lower(btrim(r->>'label')) IN ('tem scanner','qual scanner?','qual o modelo do seu scanner intraoral?') LIMIT 1),
        NULLIF(btrim(l.tem_scanner), ''),
        public.fn_event_form_answer(l.form_data, ARRAY['tem scanner','qual scanner?','qual o modelo do seu scanner intraoral?'])) AS v_scanner,
      COALESCE(
        (SELECT NULLIF(btrim(r->>'value'), '') FROM jsonb_array_elements(s.responses) r WHERE lower(btrim(r->>'label')) IN ('tem impresora?','tem impressora?','atualmente você utilza qual impressora no seu dia a dia?','qual impressora você teve contato o utiliza no seu dia a dia?','qual modelo da sua impressora 3d?') LIMIT 1),
        NULLIF(btrim(l.tem_impressora), ''),
        public.fn_event_form_answer(l.form_data, ARRAY['tem impresora?','tem impressora?','atualmente você utilza qual impressora no seu dia a dia?','qual impressora você teve contato o utiliza no seu dia a dia?','qual modelo da sua impressora 3d?'])) AS v_impressora,
      COALESCE(
        (SELECT NULLIF(btrim(r->>'value'), '') FROM jsonb_array_elements(s.responses) r WHERE lower(btrim(r->>'label')) = 'você imprimi placas miorrelaxantes?' LIMIT 1),
        NULLIF(btrim(l.imprime_placas), '')) AS v_placas,
      COALESCE(
        (SELECT NULLIF(btrim(r->>'value'), '') FROM jsonb_array_elements(s.responses) r WHERE lower(btrim(r->>'label')) = 'você imprimi modelos?' LIMIT 1),
        NULLIF(btrim(l.imprime_modelos), '')) AS v_modelos,
      COALESCE(
        (SELECT NULLIF(btrim(r->>'value'), '') FROM jsonb_array_elements(s.responses) r WHERE lower(btrim(r->>'label')) = 'você imprimi com resinas de elementos dentários de longa duração?' LIMIT 1),
        NULLIF(btrim(l.imprime_resinas_ld), '')) AS v_nanohibrida,
      COALESCE(
        (SELECT NULLIF(btrim(r->>'value'), '') FROM jsonb_array_elements(s.responses) r WHERE lower(btrim(r->>'label')) IN ('você imprimi guias cirurgicas?','você imprime guias cirúrgicas?','você imprime guias cirurgicas?') LIMIT 1),
        public.fn_event_form_answer(l.form_data, ARRAY['você imprimi guias cirurgicas?','você imprime guias cirúrgicas?'])) AS v_guias
    FROM submissions s
    JOIN public.lia_attendances l ON l.id = s.lead_id AND l.merged_into IS NULL
    LEFT JOIN public.team_members tm ON tm.id = l.event_consultant_team_member_id
    LEFT JOIN public.smartops_events ev ON ev.id = s.event_id
  ),
  wins AS (
    SELECT a.lead_id, a.event_id, count(d.id)::bigint AS deals_won, COALESCE(sum(COALESCE((SELECT es.valor_final FROM public.event_sales es WHERE es.piperun_deal_id = d.piperun_deal_id::text AND es.event_id = a.event_id LIMIT 1), CASE WHEN COALESCE(d.value,0) > 0 THEN d.value ELSE (SELECT COALESCE(sum(i.total_value),0) FROM public.deal_items i WHERE i.deal_id = d.piperun_deal_id::text AND i.source = 'omie_nf') END)), 0)::numeric AS value_won
    FROM answered a
    LEFT JOIN public.deals d ON d.status = 'ganha' AND COALESCE(d.is_deleted, false) = false
      AND d.lead_id IN (SELECT x.id FROM public.lia_attendances x WHERE x.id = a.lead_id OR x.merged_into = a.lead_id)
      AND (
        EXISTS (SELECT 1 FROM public.smartops_forms sf WHERE sf.event_id = a.event_id AND sf.name = d.origin_name)
        OR (d.closed_at IS NOT NULL AND d.closed_at >= a.submitted_at)
      )
    GROUP BY a.lead_id, a.event_id
  ),
  flags AS (
    SELECT a.*, w.deals_won, w.value_won,
      (a.v_scanner IS NOT NULL AND lower(a.v_scanner) !~ '^(não|nao|nenhum)') AS f_scanner,
      (a.v_impressora IS NOT NULL AND lower(a.v_impressora) !~ '^(não|nao|nenhum)') AS f_impressora,
      (a.v_placas IS NOT NULL AND lower(a.v_placas) ~ '^sim') AS f_placas,
      (a.v_modelos IS NOT NULL AND lower(a.v_modelos) ~ '^sim') AS f_modelos,
      (a.v_nanohibrida IS NOT NULL AND lower(a.v_nanohibrida) ~ '^sim') AS f_nanohibrida,
      (a.v_guias IS NOT NULL AND lower(a.v_guias) ~ '^sim') AS f_guias
    FROM answered a JOIN wins w ON w.lead_id = a.lead_id AND w.event_id = a.event_id
  ),
  sellers AS (SELECT event_id, seller, count(*) AS qtd, count(*) FILTER (WHERE deals_won > 0) AS ganhos, COALESCE(sum(value_won), 0) AS valor FROM flags GROUP BY 1, 2),
  produtos AS (SELECT event_id, produto, count(*) AS qtd FROM flags GROUP BY 1, 2),
  areas AS (SELECT event_id, area, count(*) AS qtd FROM flags WHERE area IS NOT NULL GROUP BY 1, 2),
  especs AS (SELECT event_id, espec, count(*) AS qtd FROM flags WHERE espec IS NOT NULL GROUP BY 1, 2)
  SELECT f.event_id, count(*)::bigint,
    (SELECT COALESCE(jsonb_agg(jsonb_build_object('seller', s.seller, 'qtd', s.qtd, 'ganhos', s.ganhos, 'valor', s.valor) ORDER BY (s.seller IN ('Sem vendedor no estande', 'Sem vendedor no CRM')), s.qtd DESC), '[]'::jsonb) FROM sellers s WHERE s.event_id = f.event_id),
    (SELECT COALESCE(jsonb_agg(jsonb_build_object('produto', p.produto, 'qtd', p.qtd) ORDER BY p.qtd DESC), '[]'::jsonb) FROM produtos p WHERE p.event_id = f.event_id),
    (SELECT COALESCE(jsonb_agg(jsonb_build_object('area', a.area, 'qtd', a.qtd) ORDER BY a.qtd DESC), '[]'::jsonb) FROM areas a WHERE a.event_id = f.event_id),
    (SELECT COALESCE(jsonb_agg(jsonb_build_object('especialidade', sp.espec, 'qtd', sp.qtd) ORDER BY sp.qtd DESC), '[]'::jsonb) FROM especs sp WHERE sp.event_id = f.event_id),
    count(*) FILTER (WHERE f.f_scanner)::bigint,
    count(*) FILTER (WHERE f.f_impressora)::bigint,
    count(*) FILTER (WHERE f.f_placas)::bigint,
    count(*) FILTER (WHERE f.f_modelos)::bigint,
    count(*) FILTER (WHERE f.f_nanohibrida)::bigint,
    COALESCE(NULLIF((SELECT count(DISTINCT COALESCE(es.lead_id::text, es.doc, es.cliente)) FROM public.event_sales es WHERE es.event_id = f.event_id), 0), count(*) FILTER (WHERE f.deals_won > 0))::bigint,
    COALESCE(NULLIF((SELECT count(*) FROM public.event_sales es WHERE es.event_id = f.event_id), 0), COALESCE(sum(f.deals_won), 0))::bigint,
    COALESCE((SELECT sum(es.valor_final) FROM public.event_sales es WHERE es.event_id = f.event_id), COALESCE(sum(f.value_won), 0))::numeric,
    count(*) FILTER (WHERE f.f_guias)::bigint
  FROM flags f GROUP BY f.event_id
$function$;

CREATE OR REPLACE FUNCTION public.fn_form_revenue(p_period_days integer DEFAULT 0)
 RETURNS TABLE(form_id uuid, revenue numeric)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH period AS (
    SELECT CASE WHEN p_period_days <= 0 THEN '1900-01-01'::timestamptz
                ELSE (now() - (p_period_days || ' days')::interval) END AS since
  ),
  f AS (SELECT id, name, event_id FROM smartops_forms),
  sub_raw AS (
    SELECT f.id AS form_id, l.lead_id AS raw_lead, l.event_timestamp AS at
    FROM lead_activity_log l JOIN f ON f.name = l.event_data->>'form_name'
    WHERE l.event_type = 'form_submission' AND f.event_id IS NULL
    UNION ALL
    SELECT f.id, la.id, la.created_at FROM lia_attendances la JOIN f ON f.name = la.form_name
    WHERE coalesce(la.source,'') NOT IN ('loja_integrada','astron_postback') AND f.event_id IS NULL
    UNION ALL
    SELECT f.id, d.lead_id, coalesce(d.piperun_created_at, d.created_at) - interval '1 second'
    FROM deals d JOIN f ON f.name = d.origin_name
    WHERE d.lead_id IS NOT NULL AND COALESCE(d.is_deleted, false) = false AND f.event_id IS NULL
  ),
  subs AS (
    SELECT sr.form_id, COALESCE(la.merged_into, la.id) AS lead_id, min(sr.at) AS first_at
    FROM sub_raw sr JOIN lia_attendances la ON la.id = sr.raw_lead
    GROUP BY 1, 2 HAVING min(sr.at) >= (SELECT since FROM period)
  ),
  won AS MATERIALIZED (
    SELECT d.id, COALESCE(dl.merged_into, dl.id) AS lead_id, COALESCE(d.value, 0)::numeric AS v,
           public.fn_deal_won_at(d.closed_at, d.piperun_updated_at) AS won_at
    FROM deals d JOIN lia_attendances dl ON dl.id = d.lead_id
    WHERE d.status = 'ganha' AND COALESCE(d.is_deleted, false) = false
  )
  SELECT form_id, sum(v) FROM (
    SELECT s.form_id, w.v
    FROM subs s JOIN won w ON w.lead_id = s.lead_id AND w.won_at > s.first_at
    UNION ALL
    SELECT f.id, COALESCE(d.value, 0)::numeric
    FROM deals d JOIN f ON f.name = d.origin_name AND f.event_id IS NOT NULL
    WHERE d.status = 'ganha' AND COALESCE(d.is_deleted, false) = false
      AND public.fn_deal_won_at(d.closed_at, d.piperun_updated_at) >= (SELECT since FROM period)
  ) x GROUP BY form_id;
$function$;

CREATE OR REPLACE FUNCTION public.fn_form_metrics(p_period_days integer DEFAULT 30)
 RETURNS TABLE(form_id uuid, visitors bigint, unique_visitors bigint, leads bigint, deals_won bigint, daily_series jsonb)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' SET statement_timeout TO '30s'
AS $function$
  WITH period AS (
    SELECT CASE WHEN p_period_days <= 0 THEN '1900-01-01'::timestamptz
                ELSE (now() - (p_period_days || ' days')::interval) END AS since
  ),
  f AS (SELECT id, slug, name, event_id FROM smartops_forms),
  fkeys AS (
    SELECT id AS form_id, 'i:' || id::text AS k FROM f
    UNION SELECT id, 'p:/f/' || slug FROM f WHERE slug IS NOT NULL UNION SELECT a.form_id, 'p:/f/' || a.slug FROM public.smartops_form_slug_aliases a
    UNION SELECT id, 'p:/f/lp/' || slug FROM f WHERE slug IS NOT NULL
    UNION SELECT id, 'p:/lp/' || slug FROM f WHERE slug IS NOT NULL
  ),
  pv_keyed AS (
    SELECT lpv.session_id, date_trunc('day', lpv.viewed_at)::date AS day,
      CASE WHEN lpv.extra_data->>'form_id' IS NOT NULL THEN 'i:' || (lpv.extra_data->>'form_id')
      ELSE 'p:' || regexp_replace(split_part(split_part(regexp_replace(lpv.page_path,
        '^https?://(parametros\.|www\.|admin\.)?smartdent\.com\.br(?=/|$)', '', 'i'), '?', 1), '#', 1), '/+$', '') END AS k
    FROM lead_page_views lpv
    WHERE lpv.viewed_at >= (SELECT since FROM period)
  ),
  pv_raw AS (SELECT fk.form_id, p.session_id, p.day FROM pv_keyed p JOIN fkeys fk ON fk.k = p.k),
  pv AS (SELECT form_id, count(*)::bigint AS visitors, count(DISTINCT session_id)::bigint AS unique_visitors FROM pv_raw GROUP BY form_id),
  series AS (
    SELECT form_id, coalesce(jsonb_agg(jsonb_build_object('d', day, 'v', cnt) ORDER BY day), '[]'::jsonb) AS daily_series
    FROM (SELECT form_id, day, count(*)::int AS cnt FROM pv_raw GROUP BY form_id, day) s GROUP BY form_id
  ),
  sub_raw AS (
    SELECT f.id AS form_id, l.lead_id AS raw_lead, l.event_timestamp AS at
    FROM lead_activity_log l JOIN f ON f.name = l.event_data->>'form_name'
    WHERE l.event_type = 'form_submission'
    UNION ALL
    SELECT f.id, la.id, la.created_at FROM lia_attendances la JOIN f ON f.name = la.form_name
    WHERE coalesce(la.source,'') NOT IN ('loja_integrada','astron_postback')
    UNION ALL
    SELECT f.id, d.lead_id, coalesce(d.piperun_created_at, d.created_at) - interval '1 second'
    FROM deals d JOIN f ON f.name = d.origin_name
    WHERE d.lead_id IS NOT NULL AND COALESCE(d.is_deleted, false) = false
  ),
  subs AS (
    SELECT sr.form_id, COALESCE(la.merged_into, la.id) AS lead_id, min(sr.at) AS first_at
    FROM sub_raw sr JOIN lia_attendances la ON la.id = sr.raw_lead
    GROUP BY 1, 2 HAVING min(sr.at) >= (SELECT since FROM period)
  ),
  won AS MATERIALIZED (
    SELECT COALESCE(dl.merged_into, dl.id) AS lead_id,
           max(public.fn_deal_won_at(d.closed_at, d.piperun_updated_at)) AS last_won_at
    FROM deals d JOIN lia_attendances dl ON dl.id = d.lead_id
    WHERE d.status = 'ganha' AND COALESCE(d.is_deleted, false) = false GROUP BY 1
    UNION ALL
    SELECT o.attendance_id, max(o.created_at) FROM loja_integrada_orders o WHERE o.attendance_id IS NOT NULL GROUP BY 1
  ),
  ld AS (SELECT form_id, count(*)::bigint AS leads FROM subs GROUP BY form_id),
  wins AS (
    SELECT s.form_id, count(DISTINCT s.lead_id)::bigint AS deals_won
    FROM subs s JOIN f ON f.id = s.form_id AND f.event_id IS NULL
    JOIN won w ON w.lead_id = s.lead_id AND w.last_won_at > s.first_at GROUP BY s.form_id
    UNION ALL
    SELECT f.id, count(DISTINCT COALESCE(dl.merged_into, dl.id))::bigint
    FROM deals d JOIN f ON f.name = d.origin_name AND f.event_id IS NOT NULL
    JOIN lia_attendances dl ON dl.id = d.lead_id
    WHERE d.status = 'ganha' AND COALESCE(d.is_deleted, false) = false
      AND public.fn_deal_won_at(d.closed_at, d.piperun_updated_at) >= (SELECT since FROM period)
    GROUP BY f.id
  )
  SELECT f.id, coalesce(pv.visitors, 0), coalesce(pv.unique_visitors, 0),
         coalesce(ld.leads, 0), coalesce(wins.deals_won, 0), coalesce(series.daily_series, '[]'::jsonb)
  FROM f LEFT JOIN pv ON pv.form_id = f.id LEFT JOIN ld ON ld.form_id = f.id
  LEFT JOIN wins ON wins.form_id = f.id LEFT JOIN series ON series.form_id = f.id;
$function$;