## Objetivo

Adicionar **Poe.com** como segundo provider de modelos IA (ao lado do Lovable AI Gateway / DeepSeek) e criar um **orquestrador** que escolhe automaticamente qual LLM chamar para cada tarefa, baseado em custo / qualidade / modalidade.

Hoje cada edge function tem um modelo fixo (memória `ai-model-routing-v1`). Vamos preservar essa matriz como default e adicionar Poe como rota alternativa, com fallback e logging unificado.

---

## Decisões (defaults razoáveis)

| Tema | Escolha | Por quê |
|---|---|---|
| API Poe | **OpenAI-compatible** (`https://api.poe.com/v1/chat/completions`) | Plug-and-play com mesmo SDK que já usamos; cobre todos os modelos texto. Imagem/vídeo Poe fica fora deste sprint. |
| Roteamento | **Híbrido: matriz default + override `task_type='auto'`** | Não quebra nada; só tarefas marcadas `auto` passam pelo classificador. |
| Migração inicial | **Infraestrutura + 1 piloto (Copilot)** | Risco baixo. Copilot pode opcionalmente usar Claude Opus 4.8 ou GPT-5.5 via Poe. |
| Observabilidade | **Estende `ai_token_usage` com `provider='poe'` + fallback automático** | Reusa dashboard existente. Caps de budget ficam para depois. |

---

## Arquitetura

```text
┌─────────────────────────────────────────────────────────────┐
│  Edge Function (ex: smart-ops-copilot, dra-lia-chat)        │
│  chama: aiRouter.complete({ task, messages, ... })          │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  _shared/ai-router.ts                                        │
│  1. Resolve task → model (tabela ai_model_routing)          │
│  2. Resolve model → provider (poe | lovable | deepseek)     │
│  3. Chama provider adapter                                  │
│  4. Em erro 429/5xx → fallback ao secundário                │
│  5. Loga em ai_token_usage (provider, model, tokens, $)    │
└─────────────────────────────────────────────────────────────┘
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ poe-adapter  │    │ lovable-adptr│    │ deepseek-adp │
│ api.poe.com  │    │ ai.gateway...│    │ deepseek.com │
└──────────────┘    └──────────────┘    └──────────────┘
```

---

## Implementação

### 1. Secret
- Adicionar `POE_API_KEY` via tool `secrets--add_secret` (usuário cola a key obtida em poe.com/api_key).

### 2. Banco — nova tabela `ai_model_routing`

Tabela canônica que mapeia `task_type` → `primary_model` + `fallback_model`, com `provider`, custo por 1M tokens e modalidade. Substitui a memória estática por dado vivo editável.

Colunas chave:
- `task_type` (PK, ex: `copilot_default`, `dra_lia_chat`, `waleads_briefing`, `cognitive_lead_analysis`, `auto_cheap`, `auto_balanced`, `auto_premium`)
- `primary_provider`, `primary_model`
- `fallback_provider`, `fallback_model`
- `input_cost_per_m`, `output_cost_per_m`, `modality` (`text`|`image`|`embedding`)
- `enabled`, `notes`

Seed inicial reflete a matriz atual + adiciona presets Poe.

### 3. Edge — `supabase/functions/_shared/ai-router.ts`

API única:
```ts
await aiRouter.complete({
  task: 'copilot_default',           // ou 'auto:balanced'
  messages, tools?, temperature?,
  functionName: 'smart-ops-copilot'  // pra log
})
```

Faz:
1. `SELECT * FROM ai_model_routing WHERE task_type=$1`
2. Tenta `primary_provider`; em 429/402/5xx → tenta `fallback`
3. Loga em `ai_token_usage` com tarifa real do provider
4. Retorna `{ text, usage, model_used, provider_used }`

### 4. Adapter Poe (`_shared/providers/poe.ts`)

```ts
fetch('https://api.poe.com/v1/chat/completions', {
  headers: { Authorization: `Bearer ${POE_API_KEY}` },
  body: JSON.stringify({ model, messages, stream:false, ... })
})
```

