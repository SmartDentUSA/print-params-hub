-- ============================================================================
-- Painel Comercial — correção das discrepâncias mapeadas em
-- docs/AUDITORIA_PAINEL_COMERCIAL_DISCREPANCIAS.md
--
--  #1  receita do mês determinística (exige closed_at)
--  #2  refresh sob snapshot único (REPEATABLE READ no cron)
--  #3  recálculo dos meses históricos + lista de meses disponíveis
--  #4  "no funil" = leads distintos, corte de 12 meses, em todos os blocos
--  #6  classificação de receita unificada em painel_classifica_item
--  #7  filtro de vendedores ativos não esconde mais quem teve movimento
--  #8  conversão por origem calculada sobre a própria coorte (<= 100%)
--  #10 rateio do mix por NEGÓCIO + base da composição explícita
--  #11 perda do funil passa a enxergar a saída para o pipeline Estagnados
--  #12 remoção dos blocos legados de painel_comercial_refresh
--
-- Aplicado no projeto okeogjgqijbfkudfjadz em 05/08/2026 nas migrations
-- painel_comercial_fix_kpis_e_funil, _fix_vendedores_origens_filtro,
-- _fix_refresh_e_cron, _rateio_por_negocio e _base_composicao_explicita.
-- Este arquivo consolida o estado final das funções.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- #1 KPIs: a data do ganho é sempre closed_at. O fallback para
-- piperun_created_at fazia negócios ganhos que ficam momentaneamente sem
-- closed_at (durante o sync do PipeRun) entrarem e saírem do mês — a receita
-- oscilava R$ 24.342,00 entre um refresh e outro. Impacto do corte medido em
-- 03–08/2026: R$ 2.530,00 em abril, zero nos demais meses.
-- ---------------------------------------------------------------------------
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
    /* rateio POR NEGÓCIO: o valor do negócio é distribuído na proporção das
       linhas de proposta DAQUELE negócio. Rateando sobre a base global (KPI) e
       sobre a base por vendedor (tabela), os dois agregados não fechavam. */
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
    'receita_mes', rec.atual, 'receita_mes_anterior', rec.anterior,
    'receita_periodo_comparado', to_char(v_prev,'DD/MM')||'–'||to_char(v_prev_fim-1,'DD/MM'),
    'leads_mes', leads.atual, 'leads_mes_anterior', leads.anterior,
    'leads_periodo_comparado', to_char(v_prev,'DD/MM')||'–'||to_char(v_prev_fim-1,'DD/MM'),
    'funil_atual', funil.abertos, 'leads_perdidos', perdidos.n, 'leads_reativados', reativados.n,
    /* base da composição = receita dos negócios COM proposta. Em abr/26 são
       R$ 528.061,66 de R$ 1.855.914,99: o rateio antigo projetava o mix desses
       28% sobre 100% da receita. */
    'receita_produtos_total', round(mix.coberto::numeric,2),
    'receita_sem_composicao', nullif(round(mix.sem_composicao::numeric,2),0),
    'receita_nao_classificada', nullif(round(mix.nclass::numeric,2),0),
    'receita_equipamentos', nullif(round(mix.equip::numeric,2),0),
    'receita_insumos', nullif(round(mix.insumo::numeric,2),0),
    'receita_software_servico', nullif(round(mix.softserv::numeric,2),0)
  ) INTO r FROM rec, leads, funil, perdidos, reativados, mix;
  RETURN r;
END $function$;

