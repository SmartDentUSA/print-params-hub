
# Bug: SDR Ignorada quando RAG não encontra resultados na Rota Comercial

## Causa raiz identificada

O fluxo da edge function tem uma **saída precoce** na linha 1332 que é chamada **antes** do LLM:

```
RAG search → filteredKnowledge vazia → hasResults = false → RETORNA FALLBACK HARDCODED
```

Quando o usuário escreve "quero saber de scanner intraoral" na rota comercial, o sistema de busca RAG não encontra nenhum resultado acima do threshold de similaridade (0.65 para vector search). Com `hasResults = false`, o código sai imediatamente com a mensagem "Ainda não tenho essa informação em nossa base de conhecimento" — sem chamar o LLM, sem aplicar a `SDR_COMMERCIAL_INSTRUCTION`, sem usar o `companyContext`.

A instrução SDR nunca é executada porque ela está no `systemPrompt` do LLM, mas o código nunca chega ao LLM neste caminho.

---

## Por que acontece especificamente no comercial

A rota comercial faz perguntas sobre **entidade/produto** ("scanner intraoral", "Medit"), não sobre processos técnicos. O índice RAG foi majoritariamente populado com artigos técnicos, parâmetros e protocolos — não com fichas de produto completas. Logo, perguntas comerciais sobre hardware têm baixa similaridade vetorial e caem no fallback com frequência.

Na rota de Parâmetros, o usuário pergunta "tempo de cura da Vitality" e o RAG encontra o conjunto de parâmetros facilmente. Na rota Comercial, o usuário pergunta "quanto custa o scanner" e o RAG não tem esse dado indexado — zero resultados, zero LLM, zero SDR.

---

## A correção: bypass do fallback hardcoded quando topic_context === "commercial"

### Arquivo: `supabase/functions/dra-lia/index.ts`

### Mudança única — Bloco `if (!hasResults)` na linha 1332

**Lógica atual:**
```typescript
const hasResults = allResults.length > 0;

// 4. If no results: return human fallback
if (!hasResults) {
  const fallbackText = FALLBACK_MESSAGES[lang] || FALLBACK_MESSAGES["pt-BR"];
  // ... retorna resposta hardcoded sem chamar o LLM
  return new Response(stream, ...);
}
```

**Lógica corrigida:**
```typescript
const hasResults = allResults.length > 0;

// 4. If no results AND not commercial route: return human fallback
// In commercial context: proceed to LLM with SDR instruction + company context
// (SDR proibition: NUNCA responda "Não sei" para questões comerciais)
if (!hasResults && topic_context !== "commercial") {
  const fallbackText = FALLBACK_MESSAGES[lang] || FALLBACK_MESSAGES["pt-BR"];
  // ... retorna resposta hardcoded (inalterado)
  return new Response(stream, ...);
}
```

A única mudança é adicionar `&& topic_context !== "commercial"` na condição do if.

---

## O que muda com a correção

Quando `topic_context === "commercial"` e `hasResults === false`:

1. O código **não retorna** o fallback hardcoded
2. O fluxo **continua** para a construção do `systemPrompt`
3. O `topicInstruction` injeta a `SDR_COMMERCIAL_INSTRUCTION` completa
4. O `companyContext` (dados da empresa: NPS, contatos, endereço) já foi buscado em paralelo e está disponível
5. O LLM recebe a instrução SDR + dados institucionais e **aplica o roteiro consultivo**

O LLM, com a instrução SDR ativa, irá responder consultivamente: propor agendamento para scanner (alta complexidade), em vez de dizer que não sabe.

---

## Simulação do fluxo corrigido

**Pergunta:** "quero saber de scanner intraoral" (rota: commercial)

| Etapa | Antes da correção | Depois da correção |
|---|---|---|
| RAG search | 0 resultados acima do threshold | 0 resultados acima do threshold |
| `hasResults` | `false` | `false` |
| Condição `if (!hasResults)` | `true` → entra no bloco | `false` (commercial) → pula o bloco |
| Resposta gerada por | Fallback hardcoded | LLM com SDR + companyContext |
| Conteúdo da resposta | "Ainda não tenho essa informação..." | "Dr(a)., percebi o seu interesse no scanner. Para eu ser mais assertiva: o senhor já atua com fluxo digital ou está planeando o primeiro centro de impressão?" |

---

## Segurança da mudança

- **Rotas `parameters`, `products`, `support`:** comportamento idêntico ao atual — fallback hardcoded quando não há resultados
- **Rota `commercial` com resultados RAG:** comportamento idêntico ao atual — SDR já funcionava nesses casos
- **Rota `commercial` sem resultados RAG:** correção do bug — fluxo chega ao LLM
- **Sem seleção de rota:** comportamento idêntico — `topic_context` é `null`, condição original se mantém
- **Zero alteração no banco, zero alteração no frontend**

---

## Resumo — 1 arquivo, 1 linha modificada

| Arquivo | Mudança |
|---|---|
| `supabase/functions/dra-lia/index.ts` | Linha 1332: `if (!hasResults)` → `if (!hasResults && topic_context !== "commercial")` |
