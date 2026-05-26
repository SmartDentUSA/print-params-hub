
DROP FUNCTION IF EXISTS public.fn_relatorio_mes_kpis(integer,integer);

CREATE OR REPLACE FUNCTION public.fn_relatorio_mes_kpis(p_ano integer, p_mes integer)
RETURNS TABLE(
  total_deals bigint, receita_total numeric, ticket_medio numeric,
  vendedores_ativos bigint, leads_criados_mes bigint,
  funil_ativo bigint, perdidas_mes bigint, enviados_estagnados bigint,
  clientes_unicos bigint, mes_ref text, gerado_em timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH mes AS (SELECT to_char(make_date(p_ano, p_mes, 1), 'YYYY-MM') AS mes_ref),
  deals_filt AS (
    SELECT d.* FROM deals d
    WHERE COALESCE(d.is_deleted, false) = false
      AND COALESCE(d.pipeline_name, '') <> ALL (ARRAY['Funil Atos','Funil E-book','Tulip-Teste-Nv-Automação','Tulip-Teste-Nv-Automacao','Exportação','Ganhos Aleatórios','Ganhos Aleatórios (CS)','Ganhos Aleatorios'])
  ),
  criados AS (
    SELECT d.* FROM deals_filt d, mes
    WHERE to_char(COALESCE(d.piperun_created_at, d.created_at) AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') = mes.mes_ref
  ),
  ganhos AS (
    SELECT d.* FROM deals_filt d, mes
    WHERE d.status = 'ganha' AND d.closed_at IS NOT NULL
      AND to_char(d.closed_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') = mes.mes_ref
  )
  SELECT
    (SELECT count(*) FROM ganhos),
    (SELECT COALESCE(sum(value),0) FROM ganhos),
    (SELECT CASE WHEN count(*)>0 THEN COALESCE(sum(value),0)/count(*) ELSE 0 END FROM ganhos),
    (SELECT count(DISTINCT owner_name) FROM ganhos WHERE owner_name IS NOT NULL),
    (SELECT count(*) FROM criados),
    (SELECT count(*) FROM criados WHERE status='aberta'),
    (SELECT count(*) FROM criados WHERE status='perdida'),
    (SELECT count(*) FROM criados WHERE status='aberta' AND COALESCE(pipeline_name,'') ILIKE '%Estagnados%'),
    (SELECT count(DISTINCT COALESCE(person_id::text, lead_id::text, piperun_deal_id)) FROM ganhos),
    (SELECT mes_ref FROM mes),
    now();
$$;

CREATE OR REPLACE FUNCTION public.fn_relatorio_mes_funil_estagnados(p_ano integer, p_mes integer)
RETURNS TABLE(vendedor text, qtd bigint, total_deals_mes bigint, pct numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH mes AS (SELECT to_char(make_date(p_ano, p_mes, 1), 'YYYY-MM') AS mes_ref),
  ativos AS (SELECT vendedor FROM public.fn_relatorio_mes_vendedores_ativos(p_ano, p_mes)),
  criados AS (
    SELECT COALESCE(NULLIF(d.owner_name,''),'Sem atribuição') AS vendedor,
           d.status, d.pipeline_name
    FROM deals d, mes
    WHERE COALESCE(d.is_deleted,false)=false
      AND to_char(COALESCE(d.piperun_created_at,d.created_at) AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') = mes.mes_ref
  ),
  estag AS (
    SELECT vendedor, count(*) AS qtd FROM criados
    WHERE status='aberta' AND COALESCE(pipeline_name,'') ILIKE '%Estagnados%'
    GROUP BY 1
  ),
  totais AS (SELECT vendedor, count(*) AS total_mes FROM criados GROUP BY 1)
  SELECT e.vendedor, e.qtd, COALESCE(t.total_mes,0),
         CASE WHEN COALESCE(t.total_mes,0)>0 THEN round(e.qtd::numeric*100/t.total_mes,2) ELSE 0 END
  FROM estag e
  JOIN ativos a ON a.vendedor = e.vendedor
  LEFT JOIN totais t ON t.vendedor = e.vendedor
  ORDER BY e.qtd DESC;
$$;

CREATE OR REPLACE FUNCTION public.fn_relatorio_mes_vendedor_detalhe(p_ano integer, p_mes integer)
RETURNS TABLE(
  vendedor text, total_criados bigint, abertas bigint, ganhas bigint,
  perdidas bigint, estagnados bigint, estagnados_pct numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH mes AS (SELECT to_char(make_date(p_ano, p_mes, 1), 'YYYY-MM') AS mes_ref),
  criados AS (
    SELECT COALESCE(NULLIF(d.owner_name,''),'Sem atribuição') AS vendedor,
           d.status, d.pipeline_name
    FROM deals d, mes
    WHERE COALESCE(d.is_deleted,false)=false
      AND to_char(COALESCE(d.piperun_created_at,d.created_at) AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') = mes.mes_ref
  )
  SELECT vendedor,
         count(*),
         count(*) FILTER (WHERE status='aberta'),
         count(*) FILTER (WHERE status='ganha'),
         count(*) FILTER (WHERE status='perdida'),
         count(*) FILTER (WHERE status='aberta' AND COALESCE(pipeline_name,'') ILIKE '%Estagnados%'),
         CASE WHEN count(*)>0
           THEN round(count(*) FILTER (WHERE status='aberta' AND COALESCE(pipeline_name,'') ILIKE '%Estagnados%')::numeric*100/count(*),2)
           ELSE 0 END
  FROM criados
  GROUP BY vendedor
  ORDER BY count(*) DESC;
$$;

CREATE OR REPLACE FUNCTION public.fn_relatorio_mes_itens_kpis(p_ano integer, p_mes integer)
RETURNS TABLE(
  total_unidades numeric, total_linhas bigint, total_deals bigint, skus_distintos bigint,
  top_volume_nome text, top_volume_qtd numeric,
  top_deals_nome text, top_deals_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH mes AS (SELECT to_char(make_date(p_ano, p_mes, 1), 'YYYY-MM') AS mes_ref),
  ganhos AS (
    SELECT d.id, d.proposals FROM deals d, mes
    WHERE COALESCE(d.is_deleted,false)=false AND d.status='ganha' AND d.closed_at IS NOT NULL
      AND to_char(d.closed_at AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') = mes.mes_ref
      AND d.proposals IS NOT NULL AND jsonb_typeof(d.proposals)='array' AND jsonb_array_length(d.proposals)>0
  ),
  itens AS (
    SELECT g.id AS deal_id,
           COALESCE(NULLIF(trim(item->>'nome'),''),'(sem nome)') AS nome,
           COALESCE((item->>'qtd')::numeric,(item->>'quantity')::numeric,0) AS qtd
    FROM ganhos g
    CROSS JOIN LATERAL jsonb_array_elements(g.proposals->0->'items') item
    WHERE item->>'nome' IS NOT NULL
  ),
  agg AS (
    SELECT nome, count(DISTINCT deal_id) AS deals_count, sum(qtd) AS unidades
    FROM itens GROUP BY nome
  )
  SELECT
    (SELECT COALESCE(sum(qtd),0) FROM itens),
    (SELECT count(*) FROM itens),
    (SELECT count(DISTINCT deal_id) FROM itens),
    (SELECT count(DISTINCT nome) FROM itens),
    (SELECT nome FROM agg ORDER BY unidades DESC NULLS LAST LIMIT 1),
    (SELECT unidades FROM agg ORDER BY unidades DESC NULLS LAST LIMIT 1),
    (SELECT nome FROM agg ORDER BY deals_count DESC NULLS LAST LIMIT 1),
    (SELECT deals_count FROM agg ORDER BY deals_count DESC NULLS LAST LIMIT 1);
$$;

CREATE OR REPLACE FUNCTION public.fn_relatorio_mes_itens_top(p_ano integer, p_mes integer, p_limit integer DEFAULT 20)
RETURNS TABLE(nome text, deals bigint, unidades numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH mes AS (SELECT to_char(make_date(p_ano, p_mes, 1), 'YYYY-MM') AS mes_ref),
  ganhos AS (
    SELECT d.id, d.proposals FROM deals d, mes
    WHERE COALESCE(d.is_deleted,false)=false AND d.status='ganha' AND d.closed_at IS NOT NULL
      AND to_char(d.closed_at AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') = mes.mes_ref
      AND d.proposals IS NOT NULL AND jsonb_typeof(d.proposals)='array' AND jsonb_array_length(d.proposals)>0
  ),
  itens AS (
    SELECT g.id AS deal_id,
           COALESCE(NULLIF(trim(item->>'nome'),''),'(sem nome)') AS nome,
           COALESCE((item->>'qtd')::numeric,(item->>'quantity')::numeric,0) AS qtd
    FROM ganhos g
    CROSS JOIN LATERAL jsonb_array_elements(g.proposals->0->'items') item
    WHERE item->>'nome' IS NOT NULL
  )
  SELECT nome, count(DISTINCT deal_id), sum(qtd)
  FROM itens GROUP BY nome
  ORDER BY sum(qtd) DESC NULLS LAST
  LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION public.fn_relatorio_mes_itens_categoria(p_ano integer, p_mes integer)
RETURNS TABLE(categoria text, deals bigint, unidades numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH mes AS (SELECT to_char(make_date(p_ano, p_mes, 1), 'YYYY-MM') AS mes_ref),
  ganhos AS (
    SELECT d.id, d.proposals FROM deals d, mes
    WHERE COALESCE(d.is_deleted,false)=false AND d.status='ganha' AND d.closed_at IS NOT NULL
      AND to_char(d.closed_at AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') = mes.mes_ref
      AND d.proposals IS NOT NULL AND jsonb_typeof(d.proposals)='array' AND jsonb_array_length(d.proposals)>0
  ),
  itens AS (
    SELECT g.id AS deal_id,
           lower(COALESCE(item->>'nome','')) AS nome_l,
           COALESCE((item->>'qtd')::numeric,(item->>'quantity')::numeric,0) AS qtd
    FROM ganhos g
    CROSS JOIN LATERAL jsonb_array_elements(g.proposals->0->'items') item
    WHERE item->>'nome' IS NOT NULL
  ),
  cat AS (
    SELECT deal_id, qtd,
      CASE
        WHEN nome_l LIKE '%atos%' THEN 'ATOS (bulk)'
        WHEN nome_l LIKE '%vitality%' THEN 'Resinas Vitality'
        WHEN nome_l LIKE '%model plus%' THEN 'Resina Model Plus'
        WHEN nome_l LIKE '%smartmake%' THEN 'SmartMake'
        WHEN nome_l LIKE '%bite splint%' OR nome_l LIKE '%splint%' THEN 'Resina Bite Splint'
        WHEN nome_l LIKE '%smartgum%' THEN 'SmartGum'
        WHEN nome_l LIKE '%nanoclean%' THEN 'NanoClean'
        WHEN nome_l LIKE '%rayshape%' THEN 'Impressora RayShape'
        WHEN nome_l LIKE '%glaze%' THEN 'GlazeON'
        WHEN nome_l LIKE '%blz%' THEN 'Scanner BLZ'
        WHEN nome_l LIKE '%notebook%' OR nome_l LIKE '%avell%' OR nome_l LIKE '%computador%' OR nome_l LIKE '%a50%' OR nome_l LIKE '%ryzen%' THEN 'Computador / Notebook'
        WHEN nome_l LIKE '%ioconnect%' THEN 'iOConnect'
        WHEN nome_l LIKE '%exocad%' THEN 'Software Exocad'
        WHEN nome_l LIKE '%treinamento%' OR nome_l LIKE '%curso%' THEN 'Treinamento'
        WHEN nome_l LIKE '%cure%' OR nome_l LIKE '%cura%' THEN 'Pós-Cura'
        ELSE 'Outros'
      END AS categoria
    FROM itens
  )
  SELECT categoria, count(DISTINCT deal_id), sum(qtd)
  FROM cat GROUP BY categoria
  ORDER BY sum(qtd) DESC NULLS LAST;
$$;

CREATE OR REPLACE FUNCTION public.fn_relatorio_mes_itens_vendedor(p_ano integer, p_mes integer)
RETURNS TABLE(vendedor text, linhas bigint, unidades numeric, skus bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH mes AS (SELECT to_char(make_date(p_ano, p_mes, 1), 'YYYY-MM') AS mes_ref),
  ganhos AS (
    SELECT d.id, d.proposals, COALESCE(NULLIF(d.owner_name,''),'Sem atribuição') AS vendedor
    FROM deals d, mes
    WHERE COALESCE(d.is_deleted,false)=false AND d.status='ganha' AND d.closed_at IS NOT NULL
      AND to_char(d.closed_at AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') = mes.mes_ref
      AND d.proposals IS NOT NULL AND jsonb_typeof(d.proposals)='array' AND jsonb_array_length(d.proposals)>0
  ),
  itens AS (
    SELECT g.vendedor, g.id AS deal_id,
           COALESCE(NULLIF(trim(item->>'nome'),''),'(sem nome)') AS nome,
           COALESCE((item->>'qtd')::numeric,(item->>'quantity')::numeric,0) AS qtd
    FROM ganhos g
    CROSS JOIN LATERAL jsonb_array_elements(g.proposals->0->'items') item
    WHERE item->>'nome' IS NOT NULL
  )
  SELECT vendedor, count(*), sum(qtd), count(DISTINCT nome)
  FROM itens GROUP BY vendedor
  ORDER BY sum(qtd) DESC NULLS LAST;
$$;

CREATE OR REPLACE FUNCTION public.fn_relatorio_mes_recorrencia(p_ano integer, p_mes integer)
RETURNS TABLE(clientes_unicos bigint, recorrentes bigint, novos bigint, taxa_pct numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH mes AS (
    SELECT make_date(p_ano, p_mes, 1) AS ini,
           (make_date(p_ano, p_mes, 1) + interval '1 month')::date AS fim
  ),
  ganhos_mes AS (
    SELECT DISTINCT COALESCE(person_id::text, lead_id::text, piperun_deal_id) AS cli
    FROM deals d, mes
    WHERE COALESCE(d.is_deleted,false)=false AND d.status='ganha'
      AND d.closed_at >= mes.ini AND d.closed_at < mes.fim
  ),
  prev AS (
    SELECT DISTINCT COALESCE(person_id::text, lead_id::text, piperun_deal_id) AS cli
    FROM deals d, mes
    WHERE COALESCE(d.is_deleted,false)=false AND d.status='ganha'
      AND d.closed_at < mes.ini
  )
  SELECT
    (SELECT count(*) FROM ganhos_mes),
    (SELECT count(*) FROM ganhos_mes g WHERE g.cli IN (SELECT cli FROM prev)),
    (SELECT count(*) FROM ganhos_mes g WHERE g.cli NOT IN (SELECT cli FROM prev)),
    CASE WHEN (SELECT count(*) FROM ganhos_mes)>0
      THEN round((SELECT count(*) FROM ganhos_mes g WHERE g.cli IN (SELECT cli FROM prev))::numeric*100/(SELECT count(*) FROM ganhos_mes),2)
      ELSE 0 END;
$$;

CREATE OR REPLACE FUNCTION public.fn_relatorio_mes_astron(p_ano integer, p_mes integer)
RETURNS TABLE(
  total_inscritos bigint, clientes_sd bigint, nao_clientes bigint,
  pct_clientes numeric, novos_mes bigint, media_concluidos numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH mes AS (
    SELECT make_date(p_ano, p_mes, 1) AS ini,
           (make_date(p_ano, p_mes, 1) + interval '1 month')::date AS fim
  ),
  base AS (
    SELECT DISTINCT a.lead_id
    FROM astron_member_access a
    WHERE COALESCE(a.has_access,true) = true AND a.lead_id IS NOT NULL
  ),
  cls AS (
    SELECT b.lead_id, (l.real_status ILIKE 'CLIENTE%') AS is_cli
    FROM base b
    LEFT JOIN lia_attendances l ON l.id = b.lead_id AND l.merged_into IS NULL
  ),
  novos AS (
    SELECT DISTINCT a.lead_id FROM astron_member_access a, mes
    WHERE a.granted_at >= mes.ini AND a.granted_at < mes.fim
  )
  SELECT
    (SELECT count(*) FROM cls),
    (SELECT count(*) FROM cls WHERE is_cli),
    (SELECT count(*) FROM cls WHERE NOT COALESCE(is_cli,false)),
    CASE WHEN (SELECT count(*) FROM cls)>0
      THEN round((SELECT count(*) FROM cls WHERE is_cli)::numeric*100/(SELECT count(*) FROM cls),2)
      ELSE 0 END,
    (SELECT count(*) FROM novos),
    (SELECT round(COALESCE(avg(lessons_completed)::numeric,0),1) FROM astron_member_access WHERE COALESCE(has_access,true));
$$;

GRANT EXECUTE ON FUNCTION public.fn_relatorio_mes_kpis(integer,integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_relatorio_mes_funil_estagnados(integer,integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_relatorio_mes_vendedor_detalhe(integer,integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_relatorio_mes_itens_kpis(integer,integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_relatorio_mes_itens_top(integer,integer,integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_relatorio_mes_itens_categoria(integer,integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_relatorio_mes_itens_vendedor(integer,integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_relatorio_mes_recorrencia(integer,integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_relatorio_mes_astron(integer,integer) TO authenticated, service_role;
