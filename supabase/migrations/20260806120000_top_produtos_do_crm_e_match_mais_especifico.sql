-- ============================================================================
-- Top Produtos: fonte errada + taxonomia casando o produto errado
--
-- (1) O grid vinha de vw_produtos_faturados (Omie), que soma TUDO que sai com
--     nota: venda, bonificação (CFOP 5.910/6.910), remessa (5.914/5.915/5.916/
--     5.917/6.916/6.917/6.908), baixa por perda (5.927), devolução (5.202/6.202),
--     outras saídas (x.949), o faturamento antecipado de venda para entrega
--     futura (5.922/6.922) E a remessa correspondente (5.117/6.117) — contando a
--     mesma venda duas vezes. Em ago/26: R$ 174.447 exibidos contra R$ 77.938 de
--     venda efetiva. Passa a vir do CRM: itens das PROPOSTAS ACEITAS dos negócios
--     GANHOS no mês, com o mesmo rateio por negócio dos KPIs (a soma do grid
--     fecha com a base da composição) e agora também com a quantidade vendida.
--
-- (2) painel_match_taxonomy desempatava pelo display_name MAIS LONGO em vez do
--     padrão mais específico. Efeitos observados:
--       "SCANNER INTRAORAL BLZ INO200"    -> "Aoralscan (concorrente)"
--          (o padrão 'aoral' casa dentro de "intrAORAL"; o scanner da própria
--           SmartDent aparecia no painel como produto de concorrente)
--       "POS CURA - RAYSHAPE SHAPECURE D" -> "Rayshape Edge Mini"
--          (pós-cura contabilizado como impressora, inflando a subcategoria)
--     Agora vence o padrão casado mais longo: 'blz ino200' (10) ganha de
--     'aoral' (5); 'shapecure d' (11) ganha de 'rayshape' (8).
--
-- Também unifica 'resina' e 'resinas' numa única coluna do grid.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.painel_match_taxonomy(p_nome text)
 RETURNS TABLE(workflow_stage text, subcategory text, display_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT t.workflow_stage, t.subcategory, t.display_name
  FROM public.product_taxonomy t
  CROSS JOIN LATERAL (
    SELECT max(length(pat)) AS especificidade
    FROM unnest(t.match_patterns) pat
    WHERE p_nome ILIKE '%' || pat || '%'
  ) m
  WHERE p_nome IS NOT NULL AND m.especificidade IS NOT NULL
  ORDER BY m.especificidade DESC, length(coalesce(t.display_name,'')) DESC
  LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.painel_comercial_refresh(p_mes date DEFAULT (date_trunc('month'::text, now()))::date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ini date := date_trunc('month', p_mes)::date;
  v_fim date := (date_trunc('month', p_mes) + interval '1 month')::date;
  v_payload jsonb;
BEGIN
  v_payload := public.painel_comercial_kpis(v_ini);
  INSERT INTO public.painel_comercial_cache (bloco, mes, payload, updated_at)
  VALUES ('kpis', v_ini, v_payload, now())
  ON CONFLICT (bloco, mes) DO UPDATE SET payload = excluded.payload, updated_at = now();

  PERFORM public.painel_funil_refresh(v_ini);

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
           /* 'resina' e 'resinas' são a mesma coluna do grid */
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
