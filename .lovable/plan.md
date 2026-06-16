## Objetivo

Substituir as descrições longas (importadas do e-commerce) por uma descrição curta (1 frase, ~160 caracteres) gerada via IA, usando os dados ricos do Sistema A (live API) + `system_a_catalog` como contexto RAG. Aplica-se **apenas às resinas** (~14 produtos da tab Catálogo).

## 1. Edge function: `smart-ops-generate-card-descriptions`

`supabase/functions/smart-ops-generate-card-descriptions/index.ts`

- **Seleção:** `system_a_catalog` onde `active=true AND approved=true AND visible_in_ui=true` E (`product_category ILIKE '%resina%'` OR `product_subcategory ILIKE '%resina%'` OR `name ILIKE '%resina%'`).
- **Parâmetros:** `?dry_run=true|false`, `?slug=<slug>` (gerar para 1 só), `?force=true` (regerar mesmo se já curto).
- **Por produto:**
  1. Buscar dossier enriquecido via `fetchEnrichedProductDossier(supabase, product.name)` (reaproveita `_shared/product-rag.ts` — junta `description`, `extra_data.benefits`, `technical_specs`, `clinical_indications` + live API: `features`, `applications`, `target_audience`).
  2. Montar prompt com nome, categoria, descrição original (truncada), specs e benefícios.
  3. Chamar Lovable AI Gateway (`google/gemini-2.5-flash`, `LOVABLE_API_KEY`) com instruções rígidas:
     - 1 frase, **máx 160 chars** (cortar se exceder).
     - Português, tom técnico-clínico.
     - **Sem preços, sem CTA, sem aspas, sem emojis** (respeita Core memory "no prices").
     - Estrutura: indicação clínica + 1 diferencial técnico (ex: viscosidade, cor, comprimento de onda, compatibilidade).
  4. `UPDATE system_a_catalog SET description = <novo>, extra_data = jsonb_set(extra_data, '{description_original}', to_jsonb(description), true), updated_at=now() WHERE id = ...` — preserva original em `extra_data.description_original` para auditoria/rollback.
  5. Log em `system_health_logs` (`function_name`, `severity:info`, contagem, falhas).
- **Resposta JSON:** `{ processed, updated, skipped, failures: [{slug, error}] }`.
- **CORS + verify_jwt=false** (chamada pelo Admin via `supabase.functions.invoke`).
- **Rate limit:** delay 800ms entre chamadas; tratar 429/402 com backoff e parar gracefully.

## 2. Botão no Admin

Adicionar em `src/components/AdminCatalog.tsx` (ou onde o admin lista produtos do System A — confirmar ao implementar) um botão **"Regenerar descrições das resinas"**:
- Confirm dialog: "Isso vai sobrescrever a descrição de ~14 resinas. Original será preservada em `extra_data.description_original`. Continuar?"
- `supabase.functions.invoke('smart-ops-generate-card-descriptions', { body: { dry_run: false } })`
- Toast com resultado (`processed`, `updated`, `failures.length`).
- Botão secundário **"Dry run"** que mostra preview das descrições propostas sem gravar.

## 3. Frontend (sem mudança visual)

`src/components/knowledge/KbTabCatalogo.tsx` já lê `description` e roda `stripHtml()`. Como sobrescrevemos `description` direto, o card passa a renderizar a versão curta automaticamente. **Sem mudanças no componente.**

## 4. Memória

Adicionar `mem://catalog/ai-card-descriptions-v1`:
- Descrições dos cards de resina são geradas pela edge `smart-ops-generate-card-descriptions` (Gemini 2.5 Flash via Lovable AI Gateway).
- Original preservada em `extra_data.description_original`.
- Re-sync do Loja Integrada pode sobrescrever — rodar regeneração depois de cada sync grande.

## 5. Validação

1. Dry run para 1 resina (`?dry_run=true&slug=...`) — validar formato (≤160 chars, sem preço).
2. Rodar para todas as resinas.
3. Conferir no preview `/base-conhecimento?tab=catalogo&category=resinas` se os cards ficaram limpos.

## Arquivos

- **Novo:** `supabase/functions/smart-ops-generate-card-descriptions/index.ts`
- **Edit:** `src/components/AdminCatalog.tsx` (botão + invoke)
- **Novo:** `mem/catalog/ai-card-descriptions-v1.md` + entrada em `mem/index.md`

## Não muda

- Schema do banco (usa coluna `description` existente + `extra_data` JSONB).
- Sync do Sistema A / Loja Integrada.
- Lógica de RAG da Dra. LIA (que usa `description` para dossier — texto curto continua válido; campos ricos via Sistema A live ficam intactos).
- Outros produtos (impressoras, scanners) não são tocados.
