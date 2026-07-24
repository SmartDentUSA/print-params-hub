
-- A. Rewrite v_deal_items_expanded so non-kit rows resolve SKU via produto_aliases
CREATE OR REPLACE VIEW public.v_deal_items_expanded AS
SELECT
  di.id,
  di.lead_id,
  di.deal_id,
  di.proposal_id,
  di.product_name,
  di.product_code,
  COALESCE(pa_nk.sku_interno, di.sku) AS sku,
  di.quantity,
  di.unit_value,
  di.total_value,
  di.deal_date,
  di.vendor_name,
  di.source,
  di.parent_deal_item_id,
  false AS is_expansion
FROM public.deal_items di
LEFT JOIN public.produto_aliases pa_nk
  ON lower(pa_nk.nome_variante) = lower(btrim(di.product_name))
 AND COALESCE(pa_nk.is_kit, false) = false
 AND COALESCE(pa_nk.ativo, true) = true
UNION ALL
SELECT
  gen_random_uuid() AS id,
  di.lead_id,
  di.deal_id,
  di.proposal_id,
  COALESCE(sac.name, cpv.presentation, cpv.sku) AS product_name,
  NULL::text AS product_code,
  COALESCE(cpv.sku, sac.extra_data ->> 'sku', sac.extra_data ->> 'SKU', sac.slug) AS sku,
  COALESCE(di.quantity, 1::numeric) * kc.quantity AS quantity,
  0 AS unit_value,
  0 AS total_value,
  di.deal_date,
  di.vendor_name,
  'kit_expansion'::text AS source,
  di.id AS parent_deal_item_id,
  true AS is_expansion
FROM public.deal_items di
JOIN public.produto_aliases pa
  ON lower(pa.nome_variante) = lower(btrim(di.product_name))
 AND pa.is_kit = true
JOIN public.catalog_kit_components kc ON kc.kit_alias_id = pa.id
LEFT JOIN public.catalog_product_variations cpv ON cpv.id = kc.component_variation_id
LEFT JOIN public.system_a_catalog sac
  ON sac.id = COALESCE(cpv.catalog_product_id, kc.component_catalog_product_id)
WHERE di.parent_deal_item_id IS NULL;

-- B. Backfill deal_items.sku from existing non-kit aliases
UPDATE public.deal_items di
SET sku = pa.sku_interno
FROM public.produto_aliases pa
WHERE lower(pa.nome_variante) = lower(btrim(di.product_name))
  AND COALESCE(pa.is_kit, false) = false
  AND COALESCE(pa.ativo, true) = true
  AND pa.sku_interno IS NOT NULL
  AND pa.sku_interno <> ''
  AND (di.sku IS DISTINCT FROM pa.sku_interno);

-- C. Trigger: propagate future alias changes to deal_items.sku
CREATE OR REPLACE FUNCTION public.fn_propagate_alias_sku_to_deal_items()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.is_kit, false) = true THEN
    RETURN NEW;
  END IF;
  IF NEW.sku_interno IS NULL OR NEW.sku_interno = '' THEN
    RETURN NEW;
  END IF;
  UPDATE public.deal_items di
  SET sku = NEW.sku_interno
  WHERE lower(btrim(di.product_name)) = lower(NEW.nome_variante)
    AND (di.sku IS DISTINCT FROM NEW.sku_interno);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagate_alias_sku ON public.produto_aliases;
CREATE TRIGGER trg_propagate_alias_sku
AFTER INSERT OR UPDATE OF sku_interno, nome_variante, is_kit, ativo
ON public.produto_aliases
FOR EACH ROW
EXECUTE FUNCTION public.fn_propagate_alias_sku_to_deal_items();
