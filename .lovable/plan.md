
## Problema confirmado (lead Thaís Mendonça)

A mesma pessoa (`pessoa_piperun_id #47253062`) gerou **14 Deals em 27 dias**, sempre do mesmo par de formulários Meta (`BLZ INO110 PLUS + NOTEBOOK` / `somente scanner`). A timeline mostra que, todo dia:
1. `deal_enriched_via_redelivery` (regra de ouro funcionou para o deal aberto)
2. **e mesmo assim** um `deal_created` novo aparece logo abaixo, com novo owner via Round Robin.

Causa raiz: `createNewDeal` é chamado em **3 caminhos diferentes** dentro de `smart-ops-lia-assign`, e a Regra de Ouro só está implementada em **1** deles. Os outros dois (`seedPiperunFromSmartForm` SDR-Captação reativação, linha 1827, e `enrichment-route CASE C` linha 2262) criam Deal novo mesmo quando já existe deal VENDAS recente. Além disso, `smart-ops-ingest-lead` ainda invoca `smart-ops-lia-assign` em re-entregas (bloco linhas 588-615) que deveria ter sido removido.

## Objetivos

1. **Zero criação de Deal sem conversão real e nova** (form_name novo + leadgen_id novo + janela > N dias).
2. **Zero mudança automática em Funil de Vendas / CS / CS Onboarding / Ganhos Aleatórios CS** (sem fechar, sem mover, sem trocar owner).
3. **Zero notas spam** no PipeRun para re-entregas, throttles, dedups, golden rule, duplicatas detectadas.
4. **Zero criação de novas origens** no CRM por automação.

## Mudanças

### A. `_shared/golden-rule-guard.ts` (NOVO — fonte única da verdade)

Helper compartilhado `assertCanCreateNewDeal(personId, lead, allDeals, opts)` que retorna `{ allowed: false, preservedDealId, reason }` se:

- Pessoa tem **qualquer** deal VENDAS aberto (status=0) **não-freezed**, OU
- Pessoa tem qualquer deal VENDAS (aberto OU Perdido) criado/atualizado nos últimos `GOLDEN_RULE_WINDOW_DAYS` (default 30), OU
- Pessoa tem deal em CS_ONBOARDING/GANHOS_ALEATORIOS_CS aberto (esses pipelines são read-only).

Único bypass permitido: `opts.force_new_deal === true` (Loja Integrada "Sob Consulta", manual override explícito). Re-entrega Meta NUNCA é bypass.

### B. `smart-ops-lia-assign/index.ts`

1. **Linha 3103 (primary `new_deal`)**: substituir a checagem inline atual pelo guard. Se bloqueado → preservar (update custom fields apenas, sem nota PipeRun, log interno).
2. **Linha 2262 (`enrichment-route` CASE C)**: aplicar o mesmo guard. Para re-entrega Meta, nunca deve cair em CASE C — se nenhum guard anterior cobriu, ainda assim este guard bloqueia e retorna `golden_rule_blocked`.
3. **Linha 1827 (`seedPiperunFromSmartForm` SDR-Captação)**: aplicar o guard. **Remover** o fechamento automático de deals do Funil Estagnados — Funil Estagnados ≠ Vendas, mas a regra do usuário é "não toque", então só logamos.
4. **Remover** o bloco `for (const deal of otherOpenDeals) { ...piperunPut(... status:2, lost_reason ...) }` (linhas 2241-2254) — não fechamos mais outros funis em re-entrega.
5. **Remover** todas as `addDealNote` restantes em fluxos de re-entrega/golden rule/throttle/dedupe (linhas 2177-2182, 2286-2290, 3032-3036 e quaisquer outras `🔁 [Dra. L.I.A.]` em re-entrega). Notas só são permitidas quando há **nova conversão real**.

### C. `smart-ops-ingest-lead/index.ts`

Remover por completo o bloco `dealRouteResult` (linhas 588-615) que invoca `smart-ops-lia-assign` com `enrichment_only_route_deal`. Re-entrega Meta com campos novos → apenas enriquece `lia_attendances` + `lead_activity_log` interno. Nunca toca PipeRun.

### D. `smart-ops-deal-form-note/index.ts` e `smart-ops-piperun-webhook/index.ts`

Auditar e bloquear qualquer chamada a `createNewDeal`, `piperunPost('deals')`, `piperunPut(deals/X, {status, owner_id, pipeline_id, stage_id})` em fluxos de re-entrega Meta / webhook. Webhook = read-only/auditoria.

### E. Origem no PipeRun

Garantir que `createPerson` e `createNewDeal` **nunca** criem nova origem: se `form_name`/`source` não bate com `origins` existentes do PipeRun, usar fallback estável ("Outras origens" ou `null`) + log em `system_health_logs`. Nunca chamar `POST /origins`.

### F. Backfill / cleanup do lead Thaís (e similares)

Após deploy, rodar SQL de auditoria identificando pessoas com >3 deals VENDAS criados em 30d a partir do mesmo `form_name`/`pessoa_piperun_id` para revisão manual no PipeRun (não fechar automaticamente — usuário decide).

## Critérios de aceitação

- Nova re-entrega Meta do mesmo lead Thaís **não** cria Deal #61267317 amanhã.
- Nenhuma `Nova nota adicionada 🔁 ... Re-entrega Meta` aparece no PipeRun.
- Timeline interna (`lead_activity_log`) continua registrando `deal_enriched_via_redelivery` / `golden_rule_blocked` para auditoria.
- Deals em Funil de Vendas existentes não mudam owner/stage/status por automação.
- Pipelines CS_ONBOARDING e GANHOS_ALEATORIOS_CS não são tocados em nenhum cenário automático.

## Detalhes técnicos

- Constante: `GOLDEN_RULE_WINDOW_DAYS = 30` em `_shared/golden-rule-guard.ts`.
- `flow_type` novos: `golden_rule_blocked_primary`, `golden_rule_blocked_enrichment`, `golden_rule_blocked_sdr_captacao`.
- Sem migração de schema. Apenas edge functions.
- Nenhuma mudança de UI/frontend.
