Popular `catalog_product_variations` diretamente via SQL (um único `supabase--insert`), casando cada COD com `system_a_catalog.external_id`. Sem modal, sem alteração de UI, sem preços.

### Parsing por linha
- **COD** = dígitos iniciais → `catalog_product_id = (SELECT id FROM system_a_catalog WHERE external_id = '<COD>')`. Linha sem match é ignorada.
- **Variação (`presentation_qty`)** = **apenas o número** (como string), ex.:
  - `250g` → `250`
  - `500g` → `500`
  - `1000g (1kg)` → `1000`
  - `2,5g` → `2.5`
  - `0,5g (Seringa)` → `0.5`
  - `Seringa` → `1`
  - `Kit (5 un)` → `5`
  - `Kit (10 un)` → `10`
  - `1 un` → `1`
- **Pres (`presentation`)** = unidade de medida ou "Item" (respeitando os valores permitidos `"grs" | "Kg" | "Item" | "ml"`):
  - contém `g` (sem `kg`) → `grs`
  - contém `kg` → `Kg` (nenhuma linha do bloco entra aqui — todas as "1kg" estão como `1000g (1kg)` → `grs`/`1000`)
  - `Seringa`, `Kit`, `un` → `Item`
- **`unidade`**: `g` para gramas, `kg` para quilos, `UN` para os demais.
- **`ncm_hs`** = texto do NCM/HS.
- **`gtin_ean`**: `Sob consulta` e `... (Ref)` → `NULL`; caso contrário, os 13–14 dígitos.
- **`weight_kg`**: `0,33 kg` → `0.33`.
- **`dimensions_cm`**: string exata (`16.0 × 8.0 × 8.0 cm`).
- **`source`** = `'bulk_import'`.
- **`sort_order`** = índice sequencial da variação dentro do produto (0, 1, 2…).

### Upsert
Uma única `INSERT ... ON CONFLICT (catalog_product_id, presentation_qty) DO UPDATE` atualizando apenas `ncm_hs`, `gtin_ean`, `unidade`, `presentation`, `weight_kg`, `dimensions_cm`. Preços permanecem intocados.

### Segurança / escopo
- Não cria produto novo em `system_a_catalog` — COD sem match é pulado no `WHERE`.
- Não gera migration.
- Idempotente: reexecutar não gera duplicatas.
