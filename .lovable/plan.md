## Diagnóstico

A tabela **Catálogo de Produtos** (`DealerPriceTable.importCatalog`) puxa de `system_a_catalog` filtrando apenas por `approved=true`. Mas essa tabela mistura tipos:

- `category='product'` (real) — 130 linhas
- `category='resin'` (real) — 14 linhas
- `category='category_config'` — 25 linhas (são as **categorias** aparecendo como produto: "CARACTERIZAÇÃO - SMARTGUM", "SCANNERS 3D - IOS", etc.)
- `category='company_info'`, `Software`, `Serviços`, `Acessórios`, `Equipamentos` — 6 linhas soltas

Total: 31 linhas "lixo" viram itens sem COD/SKU/variação → cada uma cria dezenas de linhas vazias com R$ 0,00 na planilha do distribuidor. Isso explica exatamente o que aparece na screenshot (linhas sem produto + várias R$ 0,00 seguidas).

Não há registros de vídeo em `system_a_catalog`; o que o usuário lê como "vídeo" são as linhas `category_config` (nomes de categorias/subcategorias).

## Correção

### 1. Filtrar `importCatalog` em `src/components/smartops/distributors/DealerPriceTable.tsx` (linhas ~254-258)

Adicionar filtros à query do `system_a_catalog`:
- `.in("category", ["product", "resin"])`
- `.eq("active", true)`

Assim, no próximo "Importar catálogo" só entram produtos e resinas reais.

### 2. Limpeza retroativa dos itens já criados

Rodar um `DELETE` em `dealer_price_items` para todas as linhas cujo `catalog_product_id` aponta para um registro de `system_a_catalog` com `category NOT IN ('product','resin')`. Isso remove os itens "categoria" e "vídeo/serviço/software" já materializados nas listas de todos os distribuidores, sem tocar em preços de itens válidos.

Escopo do DELETE (contagem prévia será confirmada na execução):
```sql
DELETE FROM dealer_price_items dpi
USING system_a_catalog sac
WHERE dpi.catalog_product_id = sac.id
  AND sac.category NOT IN ('product','resin');
```

### 3. Fora do escopo

- Nenhuma alteração de UI, modal, preços ou schema.
- `system_a_catalog` continua com as linhas `category_config` (elas são usadas pela navegação de categorias em outros lugares) — só deixam de ser importadas para o catálogo do distribuidor.
- `catalog_product_variations` não é tocada.

## Verificação

Depois de aplicar: recarregar a aba **📦 Catálogo de Produtos** do distribuidor → só devem aparecer produtos reais com COD/SKU/variação; as R$ 0,00 em cascata somem.
