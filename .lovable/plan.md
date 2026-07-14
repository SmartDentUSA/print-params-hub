# Plano: 4 KPIs de Vendedor Líder por Categoria (Rayshape)

Adicionar 4 novos cards no bloco de KPIs do painel Rayshape — Donos, mostrando qual vendedor tem mais donos em cada categoria:

- **Vendedor líder — ⚪ Cedo**
- **Vendedor líder — 🟡 Atenção**
- **Vendedor líder — 🔴 Crítico**
- **Vendedor líder — ✅ Recompra**

Cada card exibe:
- Nome do vendedor.
- Contagem: `N donos`.

Se a categoria não tiver donos, mostra `—` com opacidade reduzida.

## Implementação (frontend apenas)

Em `src/components/SmartOpsRayshape.tsx`:

1. Dentro do `useMemo` de `kpis`, agrupar `owners` por `(category, vendor)` com um `Map<Category, Map<string, number>>`, e depois reduzir a `topVendorByCategory: Record<Category, { vendor: string; count: number } | null>`.
   - Ignora vendors vazios / `"manual"` (não é vendedor de verdade — é fonte manual).
   - Desempate: maior contagem; se empatar, primeiro alfabético.
2. No grid de KPIs, adicionar os 4 cards após o card de "3º produto mais comprado na 1ª compra". Cor da borda/valor combina com o `CATEGORY_META` já existente (verde/amarelo/vermelho/cinza).

## Fora do escopo

- Não mexer em RPCs, banco ou filtros da tabela.
- Não alterar seções de "Unidades vendidas" nem de "Produto principal na 1ª compra".
