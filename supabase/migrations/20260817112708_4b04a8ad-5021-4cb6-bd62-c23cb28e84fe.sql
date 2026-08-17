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
  v_prev_fim date := CASE WHEN v_ini = date_trunc('month', now())::date
                          THEN least(v_prev + (current_date - v_ini) + 1, v_ini) ELSE v_ini END;
  r jsonb;
BEGIN
  WITH ganhos AS (
    SELECT d.piperun_deal_id::text AS deal_key,
           (d.closed_at AT TIME ZONE 'America/Sao_Paulo')::date AS dia,
           coalesce(nullif(d.value, 0), 0) AS valor
    FROM public.deals d
    WHERE coalesce(d.is_deleted,false)=false AND d.status='ganha'
      AND d.closed_at IS NOT NULL
      AND coalesce(d.pipeline_name,'') <> ALL (ARRAY[
        'Funil Atos','Funil E-book','Tulip-Teste-Nv-Automação','Tulip-Teste-Nv-Automacao',
        'Exportação','Ganhos Aleatórios','Ganhos Aleatórios (CS)','Ganhos Aleatorios'])
  ), stripe AS (
    SELECT coalesce(sum(unit_total) FILTER (WHERE dia >= v_ini AND dia < v_fim),0) AS atual,
           coalesce(sum(unit_total) FILTER (WHERE dia >= v_prev AND dia < v_prev_fim),0) AS anterior
    FROM (SELECT coalesce(nullif(u.unit_total,0),0) AS unit_total,
                 (u.paid_at AT TIME ZONE 'America/Sao_Paulo')::date AS dia
          FROM public.stripe_payment_units u
          WHERE u.paid_at IS NOT NULL AND coalesce(u.ativo,true) = true) s
  ), rec AS (
    SELECT coalesce(sum(valor) FILTER (WHERE dia >= v_ini AND dia < v_fim),0) AS atual,
           coalesce(sum(valor) FILTER (WHERE dia >= v_prev AND dia < v_prev_fim),0) AS anterior
    FROM ganhos
  ), leads AS (
    SELECT count(*) FILTER (WHERE dt >= v_ini AND dt < v_fim) AS atual,
           count(*) FILTER (WHERE dt >= v_prev AND dt < v_prev_fim) AS anterior
    FROM (SELECT coalesce(data_primeiro_contato, created_at) AS dt
            FROM public.lia_attendances WHERE merged_into IS NULL) x
  ), funil AS (
    SELECT count(DISTINCT lead_id) AS abertos FROM public.deals
    WHERE pipeline_name ILIKE '%vendas%' AND coalesce(is_deleted,false)=false
      AND status='aberta' AND piperun_created_at >= now() - interval '12 months'
  ), perdidos AS (
    SELECT count(DISTINCT coalesce(lead_id::text, deal_id::text)) AS n
    FROM public.piperun_stage_transitions
    WHERE pipeline_name ILIKE '%estagnad%' AND transitioned_at >= v_ini AND transitioned_at < v_fim
  ), reativados AS (
    SELECT count(DISTINCT d.lead_id) AS n FROM public.deals d
    WHERE d.pipeline_name ILIKE '%vendas%' AND coalesce(d.is_deleted,false)=false
      AND d.piperun_created_at >= v_ini AND d.piperun_created_at < v_fim
      AND EXISTS (SELECT 1 FROM public.deals e WHERE e.lead_id=d.lead_id
                  AND e.pipeline_name ILIKE '%estagnad%' AND e.piperun_created_at < d.piperun_created_at)
  ), mix_deal AS (
    SELECT g.deal_key, g.valor,
           nullif(sum(coalesce(nullif(di.total_value,0), di.valor_total)),0) AS base,
           sum(coalesce(nullif(di.total_value,0), di.valor_total)) FILTER (
             WHERE public.painel_classifica_item(tx.subcategory, tx.workflow_stage,
                     coalesce(di.product_name, di.nome_produto)) = 'equipamento') AS equip,
           sum(coalesce(nullif(di.total_value,0), di.valor_total)) FILTER (
             WHERE public.painel_classifica_item(tx.subcategory, tx.workflow_stage,
                     coalesce(di.product_name, di.nome_produto)) = 'insumo') AS insumo,
           sum(coalesce(nullif(di.total_value,0), di.valor_total)) FILTER (
             WHERE public.painel_classifica_item(tx.subcategory, tx.workflow_stage,
                     coalesce(di.product_name, di.nome_produto)) = 'software_servico') AS softserv,
           sum(coalesce(nullif(di.total_value,0), di.valor_total)) FILTER (
             WHERE public.painel_classifica_item(tx.subcategory, tx.workflow_stage,
                     coalesce(di.product_name, di.nome_produto)) = 'nao_classificado') AS nclass
    FROM ganhos g
    LEFT JOIN public.v_deal_items_dedup di ON di.deal_id = g.deal_key
    LEFT JOIN LATERAL public.painel_match_taxonomy(coalesce(di.product_name, di.nome_produto)) tx ON true
    WHERE g.dia >= v_ini AND g.dia < v_fim
    GROUP BY 1,2
  ), mix AS (
    SELECT nullif(sum(valor) FILTER (WHERE base IS NOT NULL),0) AS coberto,
           coalesce(sum(valor) FILTER (WHERE base IS NULL),0)   AS sem_composicao,
           sum(valor * coalesce(equip,0)    / base) AS equip,
           sum(valor * coalesce(insumo,0)   / base) AS insumo,
           sum(valor * coalesce(softserv,0) / base) AS softserv,
           sum(valor * coalesce(nclass,0)   / base) AS nclass
    FROM mix_deal
  )
  SELECT jsonb_build_object(
    'mes_ref', to_char(v_ini,'YYYY-MM'),
    'receita_mes', rec.atual + stripe.atual,
    'receita_mes_anterior', rec.anterior + stripe.anterior,
    'receita_periodo_comparado', to_char(v_prev,'DD/MM')||'–'||to_char(v_prev_fim-1,'DD/MM'),
    'receita_stripe', nullif(round(stripe.atual::numeric,2),0),
    'leads_mes', leads.atual, 'leads_mes_anterior', leads.anterior,
    'leads_periodo_comparado', to_char(v_prev,'DD/MM')||'–'||to_char(v_prev_fim-1,'DD/MM'),
    'funil_atual', funil.abertos, 'leads_perdidos', perdidos.n, 'leads_reativados', reativados.n,
    'receita_produtos_total', round((coalesce(mix.coberto,0) + stripe.atual)::numeric,2),
    'receita_sem_composicao', nullif(round(mix.sem_composicao::numeric,2),0),
    'receita_nao_classificada', nullif(round(mix.nclass::numeric,2),0),
    'receita_equipamentos', nullif(round(mix.equip::numeric,2),0),
    'receita_insumos', nullif(round(mix.insumo::numeric,2),0),
    'receita_software_servico', nullif(round((coalesce(mix.softserv,0) + stripe.atual)::numeric,2),0)
  ) INTO r FROM rec, leads, funil, perdidos, reativados, mix, stripe;
  RETURN r;
END $function$;