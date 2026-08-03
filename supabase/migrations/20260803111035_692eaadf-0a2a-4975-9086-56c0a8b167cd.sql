
-- Helper: match a free-text product name against product_taxonomy
CREATE OR REPLACE FUNCTION public.painel_match_taxonomy(p_nome text)
RETURNS TABLE(workflow_stage text, subcategory text, display_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.workflow_stage, t.subcategory, t.display_name
  FROM public.product_taxonomy t
  WHERE p_nome IS NOT NULL
    AND EXISTS (SELECT 1 FROM unnest(t.match_patterns) pat WHERE p_nome ILIKE '%' || pat || '%')
  ORDER BY length(coalesce(t.display_name,'')) DESC
  LIMIT 1
$$;

-- 1) KPI cards
CREATE OR REPLACE FUNCTION public.painel_comercial_kpis(p_mes date DEFAULT date_trunc('month', now())::date)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ini date := date_trunc('month', p_mes)::date;
  v_fim date := (date_trunc('month', p_mes) + interval '1 month')::date;
  v_prev date := (date_trunc('month', p_mes) - interval '1 month')::date;
  r jsonb;
BEGIN
  WITH rec AS (
    SELECT
      coalesce(sum(CASE WHEN mes_referencia::date = v_ini THEN receita_total END), 0) AS atual,
      coalesce(sum(CASE WHEN mes_referencia::date = v_prev THEN receita_total END), 0) AS anterior
    FROM public.v_receita_mensal
  ), leads AS (
    SELECT
      count(*) FILTER (WHERE created_at >= v_ini AND created_at < v_fim) AS atual,
      count(*) FILTER (WHERE created_at >= v_prev AND created_at < v_ini) AS anterior
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
    SELECT
      sum(pf.valor_total) AS total,
      sum(CASE WHEN coalesce(tx.subcategory, '') IN ('scanner_intraoral','scanner_bancada','notebook','impressora','equipamentos')
                 OR pf.categoria IN ('scanner','impressora_3d','notebook')
               THEN pf.valor_total ELSE 0 END) AS equip
    FROM public.vw_produtos_faturados pf
    LEFT JOIN LATERAL public.painel_match_taxonomy(pf.produto_nome) tx ON true
    WHERE pf.mes::date = v_ini
  )
  SELECT jsonb_build_object(
    'mes_ref', to_char(v_ini, 'YYYY-MM'),
    'receita_mes', rec.atual,
    'receita_mes_anterior', rec.anterior,
    'leads_mes', leads.atual,
    'leads_mes_anterior', leads.anterior,
    'funil_atual', funil.abertos,
    'leads_perdidos', perdidos.n,
    'leads_reativados', reativados.n,
    'receita_produtos_total', prod.total,
    'receita_equipamentos', prod.equip,
    'receita_insumos', CASE WHEN prod.total IS NULL THEN NULL ELSE prod.total - coalesce(prod.equip,0) END
  ) INTO r
  FROM rec, leads, funil, perdidos, reativados, prod;
  RETURN r;
END $$;

