## Objetivo
Tornar as badges de categoria nos cards de distribuidores monocromáticas (tons de cinza/slate) em vez de coloridas.

## Alteração
Em `KbTabDistribuidores.tsx`, substituir o uso de `CATALOG_COLORS` nas badges de categoria por uma paleta fixa monocromática:
- **Fundo:** `#f1f5f9` (slate-100)
- **Texto:** `#475569` (slate-600)
- **Borda:** `#e2e8f0` (slate-200)

Isso remove o visual "brega" das cores variadas e deixa o grid mais sóbrio e profissional.

## Arquivos afetados
- `src/components/knowledge/KbTabDistribuidores.tsx`