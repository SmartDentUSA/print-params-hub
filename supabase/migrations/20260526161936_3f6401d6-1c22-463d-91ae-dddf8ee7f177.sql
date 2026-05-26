
-- KPIs
CREATE OR REPLACE FUNCTION public.fn_relatorio_mes_kpis(p_ano int, p_mes int)
RETURNS TABLE(
  total_deals bigint,
  receita_total numeric,
  ticket_medio numeric,
  vendedores_ativos bigint,
  leads_criados_mes bigint,
  mes_ref text,
  gerado_em timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH mes AS (SELECT to_char(make_date(p_ano, p_mes, 1), 'YYYY-MM') AS mes_ref),
  deals_filt AS (
    SELECT d.* FROM deals d
    WHERE COALESCE(d.is_deleted, false) = false
      AND COALESCE(d.pipeline_name, '') <> ALL (ARRAY['Funil Atos','Funil E-book','Tulip-Teste-Nv-Automação','Tulip-Teste-Nv-Automacao','Exportação','Ganhos Aleatórios','Ganhos Aleatórios (CS)','Ganhos Aleatorios'])
  ),
  ganhos AS (
    SELECT d.* FROM deals_filt d, mes
    WHERE d.status = 'ganha' AND d.closed_at IS NOT NULL
      AND to_char(d.closed_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') = mes.mes_ref
  ),
  criados AS (
    SELECT d.* FROM deals_filt d, mes
    WHERE to_char(COALESCE(d.piperun_created_at, d.created_at) AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') = mes.mes_ref
  )
  SELECT
    (SELECT count(*) FROM ganhos),
    (SELECT COALESCE(sum(value),0) FROM ganhos),
    (SELECT CASE WHEN count(*)>0 THEN COALESCE(sum(value),0)/count(*) ELSE 0 END FROM ganhos),
    (SELECT count(DISTINCT owner_name) FROM ganhos WHERE owner_name IS NOT NULL),
    (SELECT count(*) FROM criados),
    (SELECT mes_ref FROM mes),
    now();
$$;

-- Vendedores
CREATE OR REPLACE FUNCTION public.fn_relatorio_mes_vendedor(p_ano int, p_mes int)
RETURNS TABLE(
  vendedor text,
  deals_ganhos bigint,
  receita numeric,
  ticket_medio numeric,
  perdidos bigint,
  leads_mes bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH mes AS (SELECT to_char(make_date(p_ano, p_mes, 1), 'YYYY-MM') AS mes_ref),
  deals_filt AS (
    SELECT d.* FROM deals d
    WHERE COALESCE(d.is_deleted, false) = false
      AND COALESCE(d.pipeline_name, '') <> ALL (ARRAY['Funil Atos','Funil E-book','Tulip-Teste-Nv-Automação','Tulip-Teste-Nv-Automacao','Exportação','Ganhos Aleatórios','Ganhos Aleatórios (CS)','Ganhos Aleatorios'])
  ),
  ganhos AS (
    SELECT COALESCE(NULLIF(d.owner_name,''),'Sem atribuição') AS vendedor,
           count(*) AS deals_ganhos,
           COALESCE(sum(d.value),0) AS receita,
           CASE WHEN count(*)>0 THEN COALESCE(sum(d.value),0)/count(*) ELSE 0 END AS ticket_medio
    FROM deals_filt d, mes
    WHERE d.status='ganha' AND d.closed_at IS NOT NULL
      AND to_char(d.closed_at AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') = mes.mes_ref
    GROUP BY 1
  ),
  perd AS (
    SELECT COALESCE(NULLIF(d.owner_name,''),'Sem atribuição') AS vendedor, count(*) AS perdidos
    FROM deals_filt d, mes
    WHERE d.status='perdida' AND d.closed_at IS NOT NULL
      AND to_char(d.closed_at AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') = mes.mes_ref
    GROUP BY 1
  ),
  lm AS (
    SELECT COALESCE(NULLIF(d.owner_name,''),'Sem atribuição') AS vendedor, count(*) AS leads_mes
    FROM deals_filt d, mes
    WHERE to_char(COALESCE(d.piperun_created_at,d.created_at) AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') = mes.mes_ref
    GROUP BY 1
  ),
  univ AS (
    SELECT vendedor FROM ganhos UNION SELECT vendedor FROM perd UNION SELECT vendedor FROM lm
  )
  SELECT u.vendedor,
         COALESCE(g.deals_ganhos,0),
         COALESCE(g.receita,0),
         COALESCE(g.ticket_medio,0),
         COALESCE(p.perdidos,0),
         COALESCE(l.leads_mes,0)
  FROM univ u
  LEFT JOIN ganhos g ON g.vendedor=u.vendedor
  LEFT JOIN perd p ON p.vendedor=u.vendedor
  LEFT JOIN lm l ON l.vendedor=u.vendedor;
$$;

-- Origens
CREATE OR REPLACE FUNCTION public.fn_relatorio_mes_origem(p_ano int, p_mes int)
RETURNS TABLE(
  origem text,
  total_leads bigint,
  deals_ganhos bigint,
  receita numeric,
  taxa_pct numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH mes AS (SELECT to_char(make_date(p_ano, p_mes, 1), 'YYYY-MM') AS mes_ref),
  deals_filt AS (
    SELECT d.* FROM deals d
    WHERE COALESCE(d.is_deleted, false) = false
      AND COALESCE(d.pipeline_name, '') <> ALL (ARRAY['Funil Atos','Funil E-book','Tulip-Teste-Nv-Automação','Tulip-Teste-Nv-Automacao','Exportação','Ganhos Aleatórios','Ganhos Aleatórios (CS)','Ganhos Aleatorios'])
  ),
  base AS (
    SELECT COALESCE(NULLIF(d.origin_name,''),NULLIF(d.piperun_origin_name,''),NULLIF(d.deal_source,''),'—') AS origem,
           d.status, d.value, d.closed_at
    FROM deals_filt d, mes
    WHERE to_char(COALESCE(d.piperun_created_at,d.created_at) AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') = mes.mes_ref
  )
  SELECT origem,
         count(*),
         count(*) FILTER (WHERE status='ganha' AND closed_at IS NOT NULL),
         COALESCE(sum(value) FILTER (WHERE status='ganha' AND closed_at IS NOT NULL),0),
         CASE WHEN count(*)>0
           THEN round(count(*) FILTER (WHERE status='ganha' AND closed_at IS NOT NULL)::numeric*100/count(*),2)
           ELSE 0 END
  FROM base GROUP BY origem HAVING count(*)>=3;
$$;

-- Helper: vendedores ativos no mês
CREATE OR REPLACE FUNCTION public.fn_relatorio_mes_vendedores_ativos(p_ano int, p_mes int)
RETURNS TABLE(vendedor text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.vendedor FROM public.fn_relatorio_mes_vendedor(p_ano, p_mes) v
  WHERE COALESCE(v.deals_ganhos,0)+COALESCE(v.perdidos,0)+COALESCE(v.leads_mes,0) > 0;
$$;

-- Estagnados (snapshot atual, restrito a vendedores ativos no mês)
CREATE OR REPLACE FUNCTION public.fn_relatorio_mes_funil_estagnados(p_ano int, p_mes int)
RETURNS TABLE(vendedor text, qtd bigint, total_deals_mes bigint, pct numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH ativos AS (SELECT vendedor FROM public.fn_relatorio_mes_vendedores_ativos(p_ano, p_mes)),
  estag AS (
    SELECT COALESCE(NULLIF(d.owner_name,''),'Sem atribuição') AS vendedor, count(*) AS qtd
    FROM deals d
    WHERE COALESCE(d.is_deleted,false)=false
      AND d.status='aberta'
      AND COALESCE(d.pipeline_name,'') ILIKE '%Estagnados%'
    GROUP BY 1
  ),
  totais AS (
    SELECT vendedor, (deals_ganhos+perdidos+leads_mes) AS total_mes
    FROM public.fn_relatorio_mes_vendedor(p_ano, p_mes)
  )
  SELECT e.vendedor, e.qtd, COALESCE(t.total_mes,0),
         CASE WHEN COALESCE(t.total_mes,0)>0 THEN round(e.qtd::numeric*100/t.total_mes,2) ELSE 0 END
  FROM estag e
  JOIN ativos a ON a.vendedor = e.vendedor
  LEFT JOIN totais t ON t.vendedor = e.vendedor
  ORDER BY e.qtd DESC;
$$;

-- Snapshot atual de etapas abertas por vendedor (restrito aos ativos no mês)
CREATE OR REPLACE FUNCTION public.fn_relatorio_mes_funil_atual(p_ano int, p_mes int)
RETURNS TABLE(vendedor text, funil text, etapa text, qtd bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH ativos AS (SELECT vendedor FROM public.fn_relatorio_mes_vendedores_ativos(p_ano, p_mes))
  SELECT COALESCE(NULLIF(d.owner_name,''),'Sem atribuição') AS vendedor,
         COALESCE(d.pipeline_name,'—') AS funil,
         COALESCE(d.stage_name,'—') AS etapa,
         count(*) AS qtd
  FROM deals d
  JOIN ativos a ON a.vendedor = COALESCE(NULLIF(d.owner_name,''),'Sem atribuição')
  WHERE COALESCE(d.is_deleted,false)=false AND d.status='aberta'
  GROUP BY 1,2,3
  ORDER BY 1,2,3;
$$;

GRANT EXECUTE ON FUNCTION public.fn_relatorio_mes_kpis(int,int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_relatorio_mes_vendedor(int,int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_relatorio_mes_origem(int,int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_relatorio_mes_vendedores_ativos(int,int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_relatorio_mes_funil_estagnados(int,int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_relatorio_mes_funil_atual(int,int) TO authenticated, service_role;
