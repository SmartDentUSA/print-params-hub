ALTER TABLE public.catalog_kit_components
  ALTER COLUMN component_variation_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS component_catalog_product_id uuid REFERENCES public.system_a_catalog(id) ON DELETE RESTRICT;

ALTER TABLE public.catalog_kit_components
  DROP CONSTRAINT IF EXISTS catalog_kit_components_target_check;

ALTER TABLE public.catalog_kit_components
  ADD CONSTRAINT catalog_kit_components_target_check CHECK (
    (component_variation_id IS NOT NULL AND component_catalog_product_id IS NULL)
    OR
    (component_variation_id IS NULL AND component_catalog_product_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS catalog_kit_components_catalog_product_idx
  ON public.catalog_kit_components(component_catalog_product_id);

CREATE OR REPLACE VIEW public.v_deal_items_expanded AS
SELECT
  di.id,
  di.lead_id,
  di.deal_id,
  di.proposal_id,
  di.product_name,
  di.product_code,
  di.sku,
  di.quantity,
  di.unit_value,
  di.total_value,
  di.deal_date,
  di.vendor_name,
  di.source,
  di.parent_deal_item_id,
  false AS is_expansion
FROM public.deal_items di
UNION ALL
SELECT
  gen_random_uuid() AS id,
  di.lead_id,
  di.deal_id,
  di.proposal_id,
  COALESCE(sac.name, cpv.presentation, cpv.sku) AS product_name,
  NULL AS product_code,
  COALESCE(cpv.sku, sac.extra_data->>'sku', sac.extra_data->>'SKU', sac.slug) AS sku,
  (COALESCE(di.quantity, 1) * kc.quantity) AS quantity,
  0 AS unit_value,
  0 AS total_value,
  di.deal_date,
  di.vendor_name,
  'kit_expansion' AS source,
  di.id AS parent_deal_item_id,
  true AS is_expansion
FROM public.deal_items di
JOIN public.produto_aliases pa
  ON LOWER(pa.nome_variante) = LOWER(TRIM(di.product_name)) AND pa.is_kit = true
JOIN public.catalog_kit_components kc
  ON kc.kit_alias_id = pa.id
LEFT JOIN public.catalog_product_variations cpv
  ON cpv.id = kc.component_variation_id
LEFT JOIN public.system_a_catalog sac
  ON sac.id = COALESCE(cpv.catalog_product_id, kc.component_catalog_product_id)
WHERE di.parent_deal_item_id IS NULL;

GRANT SELECT ON public.v_deal_items_expanded TO authenticated;