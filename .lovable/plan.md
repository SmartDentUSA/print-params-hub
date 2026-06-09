## Objetivo

Hoje o painel **AI Routing** (`ai_model_routing` + `_shared/ai-router.ts`) já existe e suporta primário → fallback automático em 429/402/5xx/network, mas **só 1 edge function (`social-caption-generator`) o usa**. Todas as outras chamam o Lovable Gateway direto, então quando os créditos zeram (402) ou rate-limita (429), o fluxo quebra.

Vamos plugar o router em **TODAS as edge functions de IA**, para que o fallback configurado na UI valha sempre, sem exceção.

## Escopo: 26 edge functions migradas para `aiComplete()`

Agrupadas por `task_type` da tabela (já existem 16 task_types; criaremos os que faltam):

### Grupo 1 — Geração de conteúdo (prioridade: foi o que quebrou hoje)
- `extract-pdf-text` → task `pdf_extract` (novo: lovable Gemini → Poe Gemini)
- `extract-pdf-raw` → task `pdf_extract`
- `extract-pdf-specialized` → task `pdf_extract_specialized` (novo)
- `ai-enrich-pdf-content` → task `content_format`
- `ai-orchestrate-content` → task `content_seo`
- `ai-content-formatter` → task `content_format`
- `ai-metadata-generator` → task `content_seo`
- `reformat-article-html` → task `content_format`
- `format-processing-instructions` → task `content_format`
- `enrich-article-seo` → task `content_seo`
- `translate-content` → task `content_format`
- `heal-knowledge-gaps` → task `content_seo`
- `copilot-draft-knowledge-article` → task `content_seo`
- `copilot-ingest-method-doc` → task `content_format`
- `backfill-keywords` → task `content_seo`
- `ai-generate-og-image` → task `image_gen` (novo: lovable nano-banana → Poe nano-banana-pro)

### Grupo 2 — Atendimento ao lead (Dra. LIA / WhatsApp)
- `dra-lia` → task `dra_lia_chat`
- `smart-ops-lia-assign` → task `cognitive_lead_analysis` (já configurado)
- `smart-ops-stagnant-processor` → task `cognitive_lead_analysis`
- `backfill-lia-leads` → task `cognitive_lead_analysis`
- `evaluate-interaction` → task `cognitive_lead_analysis`

### Grupo 3 — Copilot e análise interna
- `smart-ops-copilot` → task `copilot_default` (já configurado)
- `extract-commercial-expertise` → task `copilot_default`
- `generate-veredict-data` → task `copilot_default`
- `sync-google-reviews` / `resubmit-sitemap-to-gsc` → revisar: se não usam IA, removem chamada ao Gateway

## O que muda em cada função (padrão)

Antes:
```ts
const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
  headers: { Authorization: `Bearer ${LOVABLE_API_KEY}` },
  body: JSON.stringify({ model: "google/gemini-2.5-flash", messages, ... }),
});
```

Depois:
```ts
import { aiComplete } from "../_shared/ai-router.ts";

const r = await aiComplete({
  task: "content_format",
  messages,
  functionName: "ai-enrich-pdf-content",
  tools, // opcional
});
if (!r.ok) return errorResponse(r.error, r.attempts);
const text = r.text;
```

## Ampliações no `_shared/ai-router.ts`

1. **Suporte a multimodal** (PDFs / imagens): hoje só passa `messages` no formato chat. Adicionar passagem transparente de `content: [{type:"file", file_data}]` para Lovable Gemini e equivalente para Poe Gemini.
2. **Suporte a image generation** (`/v1/images/generations` para nano-banana): novo branch `callProvider` quando `task` marcada como `modality='image'`. Fallback Poe nano-banana-pro.
3. **Suporte a `response_format: json_object`** quando a função pede JSON estruturado (passar como `params.responseFormat`).
4. **Erro amigável 402** propagado no retorno (`r.error_code = "credits_exhausted"`) para a UI poder mostrar toast claro.

## Tabela `ai_model_routing` — novas linhas

Migração para inserir os task_types que faltam:
- `pdf_extract` (lovable `google/gemini-2.5-flash` → poe `gemini-3-flash`)
- `pdf_extract_specialized` (lovable `google/gemini-2.5-pro` → poe `gemini-3.1-pro`)
- `image_gen` (lovable `google/gemini-2.5-flash-image` → poe `nano-banana-pro`)

## Pré-requisito de secrets

- `LOVABLE_API_KEY` ✅ (já existe)
- `DEEPSEEK_API_KEY` ✅ (já existe, conforme memory)
- `POE_API_KEY` — preciso confirmar se está provisionado. Se não estiver, peço para você adicionar (Poe é o principal fallback configurado em quase todas as rotas).

## Validação

Para cada função migrada:
1. `supabase--curl_edge_functions` com payload mínimo, conferir status 200 e `provider_used`/`model_used` na resposta.
2. Simular falha do primário forçando `enabled=false` da rota primária temporariamente em 1 task e verificar que o fallback responde.
3. Logs em `system_health_logs` / `ai_usage_logs` mostram `attempts: [{primary, fallback}]`.

## Fora de escopo

- Não mudo a UI do painel AI Routing (já está OK).
- Não altero `social-caption-generator` (já usa router).
- Não toco em funções não-IA mesmo que tenham `LOVABLE_API_KEY` (ex.: standard connectors).

## Ordem de entrega sugerida

1. Ampliar `_shared/ai-router.ts` (multimodal + image + json + error_code) — 1 PR.
2. Migração SQL com novos task_types.
3. Migrar Grupo 1 (conteúdo, destrava o bug de hoje).
4. Migrar Grupo 2 (Dra. LIA / lead).
5. Migrar Grupo 3 (Copilot).
6. Adicionar toast no frontend (`AdminKnowledge.tsx` e onde mais consumir) para `error_code: credits_exhausted` → "Lovable AI sem créditos, usando fallback automaticamente / fallback também falhou — adicionar créditos".

Após sua aprovação, executo na ordem acima.
