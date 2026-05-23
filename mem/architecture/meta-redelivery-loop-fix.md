---
name: Meta Lead Ads re-delivery loop kill
description: 4 camadas de dedupe Meta + idempotency lia-assign à prova de race (piperun_id + updated_at <3min, sem depender de proprietario_lead_crm que zera durante GOLDEN RULE)
type: feature
---
**Problema:** Meta entrega o mesmo lead a cada 2min com `leadgen_id` que pode (a) repetir, (b) alternar entre 2 valores (X↔Y ping-pong por formulários gêmeos), ou (c) ser totalmente novo para a mesma submissão. O guard antigo só checava `platform_lead_id` (escalar único) e janela 6h em `lead_activity_log` — caso Miguel acumulou 1.251 `form_submission` em 30h.

**Solução em `smart-ops-ingest-lead/index.ts`:**

1. **HARD_DEDUPE estendido** (linhas ~86): consulta `platform_lead_id = dedupeId` OR `raw_payload->previous_platform_lead_ids cs ["dedupeId"]`. Requer índice GIN em `lia_attendances.raw_payload` (`idx_lia_attendances_raw_payload_gin`).
2. **FAMILY_KEY dedupe** (linhas ~111): para `source='meta_lead_ads'`, casa por `platform_form_id + (email OR telefone_normalized)` nas últimas 24h. Quando casa, arquiva o novo `leadgen_id` em `previous_platform_lead_ids` e retorna `dedupe_via=family_key`.
3. **PLATFORM_LEAD_ID SYNC convergente** (linhas ~548): se o `incomingPlatformLeadId` já está no arquivo, NÃO sobrescreve o atual — apenas garante que ambos estão arquivados. Mata o ping-pong X↔Y.
4. **REDELIVERY_GUARD** (linhas ~928): antes do `insert` em `lead_activity_log`, para `source='meta_lead_ads'`, se já existe evento `meta_ads_lead_entry`/`form_submission` com mesmo `(lead_id, entity_id)`, pula o log. 1 evento canônico por leadgen_id por lead, sempre.

5. **FORM_HISTORY_DEDUPE 12h** (após resolução do lead canônico, ~L405): para `source='meta_lead_ads'` com `formName`, se já existe `form_submission` no `lead_activity_log` para `(lead_id=canonical, entity_name=form_name)` nas últimas 12h, arquiva o novo leadgen_id, **faz backfill de `platform_lead_id`/`platform_form_id` no lead canônico** e retorna `dedupe_via=meta_form_history_12h`. Fecha o buraco de leads legados sem `platform_lead_id`/`platform_form_id` persistidos (caso Luciana Boggian, 661 `seller_assigned` em 24h). Log: `meta_form_history_dedupe` em `system_health_logs`.

**Solução em `smart-ops-lia-assign/index.ts`:**

- **Idempotency race-proof** (~L1842): guarda agora exige apenas `piperun_id && updated_at < 3min`, NÃO `proprietario_lead_crm`. Motivo: GOLDEN RULE zera `proprietario_lead_crm` transitoriamente durante re-atribuição; uma invocação concorrente lia uma NULL momentânea e burlava o skip, rodando o pipeline completo (Round Robin → preserve Vendas → update CRM) a cada delivery do Meta. `piperun_id` presente significa que o Deal já existe; basta isso + updated_at recente para skip.

**Validação:** payload com leadgen_id já registrado → `HARD_DEDUPE_SKIPPED` em <50ms. Leadgen_id novo mas mesmo form+email → `FAMILY_DEDUPE_SKIPPED`. Sem chamadas downstream (lia-assign, cognitive, SellFlux) em nenhum dos casos.