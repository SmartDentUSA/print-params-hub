
CREATE OR REPLACE FUNCTION public.painel_vendedores_refresh(p_mes date DEFAULT (date_trunc('month'::text, now()))::date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_ini date := date_trunc('month', p_mes)::date;
  v_fim date := (date_trunc('month', p_mes) + interval '1 month')::date;
  v_prev date := (date_trunc('month', p_mes) - interval '1 month')::date;
  v_payload jsonb;
BEGIN
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
  ), tl AS (
    SELECT public.painel_norm_vendedor(coalesce(l.event_data->>'owner', d.owner_name)) nk,
           l.lead_id,
           l.event_data->>'kind' kind,
           coalesce(l.event_data->>'title','') titulo
    FROM public.lead_activity_log l
    LEFT JOIN public.deals d ON d.piperun_deal_id::text = l.event_data->>'deal_id'
    WHERE l.event_type = 'crm_activity'
      AND l.event_timestamp >= v_ini AND l.event_timestamp < v_fim
  ), tl_apres AS (
    SELECT nk, lead_id FROM tl
    WHERE kind = 'reuniao' OR titulo ILIKE '%apresenta%' OR titulo ILIKE '%visita%'
  ), apres AS (
    SELECT nk, count(*) total, count(DISTINCT lead_id) leads_apres
    FROM tl_apres WHERE nk IS NOT NULL GROUP BY 1
  ), apres_ganhos AS (
    SELECT public.painel_norm_vendedor(d.owner_name) nk, count(DISTINCT d.lead_id) ganhas
    FROM public.deals d
    WHERE coalesce(d.is_deleted,false)=false AND d.status='ganha'
      AND d.closed_at >= v_ini AND d.closed_at < v_fim
      AND d.lead_id IN (SELECT lead_id FROM tl_apres WHERE lead_id IS NOT NULL)
    GROUP BY 1
  ), primeira_compra AS (
    SELECT cliente_nome, min(mes) primeiro_mes
    FROM public.vw_produtos_faturados
    WHERE cliente_nome IS NOT NULL
    GROUP BY 1
  ), itens AS (
    SELECT public.painel_norm_vendedor(coalesce(ov.nome_piperun, pf.vendedor_nome)) nk,
      pf.valor_total,
      (coalesce(tx.subcategory,'') IN ('scanner_intraoral','scanner_bancada','notebook','impressora','equipamentos')
        OR pf.categoria IN ('scanner','impressora_3d','notebook')) AS is_equip,
      (pc.primeiro_mes IS NOT NULL AND pc.primeiro_mes < pf.mes) AS recorrente
    FROM public.vw_produtos_faturados pf
    LEFT JOIN public.omie_vendedores ov
      ON public.painel_norm_vendedor(ov.nome_omie) = public.painel_norm_vendedor(pf.vendedor_nome)
    LEFT JOIN primeira_compra pc ON pc.cliente_nome = pf.cliente_nome
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
END $function$;

CREATE OR REPLACE FUNCTION public.painel_atividades_refresh(p_mes date DEFAULT (date_trunc('month'::text, now()))::date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_ini date := date_trunc('month', p_mes)::date;
  v_fim date := (date_trunc('month', p_mes) + interval '1 month')::date;
  v_payload jsonb;
BEGIN
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
END $function$;
