

# Fix: Dados Inconsistentes do Lead admrnagano@gmail.com

## Problemas Identificados

### 1. `itens_proposta_parsed` CORROMPIDO (afeta TODOS os leads com HTML nas propostas)
O campo `itens_proposta_crm` contém HTML bruto do PipeRun (ex: `<p>KIT CHAIRSIDE...</p><span style="color: rgb(102, 102, 102)">...`). A função `parseProposalItems()` faz split por `,` e `;` SEM limpar HTML primeiro — resultado: centenas de fragmentos CSS como `"font-size: 16px"`, `"102"`, `")"` sendo tratados como itens de proposta.

**Fix**: Adicionar `stripHtmlShared()` no início de `parseProposalItems()` antes do split, e limpar fragmentos como `[qty] <p>` e padrões CSS residuais.

### 2. Deal snapshot incompleto (`owner_name`, `product`, `origem` = null)
O `buildRichDealSnapshot` depende de `deal.owner_id` mapeado em `PIPERUN_USERS`. Se o sync não trouxe o objeto `deal.user` ou `deal.owner`, o owner fica null. Porém o `proprietario_lead_crm` já tem "Thiago Godoy" — o snapshot deveria usar isso como fallback.

**Fix**: No `piperun-full-sync` e `smart-ops-sync-piperun`, passar `ownerName` do `updatePayload.proprietario_lead_crm` como override para `buildRichDealSnapshot` quando o deal não traz owner object.

### 3. Backfill dos leads já corrompidos
Migration SQL para re-processar `itens_proposta_parsed` não é viável em SQL puro (precisa da lógica de strip HTML + classify). Mas podemos limpar os dados mais óbvios.

## Plano de Implementação

### Arquivo: `supabase/functions/_shared/piperun-field-map.ts`

**`parseProposalItems()`** (linha ~770):
- Adicionar `rawText = stripHtmlShared(rawText)` como primeira operação após o check de vazio
- Filtrar segments que são claramente CSS/lixo: regex para descartar `rgb(`, `font-size`, `font-family`, `margin:`, `padding:`, `text-decoration`, etc.
- Limpar prefixos `[qty]` que capturam HTML fragments

**`buildRichDealSnapshot()`** (linha ~1061):
- Sem alteração necessária — o problema é que os chamadores não passam `ownerName` como override

### Arquivo: `supabase/functions/piperun-full-sync/index.ts`
- Passar `ownerName: updatePayload.proprietario_lead_crm` como override no `buildRichDealSnapshot()` call

### Arquivo: `supabase/functions/smart-ops-sync-piperun/index.ts`
- Idem: passar `ownerName` override

### Migration SQL
- Limpar `itens_proposta_parsed` para leads onde os itens contêm CSS fragments (set to null para forçar re-parse no próximo sync)
- Atualizar snapshots em `piperun_deals_history` onde `owner_name` é null mas `proprietario_lead_crm` existe

## Arquivos Alterados

| Arquivo | Mudança |
|--------|---------|
| `supabase/functions/_shared/piperun-field-map.ts` | Strip HTML em `parseProposalItems()`, filtrar CSS garbage |
| `supabase/functions/piperun-full-sync/index.ts` | Passar ownerName override no snapshot builder |
| `supabase/functions/smart-ops-sync-piperun/index.ts` | Passar ownerName override no snapshot builder |
| SQL Migration | Limpar `itens_proposta_parsed` corrompidos, backfill owner_name nos snapshots |

## Impacto Esperado
- Lead admrnagano@gmail.com: itens de proposta legíveis (Notebook Avell, Kit Chairside, SmartMake, etc.)
- Todos os leads com HTML nas propostas: parsing correto
- Deal snapshots com owner_name preenchido

