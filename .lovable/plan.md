

# Fix: Propostas aparecendo vazias — itens com valor R$0 sendo filtrados

## Problema

Dois filtros removem itens de proposta com valor R$0:

1. **Sync** (`smart-ops-sync-piperun/index.ts`, linha 300):
   ```
   items.filter(it => it.nome.length > 0 || it.total > 0 || it.unit > 0)
   ```
   Itens de combo com nome vazio E valor R$0 são descartados antes de gravar no banco.

2. **Frontend** (`LeadDetailPanel.tsx`, linha 19-23):
   ```
   isValidItem: name.length > 0 || total > 0 || unit > 0
   ```
   Mesmo filtro no display — itens que passaram pelo sync mas têm valor zero são escondidos.

Combos comerciais frequentemente têm itens com valor unitário R$0 (o valor está no total da proposta, não nos itens individuais). Esses itens precisam aparecer.

## Correções

### 1. Sync — Remover filtro destrutivo (linha 300)
Manter TODOS os itens da proposta. Se um item existe na API do PipeRun, ele é relevante.

```ts
// ANTES:
items: items.filter(it => it.nome.length > 0 || it.total > 0 || it.unit > 0),

// DEPOIS:
items,
```

### 2. Frontend — Remover `isValidItem` ou torná-lo permissivo (linhas 19-24)
Aceitar todo item que tenha pelo menos um `item_id` ou qualquer campo preenchido:

```ts
const isValidItem = (item: any): boolean => {
  // Accept all items — combos have R$0 items that must be shown
  return true;
};
```

### 3. Backfill — Re-sync deals que perderam itens
Os itens já filtrados no sync anterior estão perdidos no `piperun_deals_history`. A próxima execução do sync irá reprocessar e gravar os itens completos. Para forçar, basta rodar o sync novamente.

## Arquivos

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/smart-ops-sync-piperun/index.ts` | Remover `.filter()` da linha 300 |
| `src/components/smartops/LeadDetailPanel.tsx` | `isValidItem` retorna `true` sempre |

