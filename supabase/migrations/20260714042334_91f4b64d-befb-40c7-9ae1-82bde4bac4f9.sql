
CREATE OR REPLACE FUNCTION public.fn_rayshape_product_units()
RETURNS TABLE(product_key text, product_label text, units numeric, leads int, ord int)
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
    COALESCE(NULLIF(item->>'qtd','')::numeric, 1) AS qty
  FROM owners ow
  JOIN deals d
    ON d.lead_id = ow.lead_id
   AND d.status = 'ganha'
   AND (d.is_deleted IS NULL OR d.is_deleted = false)
   AND d.closed_at > ow.printer_date
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(d.proposals, '[]'::jsonb)) prop
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(prop->'items', '[]'::jsonb)) item
  WHERE (item->>'nome') NOT ILIKE 'RayShape - Edge Mini'
    AND (item->>'nome') NOT ILIKE 'Impressora 3D Rayshape Edge Mini%'
),
matchers(ord, product_key, product_label, pattern) AS (
  VALUES
    (1,  'bio_bite_splint_flex',      'Resina 3D Smart Print Bio Bite Splint +Flex',          '%bite splint%flex%'),
    (2,  'bio_bite_splint_clear',     'Resina 3D Smart Print Bio Bite Splint Clear',          '%bite splint%clear%'),
    (3,  'bio_denture',               'Resina 3D Smart Print Bio Denture',                    '%bio denture%'),
    (4,  'bio_denture_translucida',   'Resina 3D Smart Print Bio Denture Translúcida',        '%denture%transl%'),
    (5,  'bio_temp_b1',               'Resina 3D Smart Print Bio Temp B1',                    '%bio temp%b1%'),
    (6,  'bio_vitality',              'Resina 3D Smart Print Bio Vitality',                   '%vitality%'),
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
    (22, 'atos_smart_ortho',          'ATOS Smart Ortho',                                     '%atos%smart%ortho%')
),
matched AS (
  SELECT m.ord, m.product_key, m.product_label, pi.lead_id, pi.qty
  FROM matchers m
  JOIN post_items pi ON pi.item_name ILIKE m.pattern
)
SELECT
  m.product_key,
  m.product_label,
  COALESCE(SUM(mt.qty), 0)::numeric AS units,
  COALESCE(COUNT(DISTINCT mt.lead_id), 0)::int AS leads,
  m.ord::int AS ord
FROM matchers m
LEFT JOIN matched mt ON mt.product_key = m.product_key
GROUP BY m.ord, m.product_key, m.product_label
ORDER BY m.ord;
$$;
