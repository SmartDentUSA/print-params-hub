CREATE OR REPLACE FUNCTION public.fn_team_seller_stats(_months int DEFAULT 12)
RETURNS TABLE (
  member_id uuid,
  nome_completo text,
  deals_total bigint,
  deals_ganhos bigint,
  receita numeric,
  conversao numeric,
  ultimo_ganho timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH agg AS (
    SELECT d.owner_id::text AS oid,
           count(*) AS total,
           count(*) FILTER (WHERE lower(d.status) = 'ganha') AS ganhos,
           coalesce(sum(d.value) FILTER (WHERE lower(d.status) = 'ganha'), 0) AS receita,
           max(d.closed_at) FILTER (WHERE lower(d.status) = 'ganha') AS ultimo
    FROM public.deals d
    WHERE d.created_at > now() - make_interval(months => greatest(_months, 1))
    GROUP BY 1
  )
  SELECT t.id,
         t.nome_completo,
         coalesce(a.total, 0),
         coalesce(a.ganhos, 0),
         coalesce(a.receita, 0),
         CASE WHEN coalesce(a.total, 0) > 0 THEN round((a.ganhos::numeric / a.total) * 100, 1) ELSE 0 END,
         a.ultimo
  FROM public.team_members t
  LEFT JOIN agg a ON a.oid = t.piperun_owner_id::text
  WHERE t.ativo = true AND t.role = 'vendedor'
  ORDER BY coalesce(a.receita, 0) DESC, t.nome_completo;
$$;

GRANT EXECUTE ON FUNCTION public.fn_team_seller_stats(int) TO authenticated, service_role;