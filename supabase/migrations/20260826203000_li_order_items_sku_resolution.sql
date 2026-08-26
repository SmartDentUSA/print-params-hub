-- ============================================================================
-- Loja Integrada — normalização de itens de pedido e resolução de SKU
--
-- Escopo restrito à integração Loja Integrada. Não altera regras de catálogo,
-- de CRM, RLS de outras tabelas nem qualquer outra integração.
--
-- Contexto: `loja_integrada_order_items` estava vazia e sem nenhum escritor,
-- enquanto `v_sku_mapping_inbox` a lê como fonte do braço e-commerce da fila
-- de mapeamento. Com a tabela vazia, a curadoria de SKU nunca recebeu um
-- único item vindo da loja.
-- ============================================================================

-- ─── 1. Colunas de resolução no item de pedido ──────────────────────────────
-- Guardam o resultado da cadeia de match (SKU exato → alias → nome), junto
-- com a origem da decisão, para que a atribuição seja auditável.

ALTER TABLE public.loja_integrada_order_items
  ADD COLUMN IF NOT EXISTS sku_interno           text,
  ADD COLUMN IF NOT EXISTS nome_canonico         text,
  ADD COLUMN IF NOT EXISTS catalog_variation_id  uuid,
  ADD COLUMN IF NOT EXISTS catalog_product_id    uuid,
  ADD COLUMN IF NOT EXISTS matched_by            text,
  ADD COLUMN IF NOT EXISTS match_confidence      numeric;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'li_order_items_matched_by_check'
  ) THEN
    ALTER TABLE public.loja_integrada_order_items
      ADD CONSTRAINT li_order_items_matched_by_check
      CHECK (matched_by IS NULL OR matched_by IN (
        'sku_exato','alias_sku','alias_nome','nome_exato','sku_base','nome_aproximado'
      ));
  END IF;
END $$;

