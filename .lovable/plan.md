## Atualizar catalogo-produtos-master-2026-07-21.csv

Regerar o CSV master com o estado atual do banco, incorporando as mudanças feitas desde a última exportação:

- Enriquecimento Bio Vitality (Anvisa, FDA, GTINs, NCM, preços BRL 1.859).
- 8 variações canônicas (A2/A3/B1/BL1 Classic + HT) com SKUs 1736/1645/1266/1644/2230/2231/2233/2232.
- Dimensões 16.0 × 8.0 × 8.0 cm e peso 0,33 kg nas variações 250g.
- Remoção das 5 linhas fantasmas de `catalog_product_variations`.
- Presentation normalizado (qty numérico + unit "grs").
- Preços BRL/USD/EUR por variação, quando existirem.

### Fontes consultadas

- `system_a_catalog` (allowlist: product, resin, Resinas, consumables, Serviços — conforme `docs/CATALOG_PRODUCT_GOVERNANCE.md`).
- `catalog_product_variations` (variações com SKU/GTIN/preço/dimensões).
- `resins` + `products_catalog` (espelhos), somente para completar campos onde `system_a_catalog` estiver vazio.

### Colunas do CSV (mesmo cabeçalho da versão anterior)

`entity_type, product_id, parent_name, variation_id, sku, gtin_ean, name, color, presentation_qty, presentation_unit, dimensions_cm, weight_kg, price_brl, price_usd, price_eur, ncm_hs, anvisa_registration, fda_510k, category, subcategory, stage, is_active, is_approved, is_visible, updated_at`

Uma linha por variação (quando existir); produtos sem variação entram como linha única com `variation_id` vazio.

### Entrega

Arquivo salvo em `/mnt/documents/catalogo-produtos-master-2026-07-21.csv` (sobrescreve o atual, mesmo nome para preservar o link já aberto no preview).

### Fora de escopo

- Não altero dados no banco.
- Não mudo o schema do CSV nem o nome do arquivo.
- Não incluo `video_testimonial`, `category_config` nem `company_info` (proibidos pela governança).
