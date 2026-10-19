CREATE OR REPLACE FUNCTION public.kb_catalog_resin_colors()
RETURNS TABLE(catalog_product_id uuid, color text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
 SELECT DISTINCT v.catalog_product_id, btrim(v.color)
 FROM public.catalog_product_variations v
 JOIN public.system_a_catalog c ON c.id = v.catalog_product_id
 WHERE c.active = true AND c.approved = true AND c.visible_in_ui = true
 AND c.category IN ('product', 'resin', 'Resinas', 'consumables', 'Serviços')
 AND c.name ILIKE '%resina%'
 AND nullif(btrim(v.color), '') IS NOT NULL
 ORDER BY v.catalog_product_id, btrim(v.color)
$$;
REVOKE ALL ON FUNCTION public.kb_catalog_resin_colors() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kb_catalog_resin_colors() TO anon, authenticated, service_role;