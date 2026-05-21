CREATE OR REPLACE FUNCTION public.fn_resumo_vendas_mes(
  p_ano integer DEFAULT (EXTRACT(year FROM now()))::integer,
  p_mes integer DEFAULT (EXTRACT(month FROM now()))::integer
)
RETURNS TABLE(vendedor text, total_deals bigint, receita_total numeric, ticket_medio numeric, pct_receita numeric, leads_recebidos bigint, taxa_conversao numeric)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH base AS (
    SELECT vendedor, COUNT(*) AS total_deals, SUM(valor) AS receita_total
    FROM public.vw_vendas_ganhas
    WHERE EXTRACT(YEAR FROM fechado_em)  = p_ano
      AND EXTRACT(MONTH FROM fechado_em) = p_mes
      AND vendedor IS NOT NULL
    GROUP BY vendedor
  ),
  total AS (SELECT SUM(receita_total) AS grand_total FROM base),
  leads_por_vendedor AS (
    SELECT LOWER(TRIM(proprietario_lead_crm)) AS vendedor_norm, COUNT(*) AS leads_recebidos
    FROM public.lia_attendances
    WHERE merged_into IS NULL
      AND proprietario_lead_crm IS NOT NULL
      AND TRIM(proprietario_lead_crm) <> ''
      AND EXTRACT(YEAR FROM created_at)  = p_ano
      AND EXTRACT(MONTH FROM created_at) = p_mes
    GROUP BY LOWER(TRIM(proprietario_lead_crm))
  )
  SELECT
    b.vendedor,
    b.total_deals,
    ROUND(b.receita_total, 2) AS receita_total,
    ROUND(b.receita_total / NULLIF(b.total_deals, 0), 2) AS ticket_medio,
    ROUND(b.receita_total / NULLIF(t.grand_total, 0) * 100, 1) AS pct_receita,
    COALESCE(l.leads_recebidos, 0) AS leads_recebidos,
    LEAST(ROUND(b.total_deals::numeric / NULLIF(l.leads_recebidos, 0) * 100, 1), 100.0) AS taxa_conversao
  FROM base b
  CROSS JOIN total t
  LEFT JOIN leads_por_vendedor l ON l.vendedor_norm = LOWER(TRIM(b.vendedor))
  ORDER BY b.receita_total DESC;
$function$;