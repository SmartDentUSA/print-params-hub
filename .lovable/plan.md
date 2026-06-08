# Blindar o Funil de Vendas (18784) — sem redistribuição, sem auto-estagnação

## Diagnóstico

Hoje **duas peças automáticas mexem em deals no Funil de Vendas**:

1. **Cron `stagnant-processor-cron`** (a cada 6h) — `smart-ops-stagnant-processor` faz `UPDATE lead_status` em qualquer lead `lead_status LIKE 'est%'` e dá `moveDealToStage` no PipeRun, empurrando deals para o pipeline Estagnados (72938). Foi a origem dos ~884 deals que saíram do 18784 desde 06/06.

2. **`smart-ops-lia-assign` (round-robin)** — quando um lead reentra (Meta redelivery, formulário, SDR captação) e o `proprietario_lead_crm` atual:
   - não bate com nenhum `team_members.nome_completo` ativo, OU
   - é um ID numérico cru (bug de sync), OU
   - é blocked seller,
   
   então faz `pickRandomActiveVendedor()` e regrava `owner_id` no deal — mesmo que o deal esteja aberto no 18784. Foi o que tirou ~168 deals da Janaina.

Régua nativa do PipeRun (UI) já está pausada — o usuário deve manter assim.

## Mudanças

### 1. Desativar o cron `stagnant-processor-cron`
`SELECT cron.unschedule('stagnant-processor-cron');` via `supabase--insert`.

Funções one-off (`smart-ops-reassign-danilo-vendas`, `smart-ops-cs-processor` etc.) ficam intactas — só rodam quando invocadas manualmente.

### 2. Guard "Vendas é intocável" em `smart-ops-stagnant-processor`
No `select` inicial, **excluir** qualquer lead cujo deal canônico esteja em `piperun_pipeline_id = 18784` E `piperun_status` aberto. Mesmo que alguém reative o cron, o processador para de migrar.

### 3. Guard "Vendas é intocável" em `smart-ops-lia-assign`
Antes do bloco round-robin (linha ~2470-2524), verificar se o lead tem deal aberto no 18784. Se sim:
- **Não** trocar `owner_id`. Mantém o `proprietario_lead_crm` atual, mesmo se ID numérico ou fora de `team_members` — apenas loga `health_log` para revisão manual.
- **Não** abrir novo deal nem fechar o existente.

O fluxo `enrichment-route` já tem `CASE A — preserve_vendas` (linha 2050) que cobre re-entrega Meta. Confirmar que `CASE C — Fresh Round Robin` (linha 2127) só dispara quando NÃO existe deal aberto no 18784.

### 4. Mesma proteção em `smart-ops-reassign-danilo-vendas` e similares
Já são one-off e exigem invocação manual — manter como está, sem cron. (Não precisa código novo.)

### 5. Memory
Adicionar `mem://architecture/vendas-pipeline-immutability` na Core:

> **Vendas Pipeline Immutability**: Pipeline 18784 (Funil de Vendas) é INTOCÁVEL por automações. Crons de estagnação (stagnant-processor) estão desativados. lia-assign NUNCA troca owner de deal já em 18784, mesmo se owner atual não bate com team_members. Toda redistribuição em 18784 é manual via Copilot/UI.

## Detalhes técnicos

- **Cron unschedule**: `select cron.unschedule('stagnant-processor-cron');` — usar `supabase--insert` (não migration), pois é dado de runtime do projeto.
- **stagnant-processor select**: adicionar `.is('piperun_pipeline_id', null).or('piperun_pipeline_id.neq.18784')` ou filtro pós-fetch que descarta `piperun_pipeline_id === 18784 && piperun_status in ('aberto','open','sem_contato',null)`.
- **lia-assign guard**: nova função helper `isLeadInVendas(lead)` retorna `true` se `lead.piperun_pipeline_id === 18784` E `lead.piperun_status` ∉ {'ganha','perdida','won','lost'}. Quando true, no bloco "Select owner via Round Robin", forçar `assignedOwnerId = lead.proprietario_lead_crm` resolvido (ou skip total da reatribuição) e pular `createNewDeal`/`moveDealToVendas`.
- **Log**: cada skip grava em `system_health_logs` com `error_type='vendas_immutability_skip'` para auditoria.

## O que NÃO faremos

- Não desativar `smart-ops-lia-assign` por completo — ele segue criando deals novos para leads que ainda não têm pipeline.
- Não mexer em CS Onboarding (83896), Reativação, Distribuidor.
- Não tocar na régua do PipeRun (já pausada via UI).
- Não reverter automaticamente nenhum deal — restore manual via função existente.
- Não alterar owners atuais (mesmo os com ID numérico cru) — só impedir novas trocas.

## Passos de execução

1. Unschedule do cron.
2. Patch em `smart-ops-stagnant-processor/index.ts` (filtro Vendas).
3. Patch em `smart-ops-lia-assign/index.ts` (guard `isLeadInVendas`).
4. Memory file + index update.
5. Deploy das 2 functions e validação (curl com lead-teste em 18784, esperar `vendas_immutability_skip` no log).
