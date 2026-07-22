## Objetivo
Gerar um arquivo `/mnt/documents/arvore-categorias-produtos-variacoes.txt` com a árvore completa do catálogo, no formato:

```
Categoria
├── Subcategoria
│   ├── Produto (parent)
│   │   ├── Variação — SKU · apresentação · cor · GTIN
│   │   └── ...
```

## Fonte de dados
- `system_a_catalog` → `product_category`, `product_subcategory`, `name`, `slug`, `id`, `active`
- `catalog_product_variations` (join por `catalog_product_id`) → `sku`, `presentation`, `color`, `gtin_ean`, `weight_kg`, `price_brl`

## Passos
1. Consultar todos os parents ativos ordenados por `product_category, product_subcategory, name`.
2. Consultar todas as variações agrupadas por `catalog_product_id`, ordenadas por `sort_order, sku`.
3. Montar árvore em Python (script em `/tmp`), com contagens por nível (X categorias · Y subcategorias · Z produtos · N variações).
4. Produtos sem variação aparecem com `(sem variações)`.
5. Produtos sem `product_subcategory` ficam em `— (sem subcategoria)`; sem `product_category` em `— (sem categoria)`.
6. Gravar o `.txt` em `/mnt/documents/` e emitir `<presentation-artifact>`.

## Não faz parte
- Nenhuma alteração de dados ou schema.
- Nenhuma alteração de UI/frontend.
