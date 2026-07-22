Criar o parent **Cimento UNIKK Veneer LV** em `system_a_catalog` e adicioná-lo à rodada de população de variações (junto com os outros SKUs Atos/SmartGum/SmartMake/UNIKK/Block já mapeados).

## 1. Criar parent em `system_a_catalog`

Nova linha, alinhada com as outras variações do Cimento UNIKK Veneer:

- `name`: `Cimento UNIKK Veneer LV`
- `slug`: `atos-unikk-veneer-lv` (padrão das siblings A1/A2/A3.5/B1/BL2/TRS)
- `category`: `product`
- `product_category`: mesmo das siblings UNIKK (herdar da A1 `6c7c07a5-daa0-49b9-b663-9969ef7a8b2c` via SELECT — hoje é `6. DENTÍSTICA, ESTÉTICA E ORTODONTIA`)
- `product_subcategory`: idem herdar da A1
- `active`: `true`
- `approved`: `true`
- `visible_in_ui`: `true`
- `display_order`: max(display_order das UNIKK Veneer) + 1
- Sem imagem/descrição — pode ser preenchido depois. Sem preço BRL/USD/EUR (não fornecido).
- `source`: `manual_create_2026_07_22`

## 2. Inserir 1 variação canônica no novo parent

Em `catalog_product_variations`:

- `sku`: `1983`
- `presentation`: `2,5g - LV`
- `presentation_qty`: `2,5g`
- `unidade`: `grs`
- `ncm_hs`: `9021.29.00`
- `gtin_ean`: null (N/D)
- `color`: `LV`
- `weight_kg`: null (N/D — não fornecido)
- `dimensions_cm`: null (N/D)
- `sort_order`: 1
- `source`: `manual_enrichment_2026_07_22_atos`

## 3. Reincluir SKU 1983 na rodada anterior

Somar o parent recém-criado à lista de parents da migration da rodada anterior (Atos/SmartGum/SmartMake/UNIKK/Block) e re-inserir a variação junto — mesma pipeline (snapshot preços → wipe → re-insert), respeitando "1 pai por cor + 1 variação".

## Fora de escopo

- Continua não criando SmartMake Maleta (SKU 396) — se quiser, peça em uma próxima rodada.
- Sem alteração de UI, `resins`, `catalog_documents` ou preços dos demais itens.
- Sem regeneração automática do CSV master.