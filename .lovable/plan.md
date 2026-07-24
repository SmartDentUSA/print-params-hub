# Backfill peso e dimensões por gramatura (Resinas 3D)

## Presets confirmados
| presentation_qty | dimensions_cm         | weight_kg |
|------------------|-----------------------|-----------|
| 250              | 16.0 x 8.0 x 8.0      | 0.35      |
| 500              | 19.5 x 8.5 x 8.5      | 0.61      |
| 1000             | 24.5 x 9.5 x 9.5      | 1.13      |

Observação: no backfill anterior usei `0.33` para 250g. Este plano corrige para **0.35**.

## Mudanças

1. **Backfill de dados** — `UPDATE catalog_product_variations` restrito a variações cujo produto pai é resina (`product_category` ILIKE '%resina%' OR `category` IN ('resin','Resinas')):
   - Sobrescrever `weight_kg` e `dimensions_cm` conforme a tabela acima quando `presentation_qty` for `250`, `500` ou `1000` (com `presentation` = `grs`/`g` ou vazio).
   - Sobrescrever mesmo se os campos já estiverem preenchidos (para corrigir o `0.33` anterior e alinhar dimensões).

2. **Presets no front** — `src/components/AdminCatalogTable.tsx` (constante `RESIN_GRS_PRESETS`):
   - Ajustar `250` de `0.33` para `0.35`. Demais valores já batem.

## Fora do escopo
- Não altera variações não-resina.
- Não altera `presentation` nem `presentation_qty`.

## Validação
- `SELECT presentation_qty, weight_kg, dimensions_cm, count(*) FROM catalog_product_variations v JOIN system_a_catalog c ON c.id=v.catalog_product_id WHERE (c.product_category ILIKE '%resina%' OR c.category IN ('resin','Resinas')) AND v.presentation_qty IN ('250','500','1000') GROUP BY 1,2,3` — cada gramatura deve retornar uma única combinação de peso/dimensões conforme a tabela.
