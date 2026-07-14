CREATE OR REPLACE FUNCTION public.fn_rayshape_owners()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH deal_edge AS (
  SELECT
    d.id              AS deal_id,
    d.lead_id,
    d.closed_at,
    d.piperun_deal_id,
    d.owner_name,
    COALESCE(SUM(
      CASE WHEN (item->>'nome') ILIKE 'RayShape - Edge Mini'
             OR (item->>'nome') ILIKE 'Impressora 3D Rayshape Edge Mini%'
           THEN (item->>'total')::numeric ELSE 0 END
    ), 0) AS printer_price,
    BOOL_OR(
      EXISTS (
        SELECT 1 FROM jsonb_array_elements(prop->'items') ii
        WHERE (ii->>'nome') ILIKE 'RayShape - Edge Mini'
           OR (ii->>'nome') ILIKE 'Impressora 3D Rayshape Edge Mini%'
      )
      AND (
        EXISTS (
          SELECT 1 FROM jsonb_array_elements(prop->'items') ii
          WHERE (ii->>'nome') ~* '(scanner\s*intraoral|intraoral|medit|itero|trios|primescan|aoralscan|shining|helios|panda\s*p|runyes|launca|freedom|carestream\s*cs\s*3|3shape|emerald|i700)'
        )
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(prop->'items') ii
          WHERE (ii->>'nome') ~* '(\mINO\s*200\M|kit\s*chairside)'
        )
      )
    ) AS is_combo
  FROM deals d
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(d.proposals, '[]'::jsonb)) prop
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(prop->'items', '[]'::jsonb)) item
  WHERE d.status = 'ganha'
    AND (d.is_deleted IS NULL OR d.is_deleted = false)
  GROUP BY d.id, d.lead_id, d.closed_at, d.piperun_deal_id, d.owner_name
  HAVING BOOL_OR(
    (item->>'nome') ILIKE 'RayShape - Edge Mini'
    OR (item->>'nome') ILIKE 'Impressora 3D Rayshape Edge Mini%'
  )
),
printers_auto AS (
  SELECT DISTINCT ON (la.id)
    la.id                  AS lead_id,
    la.nome                AS lead_name,
    CASE WHEN la.email ~* '^(e-?mail\s*n[ãa]o\s*informado|n[ãa]o\s*informado)' OR la.email ILIKE '%@import.placeholder%' THEN NULL ELSE la.email END AS lead_email,
    la.telefone_normalized AS lead_phone,
    de.closed_at           AS printer_date,
    de.piperun_deal_id     AS printer_deal_id,
    de.owner_name          AS vendor,
    de.printer_price       AS printer_price,
    de.is_combo            AS is_combo,
    'auto'::text           AS source
  FROM deal_edge de
  JOIN lia_attendances la ON la.id = de.lead_id
  WHERE la.merged_into IS NULL
    AND la.id <> '121e4715-00a6-4ca2-ba7b-c20677bad2a1'::uuid
    AND NOT (la.nome ILIKE 'Peru' AND la.email ILIKE '%medco.pe%')
  ORDER BY la.id, de.closed_at ASC NULLS LAST
),
combo_by_lead AS (
  SELECT lead_id, BOOL_OR(is_combo) AS any_combo
  FROM deal_edge
  GROUP BY lead_id
),
printers_manual AS (
  SELECT
    la.id                  AS lead_id,
    la.nome                AS lead_name,
    CASE WHEN la.email ~* '^(e-?mail\s*n[ãa]o\s*informado|n[ãa]o\s*informado)' OR la.email ILIKE '%@import.placeholder%' THEN NULL ELSE la.email END AS lead_email,
    la.telefone_normalized AS lead_phone,
    (m.printer_date::timestamp AT TIME ZONE 'America/Sao_Paulo') AS printer_date,
    m.piperun_deal_id      AS printer_deal_id,
    'manual'::text         AS vendor,
    0::numeric             AS printer_price,
    false                  AS is_combo,
    'manual'::text         AS source
  FROM rayshape_manual_owners m
  JOIN lia_attendances la ON la.id = m.lead_id
  WHERE la.merged_into IS NULL
    AND la.id NOT IN (SELECT lead_id FROM printers_auto)
),
printers AS (
  SELECT * FROM printers_auto
  UNION ALL
  SELECT * FROM printers_manual
),
post AS (
  SELECT
    p.lead_id,
    COUNT(DISTINCT d.id)::int                                  AS n_post,
    COALESCE(SUM((item->>'total')::numeric), 0)::numeric        AS total_post,
    MIN(EXTRACT(DAY FROM d.closed_at - p.printer_date))::int   AS first_repurchase_days,
    MAX(d.closed_at)                                           AS last_repurchase_at
  FROM printers p
  LEFT JOIN deals d
    ON d.lead_id = p.lead_id
   AND d.status = 'ganha'
   AND (d.is_deleted IS NULL OR d.is_deleted = false)
   AND d.closed_at > p.printer_date
  LEFT JOIN LATERAL jsonb_array_elements(COALESCE(d.proposals, '[]'::jsonb)) prop ON TRUE
  LEFT JOIN LATERAL jsonb_array_elements(COALESCE(prop->'items', '[]'::jsonb)) item ON TRUE
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
    'edge_purchase_at',      p.printer_date,
    'days_since',            EXTRACT(DAY FROM NOW() - p.printer_date)::int,
    'vendor',                COALESCE(p.vendor, ''),
    'printer_price',         COALESCE(p.printer_price, 0),
    'printer_deal_id',       p.printer_deal_id,
    'source',                p.source,
    'sale_kind',             CASE WHEN COALESCE(cbl.any_combo, p.is_combo, false) THEN 'combo' ELSE 'separado' END,
    'n_post',                COALESCE(po.n_post, 0),
    'total_post',            COALESCE(po.total_post, 0),
    'recompra_combo_brl',    CASE WHEN COALESCE(cbl.any_combo, p.is_combo, false) THEN COALESCE(po.total_post, 0) ELSE 0 END,
    'recompra_separado_brl', CASE WHEN COALESCE(cbl.any_combo, p.is_combo, false) THEN 0 ELSE COALESCE(po.total_post, 0) END,
    'first_repurchase_days', po.first_repurchase_days,
    'last_repurchase_iso',   (po.last_repurchase_at AT TIME ZONE 'America/Sao_Paulo')::date,
    'category', CASE
      WHEN COALESCE(po.n_post,0) > 0                              THEN 'recomprou'
      WHEN EXTRACT(DAY FROM NOW() - p.printer_date)::int >= 180   THEN 'critico'
      WHEN EXTRACT(DAY FROM NOW() - p.printer_date)::int >=  90   THEN 'atencao'
      ELSE 'cedo'
    END
  ) AS row
  FROM printers p
  LEFT JOIN combo_by_lead cbl ON cbl.lead_id = p.lead_id
  LEFT JOIN post po ON po.lead_id = p.lead_id
) s;
$function$;