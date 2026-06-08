
## Objetivo

Devolver para o **Funil de Vendas (18784)** — na **etapa original em que estavam antes de entrar em Estagnados** — todos os deals que tiveram movimentação dentro do pipeline **Estagnados (72938)** desde **07/06/2026**, mantendo o owner atual.

## Escopo

Critérios de elegibilidade (deal a deal):

1. Está atualmente em `piperun_pipeline_id = 72938` (Estagnados).
2. Teve pelo menos uma transição em 72938 com `transitioned_at >= 2026-06-07 00:00:00` (movido pela automação de estagnação ou manualmente nesse período).
3. `merged_into IS NULL` em `lia_attendances`.
4. `piperun_status = 0` (deal aberto — não restaurar Ganho/Perdido).
5. Tem uma "etapa de origem" identificável no Funil de Vendas (18784) — última `stage_to_*` registrada em `piperun_stage_transitions` para pipeline 18784 **antes da primeira entrada em 72938**.
   - Se a etapa de origem for "Sem contato", restaurar para **C1** (Sem contato é etapa inicial e não cabe restaurar de volta para lá).
   - Se não houver histórico em 18784, **pular** o deal e logar `restore_blocked_no_origin` (não inventar etapa).

Snapshot de números (com base nos dados atuais):
- ~670 deals em 72938 com movimentação desde 07/06.
- A maioria tem origem em etapas de Reativação dentro do próprio 72938 → para esses, será usada a **última etapa em 18784 antes do primeiro ingresso em 72938** (mesmo que essa entrada tenha sido antes de 07/06, contanto que o deal tenha sido tocado novamente após 07/06).
- ~23 deals têm 1ª entrada em 72938 após 07/06 com origem direta de 18784 (Sem contato → C1, Contato Feito).

## Plano de execução

### 1. Criar RPC `vendas_restore_from_estagnados_since(cutoff timestamptz)`

Retorna candidatos: `deal_id, lead_id, current_owner_id, target_pipeline_id (18784), target_stage_id, target_stage_name, source_reason`.

Lógica:
- `WITH first_entry_72938` = primeira transição de cada deal para pipeline 72938.
- `WITH any_move_since_cutoff` = deals com qualquer transição em 72938 onde `transitioned_at >= cutoff`.
- `WITH origin_stage` = última `stage_to_*` em `pipeline_id=18784` com `transitioned_at < first_entry_72938.transitioned_at`.
- Join com `lia_attendances` filtrando `merged_into IS NULL`, `piperun_status=0`, `piperun_pipeline_id=72938`.
- Mapear "Sem contato" → C1 (`stage_id = 99294`).
- Excluir deals sem origem em 18784.

### 2. Reaproveitar `smart-ops-restore-vendas-snapshot`

A função já faz PUT no PipeRun para mover `stage_id + pipeline_id`, mantém `owner_id` atual, e sincroniza `lia_attendances` + `deals`. Adicionar novo modo `?mode=estagnados_since&cutoff=2026-06-07`.

- Mantém owner atual (não devolve owner, apenas etapa/pipeline).
- Loga cada operação em `system_health_logs` com `error_type='restore_estagnados_since'`.
- Suporta `dry_run=1` e `limit/offset` para batches.

### 3. Execução em batches

1. **Dry-run completo** com `cutoff=2026-06-07`, sem `limit` → log de candidatos e validação de mapeamento de etapa.
2. **Real em batches de 50** até esgotar candidatos.
3. **Validação final**: contar `lia_attendances` em pipeline 72938 com movimentação desde 07/06 que ainda restou → esperado 0 (exceto bloqueados sem origem).

### 4. Blindagem (já existe + reforço)

- `smart-ops-stagnant-processor`: cron já desabilitado + pipeline 18784 imutável + status numérico (já feito na restauração anterior).
- Adicionar guard em `smart-ops-stagnant-processor`: **bloquear qualquer movimentação para pipeline 72938** enquanto a flag `cron_state.stagnant_processor_disabled=true` (assert duplo).

### 5. Verificação

- Comparar contagem por owner+etapa em 18784 e 72938 antes/depois.
- Verificar amostra de 10 deals no PipeRun manualmente (link Lead Card).
- Confirmar 0 deals em 72938 movidos pelo cron desde a blindagem.

## Detalhes técnicos

- **Etapa "Sem contato" → C1**: stage 99294 em 18784.
- **Owner preservation**: `owner_id` atual (de `lia_attendances.piperun_owner_id`) NÃO é alterado — só etapa+pipeline.
- **PipeRun PUT payload**: `{ pipeline_id: 18784, stage_id: <target>, owner_id: <current> }`.
- **Race condition guard**: lock `crm_lock_until` 30s em `lia_attendances` durante o PUT (padrão existente).
- **Idempotência**: re-execução não duplica — `vendas_restore_from_estagnados_since` filtra `piperun_pipeline_id=72938` (deal já restaurado sai do conjunto).

## Riscos

- **Origem ambígua**: deals sem histórico em 18784 (ex: criados direto em 72938) ficam de fora — serão logados como `restore_blocked_no_origin` para revisão manual.
- **Etapa de origem antiga** (ex: deal que estava em "Fechamento" em 2025 e migrou): será restaurado para "Fechamento". Considerar normal — é a etapa real onde estava antes de estagnar.
- **PipeRun rate limit**: batches de 50 com 200ms entre PUTs (já implementado).

## Arquivos a tocar

- `supabase/migrations/<ts>_vendas_restore_from_estagnados_since.sql` — nova RPC.
- `supabase/functions/smart-ops-restore-vendas-snapshot/index.ts` — adicionar `mode=estagnados_since`.
- `supabase/functions/smart-ops-stagnant-processor/index.ts` — assert duplo de cron disabled.
- `.lovable/plan.md` — atualizar estado.
