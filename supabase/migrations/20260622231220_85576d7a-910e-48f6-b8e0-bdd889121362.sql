
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
  WITH e AS (
    SELECT d.lead_id, d.piperun_deal_id, d.owner_name, d.stage_name, d.value,
           d.last_stage_updated_at,
           EXTRACT(DAY FROM (now() - d.last_stage_updated_at))::int AS dias_estagnado,
           la.nome, la.email, la.telefone_normalized AS telefone
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
    SELECT uc.*, la.nome, la.email, la.telefone_normalized AS telefone,
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
