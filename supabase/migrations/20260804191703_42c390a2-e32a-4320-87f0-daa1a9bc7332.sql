
CREATE OR REPLACE FUNCTION public.painel_norm_vendedor(p_nome text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT nullif(upper(trim(regexp_replace(public.unaccent(coalesce(p_nome,'')), '\s+', ' ', 'g'))), '')
$$;

CREATE OR REPLACE FUNCTION public.painel_comercial_refresh(p_mes date DEFAULT (date_trunc('month'::text, now()))::date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ini date := date_trunc('month', p_mes)::date;
  v_fim date := (date_trunc('month', p_mes) + interval '1 month')::date;
  v_prev date := (date_trunc('month', p_mes) - interval '1 month')::date;
  v_payload jsonb;
BEGIN
  v_payload := public.painel_comercial_kpis(v_ini);
  INSERT INTO public.painel_comercial_cache (bloco, mes, payload, updated_at)
  VALUES ('kpis', v_ini, v_payload, now())
  ON CONFLICT (bloco, mes) DO UPDATE SET payload = excluded.payload, updated_at = now();

  PERFORM public.painel_funil_refresh(v_ini);

  WITH base AS (
    SELECT DISTINCT public.painel_norm_vendedor(d.owner_name) nk, d.owner_name AS vendedor
    FROM public.deals d
    WHERE d.owner_name IS NOT NULL AND coalesce(d.is_deleted,false)=false
      AND (d.piperun_created_at >= v_prev OR d.closed_at >= v_prev)
  ), novos AS (
    SELECT public.painel_norm_vendedor(d.owner_name) nk,
      count(*) FILTER (WHERE d.piperun_created_at >= v_ini AND d.piperun_created_at < v_fim) atual,
      count(*) FILTER (WHERE d.piperun_created_at >= v_prev AND d.piperun_created_at < v_ini) anterior,
      count(*) FILTER (WHERE d.status = 'aberta') abertos,
      count(*) FILTER (WHERE d.piperun_created_at >= v_prev AND d.piperun_created_at < v_fim AND d.status = 'perdida') abandonados,
      count(*) FILTER (WHERE d.piperun_created_at >= v_prev AND d.piperun_created_at < v_fim) pool
    FROM public.deals d
    WHERE coalesce(d.is_deleted,false)=false AND d.pipeline_name ILIKE '%vendas%'
    GROUP BY 1
  ), ganhos AS (
    SELECT public.painel_norm_vendedor(d.owner_name) nk, count(*) pedidos
    FROM public.deals d
    WHERE coalesce(d.is_deleted,false)=false AND d.status='ganha'
      AND d.closed_at >= v_ini AND d.closed_at < v_fim
    GROUP BY 1
  ), dur AS (
    SELECT public.painel_norm_vendedor(t.owner_name) nk,
           public.fn_painel_stage_canon(t.stage_from_name) etapa,
           extract(epoch FROM (t.transitioned_at - lag(t.transitioned_at) OVER (PARTITION BY t.deal_id ORDER BY t.transitioned_at)))/86400 dias
    FROM public.piperun_stage_transitions t
    WHERE t.transitioned_at >= v_prev AND t.transitioned_at < v_fim
  ), tempos AS (
    SELECT nk,
      round(percentile_cont(0.5) WITHIN GROUP (ORDER BY dias) FILTER (WHERE etapa IN ('Sem contato','C1','C2','C3','SDR / Nutrição'))::numeric,1) qualif,
      round(percentile_cont(0.5) WITHIN GROUP (ORDER BY dias) FILTER (WHERE etapa IN ('Apresentação/Visita','Negociação'))::numeric,1) negoc,
      round(percentile_cont(0.5) WITHIN GROUP (ORDER BY dias) FILTER (WHERE etapa IN ('Proposta enviada','Fechamento'))::numeric,1) fecham
    FROM dur WHERE dias IS NOT NULL AND dias > 0 AND nk IS NOT NULL
    GROUP BY 1
  ),
  /* Timeline real dos leads: atividades do CRM (lead_activity_log) */
  tl AS (
    SELECT public.painel_norm_vendedor(coalesce(l.event_data->>'owner', d.owner_name)) nk,
           l.lead_id,
           l.event_data->>'kind' kind,
           coalesce(l.event_data->>'title','') titulo
    FROM public.lead_activity_log l
    LEFT JOIN public.deals d ON d.piperun_deal_id::text = l.event_data->>'deal_id'
    WHERE l.event_type = 'crm_activity'
      AND l.event_timestamp >= v_ini AND l.event_timestamp < v_fim
  ), apres AS (
    SELECT nk,
      count(*) FILTER (WHERE kind = 'reuniao' OR titulo ILIKE '%apresenta%' OR titulo ILIKE '%visita%') total,
      count(DISTINCT lead_id) FILTER (WHERE kind = 'reuniao' OR titulo ILIKE '%apresenta%' OR titulo ILIKE '%visita%') leads_apres
    FROM tl WHERE nk IS NOT NULL GROUP BY 1
  ), apres_ganhos AS (
    SELECT public.painel_norm_vendedor(d.owner_name) nk, count(DISTINCT d.lead_id) ganhas
    FROM public.deals d
    WHERE coalesce(d.is_deleted,false)=false AND d.status='ganha'
      AND d.closed_at >= v_ini AND d.closed_at < v_fim
      AND d.lead_id IN (SELECT lead_id FROM tl WHERE kind='reuniao' OR titulo ILIKE '%apresenta%' OR titulo ILIKE '%visita%')
    GROUP BY 1
  ), itens AS (
    SELECT public.painel_norm_vendedor(coalesce(ov.nome_piperun, pf.vendedor_nome)) nk,
      pf.valor_total,
      (coalesce(tx.subcategory,'') IN ('scanner_intraoral','scanner_bancada','notebook','impressora','equipamentos')
        OR pf.categoria IN ('scanner','impressora_3d','notebook')) AS is_equip,
      EXISTS (
        SELECT 1 FROM public.vw_produtos_faturados h
        WHERE h.cliente_nome = pf.cliente_nome AND h.mes < pf.mes
      ) AS recorrente
    FROM public.vw_produtos_faturados pf
    LEFT JOIN public.omie_vendedores ov
      ON public.painel_norm_vendedor(ov.nome_omie) = public.painel_norm_vendedor(pf.vendedor_nome)
    LEFT JOIN LATERAL public.painel_match_taxonomy(pf.produto_nome) tx ON true
    WHERE pf.mes::date = v_ini AND pf.vendedor_nome IS NOT NULL
  ), receita AS (
    SELECT nk,
      sum(valor_total) FILTER (WHERE NOT is_equip) insumos,
      sum(valor_total) FILTER (WHERE NOT is_equip AND recorrente) insumos_ltv,
      sum(valor_total) FILTER (WHERE NOT is_equip AND NOT recorrente) insumos_novos,
      sum(valor_total) FILTER (WHERE is_equip) equip,
      sum(valor_total) FILTER (WHERE is_equip AND recorrente) upsell,
      sum(valor_total) total
    FROM itens WHERE nk IS NOT NULL GROUP BY 1
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'vendedor', b.vendedor,
    'leads_novos', coalesce(n.atual,0),
    'leads_mes_anterior', coalesce(n.anterior,0),
    'funil_atual', coalesce(n.abertos,0),
    'pedidos', coalesce(g.pedidos,0),
    'pct_abandono', CASE WHEN coalesce(n.pool,0) > 0 THEN round(100.0*n.abandonados/n.pool,1) END,
    't_medio_qualif', t.qualif, 't_medio_negoc', t.negoc, 't_medio_fecham', t.fecham,
    'apresentacoes', coalesce(a.total,0),
    'conversao_apresent', CASE WHEN coalesce(a.leads_apres,0) > 0
      THEN round(100.0*coalesce(ag.ganhas,0)/a.leads_apres,1) END,
    'receita_insumos', rv.insumos, 'receita_insumos_ltv', rv.insumos_ltv,
    'receita_insumos_novos', rv.insumos_novos, 'receita_equip', rv.equip,
    'receita_upsell', rv.upsell, 'total_vendas', rv.total
  ) ORDER BY coalesce(rv.total,0) DESC, coalesce(g.pedidos,0) DESC), '[]'::jsonb) INTO v_payload
  FROM base b
  LEFT JOIN novos n ON n.nk = b.nk
  LEFT JOIN ganhos g ON g.nk = b.nk
  LEFT JOIN tempos t ON t.nk = b.nk
  LEFT JOIN apres a ON a.nk = b.nk
  LEFT JOIN apres_ganhos ag ON ag.nk = b.nk
  LEFT JOIN receita rv ON rv.nk = b.nk;

  INSERT INTO public.painel_comercial_cache (bloco, mes, payload, updated_at)
  VALUES ('vendedores', v_ini, v_payload, now())
  ON CONFLICT (bloco, mes) DO UPDATE SET payload = excluded.payload, updated_at = now();

  WITH atv AS (
    SELECT coalesce(l.event_data->>'owner', d.owner_name) vendedor,
           l.event_data->>'kind' kind,
           coalesce(l.event_data->>'title','') titulo
    FROM public.lead_activity_log l
    LEFT JOIN public.deals d ON d.piperun_deal_id::text = l.event_data->>'deal_id'
    WHERE l.event_type = 'crm_activity'
      AND l.event_timestamp >= v_ini AND l.event_timestamp < v_fim
      AND coalesce(l.event_data->>'owner', d.owner_name) IS NOT NULL
  ), agg AS (
    SELECT public.painel_norm_vendedor(vendedor) nk, min(vendedor) vendedor,
      count(*) FILTER (WHERE kind = 'whatsapp') fop,
      count(*) FILTER (WHERE titulo ILIKE '%tentativa%') tentativa,
      count(*) FILTER (WHERE kind = 'ligacao' AND titulo NOT ILIKE '%tentativa%') ligacao,
      count(*) FILTER (WHERE kind = 'tarefa' AND titulo ILIKE 'atividade%') atividade,
      count(*) FILTER (WHERE kind = 'reuniao' OR titulo ILIKE '%apresenta%' OR titulo ILIKE '%visita%') reuniao,
      count(*) FILTER (WHERE kind = 'email') email,
      count(*) FILTER (WHERE titulo ILIKE '%lembrete%') lembrete,
      count(*) total
    FROM atv GROUP BY 1
  ), fech AS (
    SELECT public.painel_norm_vendedor(d.owner_name) nk, min(d.owner_name) vendedor, count(*) fechados
    FROM public.deals d
    WHERE coalesce(d.is_deleted,false)=false AND d.status='ganha'
      AND d.closed_at >= v_ini AND d.closed_at < v_fim AND d.owner_name IS NOT NULL
    GROUP BY 1
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'vendedor', coalesce(g.vendedor, f.vendedor),
    'fop_whatsapp', coalesce(g.fop,0), 'tentativa_ligacao', coalesce(g.tentativa,0),
    'ligacao', coalesce(g.ligacao,0), 'atividade', coalesce(g.atividade,0),
    'reuniao', coalesce(g.reuniao,0), 'email', coalesce(g.email,0),
    'lembrete', coalesce(g.lembrete,0), 'total', coalesce(g.total,0),
    'fechados', coalesce(f.fechados,0),
    'media_interacoes_fechar', CASE WHEN coalesce(f.fechados,0) > 0 AND coalesce(g.total,0) > 0
      THEN round(g.total::numeric / f.fechados, 1) END
  ) ORDER BY coalesce(g.total,0) DESC), '[]'::jsonb) INTO v_payload
  FROM agg g FULL JOIN fech f ON f.nk = g.nk;

  INSERT INTO public.painel_comercial_cache (bloco, mes, payload, updated_at)
  VALUES ('atividades', v_ini, v_payload, now())
  ON CONFLICT (bloco, mes) DO UPDATE SET payload = excluded.payload, updated_at = now();

  WITH l AS (
    SELECT la.id, coalesce(nullif(trim(la.origem_primeiro_contato),''), 'Não informado') origem,
           coalesce(nullif(trim(la.origem_campanha),''), 'Sem campanha') campanha, la.created_at
    FROM public.lia_attendances la
    WHERE la.merged_into IS NULL AND la.created_at >= v_ini AND la.created_at < v_fim
  ), d AS (
    SELECT l.origem, l.campanha, l.id lead_id, l.created_at,
           dd.status, dd.stage_name, dd.value, dd.closed_at
    FROM l LEFT JOIN public.deals dd
      ON dd.lead_id = l.id AND coalesce(dd.is_deleted,false)=false
  ), perda AS (
    SELECT origem, campanha, stage_name,
           row_number() OVER (PARTITION BY origem, campanha ORDER BY count(*) DESC) rn
    FROM d WHERE status = 'perdida' AND stage_name IS NOT NULL
    GROUP BY 1,2,3
  ), agg AS (
    SELECT d.origem, d.campanha,
      count(DISTINCT d.lead_id) leads,
      count(DISTINCT d.lead_id) FILTER (WHERE d.status='aberta') ativos,
      count(DISTINCT d.lead_id) FILTER (WHERE d.status='perdida') perdidos,
      count(DISTINCT d.lead_id) FILTER (WHERE d.status='ganha') ganhos,
      max(pp.stage_name) etapa_perda,
      avg(extract(epoch FROM (d.closed_at - d.created_at))/86400) FILTER (WHERE d.status='ganha') lead_time,
      coalesce(sum(d.value) FILTER (WHERE d.status='ganha'), 0) receita
    FROM d LEFT JOIN perda pp ON pp.origem = d.origem AND pp.campanha = d.campanha AND pp.rn = 1
    GROUP BY 1,2
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'origem', origem, 'campanha', campanha, 'leads_gerados', leads,
    'ativos', ativos, 'perdidos', perdidos,
    'pct_perda', CASE WHEN leads > 0 THEN round(100.0*perdidos/leads,1) END,
    'etapa_maior_perda', etapa_perda, 'ganhos', ganhos,
    'lead_time_dias', round(lead_time::numeric,1),
    'pct_conversao', CASE WHEN leads > 0 THEN round(100.0*ganhos/leads,1) END,
    'receita', receita
  ) ORDER BY leads DESC), '[]'::jsonb) INTO v_payload FROM agg;

  INSERT INTO public.painel_comercial_cache (bloco, mes, payload, updated_at)
  VALUES ('origens', v_ini, v_payload, now())
  ON CONFLICT (bloco, mes) DO UPDATE SET payload = excluded.payload, updated_at = now();

  WITH itens AS (
    SELECT coalesce(tx.workflow_stage, 'nao_classificado') ws,
           coalesce(tx.subcategory, 'outros') sub,
           coalesce(tx.display_name, pf.produto_nome) produto,
           sum(pf.valor_total) receita
    FROM public.vw_produtos_faturados pf
    LEFT JOIN LATERAL public.painel_match_taxonomy(pf.produto_nome) tx ON true
    WHERE pf.mes::date = v_ini AND pf.valor_total IS NOT NULL
    GROUP BY 1,2,3
  ), ranked AS (
    SELECT ws, sub, produto, receita,
           row_number() OVER (PARTITION BY ws, sub ORDER BY receita DESC)::int rn
    FROM itens
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'workflow_stage', ws, 'subcategory', sub, 'posicao', rn,
    'produto', produto, 'receita', round(receita::numeric,2)
  ) ORDER BY ws, sub, rn), '[]'::jsonb) INTO v_payload
  FROM ranked WHERE rn <= 5;

  INSERT INTO public.painel_comercial_cache (bloco, mes, payload, updated_at)
  VALUES ('top_produtos', v_ini, v_payload, now())
  ON CONFLICT (bloco, mes) DO UPDATE SET payload = excluded.payload, updated_at = now();
END $function$;
