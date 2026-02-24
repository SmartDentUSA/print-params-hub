
# Auditoria Profunda: Mecanismo de Inteligencia da LIA

## Escopo Auditado

| Componente | Arquivo | Linhas |
|---|---|---|
| Motor principal (RAG + chat) | `dra-lia/index.ts` | 2436 |
| Judge anti-alucinacao | `evaluate-interaction/index.ts` | 144 |
| Indexador de embeddings | `index-embeddings/index.ts` | 852 |
| Auto-heal de lacunas | `heal-knowledge-gaps/index.ts` | 492 |
| Arquivo de conversas | `archive-daily-chats/index.ts` | 178 |
| System prompt (SEO) | `_shared/system-prompt.ts` | 220 |
| Regras de extracao | `_shared/extraction-rules.ts` | 118 |

---

## PROBLEMAS ENCONTRADOS

### CRITICO 1: Modelos de fallback invalidos (dra-lia)

**Arquivo:** `dra-lia/index.ts` linhas 2221-2238

A chain de fallback usa modelos que NAO existem no gateway Lovable AI:
- Fallback 2: `openai/gpt-4o-mini` -- NAO EXISTE
- Fallback 3: `openai/gpt-4.1-mini` -- NAO EXISTE

Modelos validos sao: `openai/gpt-5-mini`, `openai/gpt-5-nano`, `google/gemini-2.5-flash-lite`.

Se o Gemini falhar, os fallbacks OpenAI vao retornar erro 400/404 e a LIA ficara sem resposta.

**Correcao:**
```
Primario:  google/gemini-2.5-flash (manter)
Fallback 1: google/gemini-2.5-flash-lite (manter)
Fallback 2: openai/gpt-5-mini (corrigir)
Fallback 3: openai/gpt-5-nano (corrigir)
```

### CRITICO 2: Playbook `extra_data` NAO chega ao contexto RAG em tempo real

As memorias indicam que Product Playbooks (`technical_specs`, `competitor_comparison`, `clinical_brain`, `workflow_stages`) estao armazenados em `system_a_catalog.extra_data`. Porem:

- `searchCatalogProducts()` (linha 1093-1156) seleciona apenas `id, name, description, product_category, product_subcategory, cta_1_url, slug, price, promo_price` -- **NAO le `extra_data`**.
- O `index-embeddings` indexa `benefits` e `faq` do `extra_data`, mas NAO indexa `technical_specs`, `competitor_comparison`, `clinical_brain` ou `workflow_stages`.

Resultado: regras anti-alucinacao por produto (`clinical_brain`) e comparacoes com concorrentes NUNCA chegam ao agente.

**Correcao em 2 partes:**
1. `searchCatalogProducts()`: adicionar `extra_data` ao SELECT e incluir `clinical_brain` + `technical_specs` no `chunk_text`
2. `index-embeddings`: criar chunks adicionais para `clinical_brain`, `competitor_comparison` e `workflow_stages`

### CRITICO 3: `searchProcessingInstructions` retorna resinas aleatorias quando nenhuma match

**Arquivo:** `dra-lia/index.ts` linhas 1194-1196

```typescript
const matched = scored.filter((x) => x.score > 0);
const targets = matched.length > 0 ? matched : scored; // <-- TODOS os resins!
```

Se o usuario perguntar "como limpar?" sem mencionar resina, o sistema retorna 3 resinas aleatorias como protocolo. Isso pode causar alucinacao: o LLM pode citar protocolos de uma resina errada.

**Correcao:** Quando `matched.length === 0`, retornar array vazio em vez de resinas aleatorias. O system prompt ja tem regra 21 (contexto fraco = frase de seguranca).

### ALTO 4: Modelo desatualizado no `heal-knowledge-gaps`

**Arquivo:** `heal-knowledge-gaps/index.ts` linha 82

Usa `google/gemini-2.5-flash` para gerar FAQ drafts. Deveria usar `google/gemini-3-flash-preview` (modelo padrao recomendado).

### MEDIO 5: `searchCatalogProducts` nao filtra por produto especifico

Quando o usuario pergunta sobre um produto especifico (ex: "NanoClean Pod"), a funcao retorna ate 20 produtos da mesma categoria, inundando o contexto com dados irrelevantes. Falta um filtro por nome/palavra-chave no `name` do produto.

**Correcao:** Adicionar score de relevancia baseado em match de palavras do `name` contra a query, e filtrar so os top 5 mais relevantes (em vez de 20).

### MEDIO 6: `context_raw` truncado em 8000 chars pode causar falsos positivos no Judge

**Arquivo:** `dra-lia/index.ts` linha 2272

O `context_raw` e truncado em 8000 chars antes de salvar. O Judge (`evaluate-interaction`) recebe esse contexto truncado. Se dados tecnicos relevantes estiverem alem dos 8000 chars, o Judge classificara como "hallucination" incorretamente.

**Correcao:** Aumentar para 12000 chars ou priorizar os chunks com maior similaridade no contexto salvo.

### MEDIO 7: Threshold de similaridade vetorial vs ILIKE inconsistente