-- ---------------------------------------------------------------------------
-- #4 + #11 Funil
--   * todas as colunas passam a contar LEADS distintos (o KPI "Leads no funil"
--     e a coluna "Abertos" ficam na mesma unidade);
--   * a base passa a incluir os negócios que saíram do funil de vendas para o
--     pipeline Estagnados (2.766 nos últimos 12 meses) — antes eles sumiam da
--     base e as etapas finais exibiam 0,0% de perda;
--   * perda = negócio perdido OU migrado para Estagnados.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.painel_funil_refresh(p_mes date DEFAULT (date_trunc('month'::text, now()))::date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ini date := date_trunc('month', p_mes)::date;
  v_payload jsonb;
BEGIN
  WITH ordem AS (
    SELECT * FROM (VALUES
      ('Sem contato',1),('C1',2),('C2',3),('C3',4),('SDR / Nutrição',5),
      ('Apresentação/Visita',6),('Negociação',7),('Proposta enviada',8),('Fechamento',9)
    ) v(etapa, ord)
  ), base AS (
    SELECT d.id, d.lead_id, d.piperun_deal_id, d.status, d.pipeline_name,
           public.fn_painel_stage_canon(d.stage_name) AS etapa_atual,
           (d.status = 'perdida'
            OR d.pipeline_name ILIKE '%estagnad%'
            OR EXISTS (SELECT 1 FROM public.piperun_stage_transitions te
                       WHERE te.deal_id = d.piperun_deal_id
                         AND te.pipeline_name ILIKE '%estagnad%')) AS saiu
    FROM public.deals d
    WHERE coalesce(d.is_deleted,false) = false
      AND d.lead_id IS NOT NULL
      AND d.piperun_created_at >= now() - interval '12 months'
      AND ( d.pipeline_name ILIKE '%vendas%'
            OR ( d.pipeline_name ILIKE '%estagnad%'
                 AND EXISTS (SELECT 1 FROM public.piperun_stage_transitions tv
                             WHERE tv.deal_id = d.piperun_deal_id
                               AND tv.pipeline_name ILIKE '%vendas%') ) )
  ), abertos AS (
    /* "Abertos": leads com negócio aberto HOJE no funil de vendas, por etapa */
    SELECT etapa_atual AS etapa, count(DISTINCT lead_id) n
    FROM base
    WHERE status = 'aberta' AND pipeline_name ILIKE '%vendas%' AND etapa_atual IS NOT NULL
    GROUP BY 1
  ), tocou AS (
    SELECT b.lead_id, b.saiu, public.fn_painel_stage_canon(t.stage_to_name) AS etapa
    FROM base b
    JOIN public.piperun_stage_transitions t ON t.deal_id = b.piperun_deal_id
    WHERE t.pipeline_name ILIKE '%vendas%'
    UNION
    SELECT b.lead_id, b.saiu, b.etapa_atual
    FROM base b WHERE b.pipeline_name ILIKE '%vendas%'
  ), alcance AS (
    SELECT etapa, count(DISTINCT lead_id) AS reach,
           count(DISTINCT lead_id) FILTER (WHERE saiu) AS perdidos
    FROM tocou WHERE etapa IS NOT NULL GROUP BY 1
  ), max_ord AS (
    /* etapa mais avançada que cada lead alcançou */
    SELECT tc.lead_id, max(o.ord) AS ord_max
    FROM tocou tc JOIN ordem o ON o.etapa = tc.etapa
    GROUP BY 1
  ), acumulado AS (
    /* funil de verdade: chegou nesta etapa OU em qualquer posterior.
       Monotonicamente decrescente => passagem nunca passa de 100%. */
    SELECT o.ord, (SELECT count(*) FROM max_ord m WHERE m.ord_max >= o.ord) AS vol
    FROM ordem o
  ), dur AS (
    SELECT public.fn_painel_stage_canon(t.stage_from_name) AS etapa,
           extract(epoch FROM (t.transitioned_at - lag(t.transitioned_at)
             OVER (PARTITION BY t.deal_id ORDER BY t.transitioned_at)))/86400 AS dias
    FROM public.piperun_stage_transitions t
    WHERE t.transitioned_at >= now() - interval '12 months'
      AND t.pipeline_name ILIKE '%vendas%'
  ), tempos AS (
    SELECT etapa, count(*) qtd,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY dias) AS dias
    FROM dur WHERE etapa IS NOT NULL AND dias > 0.02
    GROUP BY 1
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'etapa', o.etapa,
    'ordem', o.ord,
    'atual', coalesce(a.n, 0),
    'volume', coalesce(al.reach, 0),
    'volume_acumulado', coalesce(ac.vol, 0),
    'media_dias', round(tm.dias::numeric, 1),
    'pct_perda', CASE WHEN coalesce(al.reach,0) > 0
                      THEN round(100.0 * coalesce(al.perdidos,0) / al.reach, 1) END,
    'qtd_saidas', coalesce(tm.qtd, 0)
  ) ORDER BY o.ord), '[]'::jsonb) INTO v_payload
  FROM ordem o
  LEFT JOIN abertos a ON a.etapa = o.etapa
  LEFT JOIN alcance al ON al.etapa = o.etapa
  LEFT JOIN acumulado ac ON ac.ord = o.ord
  LEFT JOIN tempos tm ON tm.etapa = o.etapa;

  INSERT INTO public.painel_comercial_cache (bloco, mes, payload, updated_at)
  VALUES ('funil', v_ini, v_payload, now())
  ON CONFLICT (bloco, mes) DO UPDATE SET payload = excluded.payload, updated_at = now();
