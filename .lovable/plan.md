## Contexto

- **Daniel Ferreira (PipeRun 102594)**: ativo no `team_members` — porém 101 leads estão com `proprietario_lead_crm = "102594"` (ID cru) em vez do nome. Apenas problema de resolução de nome.
- **Danilo Pereira (PipeRun 102595)**: **saiu da empresa**, não está no `team_members`. Tem 72 leads ativos atribuídos a ele no banco e nos deals do PipeRun.

## Regra de negócio (consolidada)

**Toda atribuição de owner — em qualquer fluxo (Meta webhook, ingest, lia-assign, re-delivery, reativação SDR-CAPTAÇÃO, cron retry) — deve resolver o owner contra `team_members` onde `ativo = true` e `role = 'vendedor'`. Se o owner recebido não estiver ativo, deve cair em Round Robin entre vendedores ativos.**

## Mudanças

### 1. `smart-ops-lia-assign/index.ts` — Endurecer validação de owner

- Criar helper `resolveActiveTeamMember(supabase, ownerHint)` que aceita: `piperun_owner_id` numérico OU nome, e retorna `{ id, nome_completo, piperun_owner_id }` somente se `ativo = true AND role = 'vendedor'`. Caso contrário retorna `null`.
- No bloco "Check if current owner exists and is active" (linhas ~2248-2275), trocar o `ilike` por `resolveActiveTeamMember`. Se vier numérico (como "102595"), match por `piperun_owner_id::text`; se vier string, `ilike` por `nome_completo`.
- Se não resolver para vendedor ativo → `pickRandomActiveVendedor` (já filtra `ativo = true` corretamente).
- **Normalizar gravação**: sempre escrever `proprietario_lead_crm = nome_completo` (nunca o ID numérico), eliminando o problema dos 101 leads com "102594".

### 2. `smart-ops-ingest-lead/index.ts` — Sanitizar owner recebido

- Antes de gravar `proprietario_lead_crm` no insert/update do lead, passar pelo mesmo `resolveActiveTeamMember`. Se o owner vindo do payload (webhook Meta, CSV import, etc.) for inativo ou desconhecido, gravar `null` e deixar o lia-assign sortear.

### 3. Migration de saneamento (one-off)

- **Backfill de nomes**: `UPDATE lia_attendances SET proprietario_lead_crm = 'Daniel Ferreira' WHERE merged_into IS NULL AND proprietario_lead_crm = '102594'` (101 linhas).
- **Reatribuir leads do Danilo Pereira**:
  - Marcar os 72 leads (`proprietario_lead_crm = '102595'` ou `ILIKE '%danilo pereira%'`) com `proprietario_lead_crm = NULL` e `lia_assigned_at = NULL`.
  - Criar fila de reprocessamento via edge function `smart-ops-reassign-orphaned-leads` (nova) que itera nesses leads e invoca `lia-assign` com flag `reassign_inactive_owner: true` — o lia-assign executa Round Robin entre ativos, atualiza o owner do deal aberto no PipeRun (via `PATCH /deals/{id}` com novo `user_id`) e grava `proprietario_lead_crm` com o nome novo.
  - Logar cada reatribuição em `lead_activity_log` com `event_type = 'owner_reassigned_inactive_seller'` (antigo → novo).

### 4. Bloquear futuras criações de team_members ID-only

- Em qualquer fluxo que sincronize owner do PipeRun (ex.: `piperun-sync`), **não auto-cadastrar** novos vendedores no `team_members`. Se o `user_id` vindo do PipeRun não existir em `team_members ativo`, logar warning em `system_health_logs` (`error_type = 'unknown_piperun_owner'`) e cair em Round Robin.

## Arquivos afetados

- `supabase/functions/smart-ops-lia-assign/index.ts` (helper + validação no Round Robin)
- `supabase/functions/smart-ops-ingest-lead/index.ts` (sanitização do owner do payload)
- `supabase/functions/smart-ops-reassign-orphaned-leads/index.ts` (novo, one-off invocável manualmente pelo admin)
- Migration SQL: backfill nome do Daniel + nullify owner do Danilo
- `mem://smart-ops/active-seller-enforcement` (nova memória de regra)

## Confirmações necessárias antes de implementar

1. **Reatribuição dos 72 leads do Danilo**: confirmar que o sistema deve **mover o ownership do deal no PipeRun** (PATCH `/deals/{id}` com novo `user_id`) e não apenas atualizar o nosso banco.
2. **Filtrar Won deals?** Pelos leads do Danilo, devo deixar deals com `status = 2` (Ganha) intactos e reatribuir apenas deals abertos? (recomendado: sim)
3. **Backfill nome Daniel Ferreira**: confirma o UPDATE direto dos 101 leads para "Daniel Ferreira"?
