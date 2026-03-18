

# Fix: Produtos sem nome e sem valor nos cards — mapeamento incorreto dos campos PipeRun

## Diagnóstico

O PipeRun **retorna sim** os dados corretos dos itens da proposta via API. Exemplo real do `proposals_data`:

```json
{
  "name": "Resina 3D Smart Print Bio Temp B1 250g",
  "value": 666,
  "quantity": 1,
  "description": "<p style='...'><br></p>"  // HTML lixo
}
```

### Problemas encontrados:

**1. Mapeamento de valor unitário errado no sync** (`smart-ops-sync-piperun/index.ts`, linha 283-284):
```ts
// ERRADO — esses campos não existem na API do PipeRun:
unit: Number(it.unit_value || it.unit_price || 0),      // → sempre 0
total: Number(it.total_value || it.total || 0),          // → sempre 0
```
O campo correto é `it.value` (preço unitário) e o total é `it.value * it.quantity`.

**2. Cleanup SQL destruiu dados válidos**: A migration anterior removeu itens com `nome != '' AND total = 0 AND unit = 0`. Mas como unit/total estavam mapeados errado, TODOS os itens caíram nessa condição e foram removidos — mesmo tendo nomes válidos.

**3. 404 leads** agora têm `"items": []` vazio no `piperun_deals_history`.

## Correções

### 1. Fix mapeamento de campos no sync (`smart-ops-sync-piperun/index.ts`)

Linha 278-286 — corrigir os nomes dos campos para os que a API realmente retorna:

```ts
items.push({
  item_id: String(it.id || it.item_id || ""),
  nome: stripHtml(it.name || it.description || ""),
  tipo: it.type || "Produto",
  qtd: Number(it.quantity) || 1,
  unit: Number(it.value || it.unit_value || it.unit_price || 0),  // FIX: "value" é o campo real
  total: Number(it.value || 0) * (Number(it.quantity) || 1),       // FIX: calcular total
  categoria: it.category || "",
});
```

### 2. Fix mapeamento na UI (`LeadDetailPanel.tsx`)

Linha 431-432 — adicionar fallback para o campo `value` do PipeRun:

```ts
const unitVal = Number(item.valor_unitario || item.unit_value || item.unit || item.value || 0);
const totalVal = Number(item.valor_total || item.total_value || item.total || 0) || (qty * unitVal);
```

Linha 448 — usar `deal.product` como fallback quando não há itens:
```ts
name: d.product || prop.sigla || d.pipeline_name || "Proposta",
```

### 3. Backfill: Repovoar items a partir do `proposals_data` (SQL)

O `proposals_data` (coluna separada) ainda tem os dados originais com nomes e valores. Vamos reconstruir os items no `piperun_deals_history` a partir dele, matchando por `deal_id`:

```sql
-- Para cada lead com proposals_data não-vazio,
-- cruzar com piperun_deals_history e preencher items
-- usando it.name, it.value, it.quantity da proposals_data original
```

### Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/smart-ops-sync-piperun/index.ts` | Fix `unit` → `it.value`, `total` → `it.value * it.quantity` |
| `src/components/smartops/LeadDetailPanel.tsx` | Adicionar fallback `item.value`, usar `d.product` como nome fallback |
| SQL migration | Repovoar items do `piperun_deals_history` a partir de `proposals_data` |