END $function$;

-- ---------------------------------------------------------------------------
-- #4 + #6 Vendedores
--   * funil_atual = leads distintos com negócio aberto, mesmo corte de 12
--     meses do KPI (antes: negócios, sem corte nenhum — somava 1.238 contra
--     982 do KPI);
--   * mix de receita passa a usar painel_classifica_item, igual ao KPI, e
--     ganha a classe software/serviço (antes embutida em "insumos").
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.painel_vendedores_refresh(p_mes date DEFAULT (date_trunc('month'::text, now()))::date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
/* total_vendas = deals.value = "Valor de P&S" do PipeRun (verificado contra export 05/08).
   A composicao insumos/equip/software vem de deal_items (linhas de PROPOSTA) e nao soma o
   mesmo valor — por isso e RATEADA sobre o total real, mantendo o mix e fechando a linha. */
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
      count(DISTINCT d.lead_id) FILTER (WHERE d.status = 'aberta'
        AND d.piperun_created_at >= now() - interval '12 months') abertos,
      count(*) FILTER (WHERE d.piperun_created_at >= v_prev AND d.piperun_created_at < v_fim) pool
    FROM public.deals d
    WHERE coalesce(d.is_deleted,false)=false AND d.pipeline_name ILIKE '%vendas%'
    GROUP BY 1
  ), estagnados AS (
    SELECT public.painel_norm_vendedor(coalesce(t.owner_name, d.owner_name)) nk, count(DISTINCT t.deal_id) n
    FROM public.piperun_stage_transitions t
    LEFT JOIN public.deals d ON d.piperun_deal_id = t.deal_id
    WHERE t.pipeline_name ILIKE '%estagnad%'
      AND t.transitioned_at >= v_ini AND t.transitioned_at < v_fim
    GROUP BY 1
  ), ganhos_deals AS (
    SELECT d.piperun_deal_id::text deal_key, d.lead_id,
           public.painel_norm_vendedor(d.owner_name) nk, coalesce(nullif(d.value,0),0) valor
    FROM public.deals d
    WHERE coalesce(d.is_deleted,false)=false AND d.status='ganha'
      AND d.closed_at IS NOT NULL
      AND d.closed_at >= v_ini AND d.closed_at < v_fim
      AND coalesce(d.pipeline_name,'') <> ALL (ARRAY[
        'Funil Atos','Funil E-book','Tulip-Teste-Nv-Automação','Tulip-Teste-Nv-Automacao',
        'Exportação','Ganhos Aleatórios','Ganhos Aleatórios (CS)','Ganhos Aleatorios'])
  ), ganhos AS (
    SELECT nk, count(*) pedidos, coalesce(sum(valor),0) crm_valor FROM ganhos_deals GROUP BY 1
  ), dur AS (
    SELECT public.painel_norm_vendedor(t.owner_name) nk,
           public.fn_painel_stage_canon(t.stage_from_name) etapa,
           extract(epoch FROM (t.transitioned_at - lag(t.transitioned_at) OVER (PARTITION BY t.deal_id ORDER BY t.transitioned_at)))/86400 dias
    FROM public.piperun_stage_transitions t
    WHERE t.transitioned_at >= v_prev AND t.transitioned_at < v_fim AND t.pipeline_name ILIKE '%vendas%'
  ), tempos AS (
    SELECT nk,
      round(percentile_cont(0.5) WITHIN GROUP (ORDER BY dias) FILTER (WHERE etapa IN ('Sem contato','C1','C2','C3','SDR / Nutrição'))::numeric,1) qualif,
      round(percentile_cont(0.5) WITHIN GROUP (ORDER BY dias) FILTER (WHERE etapa IN ('Apresentação/Visita','Negociação'))::numeric,1) negoc,
      round(percentile_cont(0.5) WITHIN GROUP (ORDER BY dias) FILTER (WHERE etapa IN ('Proposta enviada','Fechamento'))::numeric,1) fecham
    FROM dur WHERE dias IS NOT NULL AND dias > 0.02 AND nk IS NOT NULL GROUP BY 1
  ), tl AS (
    SELECT public.painel_norm_vendedor(coalesce(l.event_data->>'owner', d.owner_name)) nk,
           l.lead_id, l.event_data->>'kind' kind, coalesce(l.event_data->>'title','') titulo
    FROM public.lead_activity_log l
    LEFT JOIN public.deals d ON d.piperun_deal_id::text = l.event_data->>'deal_id'
    WHERE l.event_type='crm_activity' AND l.event_timestamp >= v_ini AND l.event_timestamp < v_fim
  ), tl_apres AS (
    SELECT nk, lead_id FROM tl WHERE kind='reuniao' OR titulo ILIKE '%apresenta%' OR titulo ILIKE '%visita%'
  ), apres AS (
    SELECT nk, count(*) total, count(DISTINCT lead_id) leads_apres FROM tl_apres WHERE nk IS NOT NULL GROUP BY 1
  ), apres_ganhos AS (
    SELECT nk, count(DISTINCT lead_id) ganhas FROM ganhos_deals
    WHERE lead_id IN (SELECT lead_id FROM tl_apres WHERE lead_id IS NOT NULL) GROUP BY 1
  ), mix_deal AS (
    /* mesmo rateio POR NEGÓCIO usado no KPI — é o que faz os dois fecharem */
    SELECT g.nk, g.deal_key, g.valor,
           EXISTS (SELECT 1 FROM public.deals pd WHERE pd.lead_id=g.lead_id AND pd.status='ganha'
                     AND coalesce(pd.is_deleted,false)=false AND pd.closed_at < v_ini) AS recorrente,
           nullif(sum(coalesce(nullif(di.total_value,0), di.valor_total)),0) AS base,
           sum(coalesce(nullif(di.total_value,0), di.valor_total)) FILTER (
             WHERE public.painel_classifica_item(tx.subcategory, tx.workflow_stage,
                     coalesce(di.product_name, di.nome_produto)) = 'insumo') AS insumo,
           sum(coalesce(nullif(di.total_value,0), di.valor_total)) FILTER (
             WHERE public.painel_classifica_item(tx.subcategory, tx.workflow_stage,
                     coalesce(di.product_name, di.nome_produto)) = 'equipamento') AS equip,
           sum(coalesce(nullif(di.total_value,0), di.valor_total)) FILTER (
             WHERE public.painel_classifica_item(tx.subcategory, tx.workflow_stage,
                     coalesce(di.product_name, di.nome_produto)) = 'software_servico') AS softserv
    FROM ganhos_deals g
    JOIN public.v_deal_items_dedup di ON di.deal_id = g.deal_key
    LEFT JOIN LATERAL public.painel_match_taxonomy(coalesce(di.product_name, di.nome_produto)) tx ON true
    WHERE g.nk IS NOT NULL
    GROUP BY 1,2,3,4
  ), mix AS (
    SELECT nk,
      sum(valor * coalesce(insumo,0)   / base) AS insumos,
      sum(valor * coalesce(insumo,0)   / base) FILTER (WHERE recorrente)     AS ltv,
      sum(valor * coalesce(insumo,0)   / base) FILTER (WHERE NOT recorrente) AS novos,
      sum(valor * coalesce(equip,0)    / base) AS equip,
      sum(valor * coalesce(equip,0)    / base) FILTER (WHERE recorrente)     AS upsell,
      sum(valor * coalesce(softserv,0) / base) AS softserv
    FROM mix_deal WHERE base IS NOT NULL GROUP BY 1
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'vendedor', b.vendedor,
    'leads_novos', coalesce(n.atual,0), 'leads_mes_anterior', coalesce(n.anterior,0),
    'funil_atual', coalesce(n.abertos,0), 'pedidos', coalesce(g.pedidos,0),
    'pct_abandono', CASE WHEN coalesce(n.pool,0)>0 THEN round(100.0*coalesce(e.n,0)/n.pool,1) END,
    't_medio_qualif', t.qualif, 't_medio_negoc', t.negoc, 't_medio_fecham', t.fecham,
    'apresentacoes', coalesce(a.total,0),
    'conversao_apresent', CASE WHEN coalesce(a.leads_apres,0)>0
      THEN round(100.0*coalesce(ag.ganhas,0)/a.leads_apres,1) END,
    'receita_insumos',           round(m.insumos::numeric,2),
    'receita_insumos_ltv',       round(m.ltv::numeric,2),
    'receita_insumos_novos',     round(m.novos::numeric,2),
    'receita_equip',             round(m.equip::numeric,2),
    'receita_upsell',            round(m.upsell::numeric,2),
    'receita_software_servico',  round(m.softserv::numeric,2),
    'total_vendas', nullif(coalesce(g.crm_valor,0),0),
    'receita_crm',  nullif(coalesce(g.crm_valor,0),0)
  ) ORDER BY coalesce(g.crm_valor,0) DESC, coalesce(g.pedidos,0) DESC), '[]'::jsonb) INTO v_payload
  FROM base b
  LEFT JOIN novos n ON n.nk=b.nk
  LEFT JOIN estagnados e ON e.nk=b.nk
  LEFT JOIN ganhos g ON g.nk=b.nk
  LEFT JOIN tempos t ON t.nk=b.nk
  LEFT JOIN apres a ON a.nk=b.nk
  LEFT JOIN apres_ganhos ag ON ag.nk=b.nk
  LEFT JOIN mix m ON m.nk=b.nk;

  INSERT INTO public.painel_comercial_cache (bloco, mes, payload, updated_at)
  VALUES ('vendedores', v_ini, v_payload, now())
  ON CONFLICT (bloco, mes) DO UPDATE SET payload = excluded.payload, updated_at = now();
