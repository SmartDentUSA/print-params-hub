
-- Lista de pipelines excluídos (não-comerciais) — mesma usada por fn_relatorio_mes_vendedor
-- 1) fn_relatorio_mes_kpis: corrigir status PT (ganha/perdida/aberta), TZ SP, e excluir pipelines não-comerciais
CREATE OR REPLACE FUNCTION public.fn_relatorio_mes_kpis(p_ano integer, p_mes integer)
 RETURNS TABLE(receita_won numeric, receita_meta numeric, deals_ganhos integer, deals_criados integer, taxa_conversao numeric, ticket_medio numeric, funil_ativo integer, perdidas_mes integer, enviados_estagnados integer, clientes_unicos integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH mes AS (SELECT to_char(make_date(p_ano, p_mes, 1), 'YYYY-MM') AS mes_ref),
  deals_filt AS (
    SELECT d.* FROM deals d
    WHERE COALESCE(d.is_deleted, false) = false
      AND COALESCE(d.pipeline_name, '') <> ALL (ARRAY[
        'Funil Atos','Funil E-book','Tulip-Teste-Nv-Automação','Tulip-Teste-Nv-Automacao',
        'Exportação','Ganhos Aleatórios','Ganhos Aleatórios (CS)','Ganhos Aleatorios'])
  ),
  ganhos AS (
    SELECT COUNT(*)::int AS qty,
           COALESCE(SUM(value),0)::numeric AS total,
           COUNT(DISTINCT person_id)::int AS unicos
    FROM deals_filt d, mes
    WHERE d.status='ganha' AND d.closed_at IS NOT NULL
      AND to_char(d.closed_at AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') = mes.mes_ref
  ),
  criados AS (
    SELECT COUNT(*)::int AS qty FROM deals_filt d, mes
    WHERE to_char(COALESCE(d.piperun_created_at, d.created_at) AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') = mes.mes_ref
  ),
  abertos AS (
    -- Snapshot atual: deals em aberto (não depende do mês selecionado)
    SELECT COUNT(*)::int AS qty FROM deals_filt d
    WHERE d.status = 'aberta'
  ),
  perdidas AS (
    SELECT COUNT(*)::int AS qty FROM deals_filt d, mes
    WHERE d.status='perdida' AND d.closed_at IS NOT NULL
      AND to_char(d.closed_at AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') = mes.mes_ref
  ),
  estagn AS (
    SELECT COUNT(*)::int AS qty FROM deals_filt d, mes
    WHERE to_char(COALESCE(d.piperun_created_at, d.created_at) AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') = mes.mes_ref
      AND d.stage_name ILIKE '%estagnad%'
  )
  SELECT
    g.total,
    0::numeric,
    g.qty,
    c.qty,
    CASE WHEN c.qty>0 THEN (g.qty::numeric / c.qty::numeric)*100 ELSE 0 END,
    CASE WHEN g.qty>0 THEN g.total / g.qty ELSE 0 END,
    a.qty,
    p.qty,
    e.qty,
    g.unicos
  FROM ganhos g, criados c, abertos a, perdidas p, estagn e;
$function$;

-- 2) fn_relatorio_mes_vendedor_detalhe: nova assinatura + status PT + TZ SP + filtro de pipelines
DROP FUNCTION IF EXISTS public.fn_relatorio_mes_vendedor_detalhe(integer, integer);

CREATE OR REPLACE FUNCTION public.fn_relatorio_mes_vendedor_detalhe(p_ano integer, p_mes integer)
 RETURNS TABLE(
   vendedor text,
   total_criados integer,
   abertas integer,
   ganhas integer,
   perdidas integer,
   estagnados integer,
   estagnados_pct numeric
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH mes AS (SELECT to_char(make_date(p_ano, p_mes, 1), 'YYYY-MM') AS mes_ref),
  deals_filt AS (
    SELECT d.* FROM deals d
    WHERE COALESCE(d.is_deleted, false) = false
      AND d.owner_name IS NOT NULL AND d.owner_name !~ '^[0-9]+$' AND d.owner_name <> ''
      AND COALESCE(d.pipeline_name, '') <> ALL (ARRAY[
        'Funil Atos','Funil E-book','Tulip-Teste-Nv-Automação','Tulip-Teste-Nv-Automacao',
        'Exportação','Ganhos Aleatórios','Ganhos Aleatórios (CS)','Ganhos Aleatorios'])
  ),
  criados AS (
    SELECT d.owner_name AS vendedor, COUNT(*)::int AS qty
    FROM deals_filt d, mes
    WHERE to_char(COALESCE(d.piperun_created_at, d.created_at) AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') = mes.mes_ref
    GROUP BY 1
  ),
  abertas_snap AS (
    -- snapshot atual de deals em aberto do vendedor (não filtra coorte)
    SELECT d.owner_name AS vendedor, COUNT(*)::int AS qty
    FROM deals_filt d
    WHERE d.status = 'aberta'
    GROUP BY 1
  ),
  ganhas_mes AS (
    SELECT d.owner_name AS vendedor, COUNT(*)::int AS qty
    FROM deals_filt d, mes
    WHERE d.status='ganha' AND d.closed_at IS NOT NULL
      AND to_char(d.closed_at AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') = mes.mes_ref
    GROUP BY 1
  ),
  perdidas_mes AS (
    SELECT d.owner_name AS vendedor, COUNT(*)::int AS qty
    FROM deals_filt d, mes
    WHERE d.status='perdida' AND d.closed_at IS NOT NULL
      AND to_char(d.closed_at AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') = mes.mes_ref
    GROUP BY 1
  ),
  estagnados_coorte AS (
    SELECT d.owner_name AS vendedor, COUNT(*)::int AS qty
    FROM deals_filt d, mes
    WHERE to_char(COALESCE(d.piperun_created_at, d.created_at) AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') = mes.mes_ref
      AND d.stage_name ILIKE '%estagnad%'
    GROUP BY 1
  ),
  all_vendors AS (
    SELECT vendedor FROM criados
    UNION SELECT vendedor FROM abertas_snap
    UNION SELECT vendedor FROM ganhas_mes
    UNION SELECT vendedor FROM perdidas_mes
    UNION SELECT vendedor FROM estagnados_coorte
  )
  SELECT
    av.vendedor,
    COALESCE(c.qty,0)  AS total_criados,
    COALESCE(a.qty,0)  AS abertas,
    COALESCE(g.qty,0)  AS ganhas,
    COALESCE(p.qty,0)  AS perdidas,
    COALESCE(e.qty,0)  AS estagnados,
    CASE WHEN COALESCE(c.qty,0) > 0
         THEN ROUND( (COALESCE(e.qty,0)::numeric / c.qty::numeric) * 100, 1)
         ELSE 0 END AS estagnados_pct
  FROM all_vendors av
  LEFT JOIN criados            c ON c.vendedor = av.vendedor
  LEFT JOIN abertas_snap       a ON a.vendedor = av.vendedor
  LEFT JOIN ganhas_mes         g ON g.vendedor = av.vendedor
  LEFT JOIN perdidas_mes       p ON p.vendedor = av.vendedor
  LEFT JOIN estagnados_coorte  e ON e.vendedor = av.vendedor
  ORDER BY (COALESCE(g.qty,0) + COALESCE(a.qty,0)) DESC, av.vendedor;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_relatorio_mes_vendedor_detalhe(integer, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_relatorio_mes_kpis(integer, integer) TO anon, authenticated, service_role;
