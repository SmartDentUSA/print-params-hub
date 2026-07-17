## Objetivo
Reclassificar o produto **SmartSlicer I.A.** no `system_a_catalog` para a subetapa correta.

## Alteração
- `product_category` = `3. Impressão 3D`
- `product_subcategory` = `3.4 Software`

## SQL (via ferramenta de dados)
```sql
UPDATE system_a_catalog
SET product_category = '3. Impressão 3D',
    product_subcategory = '3.4 Software'
WHERE id = '14142463-610a-4a82-a2ca-0d0db68226d0';
```

## Fora do escopo
- Renomear/criar outras subcategorias da lista (Biocompatíveis, Uso Geral, SmartMake, SmartGum, Adesivos, Cimentos, Resinas Compostas, Cerômero, Acabamento e Finalização).
- Alterar a taxonomia canônica do plano (que hoje define 3.2 Software).

## Critério de aceitação
- Em `/admin` → Gestão de Catálogo, o SmartSlicer I.A. aparece agrupado sob `3. Impressão 3D → 3.4 Software`.