END $function$;

-- ---------------------------------------------------------------------------
-- #8 Origens: a conversão passa a ser calculada dentro da própria coorte
-- (leads do mês que já fecharam alguma venda, a qualquer tempo). Antes era
-- "negócios fechados no mês ÷ leads do mês", populações diferentes, o que
-- produzia 128,6% de conversão. ganhos/receita continuam sendo o fechado no
-- mês (visão de caixa) e ganham o rótulo correspondente no front.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.painel_origens_refresh(p_mes date DEFAULT (date_trunc('month'::text, now()))::date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
/* Coorte do mes por data_primeiro_contato (nao created_at): created_at e a data em que
   a linha foi criada no Supabase — carga do e-commerce e re-import do PipeRun trazem
   cliente de 2022/2023 com created_at de hoje, inflando "Nao informado".
   lead_time tambem passa a contar do primeiro contato real. */
DECLARE
  v_ini date := date_trunc('month', p_mes)::date;
  v_fim date := (date_trunc('month', p_mes) + interval '1 month')::date;
  v_payload jsonb;
  v_pipelines_fora text[] := ARRAY[
      'Funil Atos','Funil E-book','Tulip-Teste-Nv-Automação','Tulip-Teste-Nv-Automacao',
      'Exportação','Ganhos Aleatórios','Ganhos Aleatórios (CS)','Ganhos Aleatorios'];
BEGIN
  WITH norm AS (
    SELECT la.id,
      coalesce(la.data_primeiro_contato, la.created_at) AS dt,
      CASE WHEN lower(coalesce(trim(la.origem_primeiro_contato),'')) IN
                ('piperun','piperun_webhook','zapier','wats','loja_integrada','')
           THEN coalesce(nullif(trim(la.origem_campanha),''),'Não informado')
           ELSE trim(la.origem_primeiro_contato) END AS origem,
      coalesce(nullif(trim(la.origem_campanha),''),'Sem campanha') AS campanha,
      CASE WHEN la.meta_form_id IS NOT NULL OR la.meta_leadgen_id IS NOT NULL
             OR la.form_name IS NOT NULL THEN 'Inbound' ELSE 'Outbound' END AS tipo
    FROM public.lia_attendances la
    WHERE la.merged_into IS NULL
  ), coorte AS (
    SELECT n.origem, n.campanha, n.tipo, n.id AS lead_id, n.dt, dd.status, dd.stage_name
    FROM norm n
    LEFT JOIN public.deals dd
      ON dd.lead_id = n.id AND coalesce(dd.is_deleted,false)=false
     AND dd.pipeline_name ILIKE '%vendas%'
    WHERE n.dt >= v_ini AND n.dt < v_fim
  ), leads_agg AS (
    SELECT origem, campanha, tipo,
      count(DISTINCT lead_id) AS leads,
      count(DISTINCT lead_id) FILTER (WHERE status='aberta')  AS ativos,
      count(DISTINCT lead_id) FILTER (WHERE status='perdida') AS perdidos
    FROM coorte GROUP BY 1,2,3
  ), perda AS (
    SELECT origem, campanha, tipo, stage_name,
      row_number() OVER (PARTITION BY origem, campanha, tipo ORDER BY count(*) DESC) AS rn
    FROM coorte WHERE status='perdida' AND stage_name IS NOT NULL
    GROUP BY 1,2,3,4
  ), coorte_ganhos AS (
    /* leads DA COORTE que já converteram (a qualquer tempo) => conversão <= 100% */
    SELECT n.origem, n.campanha, n.tipo,
      count(DISTINCT d.lead_id) AS ganhos_coorte,
      avg(extract(epoch FROM (d.closed_at - n.dt))/86400)
        FILTER (WHERE d.closed_at >= n.dt) AS lead_time
    FROM public.deals d
    JOIN norm n ON n.id = d.lead_id
    WHERE coalesce(d.is_deleted,false)=false AND d.status='ganha' AND d.closed_at IS NOT NULL
      AND n.dt >= v_ini AND n.dt < v_fim
      AND coalesce(d.pipeline_name,'') <> ALL (v_pipelines_fora)
    GROUP BY 1,2,3
  ), ganhos_agg AS (
    /* fechado NO MÊS, independentemente de quando o lead entrou (visão de caixa) */
    SELECT n.origem, n.campanha, n.tipo,
      count(DISTINCT d.id) AS ganhos,
      coalesce(sum(coalesce(nullif(d.value,0),0)), 0) AS receita
    FROM public.deals d
    JOIN norm n ON n.id = d.lead_id
    WHERE coalesce(d.is_deleted,false)=false AND d.status='ganha' AND d.closed_at IS NOT NULL
      AND d.closed_at >= v_ini AND d.closed_at < v_fim
      AND coalesce(d.pipeline_name,'') <> ALL (v_pipelines_fora)
    GROUP BY 1,2,3
  ), j AS (
    SELECT coalesce(l.origem,g.origem) origem, coalesce(l.campanha,g.campanha) campanha,
           coalesce(l.tipo,g.tipo) tipo, coalesce(l.leads,0) leads, coalesce(l.ativos,0) ativos,
           coalesce(l.perdidos,0) perdidos, coalesce(g.ganhos,0) ganhos,
           coalesce(g.receita,0) receita,
           coalesce(cg.ganhos_coorte,0) ganhos_coorte, cg.lead_time
    FROM leads_agg l
    FULL JOIN ganhos_agg g ON g.origem=l.origem AND g.campanha=l.campanha AND g.tipo=l.tipo
    LEFT JOIN coorte_ganhos cg
      ON cg.origem=coalesce(l.origem,g.origem) AND cg.campanha=coalesce(l.campanha,g.campanha)
     AND cg.tipo=coalesce(l.tipo,g.tipo)
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'origem', j.origem, 'campanha', j.campanha, 'tipo', j.tipo,
    'leads_gerados', j.leads, 'ativos', j.ativos, 'perdidos', j.perdidos,
    'pct_perda', CASE WHEN j.leads>0 THEN round(100.0*j.perdidos/j.leads,1) END,
    'etapa_maior_perda', pp.stage_name,
    'ganhos', j.ganhos, 'ganhos_coorte', j.ganhos_coorte,
    'lead_time_dias', round(j.lead_time::numeric,1),
    'pct_conversao', CASE WHEN j.leads>0 THEN round(100.0*j.ganhos_coorte/j.leads,1) END,
    'receita', round(j.receita::numeric,2)
  ) ORDER BY j.leads DESC, j.receita DESC), '[]'::jsonb) INTO v_payload
  FROM j LEFT JOIN perda pp
    ON pp.origem=j.origem AND pp.campanha=j.campanha AND pp.tipo=j.tipo AND pp.rn=1;

  INSERT INTO public.painel_comercial_cache (bloco, mes, payload, updated_at)
  VALUES ('origens', v_ini, v_payload, now())
  ON CONFLICT (bloco, mes) DO UPDATE SET payload = excluded.payload, updated_at = now();
