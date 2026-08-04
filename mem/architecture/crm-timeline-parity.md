---
name: Paridade de timeline CRM (webhook + API + planilha)
description: crm_proposal e crm_deal_snapshot passam a ser emitidos pelo webhook e pelo reconciliador por API via _shared/crm-timeline-events.ts; pendências vão para crm_timeline_unresolved
type: feature
---
- **Emissor único**: `_shared/crm-timeline-events.ts` (`buildProposalEvents`, `buildStageSnapshotEvent`, `insertTimelineEvents`, `recordUnresolved`) é usado por `smart-ops-piperun-webhook`, `crm-timeline-reconciler` e `crm-xlsx-timeline-ingest` — garante shape idêntico entre tempo real, API e planilha.
- **Dedupe**: sempre via `event_data.dedupe_key` (`proposal:{id}`, `deal_snapshot:{deal}:{stage}:{ts}`, `activity:{id}`) contra o índice único `uq_lal_dedupe`. Insert em lote com fallback linha a linha ignorando 23505.
- **Reconciliador**: `crm-timeline-reconciler` (cron `10,40 * * * *`) lê deals do espelho `public.deals` na janela, hidrata via `GET /deals/{id}` e completa `crm_proposal`/`crm_deal_snapshot`/`crm_activity` faltantes. Aceita `from`/`to`/`limit`/`offset`/`dry_run` para backfill. Limite prático: 60 deals por chamada (timeout acima disso).
- **Pendências**: leads não resolvidos vão para `public.crm_timeline_unresolved` (único parcial em `kind, entity_id`; PostgREST não aceita `onConflict` em índice parcial → insert + update no 23505). Nunca descartar evento.
- **Invariantes**: só leads canônicos (`merged_into IS NULL`), sempre data real do CRM (nunca `now()`), nenhuma escrita em deals/funis (CS e Vendas intocados).
