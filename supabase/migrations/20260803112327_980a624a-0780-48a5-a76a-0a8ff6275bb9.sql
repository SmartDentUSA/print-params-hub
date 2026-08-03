
CREATE OR REPLACE FUNCTION public.painel_comercial_refresh(p_mes date DEFAULT date_trunc('month', now())::date)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
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

  WITH ordem AS (
    SELECT * FROM (VALUES
      ('Sem contato',1),('C1',2),('C2',3),('C3',4),('SDR / Nutrição',5),
      ('Apresentação/Visita',6),('Negociação',7),('Proposta enviada',8),('Fechamento',9)
    ) v(etapa, ord)
  ), abertos AS (
    SELECT stage_name, count(*) n FROM public.deals
    WHERE pipeline_name ILIKE '%vendas%' AND coalesce(is_deleted,false)=false AND status='aberta'
    GROUP BY 1
  ), dur AS (
    SELECT t.stage_from_name, t.deal_status,
           extract(epoch FROM (t.transitioned_at - lag(t.transitioned_at) OVER (PARTITION BY t.deal_id ORDER BY t.transitioned_at)))/86400 dias
    FROM public.piperun_stage_transitions t
    WHERE t.transitioned_at >= now() - interval '90 days'
      AND t.pipeline_name ILIKE '%vendas%'
  ), trans AS (
    SELECT stage_from_name,
           count(*) qtd,
           avg(dias) FILTER (WHERE dias >= 0) dias,
           count(*) FILTER (WHERE deal_status = 'perdida') perdido
    FROM dur WHERE stage_from_name IS NOT NULL
    GROUP BY 1
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'etapa', o.etapa, 'ordem', o.ord, 'atual', coalesce(a.n,0),
    'media_dias', round(t.dias::numeric,1),
    'pct_perda', CASE WHEN coalesce(t.qtd,0) > 0 THEN round(100.0*t.perdido/t.qtd,1) END,
    'qtd_saidas', coalesce(t.qtd,0)
  ) ORDER BY o.ord), '[]'::jsonb) INTO v_payload
  FROM ordem o
  LEFT JOIN abertos a ON a.stage_name = o.etapa
  LEFT JOIN trans t ON t.stage_from_name = o.etapa;

  INSERT INTO public.painel_comercial_cache (bloco, mes, payload, updated_at)
  VALUES ('funil', v_ini, v_payload, now())
  ON CONFLICT (bloco, mes) DO UPDATE SET payload = excluded.payload, updated_at = now();

  WITH base AS (
    SELECT DISTINCT d.owner_name AS vendedor
    FROM public.deals d
    WHERE d.owner_name IS NOT NULL AND coalesce(d.is_deleted,false)=false
      AND (d.piperun_created_at >= v_prev OR d.closed_at >= v_prev)
  ), novos AS (
    SELECT d.owner_name vendedor,
      count(*) FILTER (WHERE d.piperun_created_at >= v_ini AND d.piperun_created_at < v_fim) atual,
      count(*) FILTER (WHERE d.piperun_created_at >= v_prev AND d.piperun_created_at < v_ini) anterior,
      count(*) FILTER (WHERE d.status = 'aberta') abertos,
      count(*) FILTER (WHERE d.piperun_created_at >= v_prev AND d.piperun_created_at < v_fim AND d.status = 'perdida') abandonados,
      count(*) FILTER (WHERE d.piperun_created_at >= v_prev AND d.piperun_created_at < v_fim) pool
    FROM public.deals d
    WHERE coalesce(d.is_deleted,false)=false AND d.pipeline_name ILIKE '%vendas%'
    GROUP BY 1
  ), ganhos AS (
    SELECT d.owner_name vendedor, count(*) pedidos
    FROM public.deals d
    WHERE coalesce(d.is_deleted,false)=false AND d.status='ganha'
      AND d.closed_at >= v_ini AND d.closed_at < v_fim
    GROUP BY 1
  ), dur AS (
    SELECT t.owner_name vendedor, t.stage_from_name,
           extract(epoch FROM (t.transitioned_at - lag(t.transitioned_at) OVER (PARTITION BY t.deal_id ORDER BY t.transitioned_at)))/86400 dias
    FROM public.piperun_stage_transitions t
    WHERE t.transitioned_at >= v_prev AND t.transitioned_at < v_fim
  ), tempos AS (
    SELECT vendedor,
      round(avg(dias) FILTER (WHERE stage_from_name IN ('Sem contato','C1','C2','C3','SDR / Nutrição'))::numeric,1) qualif,
      round(avg(dias) FILTER (WHERE stage_from_name IN ('Apresentação/Visita','Negociação'))::numeric,1) negoc,
      round(avg(dias) FILTER (WHERE stage_from_name IN ('Proposta enviada','Fechamento'))::numeric,1) fecham
    FROM dur WHERE dias IS NOT NULL AND dias >= 0 AND vendedor IS NOT NULL
    GROUP BY 1
  ), reunioes AS (
    SELECT a.vendedor_atividade vendedor,
      count(*) total,
      count(*) FILTER (WHERE a.status_oportunidade = 'ganha') ganhas
    FROM public.v_bi_atividades_unnested a
    WHERE a.tipo_atividade = 'Reunião' AND a.inicio >= v_ini AND a.inicio < v_fim
    GROUP BY 1
  ), itens AS (
    SELECT pf.vendedor_nome vendedor, pf.valor_total,
      (coalesce(tx.subcategory,'') IN ('scanner_intraoral','scanner_bancada','notebook','impressora','equipamentos')
        OR pf.categoria IN ('scanner','impressora_3d','notebook')) AS is_equip,
      EXISTS (
        SELECT 1 FROM public.vw_produtos_faturados h
        WHERE h.cliente_nome = pf.cliente_nome AND h.mes < pf.mes
      ) AS recorrente
    FROM public.vw_produtos_faturados pf
    LEFT JOIN LATERAL public.painel_match_taxonomy(pf.produto_nome) tx ON true
    WHERE pf.mes::date = v_ini AND pf.vendedor_nome IS NOT NULL
  ), receita AS (
    SELECT vendedor,
      sum(valor_total) FILTER (WHERE NOT is_equip) insumos,
      sum(valor_total) FILTER (WHERE NOT is_equip AND recorrente) insumos_ltv,
      sum(valor_total) FILTER (WHERE NOT is_equip AND NOT recorrente) insumos_novos,
      sum(valor_total) FILTER (WHERE is_equip) equip,
      sum(valor_total) FILTER (WHERE is_equip AND recorrente) upsell,
      sum(valor_total) total
    FROM itens GROUP BY 1
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'vendedor', b.vendedor,
    'leads_novos', coalesce(n.atual,0),
    'leads_mes_anterior', coalesce(n.anterior,0),
    'funil_atual', coalesce(n.abertos,0),
    'pedidos', coalesce(g.pedidos,0),
    'pct_abandono', CASE WHEN coalesce(n.pool,0) > 0 THEN round(100.0*n.abandonados/n.pool,1) END,
    't_medio_qualif', t.qualif, 't_medio_negoc', t.negoc, 't_medio_fecham', t.fecham,
    'apresentacoes', coalesce(r.total,0),
    'conversao_apresent', CASE WHEN coalesce(r.total,0) > 0 THEN round(100.0*r.ganhas/r.total,1) END,
    'receita_insumos', rv.insumos, 'receita_insumos_ltv', rv.insumos_ltv,
    'receita_insumos_novos', rv.insumos_novos, 'receita_equip', rv.equip,
    'receita_upsell', rv.upsell, 'total_vendas', rv.total
  ) ORDER BY coalesce(rv.total,0) DESC, coalesce(g.pedidos,0) DESC), '[]'::jsonb) INTO v_payload
  FROM base b
  LEFT JOIN novos n ON n.vendedor = b.vendedor
  LEFT JOIN ganhos g ON g.vendedor = b.vendedor
  LEFT JOIN tempos t ON t.vendedor = b.vendedor
  LEFT JOIN reunioes r ON r.vendedor = b.vendedor
  LEFT JOIN receita rv ON rv.vendedor = b.vendedor;

  INSERT INTO public.painel_comercial_cache (bloco, mes, payload, updated_at)
  VALUES ('vendedores', v_ini, v_payload, now())
  ON CONFLICT (bloco, mes) DO UPDATE SET payload = excluded.payload, updated_at = now();

  WITH atv AS (
    SELECT a.vendedor_atividade vendedor, a.tipo_atividade
    FROM public.v_bi_atividades_unnested a
    WHERE a.inicio >= v_ini AND a.inicio < v_fim AND a.vendedor_atividade IS NOT NULL
  ), agg AS (
    SELECT vendedor,
      count(*) FILTER (WHERE tipo_atividade ILIKE '%whats%') fop,
      count(*) FILTER (WHERE tipo_atividade ILIKE '%tentativa%') tentativa,
      count(*) FILTER (WHERE tipo_atividade = 'Ligação') ligacao,
      count(*) FILTER (WHERE tipo_atividade ILIKE 'Atividade%') atividade,
      count(*) FILTER (WHERE tipo_atividade = 'Reunião') reuniao,
      count(*) FILTER (WHERE tipo_atividade ILIKE '%mail%') email,
      count(*) FILTER (WHERE tipo_atividade ILIKE '%lembrete%') lembrete,
      count(*) total
    FROM atv GROUP BY 1
  ), fech AS (
    SELECT d.owner_name vendedor, count(*) fechados
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
  FROM agg g FULL JOIN fech f ON f.vendedor = g.vendedor;

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
END $fn$;