-- 2) Funnel by stage
CREATE OR REPLACE FUNCTION public.painel_comercial_funil()
RETURNS TABLE(etapa text, ordem int, atual bigint, media_dias numeric, pct_perda numeric, qtd_saidas bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH ordem AS (
    SELECT * FROM (VALUES
      ('Sem contato',1),('C1',2),('C2',3),('C3',4),('SDR / Nutrição',5),
      ('Apresentação/Visita',6),('Negociação',7),('Proposta enviada',8),('Fechamento',9)
    ) v(etapa, ord)
  ), abertos AS (
    SELECT stage_name, count(*) n FROM public.deals
    WHERE pipeline_name ILIKE '%vendas%' AND coalesce(is_deleted,false)=false AND status='aberta'
    GROUP BY 1
  ), trans AS (
    SELECT etapa AS stage_name, sum(qtd_saidas) qtd, avg(media_dias_na_etapa) dias,
           sum(saiu_perdido) perdido
    FROM public.v_bi_stage_transitions
    WHERE pipeline ILIKE '%vendas%'
    GROUP BY 1
  )
  SELECT o.etapa, o.ord,
         coalesce(a.n, 0),
         round(t.dias::numeric, 1),
         CASE WHEN coalesce(t.qtd,0) > 0 THEN round(100.0 * t.perdido / t.qtd, 1) END,
         coalesce(t.qtd, 0)
  FROM ordem o
  LEFT JOIN abertos a ON a.stage_name = o.etapa
  LEFT JOIN trans t ON t.stage_name = o.etapa
  ORDER BY o.ord
$$;

-- 3) Seller performance
CREATE OR REPLACE FUNCTION public.painel_comercial_vendedores(p_mes date DEFAULT date_trunc('month', now())::date)
RETURNS TABLE(
  vendedor text, leads_novos bigint, leads_mes_anterior bigint, funil_atual bigint,
  pedidos bigint, pct_abandono numeric, t_medio_qualif numeric, t_medio_negoc numeric,
  t_medio_fecham numeric, apresentacoes bigint, conversao_apresent numeric,
  receita_insumos numeric, receita_insumos_ltv numeric, receita_insumos_novos numeric,
  receita_equip numeric, receita_upsell numeric, total_vendas numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH params AS (
    SELECT date_trunc('month', p_mes)::date AS ini,
           (date_trunc('month', p_mes) + interval '1 month')::date AS fim,
           (date_trunc('month', p_mes) - interval '1 month')::date AS prev
  ), base AS (
    SELECT DISTINCT d.owner_name AS vendedor
    FROM public.deals d, params p
    WHERE d.owner_name IS NOT NULL AND coalesce(d.is_deleted,false)=false
      AND (d.piperun_created_at >= p.prev OR d.closed_at >= p.prev)
  ), novos AS (
    SELECT d.owner_name vendedor,
      count(*) FILTER (WHERE d.piperun_created_at >= p.ini AND d.piperun_created_at < p.fim) atual,
      count(*) FILTER (WHERE d.piperun_created_at >= p.prev AND d.piperun_created_at < p.ini) anterior,
      count(*) FILTER (WHERE d.status = 'aberta') abertos,
      count(*) FILTER (WHERE d.piperun_created_at >= p.prev AND d.piperun_created_at < p.fim
                         AND (d.status = 'perdida' OR d.pipeline_name ILIKE '%estagnad%')) abandonados,
      count(*) FILTER (WHERE d.piperun_created_at >= p.prev AND d.piperun_created_at < p.fim) pool
    FROM public.deals d, params p
    WHERE coalesce(d.is_deleted,false)=false AND d.pipeline_name ILIKE '%vendas%'
    GROUP BY 1
  ), ganhos AS (
    SELECT d.owner_name vendedor, count(*) pedidos
    FROM public.deals d, params p
    WHERE coalesce(d.is_deleted,false)=false AND d.status='ganha'
      AND d.closed_at >= p.ini AND d.closed_at < p.fim
    GROUP BY 1
  ), dur AS (
    SELECT t.owner_name vendedor, t.etapa_from, t.stage_from_name,
           extract(epoch FROM (t.transitioned_at - lag(t.transitioned_at) OVER (PARTITION BY t.deal_id ORDER BY t.transitioned_at)))/86400 dias
    FROM public.piperun_stage_transitions t, params p
    WHERE t.transitioned_at >= p.prev AND t.transitioned_at < p.fim
  ), tempos AS (
    SELECT vendedor,
      round(avg(dias) FILTER (WHERE stage_from_name IN ('Sem contato','C1','C2','C3','SDR / Nutrição','Contato Feito','Em Contato'))::numeric,1) qualif,
      round(avg(dias) FILTER (WHERE stage_from_name IN ('Apresentação/Visita','Negociação'))::numeric,1) negoc,
      round(avg(dias) FILTER (WHERE stage_from_name IN ('Proposta enviada','Proposta enviada (TEMP)','Fechamento'))::numeric,1) fecham
    FROM dur WHERE dias IS NOT NULL AND dias >= 0 AND vendedor IS NOT NULL
    GROUP BY 1
  ), reunioes AS (
    SELECT a.vendedor_atividade vendedor,
      count(*) total,
      count(*) FILTER (WHERE a.status_oportunidade = 'ganha') ganhas
    FROM public.v_bi_atividades_unnested a, params p
    WHERE a.tipo_atividade = 'Reunião' AND a.inicio >= p.ini AND a.inicio < p.fim
    GROUP BY 1
  ), itens AS (
    SELECT pf.vendedor_nome vendedor, pf.valor_total,
      (coalesce(tx.subcategory,'') IN ('scanner_intraoral','scanner_bancada','notebook','impressora','equipamentos')
        OR pf.categoria IN ('scanner','impressora_3d','notebook')) AS is_equip,
      EXISTS (
        SELECT 1 FROM public.vw_produtos_faturados h
        WHERE h.cliente_nome = pf.cliente_nome AND h.mes < pf.mes
      ) AS recorrente
    FROM public.vw_produtos_faturados pf, params p
    LEFT JOIN LATERAL public.painel_match_taxonomy(pf.produto_nome) tx ON true
    WHERE pf.mes::date = p.ini AND pf.vendedor_nome IS NOT NULL
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
  SELECT b.vendedor,
    coalesce(n.atual,0), coalesce(n.anterior,0), coalesce(n.abertos,0),
    coalesce(g.pedidos,0),
    CASE WHEN coalesce(n.pool,0) > 0 THEN round(100.0*n.abandonados/n.pool,1) END,
    t.qualif, t.negoc, t.fecham,
    coalesce(r.total,0),
    CASE WHEN coalesce(r.total,0) > 0 THEN round(100.0*r.ganhas/r.total,1) END,
    rv.insumos, rv.insumos_ltv, rv.insumos_novos, rv.equip, rv.upsell, rv.total
  FROM base b
  LEFT JOIN novos n ON n.vendedor = b.vendedor
  LEFT JOIN ganhos g ON g.vendedor = b.vendedor
  LEFT JOIN tempos t ON t.vendedor = b.vendedor
  LEFT JOIN reunioes r ON r.vendedor = b.vendedor
  LEFT JOIN receita rv ON rv.vendedor = b.vendedor
  ORDER BY coalesce(rv.total,0) DESC, coalesce(g.pedidos,0) DESC
$$;

-- 4) Activities per seller
CREATE OR REPLACE FUNCTION public.painel_comercial_atividades(p_mes date DEFAULT date_trunc('month', now())::date)
RETURNS TABLE(
  vendedor text, fop_whatsapp bigint, tentativa_ligacao bigint, ligacao bigint,
  atividade bigint, reuniao bigint, email bigint, lembrete bigint, total bigint,
  fechados bigint, media_interacoes_fechar numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH params AS (
    SELECT date_trunc('month', p_mes)::date ini, (date_trunc('month', p_mes) + interval '1 month')::date fim
  ), atv AS (
    SELECT a.vendedor_atividade vendedor, a.tipo_atividade, a.deal_id
    FROM public.v_bi_atividades_unnested a, params p
    WHERE a.inicio >= p.ini AND a.inicio < p.fim AND a.vendedor_atividade IS NOT NULL
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
    SELECT d.owner_name vendedor, count(*) fechados,
           array_agg(d.piperun_deal_id) deal_ids
    FROM public.deals d, params p
    WHERE coalesce(d.is_deleted,false)=false AND d.status='ganha'
      AND d.closed_at >= p.ini AND d.closed_at < p.fim AND d.owner_name IS NOT NULL
    GROUP BY 1
  ), inter AS (
    SELECT f.vendedor, count(a.*) n
    FROM fech f
    LEFT JOIN public.v_bi_atividades_unnested a ON a.deal_id = ANY(f.deal_ids)
    GROUP BY 1
  )
  SELECT coalesce(g.vendedor, f.vendedor),
    coalesce(g.fop,0), coalesce(g.tentativa,0), coalesce(g.ligacao,0), coalesce(g.atividade,0),
    coalesce(g.reuniao,0), coalesce(g.email,0), coalesce(g.lembrete,0), coalesce(g.total,0),
    coalesce(f.fechados,0),
    CASE WHEN coalesce(f.fechados,0) > 0 AND i.n IS NOT NULL THEN round(i.n::numeric / f.fechados, 1) END
  FROM agg g
  FULL JOIN fech f ON f.vendedor = g.vendedor
  LEFT JOIN inter i ON i.vendedor = f.vendedor
  ORDER BY coalesce(g.total,0) DESC
$$;

-- 5) Lead origins
CREATE OR REPLACE FUNCTION public.painel_comercial_origens(p_mes date DEFAULT date_trunc('month', now())::date)
RETURNS TABLE(
  origem text, campanha text, leads_gerados bigint, ativos bigint, perdidos bigint,
  pct_perda numeric, etapa_maior_perda text, ganhos bigint, lead_time_dias numeric,
  pct_conversao numeric, receita numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH params AS (
    SELECT date_trunc('month', p_mes)::date ini, (date_trunc('month', p_mes) + interval '1 month')::date fim
  ), l AS (
    SELECT la.id, coalesce(nullif(trim(la.origem_primeiro_contato),''), 'Não informado') origem,
           coalesce(nullif(trim(la.origem_campanha),''), 'Sem campanha') campanha, la.created_at
    FROM public.lia_attendances la, params p
    WHERE la.merged_into IS NULL AND la.created_at >= p.ini AND la.created_at < p.fim
  ), d AS (
    SELECT l.origem, l.campanha, l.id lead_id, l.created_at,
           dd.status, dd.stage_name, dd.value, dd.closed_at, dd.pipeline_name
    FROM l LEFT JOIN public.deals dd
      ON dd.lead_id = l.id AND coalesce(dd.is_deleted,false)=false
  ), perda AS (
    SELECT origem, campanha, stage_name, count(*) n,
           row_number() OVER (PARTITION BY origem, campanha ORDER BY count(*) DESC) rn
    FROM d WHERE status = 'perdida' AND stage_name IS NOT NULL
    GROUP BY 1,2,3
  )
  SELECT d.origem, d.campanha,
    count(DISTINCT d.lead_id),
    count(DISTINCT d.lead_id) FILTER (WHERE d.status = 'aberta'),
    count(DISTINCT d.lead_id) FILTER (WHERE d.status = 'perdida'),
    CASE WHEN count(DISTINCT d.lead_id) > 0
      THEN round(100.0 * count(DISTINCT d.lead_id) FILTER (WHERE d.status='perdida') / count(DISTINCT d.lead_id), 1) END,
    max(pp.stage_name),
    count(DISTINCT d.lead_id) FILTER (WHERE d.status = 'ganha'),
    round(avg(extract(epoch FROM (d.closed_at - d.created_at))/86400) FILTER (WHERE d.status='ganha')::numeric, 1),
    CASE WHEN count(DISTINCT d.lead_id) > 0
      THEN round(100.0 * count(DISTINCT d.lead_id) FILTER (WHERE d.status='ganha') / count(DISTINCT d.lead_id), 1) END,
    coalesce(sum(d.value) FILTER (WHERE d.status='ganha'), 0)
  FROM d
  LEFT JOIN perda pp ON pp.origem = d.origem AND pp.campanha = d.campanha AND pp.rn = 1
  GROUP BY d.origem, d.campanha
  ORDER BY count(DISTINCT d.lead_id) DESC
$$;

-- 6) Top products by workflow stage + subcategory
CREATE OR REPLACE FUNCTION public.painel_comercial_top_produtos(p_mes date DEFAULT date_trunc('month', now())::date)
RETURNS TABLE(workflow_stage text, subcategory text, posicao int, produto text, receita numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH params AS (SELECT date_trunc('month', p_mes)::date ini),
  itens AS (
    SELECT coalesce(tx.workflow_stage, 'nao_classificado') ws,
           coalesce(tx.subcategory, 'outros') sub,
           coalesce(tx.display_name, pf.produto_nome) produto,
           sum(pf.valor_total) receita
    FROM public.vw_produtos_faturados pf, params p
    LEFT JOIN LATERAL public.painel_match_taxonomy(pf.produto_nome) tx ON true
    WHERE pf.mes::date = p.ini AND pf.valor_total IS NOT NULL
    GROUP BY 1,2,3
  ), ranked AS (
    SELECT ws, sub, produto, receita,
           row_number() OVER (PARTITION BY ws, sub ORDER BY receita DESC)::int rn
    FROM itens
  )
  SELECT ws, sub, rn, produto, round(receita::numeric, 2) FROM ranked WHERE rn <= 5
  ORDER BY ws, sub, rn
$$;

GRANT EXECUTE ON FUNCTION public.painel_match_taxonomy(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.painel_comercial_kpis(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.painel_comercial_funil() TO authenticated;
GRANT EXECUTE ON FUNCTION public.painel_comercial_vendedores(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.painel_comercial_atividades(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.painel_comercial_origens(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.painel_comercial_top_produtos(date) TO authenticated;
