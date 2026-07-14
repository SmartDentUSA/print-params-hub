
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
