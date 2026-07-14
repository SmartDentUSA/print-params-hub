## Nova coluna "Pres #" + melhor espalhamento das colunas

Na tabela do `DealerPriceTable.tsx` (aba **Tabela de Preço**).

### 1. Nova coluna `Pres #` antes de `Pres`

Semântica: quantidade numérica da apresentação (ex.: `500` para `500 g`, `1` para `1 Kg`, `250` para `250 ml`). Fica **separada** do multiplicador `Unid (×)` — que continua sendo o multiplicador de preço.

- **Banco** (`dealer_price_items`): nova coluna `presentation_qty numeric` (nullable, default `null`). Migration adiciona a coluna e reutiliza os grants/policies existentes.
- **Types** (`types.ts`): adicionar `presentation_qty?: number | null;` em `DealerPriceItem`.
- **UI** (`DealerPriceTable.tsx`):
  - Novo `TableHead` `Pres #` (`hPresQty`) imediatamente antes de `Pres`.
  - `<Input type="text" inputMode="decimal">` na célula (mesmo padrão do % Desc. — sem spinners).
  - `updateField(it.id, "presentation_qty", n)` no `onBlur`.
  - `saveAll` inclui `presentation_qty` no `.update(...)`.
  - Import inicial (`insert` no `dealer_price_items`) grava `presentation_qty: null`.
- **I18N**: adicionar `hPresQty` em PT/ES/EN → `"Pres #"` (universal, mantém o mesmo rótulo nas 3 línguas).

### 2. Melhor espalhamento das colunas

Objetivo: campos mais visíveis, sem "espremer" NCM/GTIN e sem espremer os inputs de preço.

Ajustar as classes de largura dos `<TableHead>` (e afrouxar `min-w` do container):

```text
Foto        w-14   → w-16
COD         w-24   → w-28
Produto     min-w-[220px] → min-w-[280px]
Pres #      (novo) w-20
Pres        w-24   → w-24
NCM/HS      w-28   → w-32
GTIN/EAN    w-32   → w-40
Unid (×)    w-20   → w-20
Preço tabela w-28  → w-32
% Desc.     w-20   → w-24
Dealer Unit  w-28  → w-32
Dealer total w-28  → w-32
(lixeira)   w-10   → w-10
```

- Adicionar `min-w-[1400px]` na `<Table>` para forçar scroll horizontal em telas menores e evitar compressão (o wrapper já tem `overflow-x-auto`).
- Inputs numéricos ganham `text-right` e `whitespace-nowrap` nas células de preço (já existe na maioria; padronizar).

### Fora do escopo

- Sem alteração no `DealerCatalogGrid` (catálogo base).
- Sem alteração em snapshots antigos — leitores mostram `presentation_qty` como vazio para linhas legadas.
- Sem cálculo automático de `Pres #` a partir do nome do produto.
