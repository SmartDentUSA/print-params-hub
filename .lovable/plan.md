

# Fix: Produtos com dados corrompidos nos cards de Lead

## Problema Raiz

A API do PipeRun retorna **HTML bruto** nos nomes de itens de proposta. Exemplo real do deal #57924636:

```json
{
  "nome": "<p style=\"margin-bottom: 1.5em; padding: 0px; color: rgb(102, 102, 102);...\"><br></p>",
  "unit": 0,
  "total": 0
}
```

O sync grava esse HTML diretamente no JSONB `piperun_deals_history`. O frontend renderiza o HTML como texto, mostrando tags `<p>` e `<br>` junto com valores R$ 0,00.

Além disso, muitos itens têm `unit: 0` e `total: 0` — o valor real está apenas no nível da proposta (`valor_ps: 2237`), não distribuído aos itens.

## Correções

### 1. Frontend — Sanitizar nomes + filtrar itens vazios (`LeadDetailPanel.tsx`)

- Criar helper `stripHtml(str)` que remove todas as tags HTML e retorna texto limpo
- Aplicar em todas as 6+ ocorrências que leem `item.nome || item.name || item.product_name`
- Filtrar itens onde nome sanitizado é vazio E valor é 0 (são placeholders do PipeRun)
- Se todos os itens forem filtrados mas a proposta tem `valor_ps > 0`, mostrar uma linha resumo com o valor da proposta
- Corrigir comparações de status nos chips (linhas 647-649 e 829-831) para usar `isWon`/`isLost` em vez de `=== "ganha"`
- Fix do React key warning: substituir `<>` na linha 639 por `<React.Fragment key={...}>`

### 2. Sync — Sanitizar na ingestão (`smart-ops-sync-piperun/index.ts`)

- Adicionar `stripHtml()` na construção de `ProposalItem` (linha 274) para limpar `it.name || it.description`
- Filtrar itens com nome vazio E valor 0 antes de gravar

### 3. Histórico — Limpar dados já gravados (SQL)

- UPDATE em `lia_attendances` para percorrer `piperun_deals_history` → `proposals` → `items` e:
  - Strip HTML dos nomes
  - Remover itens com nome vazio e valor 0

| Arquivo | Mudança |
|---------|---------|
| `src/components/smartops/LeadDetailPanel.tsx` | Helper `stripHtml`, filtro de itens vazios, fix status chips, fix React key |
| `supabase/functions/smart-ops-sync-piperun/index.ts` | Sanitizar nomes de itens na ingestão |
| SQL (via insert tool) | Limpar dados históricos corrompidos |

