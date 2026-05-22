CREATE OR REPLACE FUNCTION public.fn_rayshape_owners()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
WITH printers AS (
  SELECT DISTINCT ON (la.id)
    la.id              AS lead_id,
    la.nome            AS lead_name,
    la.email           AS lead_email,
    la.telefone_normalized AS lead_phone,
    d.closed_at        AS printer_date,
    d.piperun_deal_id  AS printer_deal_id,
    d.owner_name       AS vendor,
    (SELECT (item->>'total')::numeric
       FROM jsonb_array_elements(d.proposals) prop,
            jsonb_array_elements(prop->'items') item
      WHERE (item->>'nome') ILIKE '%Edge Mini%' LIMIT 1) AS printer_price
  FROM deals d
  JOIN lia_attendances la ON la.id = d.lead_id
  WHERE la.merged_into IS NULL
    AND d.proposals::text ILIKE '%Edge Mini%'
    AND (d.is_deleted IS NULL OR d.is_deleted = false)
  ORDER BY la.id, d.closed_at ASC NULLS LAST
),
post AS (
  SELECT
    p.lead_id,
    COUNT(d.*)::int                                            AS n_post,
    COALESCE(SUM(d.value), 0)::numeric                         AS total_post,
    MIN(EXTRACT(DAY FROM d.closed_at - p.printer_date))::int   AS first_repurchase_days
  FROM printers p
  LEFT JOIN deals d
    ON d.lead_id = p.lead_id
   AND d.status = 'ganha'
   AND d.value > 0
   AND d.closed_at > p.printer_date
   AND (d.is_deleted IS NULL OR d.is_deleted = false)
  GROUP BY p.lead_id
)
SELECT COALESCE(jsonb_agg(row ORDER BY (row->>'days_since')::int DESC), '[]'::jsonb)
FROM (
  SELECT jsonb_build_object(
    'lead_id',               p.lead_id,
    'lead_name',             p.lead_name,
    'lead_email',            p.lead_email,
    'lead_phone',            p.lead_phone,
    'printer_date_iso',      (p.printer_date AT TIME ZONE 'America/Sao_Paulo')::date,
    'days_since',            EXTRACT(DAY FROM NOW() - p.printer_date)::int,
    'vendor',                COALESCE(p.vendor, ''),
    'printer_price',         COALESCE(p.printer_price, 0),
    'printer_deal_id',       p.printer_deal_id,
    'n_post',                COALESCE(po.n_post, 0),
    'total_post',            COALESCE(po.total_post, 0),
    'first_repurchase_days', po.first_repurchase_days,
    'category', CASE
      WHEN COALESCE(po.n_post,0) > 0                              THEN 'recomprou'
      WHEN EXTRACT(DAY FROM NOW() - p.printer_date)::int >= 180  THEN 'critico'
      WHEN EXTRACT(DAY FROM NOW() - p.printer_date)::int >=  90  THEN 'atencao'
      ELSE 'cedo'
    END
  ) AS row
  FROM printers p
  LEFT JOIN post po ON po.lead_id = p.lead_id
) s;
$$;

GRANT EXECUTE ON FUNCTION public.fn_rayshape_owners() TO authenticated;