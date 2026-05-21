---
name: Person Custom Fields Activation
description: lia-assign envia custom_fields da Pessoa (IDs 772727/772728/673900/445631) via buildPersonFormCustomFields no createPerson e updatePersonFields
type: feature
---
**Pessoa CFs ativos** (verified 2026-05-21, PipeRun):
- `772727` Scanner formulário (texto)
- `772728` Impressora formulário (texto)
- `673900` ÁREA DE ATUAÇÃO (enum)
- `445631` Especialidade principal (multi-escolha)

**Forbidden IDs**: 674001/674002 (`PESSOA_CUSTOM_FIELDS`) — retornam 422. NÃO usar.

**Fluxo em smart-ops-lia-assign/index.ts**:
- `createPerson` (linhas ~310-318) chama `buildPersonFormCustomFields(lead)` e converte para o shape `{custom_fields:[{id,value}]}` no POST /persons.
- `updatePersonFields` (linhas ~473) também envia `custom_fields` no PUT /persons; em caso de falha, retry sem custom_fields para garantir publicação de email/telefone.
- Fallback 422 (strip + retry sem CFs) protege ambos os fluxos.

**Snapshot local**: `createNewDeal` agora persiste `lia_attendances.piperun_custom_fields` após PUT enrich bem-sucedido (espelha bloco existente em `updateExistingDeal`).
