## Objetivo

Reverter, no PipeRun, as movimentações automáticas (`auto_trigger`) ocorridas nas últimas 24h no Funil de Vendas (pipeline 18784), devolvendo cada deal à etapa em que estava antes da cascata — **sem alterar proprietário** e **sem tocar em deals que estão atualmente na 1ª etapa (Novos Leads)**.

## Escopo

Incluído:
- Deals do pipeline **18784** com transições `source = 'auto_trigger'` nas últimas 24h em `piperun_stage_transitions`.
- Reversão apenas do `stage_id` (PUT no PipeRun + espelho local em `deals`).
- Pausar a régua de auto-avanço do Funil Estagnados antes da execução e religar ao final.

Excluído (intocado):
- Deals cuja **stage atual** seja a primeira etapa do pipeline 18784 (menor `order`/posição) — "Novos Leads".
- Transições com `source ≠ 'auto_trigger'` (manuais, webhooks reais, sync).
- Proprietário (`owner_id`), custom_fields, valor, título — nada disso é tocado.
- Outros pipelines (Estagnados, Onboarding, CS, Distribuidor).
- Golden Rule / `lia-assign` / sync — sem mudanças de código de runtime.

## Passos

1. **Descoberta da 1ª etapa do pipeline 18784**
   - Query PipeRun `GET /pipelines/18784/stages` → identificar `stage_id` com menor `order`. Guardar como `FIRST_STAGE_ID`.

2. **Pausa da régua Estagnados**
   - Localizar e desabilitar a regra de auto-avanço (cron/trigger) que gerou os 202 eventos de 07/06 21:00 UTC. Registrar estado anterior para reverter.

3. **Criar edge function `smart-ops-revert-auto-trigger`**
   - Inputs: `?dry_run=1` (default), `?hours=24`, `?pipeline_id=18784`.
   - Query base:
     ```sql
     SELECT DISTINCT ON (deal_id)
       deal_id, stage_from_id, stage_from_name, created_at
     FROM piperun_stage_transitions
     WHERE source = 'auto_trigger'
       AND pipeline_id = 18784
       AND created_at >= now() - interval '24 hours'
     ORDER BY deal_id, created_at ASC;  -- etapa ANTES da cascata
     ```
   - Para cada deal:
     - Buscar `deals.stage_id` atual local.
     - **Skip** se `current_stage_id = FIRST_STAGE_ID` (preservar Novos Leads).
     - **Skip** se `current_stage_id = stage_from_id` (já está no lugar).
     - **Skip** se `stage_from_id` for `FIRST_STAGE_ID` (não voltamos pra Novos Leads).
   - Em modo real: `PUT /deals/{deal_id}` com `{ stage_id: stage_from_id, pipeline_id: 18784 }` apenas. Sem owner, sem user, sem custom_fields.
   - Espelhar local: `UPDATE deals SET stage_id, stage_name, last_stage_updated_at = now() WHERE piperun_deal_id = ...`.
   - Log linha-a-linha em `system_health_logs` (`event_type = 'revert_auto_trigger'`).
   - Resposta JSON: `{ total_candidates, skipped_first_stage, skipped_noop, reverted, errors[] }`.

4. **Validação**
   - Rodar `?dry_run=1` → revisar contagem e amostra (10 linhas).
   - Confirmar com você antes do run real.
   - Run real → conferir 3 deals manualmente no PipeRun.

5. **Religar régua Estagnados**
   - Reativar a regra pausada no passo 2.

## Detalhes técnicos

- Idempotente: re-executar não causa dano (skip por `current = target`).
- Throttle: 5 req/s no PipeRun para não estourar rate-limit.
- Sem alteração no `lia-assign`, `sync-piperun`, webhooks, Golden Rule, owners, Patricia, Mello.
- Audit trail completo via `system_health_logs` para auditoria/rollback futuro.

## O que NÃO faremos

- Não mexer em owner_id de ninguém.
- Não voltar deal pra "Novos Leads" — se a 1ª transição auto veio de lá, deal fica onde está.
- Não alterar deals fora do pipeline 18784.
- Não rodar reset de "Sem contato" ou stages forçadas.
