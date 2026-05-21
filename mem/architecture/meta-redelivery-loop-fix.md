---
name: Meta Lead Ads re-delivery loop kill
description: HARD_DEDUPE checks platform_lead_id OR raw_payload.previous_platform_lead_ids; FAMILY_KEY (form_id+email+phone in 24h) catches new leadgen_ids for same submission; PLATFORM_LEAD_ID SYNC stops rebobinar when incoming id is archived; REDELIVERY_GUARD prevents duplicate (lead_id, entity_id) in lead_activity_log
type: feature
---
**Problema:** Meta entrega o mesmo lead a cada 2min com `leadgen_id` que pode (a) repetir, (b) alternar entre 2 valores (X↔Y ping-pong por formulários gêmeos), ou (c) ser totalmente novo para a mesma submissão. O guard antigo só checava `platform_lead_id` (escalar único) e janela 6h em `lead_activity_log` — caso Miguel acumulou 1.251 `form_submission` em 30h.

**Solução em `smart-ops-ingest-lead/index.ts`:**

1. **HARD_DEDUPE estendido** (linhas ~86): consulta `platform_lead_id = dedupeId` OR `raw_payload->previous_platform_lead_ids cs ["dedupeId"]`. Requer índice GIN em `lia_attendances.raw_payload` (`idx_lia_attendances_raw_payload_gin`).
2. **FAMILY_KEY dedupe** (linhas ~111): para `source='meta_lead_ads'`, casa por `platform_form_id + (email OR telefone_normalized)` nas últimas 24h. Quando casa, arquiva o novo `leadgen_id` em `previous_platform_lead_ids` e retorna `dedupe_via=family_key`.
3. **PLATFORM_LEAD_ID SYNC convergente** (linhas ~548): se o `incomingPlatformLeadId` já está no arquivo, NÃO sobrescreve o atual — apenas garante que ambos estão arquivados. Mata o ping-pong X↔Y.
4. **REDELIVERY_GUARD** (linhas ~928): antes do `insert` em `lead_activity_log`, para `source='meta_lead_ads'`, se já existe evento `meta_ads_lead_entry`/`form_submission` com mesmo `(lead_id, entity_id)`, pula o log. 1 evento canônico por leadgen_id por lead, sempre.

**Validação:** payload com leadgen_id já registrado → `HARD_DEDUPE_SKIPPED` em <50ms. Leadgen_id novo mas mesmo form+email → `FAMILY_DEDUPE_SKIPPED`. Sem chamadas downstream (lia-assign, cognitive, SellFlux) em nenhum dos casos.