END $function$;

-- ---------------------------------------------------------------------------
-- #7 O filtro de vendedores ativos escondia R$ 75.230,00 da tabela em jul/26
-- (a receita continuava no KPI). Agora só some quem está inativo E não teve
-- nenhum movimento no mês.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.painel_filtrar_ativos(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN p_payload IS NULL OR jsonb_typeof(p_payload) <> 'array' THEN p_payload
    WHEN NOT EXISTS (SELECT 1 FROM public.painel_vendedores_ativos()) THEN p_payload
    ELSE coalesce((
      SELECT jsonb_agg(e ORDER BY ord)
      FROM jsonb_array_elements(p_payload) WITH ORDINALITY t(e, ord)
      WHERE public.painel_nome_norm(e->>'vendedor') IN (
              SELECT nome_norm FROM public.painel_vendedores_ativos())
         OR coalesce((e->>'total_vendas')::numeric,0) <> 0
         OR coalesce((e->>'pedidos')::numeric,0) <> 0
         OR coalesce((e->>'fechados')::numeric,0) <> 0
         OR coalesce((e->>'total')::numeric,0) <> 0
    ), '[]'::jsonb)
  END
$function$;

-- ---------------------------------------------------------------------------
-- #12 painel_comercial_refresh continha cópias legadas dos blocos vendedores,
-- atividades e origens — sobrescritas logo depois dentro de refresh_all, mas
-- gravadas de verdade em qualquer chamada direta (backfill manual). Removidas.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.painel_comercial_refresh(p_mes date DEFAULT (date_trunc('month'::text, now()))::date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
/* Grava apenas os blocos que são responsabilidade desta função: kpis, funil e
   top_produtos. vendedores/origens/atividades têm funções próprias, chamadas
   por painel_comercial_refresh_all. */
DECLARE
  v_ini date := date_trunc('month', p_mes)::date;
  v_payload jsonb;
BEGIN
  v_payload := public.painel_comercial_kpis(v_ini);
  INSERT INTO public.painel_comercial_cache (bloco, mes, payload, updated_at)
  VALUES ('kpis', v_ini, v_payload, now())
  ON CONFLICT (bloco, mes) DO UPDATE SET payload = excluded.payload, updated_at = now();

  PERFORM public.painel_funil_refresh(v_ini);

  WITH itens AS (
    SELECT coalesce(tx.workflow_stage, 'nao_classificado') ws,
           coalesce(tx.subcategory, 'outros') sub,
           coalesce(tx.display_name, pf.produto_nome) produto,
           sum(pf.valor_total) receita
    FROM public.vw_produtos_faturados pf
    LEFT JOIN LATERAL public.painel_match_taxonomy(pf.produto_nome) tx ON true
    WHERE pf.mes::date = v_ini AND pf.valor_total IS NOT NULL
    GROUP BY 1,2,3
  ), ranked AS (
    SELECT ws, sub, produto, receita,
           row_number() OVER (PARTITION BY ws, sub ORDER BY receita DESC)::int rn
    FROM itens
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'workflow_stage', ws, 'subcategory', sub, 'posicao', rn,
    'produto', produto, 'receita', round(receita::numeric,2)
  ) ORDER BY ws, sub, rn), '[]'::jsonb) INTO v_payload
  FROM ranked WHERE rn <= 5;

  INSERT INTO public.painel_comercial_cache (bloco, mes, payload, updated_at)
  VALUES ('top_produtos', v_ini, v_payload, now())
  ON CONFLICT (bloco, mes) DO UPDATE SET payload = excluded.payload, updated_at = now();
