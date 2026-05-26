---
name: PipeRun webhook — políticas anti-perda de dados
description: smart-ops-piperun-webhook hidrata payloads parciais via GET /deals, expande cascade de identidade, nunca devolve 400 por falta de email, registra audit em piperun_webhook_events
type: feature
---
**Rule (3 invariantes):**

1. **Hidratação obrigatória** — `_shared/piperun-deal-hydrate.ts` é chamado quando `needsHydration(deal)` retorna `true` (payload sem `person`/`company` aninhados, ou sem identificadores de Person, ou `custom_fields` vazio com `deal.value > 0`). `hydrateDealPayload` faz `GET /deals/{id}?with[]=person&company&proposals&proposals.items&custom_fields&activities&files&tags&...` e mescla o resultado em cima do payload do webhook (preserva apenas `action`/`trigger`/`webhook_event`/`fired_at` do webhook). Garante que praticamente todos os ~129 campos do PipeRun ficam disponíveis em cada update.

2. **Cascade expandido + nunca-400** — `findLeadByCascade` agora tem 8 etapas: `piperun_id → pessoa_hash → pessoa_piperun_id → email → piperun_hash (deal) → empresa_piperun_id → empresa_cnpj → telefone_normalized`. Todas filtram `merged_into IS NULL`. Se mesmo após a hidratação o cascade falhar **e** o payload ainda não tiver email, devolver **HTTP 200 `{ ok:true, skipped:true, reason:"no_email_after_hydration" }`** (não 400) — isso silencia o loop de retry 5× do PipeRun.

3. **JSONB no-overwrite-with-empty** — para os 5 campos JSONB de alto risco (`piperun_custom_fields`, `piperun_involved_users`, `piperun_activities`, `piperun_files`, `piperun_forms`, `empresa_custom_fields`), **só gravar** quando o array do payload tem itens. Arrays vazios/undefined preservam o valor anterior do banco.

**Audit trail:** toda chamada ao webhook insere 1 linha em `public.piperun_webhook_events` (`deal_id`, `lead_id`, `event_action`, `stage_*`, `pipeline_id`, `owner_id`, `raw_payload`, `hydrated`, `outcome ∈ {created, updated, skipped_no_email, error_insert, error_update}`, `error`, `received_at`). Permite diff entre versões do payload de um mesmo deal, reprocessar `skipped_*` e auditar quando/qual campo mudou. RLS: SELECT apenas para admins; INSERT pelo service_role.

**Why:** webhooks parciais do PipeRun (mudança de stage envia só `deal+stage+owner`, sem `person`/`company`) faziam o cascade falhar 55% das vezes (11 de 20 chamadas em 10min em 2026-05-26) e devolver 400, gerando loop de retry e perda do evento. Além disso, campos JSONB eram sobrescritos pelo payload reduzido, apagando `custom_fields` que vieram em payloads anteriores.

**How to apply:** qualquer novo handler que processe webhooks de CRM externos com payloads variáveis deve seguir o mesmo padrão (hidratar, cascade rico, JSONB append-only, audit imutável, 200 + skipped em vez de 400).