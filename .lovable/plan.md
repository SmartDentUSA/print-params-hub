

# Plan: Generate Lead Architecture Documentation (MD)

## Objective
Create a comprehensive Markdown document at `/mnt/documents/LEAD_ARCHITECTURE_SMARTDENT.md` documenting the full lead lifecycle, data flows, B2B/B2C treatment, Copilot usage, audience generation, forms, and CRM integration.

## Document Structure

1. **Overview** — CDP architecture centered on `lia_attendances`
2. **Lead Sources** — 7 ingestion paths (Forms, Meta Ads, SellFlux, E-commerce/Loja Integrada, PipeRun Webhook, PipeRun Sync, Dra. LIA)
3. **Ingestion Pipeline** — `smart-ops-ingest-lead` flow, Smart Merge logic, field categories (PROTECTED, ALWAYS_UPDATE, ENRICHMENT_ONLY, MERGE_ARRAY, MERGE_JSONB), source priority table
4. **CRM Bidirectional Sync** — PipeRun flows: `lia-assign` (outbound: person creation, deal creation, Golden Rule), `sync-piperun` (inbound: 12 pipelines, Rich Deal Snapshots, person-centric consolidation), `piperun-webhook` (real-time with proposal re-fetch)
5. **B2B vs B2C Classification** — `buyer_type` generated column, `empresa_piperun_id` as discriminator, `companies` + `people` + `deals` normalized tables, `fn_sync_normalized_from_lead`, implications in filtering/segmentation/LTV
6. **Lead Card (LeadDetailPanel)** — Hero card (LIS score, buyer badge, heat, meta), 7 tabs (Historico, Cognitivo, Upsell, Fluxo, LIS, Acoes, CS), Timeline (10 sources), Financial tables (CRM P&S, E-commerce LTV, Product Mix), Proposals detail table
7. **Intelligence Score (LIS)** — 4 axes (Sales Heat, Technical Maturity, Behavioral Engagement, Purchase Power), stage detection hierarchy, regression tracking
8. **Cognitive Analysis** — DeepSeek-powered longitudinal analysis, stage trajectory, urgency classification
9. **Copilot IA** — 19 tools, Dual Brain (DeepSeek/Gemini), `query_deal_history` for sales analysis, `bulk_campaign` for mass operations, `create_audience` for segmentation
10. **Audience Builder** — Filters (pipeline, temperature, stage, urgency, SDR interests, active products, item proposta, UF, proprietario, valor range), SellFlux export
11. **Forms System** — `smartops_forms` + `smartops_form_fields`, purposes (SDR Captacao, NPS, CS, ROI, Evento), public form page, field mapping
12. **Stagnation Engine** — 5-day progression through stages, AI-generated reactivation messages, SellFlux campaign sync
13. **SellFlux Integration** — Bidirectional: inbound webhook (tag migration, source detection), outbound (lead sync, campaign dispatch)
14. **Workflow Portfolio 7x3** — 7 stages x subcategories x 3 layers (Ativo SmartDent, Concorrente, SDR Interest)
15. **Data Flow Diagrams** — ASCII diagrams for ingestion, CRM sync, and campaign flows

## Implementation
Single script execution to write the MD file to `/mnt/documents/`.

