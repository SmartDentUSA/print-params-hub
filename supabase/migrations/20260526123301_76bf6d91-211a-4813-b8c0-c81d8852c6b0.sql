CREATE OR REPLACE FUNCTION public.fn_rayshape_owners()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH won_props AS (
  SELECT DISTINCT ON (d.id)
    d.id              AS deal_id,
    d.lead_id,
    d.closed_at,
    d.piperun_deal_id,
    d.owner_name,
    prop              AS proposal
  FROM deals d
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(d.proposals, '[]'::jsonb)) prop
  WHERE d.status = 'ganha'
    AND (d.is_deleted IS NULL OR d.is_deleted = false)
  ORDER BY
    d.id,
    -- prefer explicitly accepted proposals
    (CASE
      WHEN lower(COALESCE(prop->>'status','')) IN ('aprovada','ganha','aceita','accepted','won','approved')
        OR (prop->>'status') = '1'
        OR (prop->>'accepted_at') IS NOT NULL
      THEN 0 ELSE 1
    END),
    COALESCE((prop->>'valor_ps')::numeric, 0) DESC
),
printers AS (
  SELECT DISTINCT ON (la.id)
    la.id                  AS lead_id,
    la.nome                AS lead_name,
    la.email               AS lead_email,
    la.telefone_normalized AS lead_phone,
    wp.closed_at           AS printer_date,
    wp.piperun_deal_id     AS printer_deal_id,
    wp.owner_name          AS vendor,
    (
      SELECT COALESCE(SUM((item->>'total')::numeric), 0)
      FROM jsonb_array_elements(wp.proposal->'items') item
      WHERE (item->>'nome') ILIKE '%Edge Mini%'
    ) AS printer_price
  FROM won_props wp
  JOIN lia_attendances la ON la.id = wp.lead_id
  WHERE la.merged_into IS NULL
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(wp.proposal->'items') it
      WHERE (it->>'nome') ILIKE '%Edge Mini%'
    )
  ORDER BY la.id, wp.closed_at ASC NULLS LAST
),
post AS (
  SELECT
    p.lead_id,
    COUNT(DISTINCT wp.deal_id)::int                              AS n_post,
    COALESCE(SUM((item->>'total')::numeric), 0)::numeric          AS total_post,
    MIN(EXTRACT(DAY FROM wp.closed_at - p.printer_date))::int     AS first_repurchase_days
  FROM printers p
  LEFT JOIN won_props wp
    ON wp.lead_id = p.lead_id
   AND wp.closed_at > p.printer_date
  LEFT JOIN LATERAL jsonb_array_elements(wp.proposal->'items') item ON TRUE
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
      WHEN EXTRACT(DAY FROM NOW() - p.printer_date)::int >= 180   THEN 'critico'
      WHEN EXTRACT(DAY FROM NOW() - p.printer_date)::int >=  90   THEN 'atencao'
      ELSE 'cedo'
    END
  ) AS row
  FROM printers p
  LEFT JOIN post po ON po.lead_id = p.lead_id
) s;
$function$;