END $function$;

-- ---------------------------------------------------------------------------
-- #3 Meses históricos: recálculo em lote e lista do que existe no cache
-- (o seletor do painel oferecia 24 meses para um cache de 4).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.painel_comercial_refresh_meses(p_meses integer DEFAULT 6)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  m date;
BEGIN
  FOR m IN
    SELECT (date_trunc('month', now()) - (i || ' month')::interval)::date
    FROM generate_series(0, greatest(coalesce(p_meses,6),1) - 1) i
  LOOP
    PERFORM public.painel_comercial_refresh_all(m);
  END LOOP;
END $function$;

CREATE OR REPLACE FUNCTION public.painel_comercial_meses_disponiveis()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT coalesce(jsonb_agg(jsonb_build_object('mes', mes, 'atualizado_em', atualizado_em)
                            ORDER BY mes DESC), '[]'::jsonb)
  FROM (SELECT mes, max(updated_at) AS atualizado_em
        FROM public.painel_comercial_cache
        WHERE bloco = 'kpis' GROUP BY mes) t
$function$;

GRANT EXECUTE ON FUNCTION public.painel_comercial_meses_disponiveis() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.painel_comercial_refresh_meses(integer) TO service_role;

-- ---------------------------------------------------------------------------
-- #1 + #2 Cron
--   * snapshot único: sem REPEATABLE READ os blocos do mesmo refresh liam
--     estados diferentes de `deals` (a função leva ~50 s e o sync do PipeRun
--     commita no meio) — o card de receita divergia das tabelas em R$ 24.342;
--   * horário deslocado dos crons de sync do PipeRun (:05/:15/:20/:25/:30).
--   * job diário para recalcular os 6 últimos meses.
-- ---------------------------------------------------------------------------
DO $do$
DECLARE
  v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'painel-comercial-refresh';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.alter_job(
      v_jobid,
      schedule := '2,7,12,17,22,27,32,37,42,47,52,57 * * * *',
      command  := 'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ; SELECT public.painel_comercial_refresh_all();'
    );
  END IF;

  PERFORM cron.unschedule('painel-comercial-refresh-historico')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'painel-comercial-refresh-historico');

  PERFORM cron.schedule(
    'painel-comercial-refresh-historico',
    '40 6 * * *',
    'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ; SELECT public.painel_comercial_refresh_meses(6);'
  );
END
$do$;
