
# Reestruturacao da Rota Comercial da Dra. L.I.A. — Consultora Especialista

## Visao Geral

Transformar a rota comercial (`topic_context === "commercial"`) de um chatbot reativo com regras rigidas em uma consultora com conversa natural, que usa o maximo dos dados internos (1.377 embeddings, 271 transcrições de video, 273 produtos do catalogo) sem alucinar.

A implementacao se divide em 3 fases incrementais, cada uma deployavel independentemente.

---

## FASE 1 — Reestruturacao do System Prompt Comercial (Impacto Imediato)

### Problema atual
O `SDR_COMMERCIAL_INSTRUCTION` tem ~2.500 tokens de regras empilhadas (REGRA #1, #2, #3...) que o LLM trata como checklist robotico. O system prompt total passa de 6.000 tokens, competindo com o contexto RAG por espaco de atencao.

### Solucao: Prompt Modular Dinamico

**Arquivo:** `supabase/functions/dra-lia/index.ts`

Substituir o bloco monolitico `SDR_COMMERCIAL_INSTRUCTION` por uma funcao `buildCommercialPrompt()` que monta o prompt em modulos baseados no estado real do lead:

```text
Modulo 1: PERSONA (fixo, ~200 tokens)
  "Voce e a Dra. L.I.A., consultora especialista da Smart Dent.
   Conversa natural, como colega que entende profundamente.
   2-3 frases por mensagem. 1 pergunta por vez."

Modulo 2: ESTADO DO LEAD (dinamico, ~100 tokens)
  Injetado com base nos extracted_entities da sessao:
  "Lead: [nome], especialidade: [X], equipamento: [Y],
   Etapa atual: Apresentacao de solucao."

Modulo 3: INSTRUCAO DE TURNO (dinamico, ~150 tokens)
  Baseado no spin_stage detectado:
  - etapa_1: "Pergunte qual produto/solucao interessa"
  - etapa_2: "Faca UMA pergunta de contexto"
  - etapa_3: "Apresente a solucao usando os DADOS DAS FONTES"
  - etapa_4+: "Ofereca agendamento/link da loja"

Modulo 4: REGRAS ANTI-ALUCINACAO COMERCIAL (fixo, ~200 tokens)
  Versao condensada: apenas 3 regras essenciais
  (nao inventar precos, nao inventar produtos, seguranca p/ scanner)
```

**Resultado:** Prompt comercial de ~650 tokens (vs ~2.500 atual), liberando espaco para contexto RAG.

### Mudancas tecnicas no codigo

1. Criar funcao `buildCommercialInstruction(sessionEntities, spinStage)` que retorna string
2. Substituir a constante `SDR_COMMERCIAL_INSTRUCTION` pela chamada dinamica
3. Mover a logica SPIN progress (linhas 1874-1932) para ANTES da montagem do prompt (ja acontece, apenas reorganizar)
4. Remover duplicacoes de regras que ja existem nas "17 Diretrizes" do prompt base

---

## FASE 2 — Contexto RAG Estruturado por Secoes Semanticas

### Problema atual
O contexto e montado como texto corrido (linhas 1845-1863):
```
[CATALOG_PRODUCT] Smart Lab + Asiga MAX 2... | URL: /produtos/...
[ARTICLE] Impressao 3D em Odontologia... | URL: /base-conhecimento/...
[COMPANY_KB] Script SDR treinamento...
```
O LLM nao sabe qual dado usar para persuasao vs informacao tecnica vs resposta direta.

### Solucao: Contexto Rotulado por Intencao

**Arquivo:** `supabase/functions/dra-lia/index.ts`

Modificar a montagem do contexto (linhas 1845-1863) para agrupar resultados por funcao semantica:

```text
## PRODUTOS RECOMENDADOS (use para sugestoes e apresentacao)
[dados de catalog_product e resin]

## ARGUMENTOS DE VENDA E EXPERTISE (use para persuasao e objecoes)
[dados de company_kb com source_label: sdr, comercial, objecoes]

## ARTIGOS TECNICOS RELEVANTES (cite se o lead pedir detalhes)
[dados de article]

## VIDEOS DISPONIVEIS (mencione APENAS se solicitado)
[dados de video — apenas titulo e URL]

## PARAMETROS TECNICOS (cite apenas se perguntado)
[dados de parameter_set e processing_protocol]
```

### Mudancas tecnicas

1. Criar funcao `buildStructuredContext(allResults)` que agrupa por `source_type` e gera o texto rotulado
2. Adicionar instrucao no system prompt: "Cada secao tem uma funcao. Use PRODUTOS para apresentar, ARGUMENTOS para convencer, ARTIGOS para aprofundar."
3. Manter a secao "--- DADOS DAS FONTES ---" mas com a estrutura semantica interna

---

## FASE 3 — Expansao Automatica do Brain Feeder via Transcricoes de Video

### Dados atuais
- `company_kb_texts`: apenas 5 textos manuais (1 sdr, 1 comercial, 1 suporte, 2 dialogos)
- 271 videos com transcricoes completas (nao utilizadas para expertise comercial)
- 273 produtos no catalogo com FAQs e descricoes

### Solucao: Edge Function de Extracao de Expertise

**Novo arquivo:** `supabase/functions/extract-commercial-expertise/index.ts`

Funcao que:
1. Le transcricoes de videos que mencionam produtos do catalogo
2. Envia ao LLM com prompt de extracao estruturada (tool calling):
   - Beneficios-chave do produto
   - Comparacoes com concorrentes (se mencionadas)
   - Objecoes respondidas no video
   - Casos de uso clinico citados
3. Salva o resultado em `company_kb_texts` com:
   - `category: 'comercial'`
   - `source_label: 'expertise-video-[produto]'`
   - `title: 'Expertise: [Nome do Produto] — [tipo: beneficios/objecoes/casos]'`

### Schema do tool calling para extracao

```typescript
tools: [{
  type: "function",
  function: {
    name: "extract_expertise",
    parameters: {
      type: "object",
      properties: {
        product_name: { type: "string" },
        benefits: { type: "array", items: { type: "string" } },
        objections_handled: { type: "array", items: {
          type: "object",
          properties: {
            objection: { type: "string" },
            response: { type: "string" }
          }
        }},
        clinical_cases: { type: "array", items: { type: "string" } },
        competitive_advantages: { type: "array", items: { type: "string" } }
      }
    }
  }
}]
```

### Processo de execucao

- Batch: processar 10 videos por invocacao (evitar timeout de 60s)
- Filtro: apenas videos com `video_transcript.length > 500` e que mencionem produtos do catalogo
- Deduplicacao: `UNIQUE(title, source_label)` ja existe na tabela
- Apos salvar em `company_kb_texts`, chamar `index-embeddings?stage=company_kb` para indexar

### Volume estimado

- 271 transcricoes disponiveis
- ~40-60% mencionam produtos especificos = ~120 textos de expertise
- Com chunking de 900 chars = ~200-300 chunks novos no RAG
- Peso do `company_kb` na rota comercial: 1.5x (ja configurado)

---

## FASE 2.5 — Correcao do Judge (evaluate-interaction)

### Problema atual (40% falsos positivos)
O prompt do Judge nao reconhece dados de `catalog_product` como contexto valido. Quando a LIA cita preco ou FAQ de um produto do catalogo, o Judge classifica como "hallucination" porque so procura dados em format RAG tradicional.

### Solucao

**Arquivo:** `supabase/functions/evaluate-interaction/index.ts`

Adicionar ao `judgePrompt`:

```text
ATENCAO: O contexto RAG inclui multiplas fontes:
- [CATALOG_PRODUCT]: dados de produtos com precos, FAQs e descricoes — SAO CONTEXTO VALIDO
- [PROCESSING_PROTOCOL]: instrucoes de processamento de resinas — SAO CONTEXTO VALIDO
- [COMPANY_KB]: conhecimento comercial e scripts — SAO CONTEXTO VALIDO
- [PARAMETER_SET]: parametros de impressao — SAO CONTEXTO VALIDO

Se a IA citou um dado que aparece em QUALQUER uma dessas fontes no contexto, NAO e alucinacao.
So classifique como "hallucination" se o dado tecnico REALMENTE nao existe em nenhuma parte do contexto.
```

### Resultado esperado
- Falsos positivos devem cair de ~40% para ~5-10%
- Taxa real de hallucination sera mensuravel com precisao
- Interacoes com score >= 4 aumentarao, populando o dataset de fine-tuning

---

## Ajuste nos Topic Weights para Rota Comercial

### Peso atual
```
commercial: { catalog_product: 2.5, company_kb: 1.5, article: 0.4, video: 0.3, ... }
```

### Ajuste proposto
```
commercial: { catalog_product: 2.0, company_kb: 2.0, article: 0.6, video: 0.5, resin: 0.8, ... }
```

Justificativa: elevar `company_kb` para 2.0 (sera a fonte principal de expertise apos Fase 3), elevar `resin` para 0.8 (resinas sao produtos vendaveis na rota comercial), e subir `article` e `video` levemente para permitir que a LIA cite artigos e videos quando relevantes.

---

## Resumo de Arquivos Modificados

| Arquivo | Fase | Tipo de Mudanca |
|---------|------|-----------------|
| `supabase/functions/dra-lia/index.ts` | 1, 2 | Refatorar prompt comercial + contexto estruturado + pesos |
| `supabase/functions/evaluate-interaction/index.ts` | 2.5 | Corrigir prompt do Judge |
| `supabase/functions/extract-commercial-expertise/index.ts` | 3 | Nova edge function |

## Ordem de Implementacao Recomendada

1. **Fase 1** — Prompt modular (impacto imediato, risco baixo)
2. **Fase 2.5** — Correcao do Judge (desbloqueia metricas reais)
3. **Fase 2** — Contexto estruturado (melhora qualidade das respostas)
4. **Fase 3** — Expansao do Brain Feeder (escala o conhecimento)

Cada fase pode ser deployada e testada independentemente. A Fase 1 sozinha ja deve produzir respostas visivelmente mais naturais e menos roboticas na rota comercial.
