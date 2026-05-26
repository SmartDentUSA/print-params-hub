
DROP VIEW IF EXISTS public.v_relatorio_mes_kpis     CASCADE;
DROP VIEW IF EXISTS public.v_relatorio_mes_vendedor CASCADE;
DROP VIEW IF EXISTS public.v_relatorio_mes_origem   CASCADE;

CREATE VIEW public.v_relatorio_mes_kpis
WITH (security_invoker=on) AS
WITH mes AS (
  SELECT to_char((now() AT TIME ZONE 'America/Sao_Paulo'),'YYYY-MM') AS mes_ref
),
deals_filt AS (
  SELECT d.*,
         COALESCE(d.closed_at, d.updated_at) AS data_evento
  FROM public.deals d
  WHERE COALESCE(d.is_deleted,false)=false
    AND COALESCE(d.pipeline_name,'') NOT IN (
      'CS Onboarding','Funil Estagnados','Funil Atos','Funil E-book',
      'Tulip-Teste-Nv-Automação','Tulip-Teste-Nv-Automacao','Exportação',
      'Ganhos Aleatórios','Ganhos Aleatórios (CS)','Ganhos Aleatorios'
    )
),
ganhos AS (
  SELECT * FROM deals_filt, mes
  WHERE status='ganha'
    AND to_char((data_evento AT TIME ZONE 'America/Sao_Paulo'),'YYYY-MM') = mes.mes_ref
),
criados AS (
  SELECT * FROM deals_filt, mes
  WHERE to_char((created_at AT TIME ZONE 'America/Sao_Paulo'),'YYYY-MM') = mes.mes_ref
)
SELECT
  (SELECT count(*) FROM ganhos) AS total_deals,
  (SELECT COALESCE(sum(value),0) FROM ganhos) AS receita_total,
  (SELECT COALESCE(avg(NULLIF(value,0)),0) FROM ganhos) AS ticket_medio,
  (SELECT count(DISTINCT owner_name) FROM ganhos WHERE owner_name IS NOT NULL) AS vendedores_ativos,
  (SELECT count(*) FROM criados) AS leads_criados_mes,
  (SELECT mes_ref FROM mes) AS mes_ref,
  now() AS gerado_em;

CREATE VIEW public.v_relatorio_mes_vendedor
WITH (security_invoker=on) AS
WITH mes AS (
  SELECT to_char((now() AT TIME ZONE 'America/Sao_Paulo'),'YYYY-MM') AS mes_ref
),
deals_filt AS (
  SELECT d.*,
         COALESCE(d.closed_at, d.updated_at) AS data_evento
  FROM public.deals d
  WHERE COALESCE(d.is_deleted,false)=false
    AND COALESCE(d.pipeline_name,'') NOT IN (
      'CS Onboarding','Funil Estagnados','Funil Atos','Funil E-book',
      'Tulip-Teste-Nv-Automação','Tulip-Teste-Nv-Automacao','Exportação',
      'Ganhos Aleatórios','Ganhos Aleatórios (CS)','Ganhos Aleatorios'
    )
),
ganhos AS (
  SELECT COALESCE(NULLIF(owner_name,''),'Sem atribuição') AS vendedor,
         count(*) AS deals_ganhos,
         COALESCE(sum(value),0) AS receita,
         COALESCE(avg(NULLIF(value,0)),0) AS ticket_medio
  FROM deals_filt, mes
  WHERE status='ganha'
    AND to_char((data_evento AT TIME ZONE 'America/Sao_Paulo'),'YYYY-MM')=mes.mes_ref
  GROUP BY 1
),
perdidos AS (
  SELECT COALESCE(NULLIF(owner_name,''),'Sem atribuição') AS vendedor, count(*) AS perdidos
  FROM deals_filt, mes
  WHERE status='perdida'
    AND to_char((data_evento AT TIME ZONE 'America/Sao_Paulo'),'YYYY-MM')=mes.mes_ref
  GROUP BY 1
),
leads_mes AS (
  SELECT COALESCE(NULLIF(owner_name,''),'Sem atribuição') AS vendedor, count(*) AS leads_mes
  FROM deals_filt, mes
  WHERE to_char((created_at AT TIME ZONE 'America/Sao_Paulo'),'YYYY-MM')=mes.mes_ref
  GROUP BY 1
),
univ AS (
  SELECT vendedor FROM ganhos UNION SELECT vendedor FROM perdidos UNION SELECT vendedor FROM leads_mes
)
SELECT u.vendedor,
  COALESCE(g.deals_ganhos,0) AS deals_ganhos,
  COALESCE(g.receita,0) AS receita,
  COALESCE(g.ticket_medio,0) AS ticket_medio,
  COALESCE(p.perdidos,0) AS perdidos,
  COALESCE(l.leads_mes,0) AS leads_mes
FROM univ u
LEFT JOIN ganhos g ON g.vendedor=u.vendedor
LEFT JOIN perdidos p ON p.vendedor=u.vendedor
LEFT JOIN leads_mes l ON l.vendedor=u.vendedor;

CREATE VIEW public.v_relatorio_mes_origem
WITH (security_invoker=on) AS
WITH mes AS (
  SELECT to_char((now() AT TIME ZONE 'America/Sao_Paulo'),'YYYY-MM') AS mes_ref
),
deals_filt AS (
  SELECT d.*,
         COALESCE(d.closed_at, d.updated_at) AS data_evento
  FROM public.deals d
  WHERE COALESCE(d.is_deleted,false)=false
    AND COALESCE(d.pipeline_name,'') NOT IN (
      'CS Onboarding','Funil Estagnados','Funil Atos','Funil E-book',
      'Tulip-Teste-Nv-Automação','Tulip-Teste-Nv-Automacao','Exportação',
      'Ganhos Aleatórios','Ganhos Aleatórios (CS)','Ganhos Aleatorios'
    )
),
base AS (
  SELECT COALESCE(NULLIF(origin_name,''), NULLIF(piperun_origin_name,''), NULLIF(deal_source,''), '—') AS origem,
         status, value, data_evento, created_at
  FROM deals_filt, mes
  WHERE to_char((created_at AT TIME ZONE 'America/Sao_Paulo'),'YYYY-MM')=mes.mes_ref
)
SELECT origem,
  count(*) AS total_leads,
  count(*) FILTER (WHERE status='ganha') AS deals_ganhos,
  COALESCE(sum(value) FILTER (WHERE status='ganha'),0) AS receita,
  CASE WHEN count(*)>0
       THEN ROUND((count(*) FILTER (WHERE status='ganha'))::numeric*100.0/count(*),2)
       ELSE 0 END AS taxa_pct
FROM base
GROUP BY origem
HAVING count(*)>=3;

GRANT SELECT ON public.v_relatorio_mes_kpis     TO anon, authenticated;
GRANT SELECT ON public.v_relatorio_mes_vendedor TO anon, authenticated;
GRANT SELECT ON public.v_relatorio_mes_origem   TO anon, authenticated;
