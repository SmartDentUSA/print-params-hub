## Diagnóstico

Hoje o RAG do SPIN lê só `system_a_catalog` (espelho local). Esse espelho não cobre os campos mais ricos que **o Sistema A já expõe publicamente** em `GET https://pgfgripuanuwwolmtknn.supabase.co/functions/v1/get-product-data?product_id={external_id}`:

| Campo no live API | Conteúdo | O que destrava no SPIN |
|---|---|---|
| `features[]` (19 itens no GlazeON) | atributos diferenciadores | Ponte-produto com benefícios específicos |
| `applications` (string) | qual aplicação clínica resolve | Indicação primária para perguntas de SITUAÇÃO |
| `document_transcriptions[]` | conteúdo extraído de Ebooks/IFU/FDS via Gemini | Specs reais (resinas compatíveis, protocolo de cura, contraindicações) |
| `workflow_stages` | papel do produto em scan/print/finish | Mapa direto para 7×3 sem heurística |
| `competitor_comparison` (quando enabled) | tabela específica vs concorrentes | Argumentos contra Anycubic/Phrozen sem invenção |
| `forbidden_products[]` / `required_products[]` | combos válidos/inválidos | Trava dura para `combo_sugerido` |
| `anti_hallucination_rules` | `never_claim`, `always_explain`, `always_require`, `never_mix_with`, `never_use_in_stages` | Regras explícitas para o prompt Gemini |
| `bot_trigger_words` / `market_keywords` / `search_intent_keywords` | intenção do lead em linguagem real | Melhora o matcher de intent (`resolveIntent`) |
| `target_audience` | perfil ideal | Calibra perguntas SPIN por persona |

Validado por curl real: `GET /get-product-data?product_id=3848beb6-b671-43c4-9799-d8e482d197f4` retornou **77 KB** com todos esses campos. (O endpoint `/export-product-ai-playbook` está retornando 500 hoje — não vamos depender dele.)

A coluna `system_a_catalog.external_id` **já guarda** o ID do produto no Sistema A (confirmado: GlazeON Splint → `3848beb6-…`), então a ponte é direta — não precisa migration de schema.

## Escopo

### 1. Novo módulo `_shared/system-a-live.ts`

- `fetchSystemAProduct(externalId, opts)` — chama `https://pgfgripuanuwwolmtknn.supabase.co/functions/v1/get-product-data?product_id=…` com timeout 8s, retry 1×, cache em memória (TTL 10 min, chave = externalId). Soft-fail → `null`.
- `mapSystemAToLiveDossier(payload)` — normaliza o response em uma nova interface `LiveProductDossier`:

```ts
interface LiveProductDossier {
  id: string;            // external_id (Sistema A)
  name: string;
  applications: string;                              // 1 frase
  benefits: string[];                                // top 8
  features: string[];                                // top 10
  technical_specs: Array<{label,value}>;             // já existe no live
  document_extracts: Array<{filename, summary, key_specs}>; // de document_transcriptions
  workflow_stages: Record<stage, {role,description,materials[],pain_points[],advantages[]}>;
  competitor_comparison?: {title, table_headers[], table_data[][]};
  forbidden_products: string[];
  required_products: string[];
  anti_hallucination: {
    never_claim: string[];
    always_explain: string[];
    always_require: string[];
    never_mix_with: string[];
    never_use_in_stages: string[];
  };
  target_audience: string[];
  market_keywords: string[];
  bot_trigger_words: string[];
}
```

- `renderLiveDossierForPrompt(d)` — bloco compacto para injetar no prompt Gemini.

### 2. `product-rag.ts` — fonte híbrida

- `fetchProductDossier(supabase, label)` continua igual (local cache rápido).
- Nova `fetchEnrichedProductDossier(supabase, label)` que:
  1. busca `system_a_catalog` row (já temos) → pega `external_id`.
  2. em paralelo busca live (`fetchSystemAProduct(external_id)`).
  3. merge: live tem prioridade em `features`, `applications`, `document_extracts`, `workflow_stages`, `competitor_comparison`, `forbidden_products`, `required_products`, `anti_hallucination`. Local fica de fallback.
- Sem mudar a interface antiga: o consumidor velho continua chamando `fetchProductDossier`; só `workflow-diagnosis.ts` migra para a versão enriquecida.

### 3. `workflow-diagnosis.ts` — usar o live em 3 pontos

