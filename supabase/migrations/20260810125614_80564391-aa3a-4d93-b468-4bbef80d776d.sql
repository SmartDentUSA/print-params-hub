CREATE OR REPLACE FUNCTION public.fn_is_rayshape_edge_printer(p_name text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(p_name,'') ~* 'rayshape'
     AND COALESCE(p_name,'') ~* 'edge\s*mini'
     AND COALESCE(p_name,'') !~* '(bandeja|teflon|lcd|cabo|filtro|n?fep|tela|resina|pos\s*cura|p[óo]s-?cura|cure|pe[çc]a|elevador|plataforma|manuten)'
$$;

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
      CASE WHEN public.fn_is_rayshape_edge_printer(item->>'nome')
           THEN (item->>'total')::numeric ELSE 0 END
    ), 0) AS printer_price,
    BOOL_OR(
      EXISTS (
        SELECT 1 FROM jsonb_array_elements(prop->'items') ii
        WHERE public.fn_is_rayshape_edge_printer(ii->>'nome')
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
  HAVING BOOL_OR(public.fn_is_rayshape_edge_printer(item->>'nome'))
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
),
first_deal AS (
  SELECT DISTINCT ON (p.lead_id)
    p.lead_id, d.id AS deal_id
  FROM printers p
  JOIN deals d
    ON d.lead_id = p.lead_id
   AND d.status = 'ganha'
   AND (d.is_deleted IS NULL OR d.is_deleted = false)
   AND d.closed_at > p.printer_date
  ORDER BY p.lead_id, d.closed_at ASC
),
first_product AS (
  SELECT fd.lead_id,
    (
      SELECT jsonb_build_object(
        'name', item->>'nome',
        'qty',  COALESCE(NULLIF(item->>'qtd','')::numeric, 1)
      )
      FROM deals d2
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(d2.proposals, '[]'::jsonb)) prop
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(prop->'items', '[]'::jsonb)) item
      WHERE d2.id = fd.deal_id
        AND NOT public.fn_is_rayshape_edge_printer(item->>'nome')
      ORDER BY COALESCE((item->>'total')::numeric, 0) DESC NULLS LAST
      LIMIT 1
    ) AS first_item
  FROM first_deal fd
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
    'first_repurchase_product', fp.first_item->>'name',
    'first_repurchase_qty',     COALESCE((fp.first_item->>'qty')::numeric, 0),
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
  LEFT JOIN first_product fp ON fp.lead_id = p.lead_id
) s;
$function$;

CREATE OR REPLACE FUNCTION public.fn_rayshape_product_units()
 RETURNS TABLE(product_key text, product_label text, units numeric, leads integer, revenue numeric, ord integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH owners_raw AS (
  SELECT value AS o FROM jsonb_array_elements(public.fn_rayshape_owners())
),
owners AS (
  SELECT
    (o->>'lead_id')::uuid AS lead_id,
    (o->>'edge_purchase_at')::timestamptz AS printer_date
  FROM owners_raw
  WHERE (o->>'edge_purchase_at') IS NOT NULL
),
post_items AS (
  SELECT
    ow.lead_id,
    (item_ord.item->>'nome') AS item_name,
    COALESCE(NULLIF(item_ord.item->>'qtd','')::numeric, 1) AS qty,
    COALESCE(NULLIF(item_ord.item->>'total','')::numeric, 0) AS total,
    d.id::text || '|' || (prop_ord.ord::text) || '|' || (item_ord.ord::text) AS item_uid
  FROM owners ow
  JOIN deals d
    ON d.lead_id = ow.lead_id
   AND d.status = 'ganha'
   AND (d.is_deleted IS NULL OR d.is_deleted = false)
   AND d.closed_at > ow.printer_date
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(d.proposals, '[]'::jsonb)) WITH ORDINALITY AS prop_ord(prop, ord)
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(prop_ord.prop->'items', '[]'::jsonb)) WITH ORDINALITY AS item_ord(item, ord)
  WHERE NOT public.fn_is_rayshape_edge_printer(item_ord.item->>'nome')
),
matchers(ord, product_key, product_label, pattern) AS (
  VALUES
    (1,  'bio_bite_splint_flex',      'Resina 3D Smart Print Bio Bite Splint +Flex',          '%bite splint%flex%'),
    (2,  'bio_bite_splint_clear',     'Resina 3D Smart Print Bio Bite Splint Clear',          '%bite splint%clear%'),
    (4,  'bio_denture_translucida',   'Resina 3D Smart Print Bio Denture Translúcida',        '%denture%transl%'),
    (3,  'bio_denture',               'Resina 3D Smart Print Bio Denture',                    '%bio denture%'),
    (5,  'bio_temp_b1',               'Resina 3D Smart Print Bio Temp B1',                    '%bio temp%b1%'),
    (7,  'model_plus',                'Resina 3D Smart Print Model Plus',                     '%model plus%'),
    (8,  'modelo_ocre',               'Resina 3D Smart Print Modelo Ocre',                    '%modelo%ocre%'),
    (9,  'modelo_precision',          'Resina 3D Smart Print Modelo Precision',               '%precision%'),
    (10, 'modelo_universal_salmao',   'Resina 3D Smart Print Modelo Universal (Salmão)',      '%universal%salm%'),
    (11, 'try_in_calcinavel',         'Resina 3D Smart Print Try-In Calcinável',              '%try-in%calcin%'),
    (12, 'bio_clear_guide',           'Resina Smart 3D Print Bio Clear Guide',                '%clear guide%'),
    (13, 'modelo_laqua',              'Resina Smart Print Modelo Láqua',                      '%l_qua%'),
    (14, 'glazeon_splint',            'GlazeON - Splint',                                     '%glazeon%splint%'),
    (15, 'nanoclean_pen',             'NanoClean Pen',                                        '%nanoclean%pen%'),
    (16, 'nanoclean_pod',             'NanoClean PoD',                                        '%nanoclean%pod%'),
    (17, 'smartmake_any',             'SmartMake (qualquer item)',                            '%smartmake%'),
    (18, 'smartgum_any',              'SmartGum (qualquer item)',                             '%smartgum%'),
    (19, 'atos_resina_composta_any',  'Atos Resina Composta Direta (qualquer item)',          '%atos%resina composta%'),
    (20, 'cimento_unikk_veneer_any',  'Cimento UNIKK Veneer (qualquer item)',                 '%unikk%veneer%'),
    (21, 'atos_unichroma',            'Atos Unichroma',                                       '%unichroma%'),
    (22, 'atos_smart_ortho',          'ATOS Smart Ortho',                                     '%atos%smart%ortho%'),
    (23, 'bio_vitality',              'Resina 3D Smart Print Bio Vitality',                   '%vitality%')
),
matched AS (
  SELECT DISTINCT ON (pi.item_uid)
    m.ord, m.product_key, m.product_label, pi.lead_id, pi.qty, pi.total
  FROM post_items pi
  JOIN matchers m ON pi.item_name ILIKE m.pattern
  ORDER BY pi.item_uid, m.ord ASC
)
SELECT
  m.product_key,
  m.product_label,
  COALESCE(SUM(mt.qty), 0)::numeric AS units,
  COALESCE(COUNT(DISTINCT mt.lead_id), 0)::int AS leads,
  COALESCE(SUM(mt.total), 0)::numeric AS revenue,
  m.ord::int AS ord
FROM matchers m
LEFT JOIN matched mt ON mt.product_key = m.product_key
GROUP BY m.ord, m.product_key, m.product_label
ORDER BY m.ord;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_is_rayshape_edge_printer(text) TO anon, authenticated, service_role;