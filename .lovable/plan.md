# Plano: Ajustes nos KPIs de Produto na 1ª Compra (Rayshape)

Três ajustes no bloco de KPIs do painel Rayshape — Donos:

## 1. Renomear "MODEL PLUS - 1 KG" → "Resina 3D Smart Print Model Plus"

O card **Produto principal na 1ª compra** mostra hoje o nome cru (`MODEL PLUS - 1 KG`). Normalizar somente na exibição, sem alterar dado no banco.

- Em `src/components/SmartOpsRayshape.tsx`, criar helper `normalizeProductName(raw)` com regras case-insensitive:
  - `/model\s*plus/i` → `Resina 3D Smart Print Model Plus`
  - estrutura extensível para futuros aliases.
- Aplicar o normalize antes de contar (`productCounts`) e ao exibir — variações (`MODEL PLUS - 1 KG`, `Model Plus 1kg`, etc.) somam no mesmo bucket.

## 2. Adicionar quantidade (unidades) ao card do produto principal

Hoje o card mostra só o nome + `N leads`. Passará a exibir também as **unidades** desse produto acumuladas nas 1ªs recompras.

- Expandir `fn_rayshape_owners` para retornar `first_repurchase_qty numeric` (soma de `qtd` do item mais valioso não-impressora da 1ª deal pós-impressora, por lead).
- No frontend, acumular `topProductQty` junto com `topProductCount`.
- Renderizar `X un. · N leads` embaixo do nome.

## 3. Novos KPIs: **2º** e **3º** produto mais comprado na 1ª compra

Após "Produto principal na 1ª compra", adicionar dois cards análogos:

- **2º produto mais comprado na 1ª compra**
- **3º produto mais comprado na 1ª compra**

Reaproveitar o mesmo `productCounts` (já normalizado) para pegar o **top 3** por `leads` (contagem de leads que compraram aquele produto como 1ª recompra), desempate por `units` desc.

Cada card mostra:
- Nome normalizado do produto (line-clamp-2).
- `X un. · N leads` abaixo.
- Se não houver 2º/3º (poucos dados), exibir `—` com opacidade reduzida.

## Arquivos

- **Migration**: `CREATE OR REPLACE fn_rayshape_owners()` incluindo `first_repurchase_qty` no CTE `first_deal_product`.
- **Editar** `src/components/SmartOpsRayshape.tsx`:
  - novo `normalizeProductName`;
  - `useMemo` calcula `topProducts: {label, leads, units}[]` (top 3);
  - grid de KPIs ganha 2 cards novos (2º e 3º);
  - display do 1º card já usa `topProducts[0]` com quantidade.

## Fora do escopo

- Não alterar `deals`/`deal_items`.
- Não mexer na seção "Unidades vendidas — pós-compra da impressora".
- Não tocar em outros KPIs, filtros ou tabela de donos.
