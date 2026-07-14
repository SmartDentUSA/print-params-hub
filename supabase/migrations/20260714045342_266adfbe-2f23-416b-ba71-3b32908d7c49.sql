
DROP FUNCTION IF EXISTS public.fn_rayshape_product_units();

CREATE OR REPLACE FUNCTION public.fn_rayshape_product_units()
RETURNS TABLE(product_key text, product_label text, units numeric, leads int, revenue numeric, ord int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    (item->>'nome') AS item_name,
    COALESCE(NULLIF(item->>'qtd','')::numeric, 1) AS qty,
    COALESCE(NULLIF(item->>'total','')::numeric, 0) AS total,
    -- id único do item dentro do deal p/ deduplicação
    d.id::text || '|' || (prop_ord.ord::text) || '|' || (item_ord.ord::text) AS item_uid
  FROM owners ow
  JOIN deals d
    ON d.lead_id = ow.lead_id
   AND d.status = 'ganha'
   AND (d.is_deleted IS NULL OR d.is_deleted = false)
   AND d.closed_at > ow.printer_date
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(d.proposals, '[]'::jsonb)) WITH ORDINALITY AS prop_ord(prop, ord)
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(prop_ord.prop->'items', '[]'::jsonb)) WITH ORDINALITY AS item_ord(item, ord)
  WHERE (item_ord.item->>'nome') NOT ILIKE 'RayShape - Edge Mini'
    AND (item_ord.item->>'nome') NOT ILIKE 'Impressora 3D Rayshape Edge Mini%'
),
-- Ordem = especificidade (produtos mais específicos primeiro; genéricos por último)
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
    -- SmartMake vem ANTES de Vitality para capturar "SmartMake Seal Glaze (aplicação na Vitality)"
    (17, 'smartmake_any',             'SmartMake (qualquer item)',                            '%smartmake%'),
    (18, 'smartgum_any',              'SmartGum (qualquer item)',                             '%smartgum%'),
    (19, 'atos_resina_composta_any',  'Atos Resina Composta Direta (qualquer item)',          '%atos%resina composta%'),
    (20, 'cimento_unikk_veneer_any',  'Cimento UNIKK Veneer (qualquer item)',                 '%unikk%veneer%'),
    (21, 'atos_unichroma',            'Atos Unichroma',                                       '%unichroma%'),
    (22, 'atos_smart_ortho',          'ATOS Smart Ortho',                                     '%atos%smart%ortho%'),
    -- Vitality genérico por último
    (23, 'bio_vitality',              'Resina 3D Smart Print Bio Vitality',                   '%vitality%')
),
-- Um item pode bater múltiplos padrões — pega apenas o de menor ord (mais específico)
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
$$;

GRANT EXECUTE ON FUNCTION public.fn_rayshape_product_units() TO authenticated, service_role;

-- Aplica mesma dedup também nas shades da Vitality
DROP FUNCTION IF EXISTS public.fn_rayshape_vitality_shades();

CREATE OR REPLACE FUNCTION public.fn_rayshape_vitality_shades()
RETURNS TABLE(shade_key text, shade_label text, units numeric, ord int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    lower(item->>'nome') AS item_name,
    COALESCE(NULLIF(item->>'qtd','')::numeric, 1) AS qty
  FROM owners ow
  JOIN deals d
    ON d.lead_id = ow.lead_id
   AND d.status = 'ganha'
   AND (d.is_deleted IS NULL OR d.is_deleted = false)
   AND d.closed_at > ow.printer_date
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(d.proposals, '[]'::jsonb)) prop
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(prop->'items', '[]'::jsonb)) item
  WHERE lower(item->>'nome') LIKE '%vitality%'
    -- Exclui SmartMake / SmartGum / etc mesmo quando mencionam vitality no nome
    AND lower(item->>'nome') NOT LIKE '%smartmake%'
    AND lower(item->>'nome') NOT LIKE '%smartgum%'
),
classified AS (
  SELECT
    qty,
    CASE
      WHEN item_name ~ 'bl1.*ht'      THEN 'bl1_ht'
      WHEN item_name ~ 'a2.*ht'       THEN 'a2_ht'
      WHEN item_name ~ 'b1.*ht'       THEN 'b1_ht'
      WHEN item_name LIKE '%bl1%'     THEN 'bl1'
      WHEN item_name LIKE '%a2%'      THEN 'a2'
      WHEN item_name LIKE '%a3%'      THEN 'a3'
      WHEN item_name LIKE '%b1%'      THEN 'b1'
      ELSE NULL
    END AS shade_key
  FROM post_items
),
shades(ord, shade_key, shade_label) AS (
  VALUES
    (1,'bl1','BL1'),
    (2,'b1','B1'),
    (3,'a2','A2'),
    (4,'a3','A3'),
    (5,'bl1_ht','BL1 HT'),
    (6,'b1_ht','B1 HT'),
    (7,'a2_ht','A2 HT')
)
SELECT
  s.shade_key,
  s.shade_label,
  COALESCE(SUM(c.qty), 0)::numeric AS units,
  s.ord::int
FROM shades s
LEFT JOIN classified c ON c.shade_key = s.shade_key
GROUP BY s.ord, s.shade_key, s.shade_label
ORDER BY s.ord;
$$;

GRANT EXECUTE ON FUNCTION public.fn_rayshape_vitality_shades() TO authenticated, service_role;
