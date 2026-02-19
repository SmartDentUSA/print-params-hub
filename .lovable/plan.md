
# Correção: Alucinação por Contexto de Baixa Relevância (RAG Pollution)

## Diagnóstico Preciso

### O que aconteceu
A L.I.A. respondeu sobre "ATOS Smart Ortho" (adesivo ortodôntico) quando o usuário não perguntou explicitamente sobre esse produto. Isso é uma **alucinação por contexto poluído**.

### Cadeia de causa e efeito

```text
Usuário escreveu algo com "ortho" (ex: "resina ortho" ou similar)
        ↓
searchByILIKE encontra artigo de "ATOS Smart Ortho" via .ilike.%ortho%
        ↓
Resultado retorna com similarity = 0.3 (fixo, não real)
        ↓
MIN_SIMILARITY = 0.05 → resultado passa o filtro
        ↓
Contexto entra no system prompt como fonte "relevante"
        ↓
LLM usa o artigo do ATOS Smart Ortho para responder — alucinação de relevância
```

### Código-raiz do problema

**Linha 1073 — Threshold irreal:**
```typescript
const MIN_SIMILARITY = method === "vector" ? 0.65 : 0.05;
//                                                   ^^^^ extremamente permissivo
```

**Linha 129 — Similaridade ILIKE é flat, não reflete relevância real:**
```typescript
similarity: 0.3, // Relevância intermediária — acima de resultados FTS fracos
```
Qualquer artigo que contenha uma única palavra de 3+ letras da query recebe score 0.3 e entra no contexto.

**Linhas 103-108 — ILIKE ordena por palavras no título, mas não filtra por relevância mínima:**
```typescript
const scoreA = words.filter(w => a.title.toLowerCase().includes(w)).length;
// scoreA pode ser 1 para um artigo que só tem 1 palavra em comum — mas ainda entra
```

---

## Solução: 3 Camadas de Proteção

### Camada 1 — Elevar MIN_SIMILARITY para métodos não-vetoriais

Mudar de `0.05` para `0.20` para ILIKE e de `0.05` para `0.10` para FTS:

```typescript
// Antes:
const MIN_SIMILARITY = method === "vector" ? 0.65 : 0.05;

// Depois:
const MIN_SIMILARITY = method === "vector" ? 0.65 
  : method === "ilike" ? 0.20 
  : 0.10; // fulltext
```

Isso força os resultados ILIKE a terem pelo menos `similarity >= 0.20`. Como ILIKE usa `similarity: 0.3` flat, isso significa que só passam se o scoreamento de título tiver pelo menos alguma relevância real.

### Camada 2 — Calcular similaridade ILIKE proporcional ao score

Em vez de atribuir `similarity: 0.3` flat para todos os resultados ILIKE, calcular a similaridade com base na proporção de palavras da query encontradas no título:

```typescript
// Antes (linha 129):
similarity: 0.3, // flat para todos

// Depois: proporcional ao score de palavras no título
// score = número de palavras da query encontradas no título
// max = total de palavras da query (mínimo 1)
// similarityScore = (score / words.length) * 0.4 + 0.1
// Exemplo: 1/1 palavra encontrada → 0.5 | 1/4 palavras → 0.2
```

Isso diferencia artigos onde **todas** as palavras da query estão no título (alta relevância) vs artigos onde apenas 1 palavra de 4 está (baixa relevância).

### Camada 3 — Instrução adicional no System Prompt para contexto fraco

Adicionar à seção de regras anti-alucinação uma regra nova:

```
18. CONTEXTO FRACO → PERGUNTA CLARIFICADORA: Se os dados das fontes não mencionam diretamente 
o produto, resina ou tema que o usuário perguntou, NÃO invente uma resposta com o que está 
disponível. Em vez disso, pergunte: "Para te ajudar com precisão, você poderia confirmar 
qual produto ou resina específica você está buscando informações?"
Sinais de contexto fraco: o contexto fala sobre produto X mas o usuário mencionou produto Y, 
ou o contexto é sobre categoria diferente da pergunta.
```

---

## Tabela de Arquivos Modificados

| Arquivo | Seção | Ação |
|---|---|---|
| `supabase/functions/dra-lia/index.ts` | Linha ~129 (searchByILIKE) | Similaridade proporcional ao score em vez de 0.3 flat |
| `supabase/functions/dra-lia/index.ts` | Linha ~1073 (MIN_SIMILARITY) | Threshold diferenciado por método de busca |
| `supabase/functions/dra-lia/index.ts` | Linha ~1199 (system prompt) | Regra 18 — Contexto Fraco → Pergunta Clarificadora |

---

## Tabela de Validação

| Cenário | Antes | Depois |
|---|---|---|
| Pergunta vaga com palavra "ortho" | ATOS Smart Ortho inventado como resposta | Pergunta clarificadora: "Qual produto ou resina você busca?" |
| Pergunta específica "Smart Print Ortho" | Pode trazer contexto errado | Traz o artigo correto (smart + print + ortho = 3 matches → alta similaridade) |
| "Vitality" + "Elegoo Mars 4 Ultra" | Continua funcionando (paramResults prioritário) | Comportamento mantido |
| "protocolo de limpeza da Vitality" | Continua funcionando (processamento match direto) | Comportamento mantido |
| Pergunta com palavra rara/específica | ILIKE retorna artigo tangencialmente relacionado | Threshold elevado filtra artigos com match fraco |
