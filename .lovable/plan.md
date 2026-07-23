# CSV completo de reconciliação de SKUs — antes de gravar nada

## Objetivo

Antes de qualquer migration ou registro no banco, entregar **um único CSV mestre** em `/mnt/documents/sku-reconciliacao-completo.csv` com uma linha por SKU externo (PipeRun + Loja Integrada) enriquecido com **tudo que o sistema já sabe** do produto. Você revisa, corrige, e só depois eu construo o `catalog_sku_registry` e as reference-only.

## Fontes que vou juntar

1. **PipeRun `produtos…b217.csv`** — 607 produtos, 517 com `Código único`. Traz: `ID do produto`, `Nome`, `Tipo`, `Referência`, `Código único`, `Categoria`, `Status`, `Custo`, `Valor de venda`, `Foto`, `Funil`.
2. **Loja Integrada `produtos…b435.xlsx`** — 436 SKUs. Traz: `sku`, `sku-pai`, `nome`, `marca`, `ncm`, `gtin`, `mpn`, `peso-em-kg`, `altura-em-cm`, `largura-em-cm`, `comprimento-em-cm`, `categoria-nome-nivel-1..5`, `preco-custo`, `preco-cheio`, `preco-promocional`, `imagem-1..5`, `estoque-quantidade`, `url-video-youtube`, `descricao-completa`, mais 25 colunas `grade-*` de variações (cor, tamanho, voltagem, tipo de fresa etc.).
3. **Loja Integrada `LISTAR_URL_PRODUTOS.xlsx`** — 190 URLs SEO (`PRODUTO_SKU`, `PRODUTO_URL`, `SEO_TITULO`, `SEO_DESCRICAO`).
4. **`system_a_catalog`** (391 produtos canônicos) — pego tudo que já existe: `name`, `product_category`, `product_subcategory`, `price`, `promo_price`, `ncm`, `gtin`, `presentation`, `presentation_qty`, `quantity_multiplier`, `image_url`, `og_image_url`, `technical_specs` (jsonb), `clinical_indications`, `contraindications`, `compatibility_list`, `certifications`, `keywords`, `wikidata_qid`, `description`, e as versões `_en` / `_es`.
5. **`catalog_product_variations`** — se houver linhas ligadas ao catálogo canônico, junto cor / tamanho / cavidade / preço-por-variação.
6. **`resins`** (82 colunas) — para SKUs que forem resina, puxo `flexural_strength`, `flexural_modulus`, `elongation`, `hardness`, `absorption`, `solubility`, `ansi_class`, `ce_marking`, `iso_certifications`, `application`, `color`, `curing_time`, `wavelength`, `shelf_life`, etc.
7. **`products_catalog`** — enriquecimento adicional se o produto estiver espelhado ali (marca, garantia, especificações).
8. **`deal_items`** e **`loja_integrada_order_items`** — contagem `sales_count` e `last_sold_at` por SKU externo.

## Cascata de match (para cada SKU externo)

1. `external_sku` já presente em `system_a_catalog.extra_data.piperun_code` ou `.loja_sku`.
2. Nome exato normalizado (lower, sem acento).
3. **GTIN idêntico** entre Loja Integrada e `system_a_catalog.gtin`.
4. Trigram fuzzy `pg_trgm.similarity ≥ 0.6`.
5. Tiebreaker por preço (dif < 10%) quando trigram fica em 0.4–0.6.
6. Sem match → linha marcada `unmatched` (candidata a virar reference-only depois).

## Colunas do CSV entregue

Agrupadas para facilitar revisão. Célula vazia = sistema não tem essa informação (é justamente o que você precisa preencher).

**Identificação da origem**
`source`, `external_id`, `external_sku`, `external_referencia`, `external_name`, `external_status`, `external_category_path` (Loja: nível 1 > 2 > 3), `external_url`, `external_seo_title`, `external_seo_description`, `external_image_url`, `external_video_url`.

