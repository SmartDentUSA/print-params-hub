

# Fix: Nomes de produtos genéricos + Endpoint cognitivo errado + Itens sem nome real

## Problemas Identificados

### 1. Nomes dos itens mostram "Produto" ou HTML lixo
**Causa raiz no sync**: O campo `it.name` na API do PipeRun é vazio para a maioria dos itens. O nome real está em `it.product_name` e `it.item.name`. O sync atual (linha 281) faz:
```
nome: stripHtml(it.name || it.description || "")
```
Mas deveria ser:
```
nome: stripHtml(it.product_name || it.item?.name || it.name || "")
```
Sem `it.product_name`, o fallback vai para `it.description` que contém HTML com CNPJ, CRO, etc.

**Dados reais confirmam** (dr.flaviorodrigues): `proposals_data` mostra `product_name: "Resina 3D Nano Híbrida Vitality 250g A2 HT"` e `item.name: "Resina 3D..."`, mas o snapshot gravou `nome: ""` para os primeiros dois itens e HTML lixo para os outros.

### 2. Endpoint de análise cognitiva errado no frontend
O frontend chama `smart-ops-cognitive-analysis` (que NÃO EXISTE). A função real é `cognitive-lead-analysis` e aceita `{ leadId }` (não `lead_id`).

### 3. Backfill necessário para itens já gravados com nome vazio
423+ leads têm items com `nome: ""` mas `proposals_data` tem os nomes reais.

## Correções

### 1. Sync — Usar `product_name` como fonte primária (`smart-ops-sync-piperun/index.ts`)
Linha 281: Mudar o fallback chain para:
```ts
nome: stripHtml(it.product_name || it.item?.name || it.name || ""),
```
Também remover `it.description` do fallback de nome (description contém dados técnicos, não nome de produto). Mover description para um campo separado se necessário.

### 2. Frontend — Fix endpoint cognitivo (`LeadDetailPanel.tsx`)
Linha 168: `smart-ops-cognitive-analysis` → `cognitive-lead-analysis`
Linha 171: `{ lead_id: leadId }` → `{ leadId }`
Tratar resposta `{ skip: "insufficient_messages" }` mostrando mensagem clara ao usuário.

### 3. Frontend — Fix getItemName fallback (`LeadDetailPanel.tsx`)
Linha 27: Adicionar `item.product_name` ao chain:
```ts
const raw = item.product_name || item.nome || item.name || "";
```

### 4. Backfill SQL — Repovoar nomes a partir de `proposals_data`
Migration PL/pgSQL que cruza `proposals_data[].items[].id` com `piperun_deals_history[].proposals[].items[].item_id` e preenche o campo `nome` usando `product_name || item.name` do `proposals_data`.

### 5. Frontend — Fix valor unitário display
Linhas 720-723: Adicionar `item.value` ao chain de fallback para exibição.

## Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/smart-ops-sync-piperun/index.ts` | `it.product_name \|\| it.item?.name` como fonte primária de nome |
| `src/components/smartops/LeadDetailPanel.tsx` | Fix endpoint cognitivo, fix getItemName, fix display de valor |
| SQL migration | Backfill nomes de items usando `proposals_data` |

