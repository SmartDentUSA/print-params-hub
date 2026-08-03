CREATE OR REPLACE FUNCTION public.painel_comercial_kpis(p_mes date DEFAULT (date_trunc('month'::text, now()))::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
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
  WITH omie AS (
    SELECT
      coalesce(sum(CASE WHEN mes_referencia::date = v_ini THEN receita_total END), 0) AS atual,
      coalesce(sum(CASE WHEN mes_referencia::date = v_prev THEN receita_total END), 0) AS anterior
    FROM public.v_receita_mensal
  ), crm AS (
    SELECT
      coalesce(sum(CASE WHEN to_char(d.closed_at AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') = to_char(v_ini,'YYYY-MM') THEN d.value END), 0) AS atual,
      coalesce(sum(CASE WHEN to_char(d.closed_at AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') = to_char(v_prev,'YYYY-MM') THEN d.value END), 0) AS anterior
    FROM public.deals d
    WHERE coalesce(d.is_deleted, false) = false
      AND d.status = 'ganha' AND d.closed_at IS NOT NULL
      AND coalesce(d.pipeline_name, '') <> ALL (ARRAY[
        'Funil Atos','Funil E-book','Tulip-Teste-Nv-Automação','Tulip-Teste-Nv-Automacao',
        'Exportação','Ganhos Aleatórios','Ganhos Aleatórios (CS)','Ganhos Aleatorios'])
  ), rec AS (
    SELECT greatest(omie.atual, crm.atual) AS atual,
           greatest(omie.anterior, crm.anterior) AS anterior
    FROM omie, crm
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
    'leads_periodo_comparado', to_char(v_prev, 'DD/MM') || '–' || to_char(v_prev_fim - 1, 'DD/MM'),
    'funil_atual', funil.abertos,
    'leads_perdidos', perdidos.n,
    'leads_reativados', reativados.n,
    'receita_produtos_total', prod.total,
    'receita_equipamentos', prod.equip,
    'receita_insumos', CASE WHEN prod.total IS NULL THEN NULL ELSE prod.total - coalesce(prod.equip,0) END
  ) INTO r
  FROM rec, leads, funil, perdidos, reativados, prod;
  RETURN r;
END $function$;