| Metodo | Threshold | Nota |
|---|---|---|
| Vector | 0.65 | OK - rigoroso |
| FTS | 0.10 | Muito baixo - lixo passa |
| ILIKE | 0.20 | Baixo |

A regra 21 do system prompt diz "se topSimilarity < 0.50 use frase de seguranca" mas isso depende do LLM auto-aplicar. Se FTS retorna resultados com similarity 0.15, eles entram no contexto mesmo sendo irrelevantes.

**Correcao:** Aumentar threshold minimo de FTS de 0.10 para 0.20 para reduzir ruido.

### MEDIO 8: `searchByILIKE` e `searchCompanyKB` com filtros de tamanho inconsistentes

- `searchByILIKE` filtra palavras `>= 3` chars
- `searchCompanyKB` filtra palavras `>= 4` chars

Isso significa que "BLZ" (3 chars, nome de scanner) e encontrado por ILIKE nos artigos mas NAO e encontrado no company_kb.

**Correcao:** Padronizar ambos para `>= 3` chars.

### BAIXO 9: `_shared/system-prompt.ts` nao e usado pela LIA

O arquivo `system-prompt.ts` contem regras anti-alucinacao excelentes (`ANTI_HALLUCINATION_RULES`, `SYSTEM_SUPER_PROMPT`) mas NAO e importado pelo `dra-lia/index.ts`. E usado apenas pelas funcoes de SEO/conteudo.

**Status:** Intencional -- a LIA tem seu proprio system prompt inline. Mas as regras poderiam ser consolidadas para evitar divergencia.

**Acao:** Nenhuma correcao necessaria agora, apenas registro.

### BAIXO 10: `archive-daily-chats` nao inclui `topic_context` na classificacao

O classificador heuristico (`classifyInteraction`) usa apenas `contextSources` e `userMsg`, mas nao usa o `topic_context` que a sessao ja tem. Isso pode classificar uma conversa de rota "commercial" como "suporte" se o usuario perguntou sobre configuracao de produto.

**Acao:** Melhoria futura, nao critica.

---

## PLANO DE CORRECOES

### Prioridade 1 -- Bug Fixes Criticos

| # | Arquivo | Mudanca |
|---|---|---|
| 1 | `dra-lia/index.ts` L2229-2238 | Corrigir fallback models para `openai/gpt-5-mini` e `openai/gpt-5-nano` |
| 2 | `dra-lia/index.ts` L1194-1196 | `searchProcessingInstructions`: retornar `[]` quando nenhuma resina match (em vez de aleatorias) |

### Prioridade 2 -- Anti-Alucinacao

| # | Arquivo | Mudanca |
|---|---|---|
| 3 | `dra-lia/index.ts` L1093-1156 | `searchCatalogProducts`: adicionar `extra_data` ao SELECT; incluir `clinical_brain` e `technical_specs` no chunk_text |
| 4 | `dra-lia/index.ts` L1820-1822 | Aumentar threshold FTS de 0.10 para 0.20 |
| 5 | `dra-lia/index.ts` L2272 | Aumentar truncamento de `context_raw` de 8000 para 12000 |
| 6 | `dra-lia/index.ts` L1148-1155 | `searchCatalogProducts`: filtrar top 5 por relevancia de nome em vez de retornar 20 |

### Prioridade 3 -- Consistencia

| # | Arquivo | Mudanca |
|---|---|---|
| 7 | `dra-lia/index.ts` L314-318 | `searchCompanyKB`: mudar filtro de `>= 4` para `>= 3` chars |
| 8 | `heal-knowledge-gaps/index.ts` L82 | Atualizar modelo de `gemini-2.5-flash` para `gemini-3-flash-preview` |

### Prioridade 4 -- Indexacao (index-embeddings)

| # | Arquivo | Mudanca |
|---|---|---|
| 9 | `index-embeddings/index.ts` L703-772 | Adicionar chunks para `clinical_brain`, `competitor_comparison` e `workflow_stages` do `extra_data` |

### Deploy

Apos correcoes, deploy de: `dra-lia`, `heal-knowledge-gaps`, `index-embeddings`

---

## RESUMO EXECUTIVO

| Tipo | Qtd | Impacto |
|---|---|---|
| Modelos de fallback invalidos | 2 modelos | CRITICO -- LIA sem resposta se Gemini falhar |
| Playbook data nao chega ao agente | 4 campos ignorados | CRITICO -- anti-alucinacao por produto nao funciona |
| Protocolos aleatorios injetados | 1 funcao | CRITICO -- resinas erradas no contexto |
| Threshold FTS muito baixo | 1 config | MEDIO -- ruido no contexto |
| context_raw truncado | 1 config | MEDIO -- falsos positivos no Judge |
| Filtro de catalogo impreciso | 1 funcao | MEDIO -- contexto poluido |
| Inconsistencia de filtro de palavras | 1 funcao | BAIXO |
| Modelo desatualizado heal-gaps | 1 funcao | BAIXO |

**Total: 9 correcoes em 3 edge functions + 1 indexador**
