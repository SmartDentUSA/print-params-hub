---
name: Sistema A Live Product API
description: Sistema A live get-product-data endpoint enriches SPIN with features, applications, document_extracts, workflow_stages, anti_hallucination rules. Snapshot persisted via smart-ops-refresh-system-a-cache.
type: reference
---

## Endpoint
`GET https://pgfgripuanuwwolmtknn.supabase.co/functions/v1/get-product-data?product_id={external_id}`

Bridge: `system_a_catalog.external_id` == Sistema A product id.

## Consumed fields
`features`, `applications`, `document_transcriptions` (Gemini-extracted PDFs),
`workflow_stages`, `competitor_comparison`, `forbidden_products`,
`required_products`, `anti_hallucination_rules`, `target_audience`,
`bot_trigger_words`, `market_keywords`, `search_intent_keywords`,
`technical_specifications`, `benefits`.

## Code
- `supabase/functions/_shared/system-a-live.ts` — fetcher (10 min in-memory cache, 8s timeout, soft-fail), mapper, prompt renderers, persistence snapshot.
- `supabase/functions/_shared/product-rag.ts::fetchEnrichedProductDossier` — merges local row + live dossier.
- `supabase/functions/_shared/workflow-diagnosis.ts` — `loadProductTokenIndex` boosts `resolveIntent` with discovery tokens; `seedSpinBriefing` + `enrichSpinWithLLM` inject `CONTEXTO DO PRODUTO (Sistema A live)` + `REGRAS ANTI-ALUCINAÇÃO` blocks into the Gemini prompt and force a SPIN problem question per `always_require` rule.
- `supabase/functions/smart-ops-refresh-system-a-cache/index.ts` — persists snapshot at `system_a_catalog.extra_data.system_a_live`. Modes: `?product_id=`, `?slug=`, `?all=true&limit=&offset=`.

## Validation
- `curl /smart-ops-refresh-system-a-cache?product_id=3848beb6-…` → 200, snapshot persisted.
- `curl /smart-ops-preview-seller-note?email=bonfanteatendimento@gmail.com` → SPIN problem cites Otoflash / Curie+ (from live `technical_specifications`).
- `curl /smart-ops-preview-seller-note?email=danilohen@gmail.com` → ioConnect/Medit/Rayshape coverage intacta.

## Limitations
- `export-product-ai-playbook` está retornando 500 — não usar.
- `/get-product-data?slug=` exige slug admin (`painel/...`). Sempre buscar por `product_id`.