-- FKs opcionais: o item pode existir sem produto resolvido, e apagar um
-- produto do catálogo não deve apagar o histórico de vendas.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'li_order_items_variation_fk'
  ) THEN
    ALTER TABLE public.loja_integrada_order_items
      ADD CONSTRAINT li_order_items_variation_fk
      FOREIGN KEY (catalog_variation_id)
      REFERENCES public.catalog_product_variations(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'li_order_items_product_fk'
  ) THEN
    ALTER TABLE public.loja_integrada_order_items
      ADD CONSTRAINT li_order_items_product_fk
      FOREIGN KEY (catalog_product_id)
      REFERENCES public.system_a_catalog(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_li_items_sku_interno
  ON public.loja_integrada_order_items (sku_interno)
  WHERE sku_interno IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_li_items_pendentes
  ON public.loja_integrada_order_items (nome_produto)
  WHERE matched_by IS NULL;

-- Chave natural do item dentro do pedido. A ingestão substitui os itens do
-- pedido a cada reprocessamento; o índice protege contra duplicação em caso
-- de escrita concorrente (webhook e reconciler no mesmo pedido).
CREATE UNIQUE INDEX IF NOT EXISTS uq_li_items_natural
  ON public.loja_integrada_order_items (
    pedido_id, COALESCE(sku, ''), COALESCE(nome_produto, '')
  );

-- ─── 2. v_sku_mapping_inbox — normalização coerente dos dois lados ──────────
-- A view agregava os itens por LOWER(TRIM(nome)) mas casava os aliases por
-- LOWER(nome_variante), sem TRIM. Qualquer alias com espaço nas pontas nunca
-- casaria. Aqui os dois lados passam a usar painel_nome_norm(), que é a mesma
-- normalização já usada pelos índices de produto_aliases e pelo resolver em
-- TypeScript — uma definição só para toda a cadeia.
--
-- O conjunto de colunas é preservado integralmente: o hook useSkuMappingInbox
-- depende dele.

CREATE OR REPLACE VIEW public.v_sku_mapping_inbox AS
WITH raw AS (
  SELECT
    public.painel_nome_norm(COALESCE(di.product_name, '')) AS name_key,
    max(di.product_name)                    AS sample_name,
    max(NULLIF(di.product_code, ''))        AS sample_code,
    max(NULLIF(di.sku, ''))                 AS sample_sku,
    'deal_items'::text                      AS source,
    count(*)                                AS occurrences,
    COALESCE(sum(di.total_value), 0::numeric) AS gmv
  FROM public.deal_items di
  WHERE COALESCE(di.product_name, '') <> ''
  GROUP BY public.painel_nome_norm(COALESCE(di.product_name, ''))

  UNION ALL

  SELECT
    public.painel_nome_norm(COALESCE(li.nome_produto, '')) AS name_key,
    max(li.nome_produto)                    AS sample_name,
    NULL::text                              AS sample_code,
    max(NULLIF(li.sku, ''))                 AS sample_sku,
    'loja_integrada'::text                  AS source,
    count(*)                                AS occurrences,
    COALESCE(sum(li.valor_total), 0::numeric) AS gmv
  FROM public.loja_integrada_order_items li
  WHERE COALESCE(li.nome_produto, '') <> ''
  GROUP BY public.painel_nome_norm(COALESCE(li.nome_produto, ''))
), agg AS (
  SELECT
    raw.name_key,
    max(raw.sample_name) AS sample_name,
    max(raw.sample_code) AS sample_code,
    max(raw.sample_sku)  AS sample_sku,
    string_agg(DISTINCT raw.source, ',' ORDER BY raw.source) AS sources,
    sum(raw.occurrences) AS occurrences,
    sum(raw.gmv)         AS gmv
  FROM raw
  GROUP BY raw.name_key
), alias_agg AS (
  SELECT
    public.painel_nome_norm(pa.nome_variante) AS name_key,
    (array_agg(pa.id ORDER BY (pa.is_kit)::int DESC, pa.created_at DESC))[1] AS alias_id
  FROM public.produto_aliases pa
  GROUP BY public.painel_nome_norm(pa.nome_variante)
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

-- ─── 3. Backfill dos itens a partir do itens_json já gravado ────────────────
-- Os pedidos históricos guardam o array de itens em `itens_json`, com SKU e
-- nome. Esta função normaliza esse conteúdo para a tabela de itens.
--
-- Não roda sozinha na migration: é chamada explicitamente
--   SELECT * FROM public.fn_li_backfill_order_items();
-- para que a carga seja uma decisão de operação, não um efeito colateral
-- do deploy. É idempotente — reexecutar não duplica.

CREATE OR REPLACE FUNCTION public.fn_li_backfill_order_items()
RETURNS TABLE(pedidos_processados integer, itens_inseridos integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pedidos integer := 0;
  v_itens   integer := 0;
BEGIN
  WITH expandido AS (
    SELECT
      o.id   AS order_id,
      o.pedido_id,
      it.elem AS item
    FROM public.loja_integrada_orders o
    CROSS JOIN LATERAL jsonb_array_elements(o.itens_json) AS it(elem)
    WHERE jsonb_typeof(o.itens_json) = 'array'
      AND jsonb_array_length(o.itens_json) > 0
  ), normalizado AS (
    SELECT
      order_id,
      pedido_id,
      NULLIF(btrim(item->>'sku'), '')  AS sku,
      NULLIF(btrim(COALESCE(item->>'nome', item->>'nome_produto')), '') AS nome_produto,
      substring(COALESCE(item->>'produto', '') from '(\d+)/?$') AS produto_id,
      COALESCE(NULLIF(item->>'quantidade', '')::numeric, 1) AS quantidade,
      COALESCE(NULLIF(item->>'preco_venda', '')::numeric, 0) AS valor_unitario,
      COALESCE(
        NULLIF(item->>'preco_subtotal', '')::numeric,
        COALESCE(NULLIF(item->>'preco_venda', '')::numeric, 0)
          * COALESCE(NULLIF(item->>'quantidade', '')::numeric, 1)
      ) AS valor_total
    FROM expandido
  ), dedup AS (
    -- O índice natural é (pedido_id, sku, nome): consolidamos linhas
    -- repetidas do mesmo produto no mesmo pedido antes de inserir.
    SELECT
      min(order_id::text)::uuid AS order_id,
      pedido_id,
      sku,
      nome_produto,
      min(produto_id) AS produto_id,
      sum(quantidade) AS quantidade,
      max(valor_unitario) AS valor_unitario,
      sum(valor_total) AS valor_total
    FROM normalizado
    WHERE sku IS NOT NULL OR nome_produto IS NOT NULL
    GROUP BY pedido_id, sku, nome_produto
  ), inserido AS (
    INSERT INTO public.loja_integrada_order_items
      (order_id, pedido_id, sku, produto_id, nome_produto,
       quantidade, valor_unitario, valor_total)
    SELECT
      order_id, pedido_id, sku, produto_id, nome_produto,
      quantidade, valor_unitario, valor_total
    FROM dedup
    ON CONFLICT (pedido_id, COALESCE(sku, ''), COALESCE(nome_produto, ''))
    DO NOTHING
    RETURNING pedido_id
  )
  SELECT count(*)::integer, count(DISTINCT pedido_id)::integer
    INTO v_itens, v_pedidos
  FROM inserido;

  RETURN QUERY SELECT v_pedidos, v_itens;
END $$;

REVOKE ALL ON FUNCTION public.fn_li_backfill_order_items() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_li_backfill_order_items() TO service_role;

-- ─── 4. Resolução em lote dos itens já gravados ─────────────────────────────
-- Aplica a mesma cadeia do resolver TypeScript, em SQL, para os itens que
-- ainda não têm produto resolvido. Serve tanto para o backfill quanto para
-- reprocessar depois que um alias novo for curado.

CREATE OR REPLACE FUNCTION public.fn_li_resolve_order_items(p_apenas_pendentes boolean DEFAULT true)
RETURNS TABLE(resolvidos integer, pendentes integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_resolvidos integer := 0;
  v_pendentes  integer := 0;
BEGIN
  WITH candidato AS (
    SELECT li.id,
           upper(btrim(li.sku))                     AS sku_norm,
           public.painel_nome_norm(li.nome_produto) AS nome_norm
    FROM public.loja_integrada_order_items li
    WHERE NOT p_apenas_pendentes OR li.matched_by IS NULL
  -- As tabelas de lookup não têm chave única nas colunas usadas no match
  -- (há SKUs repetidos entre variações e nomes repetidos no catálogo), então
  -- cada uma é reduzida a uma linha por chave antes do join. Sem isso o
  -- UPDATE ... FROM escolheria uma correspondência arbitrária.
  ), var_por_sku AS (
    SELECT DISTINCT ON (upper(btrim(sku)))
           upper(btrim(sku)) AS sku_norm, id, sku, catalog_product_id
    FROM public.catalog_product_variations
    WHERE COALESCE(btrim(sku), '') <> ''
    ORDER BY upper(btrim(sku)), sort_order NULLS LAST, id
  ), alias_por_nome AS (
    SELECT DISTINCT ON (public.painel_nome_norm(nome_variante))
           public.painel_nome_norm(nome_variante) AS nome_norm,
           sku_interno, nome_canonico
    FROM public.produto_aliases
    WHERE COALESCE(ativo, true)
    ORDER BY public.painel_nome_norm(nome_variante), (is_kit)::int DESC, created_at DESC
  ), prod_por_nome AS (
    SELECT DISTINCT ON (public.painel_nome_norm(name))
           public.painel_nome_norm(name) AS nome_norm, id
    FROM public.system_a_catalog
    WHERE COALESCE(btrim(name), '') <> ''
    ORDER BY public.painel_nome_norm(name), COALESCE(active, true) DESC, id
  ), resolucao AS (
    SELECT
      c.id,
      -- 1. SKU exato contra as variações do catálogo
      v_sku.id        AS var_sku_id,
      v_sku.sku       AS var_sku_sku,
      v_sku.catalog_product_id AS var_sku_prod,
      -- 2/3. Alias curado por nome
      pa.sku_interno  AS alias_sku,
      pa.nome_canonico AS alias_nome,
      v_alias.id      AS var_alias_id,
      v_alias.catalog_product_id AS var_alias_prod,
      -- 4. Nome do item igual ao nome de um produto do catálogo
      sac.id          AS prod_nome_id
    FROM candidato c
    LEFT JOIN var_por_sku v_sku
      ON v_sku.sku_norm = c.sku_norm AND c.sku_norm <> ''
    LEFT JOIN alias_por_nome pa
      ON pa.nome_norm = c.nome_norm AND c.nome_norm <> ''
    LEFT JOIN var_por_sku v_alias
      ON v_alias.sku_norm = upper(btrim(pa.sku_interno))
     AND COALESCE(btrim(pa.sku_interno), '') <> ''
    LEFT JOIN prod_por_nome sac
      ON sac.nome_norm = c.nome_norm AND c.nome_norm <> ''
  ), atualizado AS (
    UPDATE public.loja_integrada_order_items li
    SET
      sku_interno = COALESCE(r.var_sku_sku, r.alias_sku),
      nome_canonico = CASE WHEN r.var_sku_id IS NULL THEN r.alias_nome END,
      catalog_variation_id = COALESCE(r.var_sku_id, r.var_alias_id),
      catalog_product_id = COALESCE(r.var_sku_prod, r.var_alias_prod, r.prod_nome_id),
      matched_by = CASE
        WHEN r.var_sku_id   IS NOT NULL THEN 'sku_exato'
        WHEN r.var_alias_id IS NOT NULL THEN 'alias_sku'
        WHEN r.alias_nome   IS NOT NULL THEN 'alias_nome'
        WHEN r.prod_nome_id IS NOT NULL THEN 'nome_exato'
      END,
      match_confidence = CASE
        WHEN r.var_sku_id   IS NOT NULL THEN 1.00
        WHEN r.var_alias_id IS NOT NULL THEN 0.95
        WHEN r.alias_nome   IS NOT NULL THEN 0.85
        WHEN r.prod_nome_id IS NOT NULL THEN 0.80
      END
    FROM resolucao r
    WHERE li.id = r.id
      AND COALESCE(r.var_sku_id::text, r.var_alias_id::text, r.alias_nome, r.prod_nome_id::text) IS NOT NULL
    RETURNING li.id
  )
  SELECT count(*)::integer INTO v_resolvidos FROM atualizado;

  SELECT count(*)::integer INTO v_pendentes
  FROM public.loja_integrada_order_items
  WHERE matched_by IS NULL;

  RETURN QUERY SELECT v_resolvidos, v_pendentes;
END $$;

REVOKE ALL ON FUNCTION public.fn_li_resolve_order_items(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_li_resolve_order_items(boolean) TO service_role;

-- ─── 5. Visibilidade da fila pendente do e-commerce ─────────────────────────
-- Hoje o admin só enxerga pendências dentro da aba de mapeamento, sobre as
-- primeiras 2.000 linhas carregadas. Esta view dá o total real, por produto,
-- ordenado pelo GMV que está sem atribuição.

CREATE OR REPLACE VIEW public.v_li_sku_pendentes AS
SELECT
  public.painel_nome_norm(li.nome_produto) AS name_key,
  max(li.nome_produto)                     AS nome_produto,
  max(li.sku)                              AS sku_exemplo,
  count(DISTINCT li.sku)                   AS skus_distintos,
  count(*)                                 AS ocorrencias,
  COALESCE(sum(li.valor_total), 0)         AS gmv_sem_atribuicao,
  max(li.pedido_id)                        AS pedido_exemplo
FROM public.loja_integrada_order_items li
WHERE li.matched_by IS NULL
  AND COALESCE(li.nome_produto, '') <> ''
GROUP BY public.painel_nome_norm(li.nome_produto)
ORDER BY COALESCE(sum(li.valor_total), 0) DESC;

GRANT SELECT ON public.v_li_sku_pendentes TO authenticated;
