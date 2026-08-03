ALTER TABLE public.catalog_product_variations
  ADD COLUMN IF NOT EXISTS distribute_enabled boolean;

COMMENT ON COLUMN public.catalog_product_variations.distribute_enabled IS
  'Granular: aparece no catálogo de Distribuição. NULL = herda system_a_catalog.extra_data->distribute_enabled';