## Objetivo

Preencher no catálogo (tabela `catalog_product_variations`) as 3 variações do produto **Resina 3D Smart Print Bio Bite Splint +Flex** com SKU, NCM/HS, GTIN/EAN, Peso (kg) e Dimensões (cm), para depois serem usadas nas tabelas dos distribuidores.

## Situação atual

Existem 2 registros com o mesmo nome/slug no `system_a_catalog`:
- `10f52620-...` → já tem 3 variações normalizadas (`grs` + 250 / 500 / 1000), sem SKU/NCM/GTIN/peso/dim.
- `4aa4c2de-...` → tem 3 variações legadas (`250g` / `500g` / `1kg`, `presentation` NULL), sem os demais campos.

Vou atualizar **ambos** os conjuntos (mesmo produto duplicado no catalog) para manter consistência.

## Dados a aplicar

| Variação | SKU | NCM/HS | GTIN/EAN | Peso (kg) | Dimensões (cm) |
|---|---|---|---|---|---|
| 250g | 1899 | 9021.29.00 | 0756014744897 | 0,33 | 16.0 × 8.0 × 8.0 |
| 500g | 1898 | 9021.29.00 | 0756014744903 | 0,61 | 19.5 × 8.5 × 8.5 |
| 1kg (1000g) | 1897 | 9021.29.00 | 0756014744910 | 1,13 | 24.5 × 9.5 × 9.5 |

## Passos

1. **Normalizar as 3 variações legadas** do produto `4aa4c2de-...`:
   - `250g` → `presentation_qty='250'`, `presentation='grs'`
   - `500g` → `presentation_qty='500'`, `presentation='grs'`
   - `1kg`  → `presentation_qty='1000'`, `presentation='grs'`

2. **UPDATE em todas as 6 linhas** (ambos os `catalog_product_id`), casando por `presentation_qty` normalizado, setando:
   - `sku`, `ncm_hs`, `gtin_ean`, `weight_kg`, `dimensions_cm`

3. Nenhuma alteração de código, schema ou UI — apenas dados via `supabase--insert` (UPDATE).

## Fora de escopo

- Não deduplicar os 2 registros do `system_a_catalog` (fica para depois, se desejado).
- Não mexer em `dealer_price_items` — a Tabela de Preço puxa isso via importCatalog quando o distribuidor importar.
