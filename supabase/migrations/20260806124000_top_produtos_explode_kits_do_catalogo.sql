-- Kits vendidos (KIT CHAIRSIDE, KIT STARTER…) apareciam como uma linha só e sem
-- classificação, sumindo do grid. Agora são explodidos nos componentes cadastrados
-- em catalog_kit_components, com o valor do kit rateado pelo preço de tabela de
-- cada componente e a quantidade multiplicada pela quantidade do componente.
-- Ex.: "Plano Starter PNP" = NanoClean PoD + Resina Vitality 250g +
--      Bite Splint +Flex 1kg + GlazeON Splint (etapas 3 e 4).
--
-- O casamento é pelo nome do alias (nome_variante ou nome_canonico). "KIT
-- CHAIRSIDE" casa direto; "KIT STARTER" (nome usado no CRM) ainda não tem alias
-- correspondente no catálogo — falta confirmar se é o "Plano Starter PNP".
CREATE OR REPLACE FUNCTION public.painel_top_produtos_refresh(p_mes date DEFAULT (date_trunc('month'::text, now()))::date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
/* Itens das PROPOSTAS ACEITAS dos negócios GANHOS no mês, com o mesmo rateio por
   negócio dos KPIs. Kits são substituídos pelos seus componentes de catálogo. */
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
  ), kit_nome AS (
    /* aliases de kit que têm composição cadastrada, por qualquer um dos nomes */
    SELECT DISTINCT a.id AS kit_id, lower(btrim(n.nome)) AS nome_norm
    FROM public.produto_aliases a
    CROSS JOIN LATERAL (VALUES (a.nome_variante), (a.nome_canonico)) n(nome)
    WHERE a.is_kit AND coalesce(a.ativo,true) AND nullif(btrim(n.nome),'') IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.catalog_kit_components k WHERE k.kit_alias_id = a.id)
  ), kit_comp AS (
    SELECT k.kit_alias_id AS kit_id,
           coalesce(c.name, v.sku, 'Componente') AS nome,
           coalesce(k.quantity,1) AS qtd,
           coalesce(v.price_brl,0) * coalesce(k.quantity,1) AS peso
    FROM public.catalog_kit_components k
    LEFT JOIN public.catalog_product_variations v ON v.id = k.component_variation_id
    LEFT JOIN public.system_a_catalog c ON c.id = v.catalog_product_id
  ), kit_peso AS (
    SELECT kit_id, nullif(sum(peso),0) AS peso_total, count(*) AS n_comp
    FROM kit_comp GROUP BY 1
  ), expandido AS (
    /* item que não é kit passa direto */
    SELECT i.deal_key, i.valor, i.v, i.qtd, i.nome
    FROM itens i
    WHERE NOT EXISTS (SELECT 1 FROM kit_nome kn WHERE kn.nome_norm = lower(btrim(i.nome)))
    UNION ALL
    /* item que é kit vira seus componentes */
    SELECT i.deal_key, i.valor,
           i.v * CASE WHEN kp.peso_total IS NULL THEN 1.0/kp.n_comp ELSE kc.peso / kp.peso_total END,
           i.qtd * kc.qtd,
           kc.nome
    FROM itens i
    JOIN kit_nome kn ON kn.nome_norm = lower(btrim(i.nome))
    JOIN kit_comp kc ON kc.kit_id = kn.kit_id
    JOIN kit_peso kp ON kp.kit_id = kn.kit_id
  ), classificado AS (
    SELECT coalesce(tx.workflow_stage, 'nao_classificado') AS ws,
           CASE WHEN coalesce(tx.subcategory,'outros') = 'resina'
                THEN 'resinas' ELSE coalesce(tx.subcategory,'outros') END AS sub,
           coalesce(tx.display_name, e.nome) AS produto,
           sum(e.valor * e.v / b.tot) AS receita,
           sum(e.qtd) AS qtd
    FROM expandido e
    JOIN base b ON b.deal_key = e.deal_key AND b.tot IS NOT NULL
    LEFT JOIN LATERAL public.painel_match_taxonomy(e.nome) tx ON true
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