OpenAI-compatible 100%, suporta tools function-calling para modelos compatíveis (Claude, GPT-5.x, Gemini, DeepSeek).

### 5. Adapter Lovable Gateway e DeepSeek
Extrair o que já existe espalhado em várias functions (`format-processing-instructions`, `wa-ai-content`, `social-caption-generator`, etc.) para `_shared/providers/lovable.ts` e `_shared/providers/deepseek.ts`. Sem mudar comportamento.

### 6. Classificador `auto:*` (simples, sem LLM)
- `auto:cheap` → menor custo capaz de texto (ex: `google/gemini-3.1-flash-lite-preview` ou Poe `gemini-3.1-flash-lite`)
- `auto:balanced` → padrão (Gemini 3 Flash)
- `auto:premium` → reasoning forte (Poe `claude-opus-4.8` ou `gpt-5.5`)
- `auto:code` → `gpt-5.3-codex` via Poe

Heurística no router decide pelo `task` se vier `auto:*`.

### 7. Piloto — Copilot
Em `smart-ops-copilot`, trocar a chamada direta DeepSeek pelo `aiRouter.complete({ task: 'copilot_default', ... })`. Comportamento default idêntico (DeepSeek primário, Poe Claude como fallback). Flag `COPILOT_MODEL_OVERRIDE` permite testar `auto:premium` sem deploy.

### 8. Admin UI (mínima)
Nova aba em SmartOps Admin **"AI Routing"** lista a tabela `ai_model_routing` com:
- Toggle enabled/disabled
- Trocar primary/fallback model via dropdown (lista de modelos conhecidos Poe + Lovable)
- Custo estimado mensal por task (baseado em `ai_token_usage` últimos 30d)

CRUD via Supabase direto (admin role).

### 9. Dashboard `SmartOpsAIUsageDashboard.tsx`
Adicionar coluna `provider` na visualização e gráfico stacked Poe vs Lovable vs DeepSeek.

---

## Fora de escopo (próximos sprints)

- Geração de imagem via Poe (`nano-banana-pro`, `gpt-image-2`) — fica para depois, hoje usamos `imagegen` e Lovable Gateway.
- Geração de vídeo (Veo, Sora, Kling) — não há demanda mapeada.
- Streaming SSE pelo router — primeira versão é só request/response. Dra. LIA continua streaming direto via Gemini.
- Budget caps por modelo.
- Migração de Dra. LIA / waleads — fazer depois do piloto Copilot validar.

---

## Arquivos a criar/editar

**Novos**
- `supabase/migrations/<ts>_ai_model_routing.sql` (tabela + seed + RLS admin-only)
- `supabase/functions/_shared/ai-router.ts`
- `supabase/functions/_shared/providers/poe.ts`
- `supabase/functions/_shared/providers/lovable.ts`
- `supabase/functions/_shared/providers/deepseek.ts`
- `src/components/SmartOpsAIRouting.tsx` (admin CRUD)

**Editados**
- `supabase/functions/smart-ops-copilot/index.ts` — usar `aiRouter`
- `supabase/functions/_shared/log-ai-usage.ts` — adicionar tarifas Poe
- `src/components/SmartOpsAIUsageDashboard.tsx` — coluna provider
- `src/components/AdminSidebar.tsx` — link "AI Routing"
- `mem/strategy/ai-model-routing-v1.md` — atualizar para apontar para a tabela como fonte da verdade

**Secret**
- `POE_API_KEY` (a adicionar)

---

## Validação

1. Migration aplica e seed popula.
2. `curl` direto em `smart-ops-copilot` com `task=copilot_default` retorna resposta DeepSeek (default) e loga `provider='deepseek'`.
3. Simular DeepSeek down (forçar erro) → router cai para Poe Claude Sonnet 4.6 e loga `provider='poe', model='claude-sonnet-4.6'`.
4. UI Admin lista 6+ tasks, troca de modelo persiste e próxima chamada usa o novo.
5. Dashboard mostra split de custo por provider.

Aguardo aprovação para implementar.
