-- Extrai o bloco top_produtos para função própria (como funil/vendedores/origens/
-- atividades já são), para permitir recalcular só esse bloco num mês — o refresh
-- completo leva ~50 s por causa do funil.
CREATE OR REPLACE FUNCTION public.painel_top_produtos_refresh(p_mes date DEFAULT (date_trunc('month'::text, now()))::date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
/* Itens das PROPOSTAS ACEITAS dos negócios GANHOS no mês, com o mesmo rateio por
   negócio dos KPIs. Antes vinha de vw_produtos_faturados (Omie), que soma venda,
   bonificação, remessa, perda e o par faturamento-antecipado/entrega da mesma
   venda: em ago/26 dava R$ 174.447 contra R$ 77.938 de venda efetiva. */
DECLARE
  v_ini date := date_trunc('month', p_mes)::date;
  v_fim date := (date_trunc('month', p_mes) + interval '1 month')::date;
  v_payload jsonb;
BEGIN
  WITH ganhos AS (
    SELECT d.piperun_deal_id::text AS deal_key, coalesce(nullif(d.value,0),0) AS valor
    FROM public.deals d
    WHERE coalesce(d.is_deleted,false)=false AND d.status='ganha'
      AND d.closed_at IS NOT NULL
      AND (d.closed_at AT TIME ZONE 'America/Sao_Paulo')::date >= v_ini
      AND (d.closed_at AT TIME ZONE 'America/Sao_Paulo')::date <  v_fim
      AND coalesce(d.pipeline_name,'') <> ALL (ARRAY[
        'Funil Atos','Funil E-book','Tulip-Teste-Nv-Automação','Tulip-Teste-Nv-Automacao',
        'Exportação','Ganhos Aleatórios','Ganhos Aleatórios (CS)','Ganhos Aleatorios'])
  ), itens AS (
    SELECT g.deal_key, g.valor,
           coalesce(nullif(di.total_value,0), di.valor_total) AS v,
           coalesce(di.quantity, di.quantidade, 1) AS qtd,
           coalesce(di.product_name, di.nome_produto) AS nome
    FROM ganhos g
    JOIN public.v_deal_items_dedup di ON di.deal_id = g.deal_key
    WHERE coalesce(di.proposta_raw->>'status', '1') = '1'   -- proposta aceita
      AND nullif(trim(coalesce(di.product_name, di.nome_produto)), '') IS NOT NULL
  ), base AS (
    SELECT deal_key, nullif(sum(v),0) AS tot FROM itens GROUP BY 1
  ), classificado AS (
    SELECT coalesce(tx.workflow_stage, 'nao_classificado') AS ws,
           CASE WHEN coalesce(tx.subcategory,'outros') = 'resina'
                THEN 'resinas' ELSE coalesce(tx.subcategory,'outros') END AS sub,
           coalesce(tx.display_name, i.nome) AS produto,
           sum(i.valor * i.v / b.tot) AS receita,
           sum(i.qtd) AS qtd
    FROM itens i
    JOIN base b ON b.deal_key = i.deal_key AND b.tot IS NOT NULL
    LEFT JOIN LATERAL public.painel_match_taxonomy(i.nome) tx ON true
    GROUP BY 1,2,3
  ), ranked AS (
    SELECT ws, sub, produto, receita, qtd,
           row_number() OVER (PARTITION BY ws, sub ORDER BY receita DESC)::int AS rn
    FROM classificado
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'workflow_stage', ws, 'subcategory', sub, 'posicao', rn,
    'produto', produto, 'receita', round(receita::numeric,2),
    'quantidade', round(qtd::numeric,2)
  ) ORDER BY ws, sub, rn), '[]'::jsonb) INTO v_payload
  FROM ranked WHERE rn <= 5;

  INSERT INTO public.painel_comercial_cache (bloco, mes, payload, updated_at)
  VALUES ('top_produtos', v_ini, v_payload, now())
  ON CONFLICT (bloco, mes) DO UPDATE SET payload = excluded.payload, updated_at = now();
END $function$;

CREATE OR REPLACE FUNCTION public.painel_comercial_refresh(p_mes date DEFAULT (date_trunc('month'::text, now()))::date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ini date := date_trunc('month', p_mes)::date;
  v_payload jsonb;
BEGIN
  v_payload := public.painel_comercial_kpis(v_ini);
  INSERT INTO public.painel_comercial_cache (bloco, mes, payload, updated_at)
  VALUES ('kpis', v_ini, v_payload, now())
  ON CONFLICT (bloco, mes) DO UPDATE SET payload = excluded.payload, updated_at = now();

  PERFORM public.painel_funil_refresh(v_ini);
  PERFORM public.painel_top_produtos_refresh(v_ini);
END $function$;