**Comercial da origem**
`piperun_custo`, `piperun_valor_venda`, `loja_preco_custo`, `loja_preco_cheio`, `loja_preco_promocional`, `estoque_quantidade`.

**Fiscal / logística (Loja Integrada)**
`ncm_origem`, `gtin_origem`, `mpn_origem`, `peso_kg`, `altura_cm`, `largura_cm`, `comprimento_cm`.

**Variações (Loja Integrada)**
`sku_pai`, `variacao_cor`, `variacao_tamanho`, `variacao_voltagem`, `variacao_tipo`, `variacao_bloco`, `variacao_impressora`, `variacao_resina`, `variacao_dissilicato`, `variacao_pincel`, `variacao_placa`, `variacao_outros` (agrega os demais campos `grade-*` não vazios).

**Match escolhido**
`match_method` (`extra_data` | `nome_exato` | `gtin` | `trigram` | `preco_tiebreaker` | `unmatched`), `match_score`, `sac_id`, `sac_name`, `sac_product_category`, `sac_product_subcategory`.

**Enriquecimento do `system_a_catalog`** (se match)
`sac_ncm`, `sac_gtin`, `sac_presentation`, `sac_presentation_qty`, `sac_quantity_multiplier`, `sac_price`, `sac_promo_price`, `sac_image_url`, `sac_technical_specs_json`, `sac_clinical_indications`, `sac_contraindications`, `sac_compatibility_list`, `sac_certifications`, `sac_keywords`, `sac_wikidata_qid`.

**Enriquecimento `resins`** (se o produto for resina)
`resin_flexural_strength_mpa`, `resin_flexural_modulus_gpa`, `resin_elongation_pct`, `resin_hardness_shore`, `resin_water_absorption`, `resin_solubility`, `resin_ansi_class`, `resin_ce_marking`, `resin_iso_certifications`, `resin_application`, `resin_color`, `resin_curing_time_s`, `resin_wavelength_nm`, `resin_shelf_life_months`, `resin_viscosity_cps`, `resin_density`.

**Variações no catálogo canônico**
`sac_variations_count`, `sac_variations_summary` (cor/tamanho/preço concatenados).

**Uso histórico**
`sales_count_piperun` (linhas em `deal_items` com esse `Código único`), `sales_count_ecommerce` (em `loja_integrada_order_items`), `last_sold_at`, `distinct_leads`.

**Decisão sugerida**
`recommended_action` (`use_existing` | `merge_variation` | `create_reference_only` | `needs_review`), `recommended_product_category`, `recommended_product_subcategory`, `notes` (motivo + qualquer ambiguidade que valha revisar).

## Como executo (read-only)

1. Uma edge function `catalog-sku-audit` (só SELECT, zero INSERT/UPDATE) que carrega os dois arquivos, roda a cascata via `pg_trgm`, cruza com `system_a_catalog`, `catalog_product_variations`, `resins`, `products_catalog`, `deal_items`, `loja_integrada_order_items`, e devolve o CSV completo.
2. Alternativamente, se preferir mais rápido, faço em `python` no sandbox lendo Supabase via REST — mesmo resultado, sem deploy.
3. Nenhuma linha do banco é alterada. Nenhuma migration é executada.

## Depois do seu OK no CSV

Aí sim: crio a migration do `catalog_sku_registry`, o bootstrap idempotente, a aba "Referência" na Gestão de Catálogo e o ajuste no MIX/Cursos — exatamente como no plano anterior, mas usando o CSV revisado como fonte de verdade.

## Escolha antes de eu executar

- **Opção A** — executo agora e gravo `/mnt/documents/sku-reconciliacao-completo.csv` (~1.043 linhas). Você revisa, corrige, e me devolve o CSV editado como base do bootstrap.
- **Opção B** — antes do CSV, quer que eu inclua ainda alguma coluna específica que não listei (ex: Omie CFOP, Omie ID, alguma flag interna)?

Confirma A ou pede ajustes na estrutura de colunas?
