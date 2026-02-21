

# Blindagem Completa da Dra. L.I.A. — 6 Frentes de Correção

## Resumo das Mudancas

Arquivo unico: `supabase/functions/dra-lia/index.ts` (2.209 linhas)

---

## 1. Blindagem do System Prompt (Regras 21, 22, 23)

Adicionar 3 novas regras ao bloco "REGRAS ANTI-ALUCINACAO" (apos linha 1944):

```
21. CONTEXTO FRACO = FRASE DE SEGURANCA OBRIGATORIA:
    Se o topSimilarity < 0.50 OU nenhum resultado RAG corresponde ao tema da pergunta,
    use OBRIGATORIAMENTE uma destas frases:
    - "Nao tenho essa informacao especifica cadastrada no momento."
    - "Vou confirmar com o time tecnico e te trago a resposta exata."
    Seguida do link WhatsApp. NUNCA improvise uma resposta com dados genericos.

22. PROIBIDO INVENTAR DADOS COMERCIAIS:
    Precos, prazos de entrega, condicoes de pagamento, disponibilidade de estoque
    e garantia so podem ser citados se aparecerem EXPLICITAMENTE nos DADOS DAS FONTES.
    Para qualquer dado comercial ausente: "Para informacoes comerciais atualizadas,
    posso te conectar com nosso time: [Falar com especialista](https://wa.me/5516993831794)"

23. PROIBIDO INVENTAR DADOS TECNICOS:
    Temperaturas, tempos de cura, layer heights, velocidades e protocolos
    so podem ser citados se aparecerem EXPLICITAMENTE nos DADOS DAS FONTES
    (campos PROCESSING_PROTOCOL ou PARAMETER_SET).
    Se ausentes: "Nao tenho os parametros exatos para essa configuracao.
    Recomendo verificar com nosso suporte tecnico."
```

---

## 2. Eliminacao de Scores Magicos

Substituir todos os similarity fixos por valores calculados reais:

| Local | Antes | Depois |
|-------|-------|--------|
| `searchCatalogProducts` (linha 1115) | `similarity: 0.90` | `similarity: matchedWords / totalWords * 0.6 + 0.3` (proporcional a palavras matched no nome/descricao) |
| `searchProcessingInstructions` (linha 1176) | `similarity: 0.95` | `similarity: score > 0 ? Math.min(score / maxPossible * 0.5 + 0.5, 0.95) : 0.40` (proporcional a palavras da resina na query) |
| `searchParameterSets` (linha 1242) | `similarity: resinMatched ? 0.93 : 0.78` | `similarity: resinMatched ? 0.85 : 0.60` (reduzidos, sem inflacao) |
| Video keyword search (linha 1382) | `similarity: 0.50` | Manter 0.50 (ja e baixo, aceitavel) |
| `topSimilarity` override (linhas 1697-1699) | `protocolResults.length > 0 ? 0.95 : ...` | `Math.max(...allResults.map(r => r.similarity), 0)` (usar o MAX real de todos os resultados) |

---

## 3. Saneamento de Knowledge Gaps

Adicionar filtro no inicio de `upsertKnowledgeGap` (linha 1020):

```typescript
// Filtro anti-lixo: ignorar mensagens curtas e ruido
const NOISE_PATTERNS = /^(oi|ola|olá|hey|hi|hola|obrigad|valeu|ok|sim|não|nao|lia|ooe|tchau|bye|gracias|thanks|tudo bem|beleza|show|legal|massa|top)\b/i;
if (question.trim().length < 10 || NOISE_PATTERNS.test(question.trim())) {
  return; // silently skip noise
}
```

---

## 4. Resiliencia no External KB

Atualizar `fetchCompanyContext` (linhas 119-185):

- Adicionar retry (1x) com delay de 1s antes de usar fallback
- Adicionar `console.warn` com timestamp quando fallback for ativado
- Manter timeout de 3s por tentativa (total maximo: 7s)

```typescript
async function fetchCompanyContext(): Promise<string> {
  const FALLBACK = `...`; // manter igual

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (response.ok) {
        // ... parse e retorna
      }
      console.warn(`[fetchCompanyContext] HTTP ${response.status} (attempt ${attempt + 1})`);
    } catch (err) {
      console.warn(`[fetchCompanyContext] Failed attempt ${attempt + 1}: ${err}`);
    }
    if (attempt === 0) await new Promise(r => setTimeout(r, 1000)); // wait 1s before retry
  }
  console.warn(`[fetchCompanyContext] ALL ATTEMPTS FAILED — using hardcoded fallback`);
  return FALLBACK;
}
```

---

## 5. Refino de Leads e Performance

### 5a. Email Regex RFC-compliant (linha 795)

```
Antes:  /[\w.+-]+@[\w-]+\.[\w.-]+/
Depois: /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*/
```

Suporta dominios `.com.br`, emails com `+`, e caracteres especiais permitidos pelo RFC 5322.

### 5b. max_tokens comercial: 512 -> 768 (linha 1988)

```
Antes:  max_tokens: isCommercial ? 512 : 1024
Depois: max_tokens: isCommercial ? 768 : 1024
```

Garante apresentacoes de ROI e precos completas sem truncamento.

---

## 6. Preservacao da Etapa 0 (Lead Collection)

Nenhuma alteracao na logica de coleta de leads. O fluxo Nome -> Email -> Persistencia permanece intacto:
- `detectLeadCollectionState` (linhas 777-868): mantido
- `upsertLead` (linhas 884-926): mantido
- Interceptadores pre-RAG (linhas 1429-1516): mantidos
- A normalizacao de espacos no email (`.replace(/\s*@\s*/g, '@')`) ja aplicada anteriormente: mantida

---

## Deploy

Redeploy da edge function `dra-lia` apos todas as alteracoes.

