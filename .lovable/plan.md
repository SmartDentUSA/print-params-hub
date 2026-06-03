## Problema

Notas de "Resumo do Lead / briefing" estão sendo postadas em duplicidade no PipeRun. A investigação encontrou **três edge functions independentes** que postam a mesma nota usando **dois sistemas de lock incompatíveis** entre si.

## Causa raiz

| # | Path | Lock usado |
|---|------|------------|
| 1 | `smart-ops-lia-assign` (`postRichSellerNote`) | `smartops_deal_note_locks` (via `claimSellerNoteSlot`) |
| 2 | `smart-ops-deal-form-note` | `smartops_deal_note_locks` (mesmo) |
| 3 | `smart-ops-piperun-webhook` (linhas 1287–1334) | `lia_attendances.last_seller_note_hash/at` (5 min TTL) |

Como (3) não consulta a tabela usada por (1)/(2) e vice-versa, qualquer ciclo "lia-assign cria deal → PipeRun dispara webhook → piperun-webhook posta de novo" gera **2 notas idênticas**. Além disso, `claimSellerNoteSlot` em `_shared/seller-note-lock.ts:37–76` tem **race TOCTOU** (read → decide → upsert não atômico), então `deal-form-note` e `lia-assign` rodando em paralelo no mesmo deal também conseguem postar duas vezes.

Notas administrativas adicionais em `lia-assign:2040, 2094, 2158` (`🔁 Re-entrega Meta…`) também rodam sem lock.

## Plano de correção

### 1. Unificar lock em `smartops_deal_note_locks` (fim do split brain)
- **`smart-ops-piperun-webhook/index.ts:1287–1334`**: remover o lock baseado em `lia_attendances.last_seller_note_*` e usar `claimSellerNoteSlot()` de `_shared/seller-note-lock.ts`.
- Manter o gate de pipeline VENDAS + stage SEM_CONTATO.
- Manter as colunas em `lia_attendances` por compatibilidade histórica (sem migração destrutiva agora).

### 2. Tornar `claimSellerNoteSlot` atômico (fim do TOCTOU)
- Criar função SQL `public.try_claim_seller_note_slot(p_deal_id, p_hash, p_ttl_seconds)` que faz `INSERT ... ON CONFLICT (deal_id) DO UPDATE ... WHERE last_hash IS DISTINCT FROM EXCLUDED.last_hash OR last_at < now() - interval ... RETURNING (xmax = 0 OR last_hash IS DISTINCT FROM ...)` num único statement.
- Reescrever `_shared/seller-note-lock.ts:claimSellerNoteSlot` para chamar essa RPC em vez do read+upsert atual.

### 3. Guard adicional no piperun-webhook contra updates de deal
- Após o gate atual, ler `deal.created_at` do payload do webhook e só permitir post se `now() - deal.created_at < 10 min` (i.e., é evento de criação, não update). Isso protege contra o webhook disparar nota nova a cada update de custom field feito pelo próprio lia-assign.

### 4. Throttle das notas de re-entrega Meta
- **`smart-ops-lia-assign/index.ts:2040, 2094, 2158`**: envolver cada `addDealNote('🔁 Re-entrega Meta…')` numa checagem rápida em `lead_activity_log` (já existe parcialmente em 2086–2100). Padronizar: se já houve evento `deal_note_redelivery` para o mesmo `deal_id` nas últimas 24h, pular.

### 5. Limpeza opcional (não destrutiva)
- Adicionar entrada em `system_health_logs` (`error_type='note_duplicate_skipped'`) toda vez que um lock bloqueia, para medirmos quantos duplicatas o fix evitou.

## Arquivos afetados
- `supabase/functions/smart-ops-piperun-webhook/index.ts` (lock unificado + guard de update)
- `supabase/functions/_shared/seller-note-lock.ts` (atomicidade via RPC)
- `supabase/functions/smart-ops-lia-assign/index.ts` (throttle das notas de re-entrega)
- 1 nova migração SQL: função `try_claim_seller_note_slot` + (opcional) índice em `smartops_deal_note_locks(deal_id)` se faltar

## O que NÃO mexer
- Tabela `smartops_deal_note_locks` (schema atual já serve)
- Colunas `lia_attendances.last_seller_note_*` (manter por compatibilidade)
- Fluxo de `dra-lia` / `ingest-lead` que dispara `lia-assign`/`deal-form-note` — apenas o lock muda

## Validação
1. Após deploy, monitorar `lead_activity_log` por evento `deal_note_posted` para confirmar que cada `deal_id` recebe no máximo uma nota de briefing por ciclo de criação.
2. Verificar `system_health_logs` por `note_duplicate_skipped` para confirmar que os locks estão sendo acionados.
3. Conferir manualmente 5 deals novos criados após o fix no PipeRun para garantir 1 nota só.