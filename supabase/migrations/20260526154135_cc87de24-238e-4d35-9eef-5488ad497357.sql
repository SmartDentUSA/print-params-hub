
DROP VIEW IF EXISTS public.v_relatorio_mes_kpis     CASCADE;
DROP VIEW IF EXISTS public.v_relatorio_mes_vendedor CASCADE;
DROP VIEW IF EXISTS public.v_relatorio_mes_origem   CASCADE;

-- Pipelines a EXCLUIR (apenas teste/auxiliares); CS Onboarding e Funil Estagnados FICAM (vendas reais)
-- Excluídos: Tulip-Teste-Nv-Automação, Funil Atos (teste), Funil E-book (lead magnet),
-- Exportação, Ganhos Aleatórios* (auxiliares de migração)

CREATE VIEW public.v_relatorio_mes_kpis
WITH (security_invoker=on) AS
WITH mes AS (
  SELECT to_char((now() AT TIME ZONE 'America/Sao_Paulo'),'YYYY-MM') AS mes_ref
),
deals_filt AS (
  SELECT d.* FROM public.deals d
  WHERE COALESCE(d.is_deleted,false)=false
    AND COALESCE(d.pipeline_name,'') NOT IN (
      'Funil Atos','Funil E-book','Tulip-Teste-Nv-Automação','Tulip-Teste-Nv-Automacao',
      'Exportação','Ganhos Aleatórios','Ganhos Aleatórios (CS)','Ganhos Aleatorios'
    )
),
ganhos AS (
  SELECT * FROM deals_filt, mes
  WHERE status='ganha' AND closed_at IS NOT NULL
    AND to_char((closed_at AT TIME ZONE 'America/Sao_Paulo'),'YYYY-MM')=mes.mes_ref
),
criados AS (
  SELECT * FROM deals_filt, mes
  WHERE to_char((COALESCE(piperun_created_at,created_at) AT TIME ZONE 'America/Sao_Paulo'),'YYYY-MM')=mes.mes_ref
)
SELECT
  (SELECT count(*) FROM ganhos) AS total_deals,
  (SELECT COALESCE(sum(value),0) FROM ganhos) AS receita_total,
  (SELECT CASE WHEN count(*)>0 THEN COALESCE(sum(value),0)/count(*) ELSE 0 END FROM ganhos) AS ticket_medio,
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
  SELECT d.* FROM public.deals d
  WHERE COALESCE(d.is_deleted,false)=false
    AND COALESCE(d.pipeline_name,'') NOT IN (
      'Funil Atos','Funil E-book','Tulip-Teste-Nv-Automação','Tulip-Teste-Nv-Automacao',
      'Exportação','Ganhos Aleatórios','Ganhos Aleatórios (CS)','Ganhos Aleatorios'
    )
),
ganhos AS (
  SELECT COALESCE(NULLIF(owner_name,''),'Sem atribuição') AS vendedor,
         count(*) AS deals_ganhos,
         COALESCE(sum(value),0) AS receita,
         CASE WHEN count(*)>0 THEN COALESCE(sum(value),0)/count(*) ELSE 0 END AS ticket_medio
  FROM deals_filt, mes
  WHERE status='ganha' AND closed_at IS NOT NULL
    AND to_char((closed_at AT TIME ZONE 'America/Sao_Paulo'),'YYYY-MM')=mes.mes_ref
  GROUP BY 1
),
perdidos AS (
  SELECT COALESCE(NULLIF(owner_name,''),'Sem atribuição') AS vendedor, count(*) AS perdidos
  FROM deals_filt, mes
  WHERE status='perdida' AND closed_at IS NOT NULL
    AND to_char((closed_at AT TIME ZONE 'America/Sao_Paulo'),'YYYY-MM')=mes.mes_ref
  GROUP BY 1
),
leads_mes AS (
  SELECT COALESCE(NULLIF(owner_name,''),'Sem atribuição') AS vendedor, count(*) AS leads_mes
  FROM deals_filt, mes
  WHERE to_char((COALESCE(piperun_created_at,created_at) AT TIME ZONE 'America/Sao_Paulo'),'YYYY-MM')=mes.mes_ref
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
  SELECT d.* FROM public.deals d
  WHERE COALESCE(d.is_deleted,false)=false
    AND COALESCE(d.pipeline_name,'') NOT IN (
      'Funil Atos','Funil E-book','Tulip-Teste-Nv-Automação','Tulip-Teste-Nv-Automacao',
      'Exportação','Ganhos Aleatórios','Ganhos Aleatórios (CS)','Ganhos Aleatorios'
    )
),
base AS (
  SELECT COALESCE(NULLIF(origin_name,''), NULLIF(piperun_origin_name,''), NULLIF(deal_source,''), '—') AS origem,
         status, value, closed_at
  FROM deals_filt, mes
  WHERE to_char((COALESCE(piperun_created_at, created_at) AT TIME ZONE 'America/Sao_Paulo'),'YYYY-MM')=mes.mes_ref
)
SELECT origem,
  count(*) AS total_leads,
  count(*) FILTER (WHERE status='ganha' AND closed_at IS NOT NULL) AS deals_ganhos,
  COALESCE(sum(value) FILTER (WHERE status='ganha' AND closed_at IS NOT NULL),0) AS receita,
  CASE WHEN count(*)>0
       THEN ROUND((count(*) FILTER (WHERE status='ganha' AND closed_at IS NOT NULL))::numeric*100.0/count(*),2)
       ELSE 0 END AS taxa_pct
FROM base
GROUP BY origem
HAVING count(*)>=3;

GRANT SELECT ON public.v_relatorio_mes_kpis     TO anon, authenticated;
GRANT SELECT ON public.v_relatorio_mes_vendedor TO anon, authenticated;
GRANT SELECT ON public.v_relatorio_mes_origem   TO anon, authenticated;
