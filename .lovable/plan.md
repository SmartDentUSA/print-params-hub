## Diagnóstico

Verificado no banco:
- `astron_courses`: **0 registros** (tabela existe, sync nunca rodou)
- `smartops_courses`: 11 registros sem campo de grade curricular/módulos
- FAQs em `knowledge_contents`: **0** (não existe taxonomia)
- Casos de sucesso: 9 registros soltos por título (não tagueados)
- `products_catalog`: 116 produtos, **sem coluna `datasheet_url`**
- `resin_documents`: 47 PDFs (apenas resinas têm ficha técnica)

## Plano (4 frentes, sem inventar dados)

### 1. 🔴 Cursos Astron — Sync da grade curricular
- Criar edge function `sync-astron-courses` que consome a API Astron Academy (mesma já usada em `dynamic-context-enrichment`) e popula `astron_courses` + nova tabela `astron_course_modules` (course_id, order_index, title, lessons jsonb, duration_sec).
- Schedulada diariamente via `pg_cron`.
- Atualizar tool `search_courses` do Copilot para fazer JOIN com `astron_course_modules` e retornar grade resumida (≤2KB).

### 2. 🟡 FAQ Comercial — Taxonomia + seed
- Migration: criar `commercial_faqs` (id, question, answer, category, tags[], product_refs[], priority, active, embedding vector(3072)).
- GRANT + RLS read-only para `anon`/`authenticated`; insert via service_role.
- UI mínima em `/admin/faqs` (CRUD básico reaproveitando shadcn Table existente) para o time popular as 50 perguntas.
- Nova tool Copilot `search_faqs` (FTS + vetorial, reusa `generateEmbedding`).
- Incluir embeddings em `agent_embeddings` via trigger AFTER INSERT/UPDATE (mesmo padrão de `knowledge_contents`).

### 3. 🟡 Fichas Técnicas PDF — Coluna + ingestão
- Migration: `ALTER TABLE products_catalog ADD COLUMN datasheet_url text, spec_sheet_url text, manual_url text`.
- Função `ingest-product-datasheet` que aceita upload (Storage bucket `product-datasheets`) ou URL externa, extrai texto via `pdf-parse`, gera chunks + embeddings para `agent_embeddings` (source='product_datasheet', source_id=product_id).
- UI em `/admin/produtos/[id]` (extender página existente do catálogo) com campo de upload.
- Tool `search_products` retorna `datasheet_url` quando disponível.

### 4. 🟢 Casos de Sucesso — Modelo dedicado
- Migration: `success_stories` (client_name, segment, challenge, solution, results jsonb, products_used[], video_url, image_url, published, embedding).
- Backfill manual dos 9 conteúdos existentes (script one-off via insert tool, sem inventar dados — apenas reclassifica títulos óbvios).
- Tool Copilot `search_success_stories` (filtra por segmento/produto/resultado).
- Página pública `/casos-de-sucesso` (SEO-friendly, schema.org `Review`).

## Ordem de execução sugerida

1. **Sprint 1 (hoje)**: FAQ infra (migration + UI) e Fichas Técnicas (migration + coluna) — desbloqueiam time comercial para começar a popular.
2. **Sprint 2 (24h)**: Sync Astron courses (depende de credenciais API — confirmar `ASTRON_API_KEY` em secrets).
3. **Sprint 3**: Success stories + página pública.

## Detalhes técnicos

- Todas as novas tabelas seguem padrão CDP: `merged_into IS NULL` quando referenciam leads; `embedding vector(3072)` com índice HNSW.
- Tools novas do Copilot entram em `ACTION_TOOLS_ALLOWLIST` (`smart-ops-copilot/index.ts`) e atualizam o bloco "FONTES DE CONHECIMENTO" do SYSTEM_PROMPT.
- Instrumentação `rag_hits` por tool em `system_health_logs` (já existente).
- Memória: atualizar `mem://smart-ops/copilot-rag-access-v1` com as 3 novas fontes (faqs, datasheets, success_stories) e criar `mem://integration/astron-courses-sync-v1`.

## Fora de escopo

- Não vou criar conteúdo (perguntas, casos, fichas) — apenas a infra. O time popula.
- Não vou alterar `products_catalog` semântica nem `system_a_catalog` (read-only sync de System A).
- Não vou tocar Dra. LIA RAG (já funciona; reusamos `generateEmbedding` apenas).

## Pré-requisitos a confirmar antes do build

1. Existe `ASTRON_API_KEY` ou endpoint público para grade curricular?
2. Storage bucket `product-datasheets` pode ser público (CDN) ou precisa de signed URLs?
3. UI de admin de FAQs/produtos: reaproveitar `/admin` atual ou criar rota nova?
