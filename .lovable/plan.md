
# Implementação: RAG Re-ranking por Pesos Semânticos

## Confirmação do estado atual (leitura do código)

Após ler `supabase/functions/dra-lia/index.ts` (1676 linhas), confirmei:

- Linha 12: última constante global — ponto de inserção do `TOPIC_WEIGHTS`
- Linhas 894–898: assinatura de `searchKnowledge` encerra em `lang: string` — sem `topicContext`
- Linha 909: primeiro `return` — retorna `data` bruto (vetor)
- Linha 956: segundo `return` — retorna `merged` bruto (ilike)
- Linha 961: terceiro `return` — retorna `ftsResults` bruto (fulltext)
- Linha 1024: quarto `return` — retorna `results` bruto (keyword)
- Linha 1239: chamada de `searchKnowledge` — sem `topic_context`
- Linha 1255: montagem de `allResults` — sem re-ranking

Nenhuma das 5 mudanças planejadas existe no código. Esta é a implementação definitiva.

---

## Arquivo modificado: `supabase/functions/dra-lia/index.ts`

### Mudança 1 — Inserir constante `TOPIC_WEIGHTS` + função `applyTopicWeights` (após linha 12)

Logo após `const GOOGLE_AI_KEY = Deno.env.get("GOOGLE_AI_KEY");`, antes de `const CHAT_API`:

```typescript
// ── Topic context re-ranking weights ─────────────────────────────────────────
// Applied post-search to reorder results toward the user's declared context.
// source_types: parameter_set, resin, processing_protocol,
//               article, video, catalog_product, company_kb
const TOPIC_WEIGHTS: Record<string, Record<string, number>> = {
  parameters: { parameter_set: 1.5, resin: 1.3, processing_protocol: 1.4, article: 0.7,  video: 0.6, catalog_product: 0.5, company_kb: 0.3 },
  products:   { parameter_set: 0.4, resin: 1.4, processing_protocol: 1.2, article: 1.2,  video: 0.8, catalog_product: 1.4, company_kb: 0.5 },
  commercial: { parameter_set: 0.2, resin: 0.5, processing_protocol: 0.3, article: 0.6,  video: 0.4, catalog_product: 0.8, company_kb: 2.0 },
  support:    { parameter_set: 0.6, resin: 0.7, processing_protocol: 0.8, article: 1.3,  video: 1.2, catalog_product: 0.5, company_kb: 0.4 },
};

function applyTopicWeights<T extends { source_type: string; similarity: number }>(
  results: T[],
  topicContext: string | undefined | null
): T[] {
  if (!topicContext || !TOPIC_WEIGHTS[topicContext]) return results;
  const weights = TOPIC_WEIGHTS[topicContext];
  return results
    .map(r => ({ ...r, similarity: r.similarity * (weights[r.source_type] ?? 1.0) }))
    .sort((a, b) => b.similarity - a.similarity);
}
```

**Por que constante de módulo:** usada em dois pontos distintos — dentro de `searchKnowledge` e no `allResults`. Uma única definição garante consistência e evita duplicação.

---

### Mudança 2 — Assinatura de `searchKnowledge` (linhas 894–898)

```typescript
// Antes:
async function searchKnowledge(
  supabase: ReturnType<typeof createClient>,
  query: string,
  lang: string
)

// Depois:
async function searchKnowledge(
  supabase: ReturnType<typeof createClient>,
  query: string,
  lang: string,
  topicContext?: string
)
```

---

### Mudança 3 — Re-ranking nos 4 pontos de retorno de `searchKnowledge`

| Linha | Método | O que muda |
|---|---|---|
| 909 | vector | `applyTopicWeights(data, topicContext)` antes do return; `topSimilarity` recalculado do array re-rankeado |
| 956 | ilike | `applyTopicWeights(merged, topicContext)` antes do return |
| 961 | fulltext | `applyTopicWeights(ftsResults, topicContext)` antes do return |
| 1024 | keyword | `applyTopicWeights(results, topicContext)` antes do return |

Padrão aplicado em todos os 4 pontos:
```typescript
const reranked = applyTopicWeights(data, topicContext);
return { results: reranked, method: "vector", topSimilarity: reranked[0]?.similarity || 0 };
```

---

### Mudança 4 — Passar `topic_context` na chamada de `searchKnowledge` (linha 1239)

```typescript
// Antes:
searchKnowledge(supabase, message, lang),

// Depois:
searchKnowledge(supabase, message, lang, topic_context),
```

`topic_context` já está disponível neste escopo (extraído na linha 1057).

---

### Mudança 5 — Re-ranking de `allResults` (linha 1255) — ponto mais crítico

```typescript
// Antes:
const allResults = [...paramResults, ...protocolResults, ...filteredKnowledge];

// Depois:
const allResults = applyTopicWeights(
  [...paramResults, ...protocolResults, ...filteredKnowledge],
  topic_context
);
```

Este é o ponto de maior impacto: é o bloco de texto enviado ao LLM. Com re-ranking aplicado aqui:
- Rota **Comercial**: `company_kb` (×2.0) sobe para o topo; `parameter_set` (×0.2) vai para o fundo
- Rota **Parâmetros**: `parameter_set` (×1.5) e `processing_protocol` (×1.4) dominam
- Rota **Sem seleção**: array retornado sem modificação — zero regressão

---

## Resultado por rota após implementação

| Rota | LLM recebe no topo | LLM recebe no fundo |
|---|---|---|
| 🖨️ Parâmetros | `parameter_set` (1.5x), `processing_protocol` (1.4x), `resin` (1.3x) | `company_kb` (0.3x) |
| 🔬 Produtos | `catalog_product` (1.4x), `resin` (1.4x), `article` (1.2x) | `parameter_set` (0.4x) |
| 💼 Comercial | `company_kb` (2.0x), `catalog_product` (0.8x) | `parameter_set` (0.2x), `processing_protocol` (0.3x) |
| 🛠️ Suporte | `article` (1.3x), `video` (1.2x) | `company_kb` (0.4x) |
| Sem seleção | Sem alteração — comportamento idêntico ao atual | — |

## Notas técnicas

- **Similaridade pode ultrapassar 1.0** (ex: 0.93 × 1.5 = 1.39) — correto e esperado. Os valores são usados apenas para ordenação, nunca em cálculos externos
- **Backward compatible** — `null` ou `undefined` em `topicContext` retorna o array inalterado
- **Zero alteração no banco** — nenhuma migration SQL
- **Zero alteração no frontend** — `topic_context` já é enviado pelo `DraLIA.tsx`
- **Deploy automático** após salvar o arquivo

## Resumo — apenas 1 arquivo, 5 intervenções cirúrgicas

| Intervenção | Linha(s) afetadas |
|---|---|
| `TOPIC_WEIGHTS` + `applyTopicWeights` inseridos | Após linha 12 |
| Assinatura de `searchKnowledge` ampliada | 894–898 |
| Re-ranking nos 4 `return` da função | 909, 956, 961, 1024 |
| `topic_context` passado na chamada | 1239 |
| `allResults` re-rankeado antes de chegar ao LLM | 1255 |
