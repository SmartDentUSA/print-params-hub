
-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Forecast de Receita
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_revenue_forecast(p_ano integer, p_mes integer)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_inicio_mes timestamptz := make_timestamptz(p_ano, p_mes, 1, 0, 0, 0, 'America/Sao_Paulo');
  v_fim_mes    timestamptz := v_inicio_mes + interval '1 month';
  v_now        timestamptz := now();
  v_dias_no_mes int := EXTRACT(DAY FROM (v_fim_mes - interval '1 day'))::int;
  v_dias_decorridos int := LEAST(v_dias_no_mes,
                                  GREATEST(1, EXTRACT(DAY FROM (v_now AT TIME ZONE 'America/Sao_Paulo'))::int));
  v_dias_restantes  int := GREATEST(0, v_dias_no_mes - v_dias_decorridos);
  v_won_so_far numeric := 0;
  v_deals_won int := 0;
  v_weighted_pipeline numeric := 0;
  v_pipeline_open numeric := 0;
  v_avg_last_3 numeric := 0;
  v_stages jsonb;
  v_pace_projection numeric;
  v_realistic numeric;
  v_optimistic numeric;
  v_conservative numeric;
BEGIN
  -- Ganhos já fechados no mês
  SELECT COALESCE(SUM(value),0), COUNT(*)
    INTO v_won_so_far, v_deals_won
  FROM deals
  WHERE COALESCE(is_deleted,false)=false
    AND status='ganha'
    AND closed_at >= v_inicio_mes
    AND closed_at <  v_fim_mes
    AND COALESCE(pipeline_name,'') NOT IN
        ('Funil Atos','Funil E-book','Tulip-Teste-Nv-Automação','Exportação','Ganhos Aleatórios','Ganhos Aleatórios (CS)');

  -- Pipeline ponderado por etapa (abertos em Funil de vendas)
  WITH stage_weights AS (
    SELECT d.stage_name,
           COUNT(*)::int AS n_deals,
           COALESCE(SUM(d.value),0)::numeric AS valor_aberto,
           CASE
             WHEN d.stage_name ILIKE 'Fechamento%'   THEN 0.60
             WHEN d.stage_name ILIKE 'Negociação%'   THEN 0.40
             WHEN d.stage_name ILIKE 'Proposta%'     THEN 0.30
             WHEN d.stage_name ILIKE 'Apresenta%'    THEN 0.20
             WHEN d.stage_name ILIKE 'C3%'           THEN 0.25
             WHEN d.stage_name ILIKE 'C2%'           THEN 0.15
             WHEN d.stage_name ILIKE 'C1%'           THEN 0.10
             WHEN d.stage_name ILIKE 'Em Contato%'   THEN 0.08
             WHEN d.stage_name ILIKE 'Contato Feito%' THEN 0.05
             WHEN d.stage_name ILIKE 'SDR%'          THEN 0.03
             WHEN d.stage_name ILIKE 'Sem contato%'  THEN 0.02
             ELSE 0.05
           END AS peso
    FROM deals d
    WHERE COALESCE(d.is_deleted,false)=false
      AND d.status='aberta'
      AND d.pipeline_name='Funil de vendas'
      AND d.value > 0
    GROUP BY 1
  )
  SELECT
    COALESCE(SUM(valor_aberto * peso),0),
    COALESCE(SUM(valor_aberto),0),
    COALESCE(jsonb_agg(jsonb_build_object(
      'etapa', stage_name, 'deals', n_deals,
      'valor_aberto', ROUND(valor_aberto,2),
      'peso', peso,
      'valor_ponderado', ROUND(valor_aberto*peso,2)
    ) ORDER BY valor_aberto*peso DESC), '[]'::jsonb)
  INTO v_weighted_pipeline, v_pipeline_open, v_stages
  FROM stage_weights;

  -- Média de receita dos últimos 3 meses fechados
  SELECT COALESCE(AVG(receita_mes),0) INTO v_avg_last_3 FROM (
    SELECT (fn_total_vendas_mes(
      EXTRACT(YEAR  FROM (v_inicio_mes - (i || ' month')::interval))::int,
      EXTRACT(MONTH FROM (v_inicio_mes - (i || ' month')::interval))::int
    )).receita_total AS receita_mes
    FROM generate_series(1,3) i
  ) x;

  -- Projeção por pace (extrapola ritmo do mês)
  v_pace_projection := CASE WHEN v_dias_decorridos > 0
                            THEN (v_won_so_far / v_dias_decorridos) * v_dias_no_mes
                            ELSE v_won_so_far END;

  v_realistic    := v_won_so_far + (v_weighted_pipeline * (v_dias_restantes::numeric / NULLIF(v_dias_no_mes,0)));
  v_optimistic   := v_won_so_far + v_weighted_pipeline;
  v_conservative := GREATEST(v_pace_projection, v_won_so_far + (v_weighted_pipeline * 0.5 * (v_dias_restantes::numeric / NULLIF(v_dias_no_mes,0))));

  RETURN jsonb_build_object(
    'periodo', to_char(make_date(p_ano,p_mes,1),'MM/YYYY'),
    'dias_no_mes', v_dias_no_mes,
    'dias_decorridos', v_dias_decorridos,
    'dias_restantes', v_dias_restantes,
    'ganhos_fechados', jsonb_build_object(
      'receita', ROUND(v_won_so_far,2),
      'deals', v_deals_won
    ),
    'pipeline', jsonb_build_object(
      'valor_aberto_total', ROUND(v_pipeline_open,2),
      'valor_ponderado',    ROUND(v_weighted_pipeline,2),
      'por_etapa', v_stages
    ),
    'historico', jsonb_build_object(
      'media_ultimos_3_meses', ROUND(v_avg_last_3,2),
      'projecao_por_pace',     ROUND(v_pace_projection,2)
    ),
    'forecast', jsonb_build_object(
      'conservador', ROUND(v_conservative,2),
      'realista',    ROUND(v_realistic,2),
      'otimista',    ROUND(v_optimistic,2)
    ),
    'metodologia', 'Pipeline ponderado por etapa (Fechamento 60%, Negociação 40%, Proposta 30%, C3 25%, Apresentação 20%, C2 15%, C1 10%, demais 5%) ajustado pelos dias restantes + ganhos já fechados. Pace = receita até hoje extrapolada para o mês inteiro.'
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Análise de Risco de Churn
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_churn_risk()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_estagnados jsonb;
  v_sem_recompra jsonb;
  v_summary jsonb;
BEGIN
  -- Leads estagnados há > 90 dias no Funil Estagnados
  WITH e AS (
    SELECT d.lead_id, d.piperun_deal_id, d.owner_name, d.stage_name, d.value,
           d.last_stage_updated_at,
           EXTRACT(DAY FROM (now() - d.last_stage_updated_at))::int AS dias_estagnado,
           la.nome, la.email, la.telefone
    FROM deals d
    LEFT JOIN lia_attendances la ON la.id = d.lead_id AND la.merged_into IS NULL
    WHERE COALESCE(d.is_deleted,false)=false
      AND d.status='aberta'
      AND d.pipeline_name='Funil Estagnados'
      AND d.last_stage_updated_at < now() - interval '90 days'
      AND d.owner_name IS NOT NULL AND d.owner_name !~ '^[0-9]+$'
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'lead_id', lead_id, 'piperun_deal_id', piperun_deal_id,
    'nome', nome, 'email', email, 'telefone', telefone,
    'vendedor', owner_name, 'etapa', stage_name,
    'valor_potencial', value, 'dias_estagnado', dias_estagnado,
    'acao_sugerida', CASE
      WHEN dias_estagnado > 180 THEN 'Reativação agressiva ou descarte'
      WHEN dias_estagnado > 120 THEN 'Última tentativa de contato + oferta'
      ELSE 'Retomar follow-up imediato'
    END
  ) ORDER BY dias_estagnado DESC), '[]'::jsonb)
  INTO v_estagnados FROM e;

  -- Clientes com compra ganha mas sem recompra há > 90 dias
  WITH ultima_compra AS (
    SELECT d.lead_id,
           MAX(d.closed_at) AS ultima_compra,
           SUM(d.value) AS receita_historica,
           COUNT(*) AS deals_ganhos,
           (ARRAY_AGG(d.owner_name ORDER BY d.closed_at DESC))[1] AS ultimo_owner
    FROM deals d
    WHERE COALESCE(d.is_deleted,false)=false
      AND d.status='ganha'
      AND d.closed_at IS NOT NULL
      AND d.lead_id IS NOT NULL
    GROUP BY d.lead_id
    HAVING MAX(d.closed_at) < now() - interval '90 days'
  ),
  enriched AS (
    SELECT uc.*, la.nome, la.email, la.telefone,
           EXTRACT(DAY FROM (now() - uc.ultima_compra))::int AS dias_sem_compra
    FROM ultima_compra uc
    JOIN lia_attendances la ON la.id = uc.lead_id AND la.merged_into IS NULL
    WHERE uc.deals_ganhos >= 1
    ORDER BY uc.receita_historica DESC NULLS LAST
    LIMIT 100
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'lead_id', lead_id, 'nome', nome, 'email', email, 'telefone', telefone,
    'vendedor', ultimo_owner,
    'receita_historica', ROUND(receita_historica,2),
    'deals_historicos', deals_ganhos,
    'ultima_compra', ultima_compra,
    'dias_sem_compra', dias_sem_compra,
    'acao_sugerida', CASE
      WHEN dias_sem_compra > 365 THEN 'Reativação completa — possivelmente perdido'
      WHEN dias_sem_compra > 180 THEN 'Contato + oferta de upgrade/insumos'
      ELSE 'Lembrete de recompra de insumos'
    END
  )), '[]'::jsonb)
  INTO v_sem_recompra FROM enriched;

  -- Summary por vendedor
  WITH all_risk AS (
    SELECT (e->>'vendedor') AS vendedor, 'estagnado' AS tipo FROM jsonb_array_elements(v_estagnados) e
    UNION ALL
    SELECT (s->>'vendedor') AS vendedor, 'sem_recompra' FROM jsonb_array_elements(v_sem_recompra) s
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'vendedor', vendedor,
    'leads_estagnados', count(*) FILTER (WHERE tipo='estagnado'),
    'clientes_sem_recompra', count(*) FILTER (WHERE tipo='sem_recompra'),
    'total_em_risco', count(*)
  ) ORDER BY count(*) DESC), '[]'::jsonb)
  INTO v_summary
  FROM all_risk
  WHERE vendedor IS NOT NULL
  GROUP BY vendedor;

  RETURN jsonb_build_object(
    'gerado_em', now(),
    'leads_estagnados_90d', v_estagnados,
    'total_estagnados', jsonb_array_length(v_estagnados),
    'clientes_sem_recompra_90d', v_sem_recompra,
    'total_sem_recompra', jsonb_array_length(v_sem_recompra),
    'summary_por_vendedor', v_summary
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Sugestão de Cross-Sell
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_suggest_cross_sell(p_lead_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_owned jsonb;
  v_suggestions jsonb;
  v_rules jsonb;
  v_total_clientes int;
BEGIN
  -- O que o lead já comprou (deals ganha)
  WITH ganhos AS (
    SELECT lower(trim(COALESCE(di.nome_produto, di.product_name, ''))) AS produto_norm,
           COALESCE(di.nome_produto, di.product_name) AS produto,
           SUM(COALESCE(di.quantidade, di.quantity, 0)) AS qtd,
           SUM(COALESCE(di.valor_total, di.total_value, 0)) AS receita,
           MAX(COALESCE(di.data_proposta, di.deal_date)) AS ultima_compra
    FROM deal_items di
    JOIN deals d ON d.piperun_deal_id::text = di.deal_id::text
    WHERE di.lead_id = p_lead_id
      AND d.status = 'ganha'
      AND COALESCE(d.is_deleted,false) = false
      AND COALESCE(di.nome_produto, di.product_name, '') <> ''
    GROUP BY 1,2
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'produto', produto, 'qtd', qtd,
    'receita', ROUND(receita,2),
    'ultima_compra', ultima_compra
  )), '[]'::jsonb)
  INTO v_owned FROM ganhos;

  -- Co-compra histórica
  WITH owned_set AS (
    SELECT DISTINCT lower(trim(COALESCE(di.nome_produto, di.product_name, ''))) AS p
    FROM deal_items di
    JOIN deals d ON d.piperun_deal_id::text = di.deal_id::text
    WHERE di.lead_id = p_lead_id AND d.status='ganha' AND COALESCE(d.is_deleted,false)=false
      AND COALESCE(di.nome_produto, di.product_name, '') <> ''
  ),
  same_owners AS (
    -- Leads que compraram pelo menos um produto em comum
    SELECT DISTINCT di.lead_id
    FROM deal_items di
    JOIN deals d ON d.piperun_deal_id::text = di.deal_id::text
    WHERE d.status='ganha' AND COALESCE(d.is_deleted,false)=false
      AND di.lead_id IS NOT NULL
      AND di.lead_id <> p_lead_id
      AND lower(trim(COALESCE(di.nome_produto, di.product_name, ''))) IN (SELECT p FROM owned_set)
  ),
  total_owners AS (SELECT count(*) AS n FROM same_owners),
  co_purchased AS (
    SELECT lower(trim(COALESCE(di.nome_produto, di.product_name, ''))) AS produto_norm,
           COALESCE(di.nome_produto, di.product_name) AS produto,
           count(DISTINCT di.lead_id) AS clientes_que_compraram,
           SUM(COALESCE(di.valor_total, di.total_value, 0)) AS receita_total,
           AVG(COALESCE(di.valor_unitario, di.unit_value, 0)) AS preco_medio,
           MAX(di.product_category) AS categoria
    FROM deal_items di
    JOIN deals d ON d.piperun_deal_id::text = di.deal_id::text
    WHERE di.lead_id IN (SELECT lead_id FROM same_owners)
      AND d.status='ganha' AND COALESCE(d.is_deleted,false)=false
      AND COALESCE(di.nome_produto, di.product_name, '') <> ''
      AND lower(trim(COALESCE(di.nome_produto, di.product_name, ''))) NOT IN (SELECT p FROM owned_set)
    GROUP BY 1,2
    HAVING count(DISTINCT di.lead_id) >= 2
    ORDER BY clientes_que_compraram DESC
    LIMIT 15
  )
  SELECT (SELECT n FROM total_owners),
         COALESCE(jsonb_agg(jsonb_build_object(
           'produto', produto,
           'categoria', categoria,
           'clientes_que_compraram', clientes_que_compraram,
           'pct_co_compra', CASE WHEN (SELECT n FROM total_owners) > 0
                                  THEN ROUND((clientes_que_compraram::numeric / (SELECT n FROM total_owners)::numeric) * 100, 1)
                                  ELSE 0 END,
           'preco_medio', ROUND(preco_medio,2),
           'score', ROUND((clientes_que_compraram::numeric / GREATEST((SELECT n FROM total_owners), 1)::numeric) * 100, 1),
           'fonte', 'co_purchase_pattern'
         ) ORDER BY clientes_que_compraram DESC), '[]'::jsonb)
  INTO v_total_clientes, v_suggestions
  FROM co_purchased;

  -- Regras de oportunidade explícitas (Sistema A)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'produto', orr.target_product_name,
    'item_origem', orr.source_item,
    'tipo', orr.action_type,
    'etapa', orr.workflow_stage,
    'vida_util_meses', orr.useful_life_months,
    'fonte', 'opportunity_rule'
  )), '[]'::jsonb)
  INTO v_rules
  FROM opportunity_rules orr
  WHERE orr.active = true
    AND EXISTS (
      SELECT 1 FROM deal_items di
      JOIN deals d ON d.piperun_deal_id::text = di.deal_id::text
      WHERE di.lead_id = p_lead_id AND d.status='ganha'
        AND lower(COALESCE(di.nome_produto, di.product_name, '')) ILIKE '%' || lower(orr.source_item) || '%'
    );

  RETURN jsonb_build_object(
    'lead_id', p_lead_id,
    'produtos_ja_comprados', v_owned,
    'qtd_produtos_comprados', jsonb_array_length(v_owned),
    'sugestoes_co_compra', v_suggestions,
    'sugestoes_regras_sistema_a', v_rules,
    'base_amostral', jsonb_build_object(
      'clientes_similares', v_total_clientes
    ),
    'metodologia', 'Co-compra: clientes que adquiriram os mesmos produtos do lead também compraram estes outros, com no mínimo 2 ocorrências. Score = % de clientes similares que também compraram o item.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_revenue_forecast(integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_churn_risk() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_suggest_cross_sell(uuid) TO authenticated, service_role;
