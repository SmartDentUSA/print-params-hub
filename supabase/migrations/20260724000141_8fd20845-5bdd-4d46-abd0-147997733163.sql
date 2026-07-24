
ALTER TABLE public.produto_aliases
  ADD COLUMN IF NOT EXISTS is_kit boolean NOT NULL DEFAULT false;

ALTER TABLE public.deal_items
  ADD COLUMN IF NOT EXISTS parent_deal_item_id uuid REFERENCES public.deal_items(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS deal_items_parent_idx ON public.deal_items(parent_deal_item_id);

CREATE INDEX IF NOT EXISTS produto_aliases_nome_variante_lower_idx
  ON public.produto_aliases (LOWER(nome_variante));

CREATE TABLE IF NOT EXISTS public.catalog_kit_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_alias_id integer NOT NULL REFERENCES public.produto_aliases(id) ON DELETE CASCADE,
  component_variation_id uuid NOT NULL REFERENCES public.catalog_product_variations(id) ON DELETE RESTRICT,
  quantity numeric NOT NULL DEFAULT 1,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_kit_components TO authenticated;
GRANT ALL ON public.catalog_kit_components TO service_role;

ALTER TABLE public.catalog_kit_components ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth read kit components" ON public.catalog_kit_components;
CREATE POLICY "auth read kit components" ON public.catalog_kit_components
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth write kit components" ON public.catalog_kit_components;
CREATE POLICY "auth write kit components" ON public.catalog_kit_components
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS catalog_kit_components_kit_idx ON public.catalog_kit_components(kit_alias_id, sort_order);

CREATE OR REPLACE FUNCTION public.tg_kit_components_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS kit_components_updated_at ON public.catalog_kit_components;
CREATE TRIGGER kit_components_updated_at BEFORE UPDATE ON public.catalog_kit_components
  FOR EACH ROW EXECUTE FUNCTION public.tg_kit_components_updated_at();

CREATE OR REPLACE VIEW public.v_sku_mapping_inbox AS
WITH raw AS (
  SELECT
    LOWER(TRIM(COALESCE(product_name, ''))) AS name_key,
    MAX(product_name)                       AS sample_name,
    MAX(NULLIF(product_code, ''))           AS sample_code,
    MAX(NULLIF(sku, ''))                    AS sample_sku,
    'deal_items'::text                      AS source,
    COUNT(*)                                AS occurrences,
    COALESCE(SUM(total_value), 0)           AS gmv
  FROM public.deal_items
  WHERE COALESCE(product_name, '') <> ''
  GROUP BY 1
  UNION ALL
  SELECT
    LOWER(TRIM(COALESCE(nome_produto, ''))) AS name_key,
    MAX(nome_produto)                       AS sample_name,
    NULL::text                              AS sample_code,
    MAX(NULLIF(sku, ''))                    AS sample_sku,
    'loja_integrada'::text                  AS source,
    COUNT(*)                                AS occurrences,
    COALESCE(SUM(valor_total), 0)           AS gmv
  FROM public.loja_integrada_order_items
  WHERE COALESCE(nome_produto, '') <> ''
  GROUP BY 1
),
agg AS (
  SELECT
    name_key,
    MAX(sample_name) AS sample_name,
    MAX(sample_code) AS sample_code,
    MAX(sample_sku)  AS sample_sku,
    STRING_AGG(DISTINCT source, ',' ORDER BY source) AS sources,
    SUM(occurrences) AS occurrences,
    SUM(gmv)         AS gmv
  FROM raw
  GROUP BY name_key
),
alias_agg AS (
  SELECT
    LOWER(nome_variante) AS name_key,
    (ARRAY_AGG(id ORDER BY (is_kit)::int DESC, created_at DESC))[1] AS alias_id
  FROM public.produto_aliases
  GROUP BY 1
)
SELECT
  agg.name_key,
  agg.sample_name,
  agg.sample_code,
  agg.sample_sku,
  agg.sources,
  agg.occurrences,
  agg.gmv,
  pa.id            AS alias_id,
  pa.nome_canonico,
  pa.sku_interno,
  pa.categoria,
  pa.subcategoria,
  COALESCE(pa.is_kit, false) AS is_kit,
  pa.ativo         AS alias_ativo
FROM agg
LEFT JOIN alias_agg aa ON aa.name_key = agg.name_key
LEFT JOIN public.produto_aliases pa ON pa.id = aa.alias_id;

GRANT SELECT ON public.v_sku_mapping_inbox TO authenticated;

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
  gen_random_uuid()                    AS id,
  di.lead_id,
  di.deal_id,
  di.proposal_id,
  COALESCE(sac.name, cpv.presentation, cpv.sku) AS product_name,
  NULL                                 AS product_code,
  cpv.sku,
  (COALESCE(di.quantity, 1) * kc.quantity) AS quantity,
  0                                    AS unit_value,
  0                                    AS total_value,
  di.deal_date,
  di.vendor_name,
  'kit_expansion'                      AS source,
  di.id                                AS parent_deal_item_id,
  true                                 AS is_expansion
FROM public.deal_items di
JOIN public.produto_aliases pa
  ON LOWER(pa.nome_variante) = LOWER(TRIM(di.product_name)) AND pa.is_kit = true
JOIN public.catalog_kit_components kc
  ON kc.kit_alias_id = pa.id
JOIN public.catalog_product_variations cpv
  ON cpv.id = kc.component_variation_id
LEFT JOIN public.system_a_catalog sac
  ON sac.id = cpv.catalog_product_id
WHERE di.parent_deal_item_id IS NULL;

GRANT SELECT ON public.v_deal_items_expanded TO authenticated;
