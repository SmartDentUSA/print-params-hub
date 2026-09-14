ALTER TABLE public.promotional_table_sections
  ADD COLUMN IF NOT EXISTS main_product_name text,
  ADD COLUMN IF NOT EXISTS main_product_catalog_id uuid;

DROP FUNCTION IF EXISTS public.fn_public_event_combos(uuid);

CREATE FUNCTION public.fn_public_event_combos(p_event_id uuid)
RETURNS TABLE(section_title text, section_description text, section_image_url text, main_product_name text, sort_order integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.title,
         s.description,
         COALESCE(
           s.image_url,
           (SELECT i.image_url FROM public.promotional_table_items i
             WHERE i.section_id = s.id AND i.image_url IS NOT NULL
             ORDER BY i.sort_order NULLS LAST LIMIT 1)
         ) AS section_image_url,
         NULLIF(TRIM(COALESCE(s.main_product_name, '')), '') AS main_product_name,
         s.sort_order
  FROM public.promotional_table_sections s
  JOIN public.promotional_tables t ON t.id = s.promotional_table_id
  WHERE t.event_id = p_event_id AND t.status = 'active'
  ORDER BY s.sort_order NULLS LAST, s.title
$$;

GRANT EXECUTE ON FUNCTION public.fn_public_event_combos(uuid) TO anon, authenticated;