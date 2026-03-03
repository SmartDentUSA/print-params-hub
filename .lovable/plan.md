

# Plano: Instrumentação de 20 Gaps + Inserção Cirúrgica do DeepSeek

## Escopo Total

**23 arquivos** a modificar: 20 Edge Functions para instrumentação de tokens + 3 Edge Functions para migração DeepSeek.

---

## PARTE 1 — Padrão de Instrumentação

A assinatura real do `logAIUsage` é:

```typescript
import { logAIUsage, extractUsage } from "../_shared/log-ai-usage.ts";

// Após cada chamada IA:
const aiData = await res.json();
const usage = extractUsage(aiData);
await logAIUsage({
  functionName: "nome-da-funcao",
  actionLabel: "descricao-curta-da-acao",
  model: "google/gemini-2.5-flash",  // modelo exato usado na chamada
  promptTokens: usage.prompt_tokens,
  completionTokens: usage.completion_tokens,
});
```

O provider e custo são calculados automaticamente pelo helper (detectProvider + estimateCost). Não precisamos passar `provider` nem `cost_usd`.

---

## PARTE 1A — Funções com 1 chamada IA (12 arquivos)

Cada uma recebe: import + 3 linhas após `await res.json()`.

| Arquivo | model | actionLabel |
|---|---|---|
| `extract-commercial-expertise/index.ts` | `google/gemini-2.5-flash` | `extract-expertise` |
| `backfill-lia-leads/index.ts` | modelo usado | `backfill-lead` |
| `reformat-article-html/index.ts` | `google/gemini-2.5-flash` | `reformat-html-{lang}` |
| `ai-content-formatter/index.ts` | `google/gemini-2.5-flash` | `format-content` |
| `enrich-article-seo/index.ts` | `google/gemini-2.5-flash` | `generate-summary` |
| `backfill-keywords/index.ts` | `google/gemini-2.5-flash` | `extract-keywords` |
| `generate-veredict-data/index.ts` | modelo usado | `generate-veredict` |
| `auto-inject-product-cards/index.ts` | modelo usado | `inject-cards` |
| `extract-pdf-text/index.ts` | modelo usado | `extract-pdf-text` |
| `extract-pdf-raw/index.ts` | modelo usado | `extract-pdf-raw` |
| `extract-pdf-specialized/index.ts` | modelo usado | `extract-pdf-specialized` |
| `format-processing-instructions/index.ts` | modelo usado | `format-instructions` |
| `sync-google-reviews/index.ts` | modelo usado | `translate-review` |
| `extract-video-content/index.ts` | modelo usado | `extract-video` |

## PARTE 1B — Funções com múltiplas chamadas IA (5 arquivos)

| Arquivo | Chamadas | Estratégia |
|---|---|---|
| `smart-ops-lia-assign/index.ts` | 2 (saudação + briefing) | Log separado por ação |
| `ai-generate-og-image/index.ts` | 2 (layout + refine) | Log separado |
| `ai-model-compare/index.ts` | 2 (Gemini + DeepSeek) | Log separado por provider |
| `ai-enrich-pdf-content/index.ts` | 2 (identify + enrich) | Log separado |
| `ai-metadata-generator/index.ts` | 5 paralelas | Somar tokens, 1 log |

## PARTE 1C — Funções de embedding em batch (3 arquivos)

| Arquivo | Estratégia |
|---|---|
| `index-embeddings/index.ts` | Acumular tokens no loop, 1 log ao final |
| `index-spin-entries/index.ts` | Idem |
| `ingest-knowledge-text/index.ts` | Idem |

Nota: A Google Embedding API retorna `billable_character_count` em vez de `usage.prompt_tokens`. Adaptaremos o `extractUsage` localmente ou estimaremos tokens como `Math.ceil(billable_character_count / 4)`.

---

## PARTE 2 — Inserção Cirúrgica do DeepSeek

### 2.1 `cognitive-lead-analysis/index.ts`

**Mudança:** Linhas 267-283 — trocar Lovable Gateway (Gemini 2.5 Flash Lite) por DeepSeek API direta.

- Endpoint: `https://api.deepseek.com/chat/completions`
- Auth: `Bearer ${DEEPSEEK_API_KEY}` (secret já existe)
- Modelo: `deepseek-chat`
- max_tokens: 500 → 800
- Timeout: 12s → 20s (assíncrono, sem impacto UX)
- System prompt mantido idêntico
- Toda validação/sanitização posterior permanece inalterada
- Adicionar `logAIUsage` (atualmente sem instrumentação)

### 2.2 `smart-ops-lia-assign/index.ts` — Briefing do Vendedor

**Mudança:** Função `generateHistoricoOportunidade` (linhas 542-619) — trocar Lovable Gateway por DeepSeek.

- Modelo: `deepseek-chat`
- max_tokens: 300 → 600 (briefing mais tático)
- Timeout: 6s → 12s
- System prompt enriquecido com instrução tática (PERFIL/OPORTUNIDADE/OBJEÇÃO/ABORDAGEM)
- Saudação (`generateAILeadGreeting`, linhas 362-423) permanece em Gemini Flash Lite
- Adicionar `logAIUsage` para ambas as chamadas

### 2.3 `smart-ops-stagnant-processor/index.ts` — Decisão de Reativação

**Mudança:** Adicionar 2 novas funções antes do avanço mecânico:

1. `analyzeStagnationWithDeepSeek(lead)` — DeepSeek analisa cognitive_analysis + histórico e retorna JSON `{ vale_reativar, motivo_provavel, angulo, tom, cta }`
2. `generateReactivationMessage(lead, estrategia)` — Gemini Flash gera texto WhatsApp com base na estratégia

Integração no loop principal:
- Adicionar `cognitive_analysis, resumo_historico_ia, historico_resumos` ao SELECT inicial
- Para cada lead que passou 5 dias: chamar DeepSeek primeiro
- Se `vale_reativar === false`: pular (não avançar etapa)
- Se `true`: gerar mensagem via Gemini e enviar
- Rate limit: max 20 leads com IA por execução (demais seguem mecânico)
- Adicionar `logAIUsage` para ambas chamadas

---

## Ordem de Implementação

Dado o volume (23 arquivos), implementação será em blocos:

1. **Bloco 1:** 12 funções simples (1 chamada cada) + log-ai-usage import
2. **Bloco 2:** 5 funções multi-chamada + 3 funções batch embedding
3. **Bloco 3:** cognitive-lead-analysis → DeepSeek
4. **Bloco 4:** lia-assign briefing → DeepSeek + instrumentação
5. **Bloco 5:** stagnant-processor → DeepSeek decisor + Gemini executor

