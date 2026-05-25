CREATE OR REPLACE FUNCTION public.query_seller_performance()
RETURNS TABLE (
  name text,
  whatsapp text,
  total_leads bigint,
  won_deals bigint,
  open_deals bigint,
  revenue numeric,
  avg_ticket numeric,
  conversion_rate numeric,
  last_lead_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH sellers AS (
    SELECT nome_completo, whatsapp_number
    FROM public.team_members
    WHERE ativo = true AND role = 'vendedor'
  ),
  lead_agg AS (
    SELECT proprietario_lead_crm AS name,
           COUNT(*)::bigint AS total_leads,
           MAX(created_at) AS last_lead_at
    FROM public.lia_attendances
    WHERE merged_into IS NULL
    GROUP BY proprietario_lead_crm
  ),
  deal_agg AS (
    SELECT owner_name AS name,
           COUNT(*) FILTER (WHERE status = 'ganha' AND COALESCE(closed_at, piperun_created_at, created_at) >= now() - interval '365 days')::bigint AS won_deals,
           COUNT(*) FILTER (WHERE status = 'aberta')::bigint AS open_deals,
           COALESCE(SUM(value) FILTER (WHERE status = 'ganha' AND COALESCE(closed_at, piperun_created_at, created_at) >= now() - interval '365 days'), 0)::numeric AS revenue
    FROM public.deals
    WHERE COALESCE(is_deleted, false) = false
    GROUP BY owner_name
  )
  SELECT
    s.nome_completo AS name,
    s.whatsapp_number AS whatsapp,
    COALESCE(l.total_leads, 0) AS total_leads,
    COALESCE(d.won_deals, 0) AS won_deals,
    COALESCE(d.open_deals, 0) AS open_deals,
    COALESCE(d.revenue, 0) AS revenue,
    CASE WHEN COALESCE(d.won_deals, 0) > 0 THEN ROUND(COALESCE(d.revenue, 0) / d.won_deals, 2) ELSE 0 END AS avg_ticket,
    CASE WHEN COALESCE(l.total_leads, 0) > 0 THEN ROUND(COALESCE(d.won_deals, 0)::numeric / l.total_leads * 100, 2) ELSE 0 END AS conversion_rate,
    l.last_lead_at
  FROM sellers s
  LEFT JOIN lead_agg l ON l.name = s.nome_completo
  LEFT JOIN deal_agg d ON d.name = s.nome_completo
  ORDER BY COALESCE(d.revenue, 0) DESC, COALESCE(d.won_deals, 0) DESC;
$$;

GRANT EXECUTE ON FUNCTION public.query_seller_performance() TO authenticated;