- **`resolveIntent`** — passa a opcionalmente carregar `bot_trigger_words` e `market_keywords` de todos os produtos do mapping (em batch, cache 10min). Cada token desses entra no scoring como **PRODUCT_TOKENS** específico. Resolve o caso "GlazeON Splint → sem match no portfólio" (mencionado no plan anterior) sem precisar manter hardcoded.
- **`buildProductDiscoveryHints`** (do plano anterior) — agora alimentado por: `applications`, `workflow_stages[stage].pain_points_addressed`, `anti_hallucination.always_require` (perguntar se o lead tem o pré-requisito), `document_extracts[].key_specs` (resinas compatíveis, dispositivos de cura).
- **`enrichSpinWithLLM`** — o prompt Gemini ganha 3 novos blocos:
  - `=== CONTEXTO DO PRODUTO (Sistema A live) ===` com `features` + `applications` + top 2 `document_extracts.summary`.
  - `=== REGRAS ANTI-ALUCINAÇÃO DO PRODUTO ===` com as 5 listas de `anti_hallucination_rules`. Instrução dura: *"Se uma pergunta SPIN ou a ponte_produto violar `never_claim` / `never_mix_with` / `never_use_in_stages`, REESCREVA."*
  - `=== COMBO VÁLIDO ===` com `required_products` (devem aparecer em perguntas de problema/implicação se faltarem no stack do lead) e `forbidden_products` (proibido sugerir).

### 4. Endpoint de manutenção: `smart-ops-refresh-system-a-cache`

Edge function nova (`verify_jwt=false`, on-demand), com 2 modos:

- `GET ?product_id=<external_id>` — força refresh do cache em memória + opcionalmente faz `UPSERT` em `system_a_catalog.extra_data` com os campos novos (`features`, `applications`, `document_extracts`, `workflow_stages`, `anti_hallucination`) para garantir que mesmo sem live disponível o seed heurístico melhora.
- `GET ?all=true&limit=50` — varre todas as rows do `system_a_catalog` que têm `external_id` e atualiza em lote (chamado por cron diário).

Sem migration. Apenas `UPDATE system_a_catalog SET extra_data = jsonb_set(coalesce(extra_data,'{}'), '{system_a_live}', $payload, true), updated_at=now() WHERE external_id=$id`.

### 5. Validação

1. `curl smart-ops-refresh-system-a-cache?product_id=3848beb6-b671-43c4-9799-d8e482d197f4` → confirmar 200 + 19 features + applications populadas.
2. `curl smart-ops-preview-seller-note?email=bonfanteatendimento@gmail.com` →
   - `diagnosis.intent.matched_product_label` = "Sistema de Acabamento GlazeON - Splint" (matcher casa via `bot_trigger_words` / `market_keywords` do live).
   - `diagnosis.spin.perguntas_spin.problema` cita **qual resina de placa** + **qual dispositivo de fotopolimerização** (vindos de `document_extracts` / `technical_specifications`).
   - `diagnosis.spin.ponte_produto` cita o ganho de **10,5% de Resistência Flexural** (vindo de `technical_specifications`) e a compatibilidade universal (vindo de `applications` / `features`).
3. Re-rodar `danilohen@gmail.com` para garantir que ioConnect/Medit não regrediu.
4. `enableLLM:false` → confirmar que o seed heurístico já entrega perguntas específicas usando `applications` + `workflow_stages` + `anti_hallucination.always_require`.

## Arquivos alterados

- **Novo** `supabase/functions/_shared/system-a-live.ts` — fetcher + mapper + render do live API.
- `supabase/functions/_shared/product-rag.ts` — adiciona `fetchEnrichedProductDossier` (merge local+live).
- `supabase/functions/_shared/workflow-diagnosis.ts` — `resolveIntent` lê PRODUCT_TOKENS do live, `seedSpinBriefing` usa `applications`/`workflow_stages`, `enrichSpinWithLLM` injeta os 3 novos blocos no prompt Gemini.
- **Nova edge function** `supabase/functions/smart-ops-refresh-system-a-cache/index.ts` + entrada em `supabase/config.toml` com `verify_jwt=false`.
- `mem/smart-ops/seller-note-workflow-diagnosis.md` — documentar a fonte híbrida (local cache + Sistema A live).
- **Nova memory** `mem://integration/system-a-live-product-api` — registrar URL, campos consumidos e regra de cache.

Nada muda em `lia-assign`, `cognitive-analysis`, `seller-summary`, `dra-lia` ou frontend. O `system_a_catalog` local continua sendo a fonte principal; o live API é uma camada de enriquecimento opcional com soft-fail completo.
