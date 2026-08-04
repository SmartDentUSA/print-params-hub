-- ============ KPIs: receita 100% CRM (PipeRun), sem Omie ============
CREATE OR REPLACE FUNCTION public.painel_comercial_kpis(p_mes date DEFAULT (date_trunc('month'::text, now()))::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ini date := date_trunc('month', p_mes)::date;
  v_fim date := (date_trunc('month', p_mes) + interval '1 month')::date;
  v_prev date := (date_trunc('month', p_mes) - interval '1 month')::date;
  v_prev_fim date := CASE
    WHEN v_ini = date_trunc('month', now())::date
      THEN least(v_prev + (current_date - v_ini) + 1, v_ini)
    ELSE v_ini
  END;
  r jsonb;
BEGIN
  WITH ganhos AS (
    SELECT
      d.piperun_deal_id::text AS deal_key,
      coalesce((d.closed_at AT TIME ZONE 'America/Sao_Paulo')::date,
               (d.piperun_created_at AT TIME ZONE 'America/Sao_Paulo')::date) AS dia,
      coalesce(nullif(d.value, 0), la.proposals_total_value) AS valor
    FROM public.deals d
    LEFT JOIN public.lia_attendances la ON la.id = d.lead_id
    WHERE coalesce(d.is_deleted, false) = false
      AND d.status = 'ganha'
      AND coalesce(d.pipeline_name, '') <> ALL (ARRAY[
        'Funil Atos','Funil E-book','Tulip-Teste-Nv-Automação','Tulip-Teste-Nv-Automacao',
        'Exportação','Ganhos Aleatórios','Ganhos Aleatórios (CS)','Ganhos Aleatorios'])
  ), rec AS (
    SELECT
      coalesce(sum(valor) FILTER (WHERE dia >= v_ini AND dia < v_fim), 0) AS atual,
      coalesce(sum(valor) FILTER (WHERE dia >= v_prev AND dia < v_prev_fim), 0) AS anterior
    FROM ganhos
  ), leads AS (
    SELECT
      count(*) FILTER (WHERE created_at >= v_ini AND created_at < v_fim) AS atual,
      count(*) FILTER (WHERE created_at >= v_prev AND created_at < v_prev_fim) AS anterior
    FROM public.lia_attendances WHERE merged_into IS NULL
  ), funil AS (
    SELECT count(*) AS abertos FROM public.deals
    WHERE pipeline_name ILIKE '%vendas%' AND coalesce(is_deleted,false) = false AND status = 'aberta'
  ), perdidos AS (
    SELECT count(DISTINCT coalesce(lead_id::text, deal_id::text)) AS n
    FROM public.piperun_stage_transitions
    WHERE pipeline_name ILIKE '%estagnad%' AND transitioned_at >= v_ini AND transitioned_at < v_fim
  ), reativados AS (
    SELECT count(DISTINCT d.lead_id) AS n
    FROM public.deals d
    WHERE d.pipeline_name ILIKE '%vendas%'
      AND coalesce(d.is_deleted,false) = false
      AND d.piperun_created_at >= v_ini AND d.piperun_created_at < v_fim
      AND EXISTS (
        SELECT 1 FROM public.deals e
        WHERE e.lead_id = d.lead_id
          AND e.pipeline_name ILIKE '%estagnad%'
          AND e.piperun_created_at < d.piperun_created_at
      )
  ), prod AS (
    -- Itens das propostas ganhas no CRM (sem Omie). Sem itens => NULL (UI mostra "—")
    SELECT
      sum(coalesce(nullif(di.total_value,0), di.valor_total)) AS total,
      sum(CASE WHEN coalesce(tx.subcategory,'') IN ('scanner_intraoral','scanner_bancada','notebook','impressora','equipamentos')
                 OR coalesce(di.product_category,'') IN ('scanner','impressora_3d','notebook')
               THEN coalesce(nullif(di.total_value,0), di.valor_total) ELSE 0 END) AS equip
    FROM public.deal_items di
    JOIN ganhos g ON g.deal_key = di.deal_id
    LEFT JOIN LATERAL public.painel_match_taxonomy(coalesce(di.product_name, di.nome_produto)) tx ON true
    WHERE g.dia >= v_ini AND g.dia < v_fim
  )
  SELECT jsonb_build_object(
    'mes_ref', to_char(v_ini, 'YYYY-MM'),
    'receita_mes', rec.atual,
    'receita_mes_anterior', rec.anterior,
    'receita_periodo_comparado', to_char(v_prev, 'DD/MM') || '–' || to_char(v_prev_fim - 1, 'DD/MM'),
    'leads_mes', leads.atual,
    'leads_mes_anterior', leads.anterior,
    'leads_periodo_comparado', to_char(v_prev, 'DD/MM') || '–' || to_char(v_prev_fim - 1, 'DD/MM'),
    'funil_atual', funil.abertos,
    'leads_perdidos', perdidos.n,
    'leads_reativados', reativados.n,
    'receita_produtos_total', prod.total,
    'receita_equipamentos', nullif(coalesce(prod.equip, 0), 0),
    'receita_insumos', CASE WHEN prod.total IS NULL THEN NULL ELSE prod.total - coalesce(prod.equip,0) END
  ) INTO r
  FROM rec, leads, funil, perdidos, reativados, prod;
  RETURN r;
END
$function$;

-- ============ Vendedores: receita 100% CRM (PipeRun), sem Omie ============
CREATE OR REPLACE FUNCTION public.painel_vendedores_refresh(p_mes date DEFAULT (date_trunc('month'::text, now()))::date)
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
  ), ganhos_deals AS (
    SELECT d.piperun_deal_id::text deal_key, d.lead_id,
           public.painel_norm_vendedor(d.owner_name) nk,
           coalesce(nullif(d.value,0), 0) valor
    FROM public.deals d
    WHERE coalesce(d.is_deleted,false)=false AND d.status='ganha'
      AND d.closed_at >= v_ini AND d.closed_at < v_fim
      AND coalesce(d.pipeline_name,'') <> ALL (ARRAY[
        'Funil Atos','Funil E-book','Tulip-Teste-Nv-Automação','Tulip-Teste-Nv-Automacao',
        'Exportação','Ganhos Aleatórios','Ganhos Aleatórios (CS)','Ganhos Aleatorios'])
  ), ganhos AS (
    SELECT nk, count(*) pedidos, coalesce(sum(valor),0) crm_valor
    FROM ganhos_deals GROUP BY 1
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
  ), itens AS (
    -- Itens das propostas ganhas no CRM (PipeRun), sem Omie
    SELECT g.nk,
      coalesce(nullif(di.total_value,0), di.valor_total) AS valor_total,
      (coalesce(tx.subcategory,'') IN ('scanner_intraoral','scanner_bancada','notebook','impressora','equipamentos')
        OR coalesce(di.product_category,'') IN ('scanner','impressora_3d','notebook')) AS is_equip,
      EXISTS (
        SELECT 1 FROM public.deals pd
        WHERE pd.lead_id = g.lead_id AND pd.status='ganha'
          AND coalesce(pd.is_deleted,false)=false AND pd.closed_at < v_ini
      ) AS recorrente
    FROM public.deal_items di
    JOIN ganhos_deals g ON g.deal_key = di.deal_id
    LEFT JOIN LATERAL public.painel_match_taxonomy(coalesce(di.product_name, di.nome_produto)) tx ON true
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
    'receita_upsell', rv.upsell,
    -- Fonte única: CRM PipeRun (Omie removido do cálculo)
    'total_vendas', nullif(coalesce(g.crm_valor,0), 0),
    'receita_crm', nullif(coalesce(g.crm_valor,0), 0)
  ) ORDER BY coalesce(g.crm_valor,0) DESC, coalesce(g.pedidos,0) DESC), '[]'::jsonb) INTO v_payload
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
END
$function$;