## Ocultar amostras grátis (100g) no catálogo de distribuição

Na aba **Distribuição → Catálogo de Produtos** (`DealerCatalogGrid`), esconder variações cuja quantidade seja **100** dentro de **3. IMPRESSÃO 3D → 3.1 RESINAS 3D** (são amostras grátis, não entram em proposta).

### Escopo
- Apenas UI de distribuição:
  - `DealerCatalogGrid.tsx` (grid visual do catálogo de distribuição)
  - `DealerPriceTable.tsx` — no fluxo "Importar do Catálogo" (para não trazer o 100 ao criar tabela de preço nova)
  - `DealerProposalWizard.tsx` — no seletor de produtos (para não permitir adicionar 100g em proposta)
- **NÃO alterar**:
  - Gestão de Catálogo (`AdminCatalogTable`) — 100g continua existindo no cadastro.
  - Base de Conhecimento / Catálogo público.
  - `system_a_catalog` / `catalog_product_variations` (nenhuma mudança de banco).
  - Tabelas de preço já existentes com item 100 (mantém histórico).

### Regra de filtro
Ocultar variação quando **todas** condições:
1. `category` começa com `3.` (IMPRESSÃO 3D) e `subcategory` começa com `3.1` (RESINAS 3D).
2. `presentation_qty` (ou label da variação) parseia como `100` — usando o mesmo parser numérico já usado na ordenação por peso.

Categorias 3.2+ (uso geral etc.) e demais categorias não são afetadas.

### Detalhes técnicos
- Criar helper `isFreeSampleVariation(category, subcategory, qty)` em `src/components/smartops/distributors/types.ts` (ao lado de `categoryRank`) para uso compartilhado.
- Aplicar em:
  - `DealerCatalogGrid` — filtrar antes de agrupar por categoria.
  - `DealerPriceTable.importCatalog` — filtrar variações antes do upsert.
  - `DealerProposalWizard` — filtrar variações listadas no diálogo "Adicionar produto" e no preview inicial.
