# Plano: Cards por Categoria com Ranking de Vendedores

Substituir os 4 cards de "Vendedor líder — categoria" (que mostram apenas 1 vendedor) por 4 cards que **listam todos os vendedores da categoria com a respectiva quantidade de donos**, ordenados do maior para o menor.

Cada card:

- Título: `⚪ Cedo` / `🟡 Atenção` / `🔴 Crítico` / `✅ Recomprou` (usar `CATEGORY_META[cat].label`).
- Contagem total da categoria no topo (ex.: `12 donos`).
- Lista compacta: `Nome do Vendedor — N` por linha, ordenada desc.
- Ignora vendedor vazio ou `"manual"` (não é vendedor real).
- Se a categoria não tiver donos: mostra `—` com opacidade reduzida.
- Altura razoável (max-h com overflow-y auto) para não estourar o grid.

## Implementação (frontend apenas, `src/components/SmartOpsRayshape.tsx`)

1. No `useMemo` de `kpis`, substituir `topVendorByCategory` por `vendorsByCategory: Record<Category, { vendor: string; count: number }[]>` — lista ordenada `count desc`, `vendor asc` como desempate.
2. Substituir o `.map` que hoje renderiza `topVendorByCategory[cat]` por um `.map` que renderiza cada lista dentro do card com um `<ul>` compacto.
3. Manter as 4 categorias na mesma ordem: `cedo`, `atencao`, `critico`, `recomprou`.

## Fora do escopo

- Não mexer em RPCs ou banco.
- Não tocar em outros KPIs.
