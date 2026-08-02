---
name: Lead Opportunities Taxonomy Auto-Register
description: Trigger auto-cadastra product_key ausente em product_taxonomy para o compute-opportunity-engine não perder oportunidades por FK
type: feature
---
`lead_opportunities.product_key` tem FK para `product_taxonomy.product_key`. O `compute-opportunity-engine` (deployed-only, sem fonte no repo) emite chaves de catálogo próprias (`resinas_3d`, `curso_imersao`, `ino_200`, `smartmake_seal`, ...), o que gerava erro 23503 em massa e perda silenciosa de oportunidades.

Guard: trigger `trg_autoregister_product_taxonomy` (BEFORE INSERT/UPDATE OF product_key) chama `public.fn_autoregister_product_taxonomy()`, que cadastra stub em `product_taxonomy` (display_name = product_name, workflow_stage do payload, is_smartdent=true) quando a chave não existe. NÃO remover a FK; NÃO remover o trigger.
