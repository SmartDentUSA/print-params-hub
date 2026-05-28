## Objetivo

Eliminar alucinações sobre produtos (compatibilidade, integrações, combos, concorrentes) na LIA (chat cliente) e no Copilot (gestor comercial), usando como fonte única de verdade as `anti_hallucination_rules` do Sistema A — além de dar acesso governado a **depoimentos** e **conteúdos publicados** (artigos da base de conhecimento, casos de sucesso).

## Fontes oficiais (Sistema A) já mapeadas

- `GET /get-product-data?product_id=<id>` → `anti_hallucination_rules` (`never_claim`, `always_explain`, `always_require`, `never_mix_with`, `never_use_in_stages`, `forbidden_products`, `required_products`, `competitor_comparison`), `workflow_stages[*]`, `document_transcriptions[*].extracted_data` (materiais/resinas/contraindicações)
- `GET /knowledge-base?format=ai_training` → `articles`, `testimonials`, `specialists`, `categories`, `company_profile`
- `GET /knowledge-feed` → conteúdos publicados incrementais

## Frente 1 — LIA chat: injetar dossiê live + depoimentos/conteúdos

Em `supabase/functions/dra-lia/index.ts`:
1. Após `resolveIntent`, se há produto inferido (intent ou matched docs), chamar `fetchEnrichedProductDossier(productId)` (já existente em `_shared/system-a-live.ts`, cache 10 min).
2. Injetar `renderAntiHallucinationForPrompt(dossier)` como bloco `### REGRAS ANTI-ALUCINAÇÃO (Sistema A oficial)` **antes** das instruções de tom — prioridade máxima, hard rules.
3. Estender `_shared/lia-rag.ts` fallback Complete Collection para incluir `system_a_testimonials` e `success_stories` quando intent for ROI/caso real/prova social.
4. Fallback: se live falhar, usar `clinical_brain` local + log em `system_health_logs` (severity=warn, tag `anti_hallucination_fallback`).
5. Instrumentação: `system_health_logs` com `dossier_loaded`, `cache_hit`, `latency_ms`, `product_id`.

## Frente 2 — Copilot: 3 tools read-only + prompt-guard

Em `supabase/functions/smart-ops-copilot/index.ts`, adicionar à allowlist (sem aprovação):

1. **`get_product_anti_hallucination(product_slug_or_id)`** — resolve em `system_a_catalog`, chama `fetchSystemAProduct` (live, 10 min cache), retorna `{ name, never_claim, always_require, never_mix_with, forbidden_products, required_products, competitor_comparison }`.
2. **`search_testimonials(query, product_slug?, limit=5)`** — FTS/ILIKE em `system_a_testimonials` (espelho a criar na Frente 4) ou fetch direto de `/knowledge-base?format=ai_training` filtrando `testimonials[]`.
3. **`search_published_content(query, category?, limit=5)`** — FTS em `knowledge_base_articles` locais + fallback `/knowledge-feed` se vazio; retorna `{ title, canonical_url, summary }` com paths internos `/base-conhecimento/{letter}/{slug}`.

SYSTEM_PROMPT do Copilot ganha bloco:
```
REGRA DURA: antes de qualquer afirmação sobre compatibilidade,
integração, combo, comparação com concorrente ou ROI de produto:
1. Chame get_product_anti_hallucination(produto)
2. Para prova social/caso real: search_testimonials
3. Para fundamentar com artigo publicado: search_published_content
Se a tool não retornar a informação, responda
"Não tenho essa informação confirmada no Sistema A".
NUNCA invente integrações.
```

## Frente 3 — Guard pós-resposta (`_shared/anti-hallucination-guard.ts`)

Função `validateResponse(text, loadedDossiers[])`:
- Regex `compatível|integração|funciona com|conecta com|trabalha com|combina com|substitui` → extrai entidades candidatas
- Cruza com `compatible_products` ∪ `required_products` ∪ `competitor_comparison.table_data` dos dossiês carregados na sessão
- Match literal em `never_claim` ou `never_mix_with` → `risk='blocker'`
- Afirmação de integração sem suporte no dossiê → `risk='high'`

Comportamento:
- **LIA**: `blocker` ou `high` → substitui resposta por "Vou confirmar isso com o time técnico antes de te responder" + log + cria alerta interno
- **Copilot**: prefixa `⚠️ Não confirmado no Sistema A:` + log `warning`

## Frente 4 — Espelhos mínimos para depoimentos e conteúdos

Apenas o estritamente necessário para tools rápidas (sem refazer o sync completo proposto antes):

- `system_a_testimonials` (id, external_id, author_name, role, product_slug, content, rating, payload jsonb, last_synced_at) — populado por novo `sync-system-a-testimonials` (cron 6h + on-demand)
- Reusar `knowledge_base_articles` existente para conteúdos publicados (já espelhado via outros syncs)

GRANTs padrão: `service_role ALL`, `authenticated SELECT`; RLS admin-only para escrita.

## Fora de escopo

- Não criar as 7 tabelas espelho completas do plano anterior (só `testimonials`)
- Não tocar em `workflow-diagnosis.ts` (já funciona)
- Não alterar Sistema A
- Não mexer em qualificação / Cérebro Comercial / RAG embeddings

## Detalhes técnicos

- Cache live: 10 min em memória do edge function (já implementado em `system-a-live.ts`)
- Latência esperada LIA: +200–800 ms apenas na 1ª pergunta por produto/sessão
- Migrations: 1 nova (`system_a_testimonials` + RLS + GRANTs)
- Edge functions novas: `sync-system-a-testimonials`
- Edge functions editadas: `dra-lia/index.ts`, `smart-ops-copilot/index.ts`, `_shared/lia-rag.ts`
- Novo arquivo: `supabase/functions/_shared/anti-hallucination-guard.ts`

## Validação

1. Pergunta LIA "RayShape Edge Mini é compatível com iOConnect?" → deve responder "Não tenho essa informação confirmada" (não está em `compatible_products`)
2. Copilot mesma pergunta → mesma resposta com prefixo `⚠️`
3. Copilot "me dá um depoimento de quem usa RayShape" → retorna via `search_testimonials`
4. LIA "tem artigo sobre fluxo all-on-X?" → retorna link interno `/base-conhecimento/...`
5. Logs em `system_health_logs` confirmam dossiê carregado em todas as respostas sobre produto