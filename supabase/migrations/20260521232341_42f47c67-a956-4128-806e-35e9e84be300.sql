CREATE OR REPLACE FUNCTION public.fn_itens_propostas_ganhas_mes(
  p_ano integer DEFAULT (EXTRACT(year FROM now()))::integer,
  p_mes integer DEFAULT (EXTRACT(month FROM now()))::integer
)
RETURNS TABLE(produto text, qtd_total numeric, receita_total numeric, n_deals bigint, ticket_medio numeric)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH itens AS (
    SELECT
      d.id AS deal_id,
      TRIM(it->>'nome') AS produto,
      COALESCE(NULLIF(it->>'qtd','')::numeric, 1) AS qtd,
      COALESCE(NULLIF(it->>'total','')::numeric, 0) AS total,
      COALESCE(NULLIF(it->>'unit','')::numeric, 0) AS unit
    FROM public.deals d
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(d.proposals, '[]'::jsonb)) AS p
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p->'items', '[]'::jsonb)) AS it
    WHERE d.status = 'ganha'
      AND (d.is_deleted IS NULL OR d.is_deleted = false)
      AND d.closed_at IS NOT NULL
      AND EXTRACT(YEAR  FROM d.closed_at) = p_ano
      AND EXTRACT(MONTH FROM d.closed_at) = p_mes
      AND TRIM(COALESCE(it->>'nome','')) <> ''
  )
  SELECT
    produto,
    SUM(qtd)                                                 AS qtd_total,
    ROUND(SUM(total), 2)                                     AS receita_total,
    COUNT(DISTINCT deal_id)                                  AS n_deals,
    ROUND(SUM(total) / NULLIF(SUM(qtd), 0), 2)               AS ticket_medio
  FROM itens
  GROUP BY produto
  ORDER BY SUM(total) DESC NULLS LAST;
$function$;