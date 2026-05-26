DROP FUNCTION IF EXISTS public.fn_relatorio_mes_vendedor_detalhe(integer, integer);
DROP FUNCTION IF EXISTS public.fn_relatorio_mes_kpis(integer, integer);

CREATE FUNCTION public.fn_relatorio_mes_vendedor_detalhe(p_ano integer, p_mes integer)
RETURNS TABLE(vendedor text, abertos integer, estagnados integer, perdidas integer, ganhas integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH mes AS (
    SELECT make_date(p_ano, p_mes, 1)::timestamptz AS ini,
           (make_date(p_ano, p_mes, 1) + interval '1 month')::timestamptz AS fim
  ),
  abertos_snap AS (
    SELECT d.owner_name AS vendedor, COUNT(*)::int AS qty
    FROM deals d, mes
    WHERE d.is_deleted = false
      AND d.owner_name IS NOT NULL AND d.owner_name !~ '^[0-9]+$'
      AND d.piperun_created_at < mes.fim
      AND (d.closed_at IS NULL OR d.closed_at >= mes.ini)
      AND COALESCE(d.status,'open') NOT IN ('won','lost')
    GROUP BY d.owner_name
  ),
  estagnados_coorte AS (
    SELECT d.owner_name AS vendedor, COUNT(*)::int AS qty
    FROM deals d, mes
    WHERE d.is_deleted = false
      AND d.owner_name IS NOT NULL AND d.owner_name !~ '^[0-9]+$'
      AND d.piperun_created_at >= mes.ini AND d.piperun_created_at < mes.fim
      AND d.stage_name ILIKE '%estagnad%'
    GROUP BY d.owner_name
  ),
  perdidas_mes AS (
    SELECT d.owner_name AS vendedor, COUNT(*)::int AS qty
    FROM deals d, mes
    WHERE d.is_deleted = false
      AND d.owner_name IS NOT NULL AND d.owner_name !~ '^[0-9]+$'
      AND d.status = 'lost'
      AND d.closed_at >= mes.ini AND d.closed_at < mes.fim
    GROUP BY d.owner_name
  ),
  ganhas_mes AS (
    SELECT d.owner_name AS vendedor, COUNT(*)::int AS qty
    FROM deals d, mes
    WHERE d.is_deleted = false
      AND d.owner_name IS NOT NULL AND d.owner_name !~ '^[0-9]+$'
      AND d.status = 'won'
      AND d.closed_at >= mes.ini AND d.closed_at < mes.fim
    GROUP BY d.owner_name
  ),
  all_vendors AS (
    SELECT vendedor FROM abertos_snap
    UNION SELECT vendedor FROM estagnados_coorte
    UNION SELECT vendedor FROM perdidas_mes
    UNION SELECT vendedor FROM ganhas_mes
  )
  SELECT
    av.vendedor,
    COALESCE(a.qty,0), COALESCE(e.qty,0), COALESCE(p.qty,0), COALESCE(g.qty,0)
  FROM all_vendors av
  LEFT JOIN abertos_snap      a ON a.vendedor = av.vendedor
  LEFT JOIN estagnados_coorte e ON e.vendedor = av.vendedor
  LEFT JOIN perdidas_mes      p ON p.vendedor = av.vendedor
  LEFT JOIN ganhas_mes        g ON g.vendedor = av.vendedor
  ORDER BY (COALESCE(g.qty,0) + COALESCE(a.qty,0)) DESC, av.vendedor;
$$;

CREATE FUNCTION public.fn_relatorio_mes_kpis(p_ano integer, p_mes integer)
RETURNS TABLE(
  receita_won numeric, receita_meta numeric,
  deals_ganhos integer, deals_criados integer,
  taxa_conversao numeric, ticket_medio numeric,
  funil_ativo integer, perdidas_mes integer,
  enviados_estagnados integer, clientes_unicos integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH mes AS (
    SELECT make_date(p_ano, p_mes, 1)::timestamptz AS ini,
           (make_date(p_ano, p_mes, 1) + interval '1 month')::timestamptz AS fim
  ),
  ganhos AS (
    SELECT COUNT(*)::int AS qty, COALESCE(SUM(value),0)::numeric AS total,
           COUNT(DISTINCT person_id)::int AS unicos
    FROM deals d, mes
    WHERE d.is_deleted=false AND d.status='won'
      AND d.closed_at >= mes.ini AND d.closed_at < mes.fim
  ),
  criados AS (
    SELECT COUNT(*)::int AS qty FROM deals d, mes
    WHERE d.is_deleted=false
      AND d.piperun_created_at >= mes.ini AND d.piperun_created_at < mes.fim
  ),
  abertos AS (
    SELECT COUNT(*)::int AS qty FROM deals d, mes
    WHERE d.is_deleted=false
      AND d.piperun_created_at < mes.fim
      AND (d.closed_at IS NULL OR d.closed_at >= mes.ini)
      AND COALESCE(d.status,'open') NOT IN ('won','lost')
  ),
  perdidas AS (
    SELECT COUNT(*)::int AS qty FROM deals d, mes
    WHERE d.is_deleted=false AND d.status='lost'
      AND d.closed_at >= mes.ini AND d.closed_at < mes.fim
  ),
  estagn AS (
    SELECT COUNT(*)::int AS qty FROM deals d, mes
    WHERE d.is_deleted=false
      AND d.piperun_created_at >= mes.ini AND d.piperun_created_at < mes.fim
      AND d.stage_name ILIKE '%estagnad%'
  )
  SELECT
    g.total, 0::numeric, g.qty, c.qty,
    CASE WHEN c.qty>0 THEN (g.qty::numeric / c.qty::numeric)*100 ELSE 0 END,
    CASE WHEN g.qty>0 THEN g.total / g.qty ELSE 0 END,
    a.qty, p.qty, e.qty, g.unicos
  FROM ganhos g, criados c, abertos a, perdidas p, estagn e;
$$;