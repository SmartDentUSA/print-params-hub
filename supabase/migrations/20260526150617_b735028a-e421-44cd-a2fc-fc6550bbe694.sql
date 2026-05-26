
-- v_relatorio_mes_kpis
CREATE OR REPLACE VIEW public.v_relatorio_mes_kpis
WITH (security_invoker=on) AS
WITH mes_key AS (
  SELECT to_char((now() AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM') AS ym
),
ganhas AS (
  SELECT d.value, d.owner_name
  FROM public.deals d, mes_key m
  WHERE d.status = 'ganha'
    AND COALESCE(d.is_deleted, false) = false
    AND d.closed_at IS NOT NULL
    AND to_char((d.closed_at AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM') = m.ym
)
SELECT
  (SELECT count(*) FROM ganhas) AS total_deals,
  (SELECT round(COALESCE(sum(value), 0)::numeric, 2) FROM ganhas) AS receita_total,
  (SELECT round(avg(NULLIF(value, 0))::numeric, 2) FROM ganhas) AS ticket_medio,
  (SELECT count(DISTINCT owner_name) FROM ganhas WHERE owner_name IS NOT NULL) AS vendedores_ativos,
  (SELECT count(*) FROM public.lia_attendances la, mes_key m
    WHERE la.merged_into IS NULL
      AND to_char((la.created_at AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM') = m.ym) AS leads_criados_mes,
  (SELECT ym FROM mes_key) AS mes_ref,
  now() AS gerado_em;

-- v_relatorio_mes_vendedor
CREATE OR REPLACE VIEW public.v_relatorio_mes_vendedor
WITH (security_invoker=on) AS
WITH mes_key AS (
  SELECT to_char((now() AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM') AS ym
),
ganhos AS (
  SELECT COALESCE(NULLIF(d.owner_name, ''), 'Sem atribuição') AS vendedor,
         count(*) AS deals_ganhos,
         round(sum(d.value)::numeric, 2) AS receita,
         round(avg(NULLIF(d.value, 0))::numeric, 2) AS ticket_medio
  FROM public.deals d, mes_key m
  WHERE d.status = 'ganha'
    AND COALESCE(d.is_deleted, false) = false
    AND d.closed_at IS NOT NULL
    AND to_char((d.closed_at AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM') = m.ym
  GROUP BY 1
),
perdidos AS (
  SELECT COALESCE(NULLIF(d.owner_name, ''), 'Sem atribuição') AS vendedor,
         count(*) AS n
  FROM public.deals d, mes_key m
  WHERE d.status = 'perdida'
    AND COALESCE(d.is_deleted, false) = false
    AND d.closed_at IS NOT NULL
    AND to_char((d.closed_at AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM') = m.ym
  GROUP BY 1
),
leads_mes AS (
  SELECT COALESCE(NULLIF(la.proprietario_lead_crm, ''), 'Sem atribuição') AS vendedor,
         count(*) AS qtd
  FROM public.lia_attendances la, mes_key m
  WHERE la.merged_into IS NULL
    AND to_char((la.created_at AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM') = m.ym
  GROUP BY 1
),
univ AS (
  SELECT vendedor FROM ganhos
  UNION SELECT vendedor FROM perdidos
  UNION SELECT vendedor FROM leads_mes
)
SELECT
  u.vendedor,
  COALESCE(g.deals_ganhos, 0)::bigint AS deals_ganhos,
  COALESCE(g.receita, 0)::numeric AS receita,
  COALESCE(g.ticket_medio, 0)::numeric AS ticket_medio,
  COALESCE(p.n, 0)::bigint AS perdidos,
  COALESCE(l.qtd, 0)::bigint AS leads_mes
FROM univ u
LEFT JOIN ganhos g ON g.vendedor = u.vendedor
LEFT JOIN perdidos p ON p.vendedor = u.vendedor
LEFT JOIN leads_mes l ON l.vendedor = u.vendedor
WHERE u.vendedor IS NOT NULL
ORDER BY COALESCE(g.receita, 0) DESC;

-- v_relatorio_mes_funil
CREATE OR REPLACE VIEW public.v_relatorio_mes_funil
WITH (security_invoker=on) AS
SELECT
  COALESCE(NULLIF(d.owner_name, ''), 'Sem atribuição') AS vendedor,
  COALESCE(d.pipeline_name, 'Sem funil') AS funil,
  COALESCE(d.stage_name, 'Sem etapa') AS etapa,
  count(*)::bigint AS qtd
FROM public.deals d
WHERE d.status = 'aberta'
  AND COALESCE(d.is_deleted, false) = false
GROUP BY 1, 2, 3
ORDER BY 1, 4 DESC;

-- v_relatorio_mes_origem
CREATE OR REPLACE VIEW public.v_relatorio_mes_origem
WITH (security_invoker=on) AS
WITH mes_key AS (
  SELECT to_char((now() AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM') AS ym
),
leads_orig AS (
  SELECT COALESCE(NULLIF(la.origem_campanha, ''), 'Sem origem') AS origem,
         la.id AS lead_id
  FROM public.lia_attendances la, mes_key m
  WHERE la.merged_into IS NULL
    AND to_char((la.created_at AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM') = m.ym
),
leads_agg AS (
  SELECT origem, count(*) AS total_leads
  FROM leads_orig GROUP BY origem
),
ganhos_orig AS (
  SELECT lo.origem, count(*) AS deals_ganhos, round(sum(d.value)::numeric, 2) AS receita
  FROM leads_orig lo
  JOIN public.deals d
    ON d.lead_id = lo.lead_id
   AND d.status = 'ganha'
   AND COALESCE(d.is_deleted, false) = false
   AND d.closed_at IS NOT NULL
   AND to_char((d.closed_at AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM') = (SELECT ym FROM mes_key)
  GROUP BY lo.origem
)
SELECT
  l.origem,
  l.total_leads::bigint,
  COALESCE(g.deals_ganhos, 0)::bigint AS deals_ganhos,
  COALESCE(g.receita, 0)::numeric AS receita,
  round(COALESCE(g.deals_ganhos, 0)::numeric / NULLIF(l.total_leads, 0)::numeric * 100, 1) AS taxa_pct
FROM leads_agg l
LEFT JOIN ganhos_orig g ON g.origem = l.origem
WHERE l.total_leads >= 3
ORDER BY COALESCE(g.receita, 0) DESC;

GRANT SELECT ON public.v_relatorio_mes_kpis, public.v_relatorio_mes_vendedor,
                 public.v_relatorio_mes_funil, public.v_relatorio_mes_origem
TO anon, authenticated;
