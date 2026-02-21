# Auditoria Técnica Completa: Dra. L.I.A. — Sistema de IA Conversacional SmartDent

**Data da Auditoria**: 2026-02-21
**Verificado com dados reais**: ✅ Sim (queries diretas no banco de produção)

---

## 1. ARQUITETURA GERAL

O sistema é composto por 4 edge functions principais e 1 função de banco de dados:

```text
+-------------------+     +--------------------+     +---------------------+
|   Frontend React  |---->|  dra-lia (chat)     |---->| Gemini 2.5 Flash    |
|   (DraLIA.tsx)    |     |  ~2.200 linhas      |     | via Lovable Gateway |
+-------------------+     +--------------------+     +---------------------+
                                |    |    |
                    +-----------+    |    +----------+
                    v                v               v
            +-----------+  +----------------+  +------------+
            | index-    |  | evaluate-      |  | dra-lia-   |
            | embeddings|  | interaction    |  | export     |
            | (RAG)     |  | (Judge IA)     |  | (JSONL)    |
            +-----------+  +----------------+  +------------+
```

### Edge Functions Deployadas

| Função | Linhas | JWT | Status |
|--------|--------|-----|--------|
| `dra-lia` | ~2.200 | false | ✅ ATIVO |
| `index-embeddings` | ~800 | false | ✅ ATIVO |
| `evaluate-interaction` | ~300 | false | ✅ ATIVO |
| `dra-lia-export` | ~128 | false | ✅ ATIVO (requer auth manual) |

---

## 2. FLUXO COMPLETO DA CONVERSA (Pipeline)

### Etapa 0: Interceptadores Pré-RAG (sem IA)

| Ordem | Interceptador | Condição | Ação | Status |
|-------|--------------|----------|------|--------|
| 1 | Lead Collection: needs_name | Sem nome na sessão | Pede nome (sem RAG) | ✅ ATIVO |
| 2 | Lead Collection: needs_email | Tem nome, sem email | Pede email (sem RAG) | ✅ ATIVO |
| 3 | Lead Collection: collected | Nome + email | Salva lead, confirma | ✅ ATIVO |
| 4 | Support Guard | Regex de problema técnico | Redireciona WhatsApp | ✅ ATIVO |
| 5 | Guided Printer Dialog | Regex de parâmetros | Fluxo marca>modelo>resina | ✅ ATIVO |

### Etapa 1: Busca RAG (Retrieval)

Busca paralela em 4 fontes:

| Fonte | Função | Condição de Ativação | Prioridade (similarity) |
|-------|--------|---------------------|------------------------|
| Knowledge Base (artigos/vídeos) | searchKnowledge() | Sempre | 0.10 - 0.95 (variável) |
| Processing Instructions | searchProcessingInstructions() | Regex de protocolo | ⚠️ 0.95 (fixo) |
| Parameter Sets | searchParameterSets() | Não é rota comercial | ⚠️ 0.78 - 0.93 |
| Catalog Products | searchCatalogProducts() | topic_context === "commercial" | ⚠️ 0.90 (fixo) |

### Etapa 2: Busca Knowledge Base — Cascata de 4 métodos

```text
1. Vector Search (pgvector + Gemini Embedding 001)
   threshold: 0.65 | match_count: 10
   |
   v (se falhar)
2. Full-Text Search (search_knowledge_base RPC, tsvector português)
   threshold: 0.10
   |
   v (se fraco: 0-2 resultados com relevance < 0.25)
3. ILIKE Search (busca no título/excerpt/ai_context)
   threshold: 0.20 | limite: 5 resultados
   |
   v (se falhar)
4. Keyword Search em Vídeos (ILIKE nos títulos)
   similarity fixa: 0.50
```

### Etapa 3: Re-ranking por Topic Weights

Pesos aplicados pós-busca baseados no `topic_context` declarado pelo usuário:

| source_type | parameters | products | commercial | support |
|------------|-----------|----------|-----------|---------|
| parameter_set | 1.5x | 0.4x | 0.2x | 0.6x |
| resin | 1.3x | 1.4x | 0.5x | 0.7x |
| processing_protocol | 1.4x | 1.2x | 0.3x | 0.8x |
| article | 0.7x | 1.2x | 0.4x | 1.3x |
| video | 0.6x | 0.8x | 0.3x | 1.2x |
| catalog_product | 0.5x | 1.4x | **2.5x** | 0.5x |
| company_kb | 0.3x | 0.5x | **1.5x** | 0.4x |

### Etapa 4: Geração (LLM)

| Modelo | Função | max_tokens |
|--------|--------|-----------|
| google/gemini-2.5-flash | Primário | 1024 (512 comercial) |
| google/gemini-2.5-flash-lite | Fallback 1 (se 500) | idem |
| openai/gpt-4o-mini | Fallback 2 (contexto truncado 6000 chars) | idem |
| openai/gpt-4.1-mini | Fallback 3 (último recurso) | idem |

### Etapa 5: Pós-processamento

| Ação | Descrição | Status |
|------|-----------|--------|
| Salvar agent_interactions | user_message, agent_response, context_raw, top_similarity | ✅ ATIVO |
| Media Cards | Só se usuário pediu vídeo (regex) + gate de sub-tema | ✅ ATIVO |
| Knowledge Gap | Se topSimilarity < 0.35 ou sem resultados | ✅ ATIVO |

---

## 3. SISTEMA PROMPT PRINCIPAL (System Prompt)

O system prompt é montado dinamicamente com estas seções:

1. **Identidade**: "Dra. L.I.A., especialista máxima em odontologia digital da Smart Dent (16 anos)"
2. **Lead Name Context**: Injeta nome/email se sessão ativa
3. **Topic Instruction**: Injeta SDR_COMMERCIAL_INSTRUCTION se rota comercial
4. **SPIN Progress Note**: Injeta etapas já completadas do SPIN
5. **Memória Viva**: Instrução para usar dados de LIA-Diálogos (company_kb source_label)
6. **Dados da Empresa**: Contexto ao vivo (fetchCompanyContext) com fallback hardcoded
7. **Personalidade**: 11 regras de ouro (tom, consultiva, sincera, etc)
8. **Knowledge Base**: ICP, Portfólio, NPS
9. **Estratégia de Transição Humana**: Fallback para WhatsApp
10. **20 Regras de Resposta**: Anti-alucinação, links, vídeos, protocolos

---

## 4. SDR CONSULTIVO (Rota Comercial)

### Regras (5 regras + 4 etapas)

| Regra | Descrição | Status |
|-------|-----------|--------|
| REGRA 1 | Máx 1 pergunta por mensagem | ✅ ATIVO |
| REGRA 2 | Detecção de intenção direta (produto específico = responder imediato) | ✅ ATIVO |
| REGRA 3 | Limite de 3 perguntas de qualificação | ✅ ATIVO |
| REGRA 4 | Anti-loop (releia histórico antes de cada resposta) | ✅ ATIVO |
| REGRA 5 | Continuidade de sessão | ✅ ATIVO |

### Etapas SDR

| Etapa | Nome | Ação |
|-------|------|------|
| 0 | Identificação | Nome/email já coletados pelo sistema |
| 1 | Abertura | Saudação + "Em qual produto você está interessado?" SEM citar produtos |
| 2 | Contexto Rápido | Máx 1 pergunta se lead não sabe o que quer |
| 3 | Apresentação | 2-3 frases, oferecer demo/agendamento |
| 4 | Fechamento | Alta complexidade = agendamento, Baixa = link loja |

### SPIN Progress Detection (automático)

O sistema analisa TODO o histórico e detecta etapas completadas:

- `equipamento_atual` (analógico/digital)
- `especialidade` (implante/prótese/etc)
- `estrutura` (consultório)
- `dor_principal`
- `tipo_fluxo`
- `pediu_preco`

Resultado persistido em `agent_sessions.extracted_entities` e `leads`.

---

## 5. SISTEMA DE INDEXAÇÃO (RAG)

### Edge Function: index-embeddings

**Dados verificados em 2026-02-21** (query direta no banco):

| Estágio | Fonte | Chunks Ativos | Última Atualização | Com Embedding |
|---------|-------|---------------|-------------------|---------------|
| articles | knowledge_contents (active) | **307** | 2026-02-21 03:59 | 307/307 ✅ |
| videos | knowledge_videos (com transcript) | **443** | 2026-02-21 04:19 | 443/443 ✅ |
| resins | resins (active) | **18** | 2026-02-21 04:51 | 18/18 ✅ |
| parameters | parameter_sets (active) | **260** | 2026-02-20 11:08 | 260/260 ✅ |
| company_kb | External KB + company_kb_texts | **76** | 2026-02-21 04:19 | 76/76 ✅ |
| catalog_products | system_a_catalog (active+approved) | **273** | 2026-02-21 04:54 | 273/273 ✅ |
| **TOTAL** | | **1.377 embeddings** | | **100% preenchidos** |

### Modelo de Embedding
- **Modelo**: gemini-embedding-001 (Gemini)
- **Dimensionalidade**: 768
- **Task Type**: RETRIEVAL_DOCUMENT (indexação) / RETRIEVAL_QUERY (busca)
- **Busca**: match_agent_embeddings (pgvector, cosine distance)
- **Threshold**: 0.65

### Chunking Strategy

| Fonte | Tamanho Chunk | Overlap |
|-------|--------------|---------|
| Videos (transcripts) | 1.200 chars | 150 chars |
| company_kb_texts (Brain Feeder) | 900 chars | 150 chars |
| Articles | Inteiro (title + excerpt + meta + 800 chars HTML) | N/A |
| Catalog Products | 3 chunks por produto (desc + benefits + FAQ) | N/A |

---

## 6. SISTEMA DE AVALIAÇÃO AUTOMÁTICA (Judge)

### Edge Function: evaluate-interaction

- **Trigger**: Database webhook no INSERT/UPDATE de `agent_interactions`
- **Modelo**: google/gemini-3-flash-preview
- **Temperature**: 0.1

### Critérios de Score

| Score | Verdict | Significado |
|-------|---------|-------------|
| 0 | hallucination | Citou parâmetro técnico AUSENTE no contexto |
| 1-2 | off_topic | Citou produto não solicitado ou termos vagos |
| 3 | incomplete | Correta mas omitiu info importante |
| 4-5 | ok | Precisa, direta, baseada no contexto |

### Dados Reais do Judge (verificados 2026-02-21)

| Verdict | Total | % | Score Médio |
|---------|-------|---|-------------|
| ok | **131** | 52.2% | 4.85 |
| **hallucination** | **91** | **36.3%** | **0.00** |
| off_topic | 21 | 8.4% | 1.24 |
| incomplete | 8 | 3.2% | 3.00 |
| **Total avaliados** | **251** | 100% | — |

---

## 7. DADOS OPERACIONAIS EM TEMPO REAL (verificados 2026-02-21)

### Interações

| Métrica | Valor |
|---------|-------|
| Total de interações | **546** |
| Com judge score >= 4 | **122** (22.3%) |
| Revisadas por humano | **24** (4.4%) |
| **Exportáveis (reviewed + score>=4)** | **0** ⚠️ |
| Sem resposta (unanswered) | **34** (6.2%) |

### ⚠️ ALERTA: ZERO interações exportáveis

Das 24 revisadas por humano, **nenhuma** tem judge_score >= 4. Isso significa que o dataset de fine-tuning está **completamente vazio**. A edge function `dra-lia-export` retornaria 404.

### Knowledge Gaps

| Status | Total |
|--------|-------|
| Low Confidence | **41** |
| Resolved | **33** |
| Pending | **6** |
| **Total** | **80** |

### Knowledge Gaps com Lixo (< 10 chars) — VERIFICADO

| Pergunta | Status | Frequência |
|----------|--------|------------|
| "Lia" | pending | 1 |
| "Ooe" | pending | 1 |
| "Clinica" | pending | 1 |
| "demora" | low_confidence | 1 |
| "só eu" | low_confidence | 1 |
| "De novo" | low_confidence | 1 |
| "Bastante" | low_confidence | 1 |
| "Varios" | low_confidence | 1 |
| "Muitos" | low_confidence | 1 |
| "obrigado" | resolved | 2 |
| "Obrigado" | resolved | 4 |
| "Que merda" | resolved | 1 |
| "Olá" | resolved | 2 |

**19 gaps com lixo** — mensagens curtas, agradecimentos, e interjeições estão poluindo o sistema.

### Leads

| Métrica | Valor |
|---------|-------|
| Total | **2** |
| SPIN completo | **1** |

### Brain Feeder (company_kb_texts)

| Métrica | Valor |
|---------|-------|
| Textos ativos | **5** |
| Chunks no RAG | **76** (inclui external KB) |

---

## 8. EXPORTAÇÃO PARA FINE-TUNING

### Edge Function: dra-lia-export

- **Formato**: JSONL (Google AI Studio / Gemini format)
- **Filtro**: human_reviewed = true AND judge_score >= 4
- **Limite**: 1000 interações
- **Autenticação**: Requer admin (retorna 401 sem token — ✅ verificado)
- **Dados exportáveis**: **ZERO** ❌

**PROBLEMA GRAVE**: O critério de exportação exige `human_reviewed = true` E `judge_score >= 4`. Das 24 revisadas, o Judge deu score 0 (hallucination) para quase todas. Resultado: **dataset vazio**.

---

## 9. ANÁLISE DE ALUCINAÇÕES — AMOSTRA MANUAL (10 casos)

Analisei manualmente as 10 últimas interações classificadas como "hallucination":

| # | Pergunta do Usuário | Resposta da LIA | Contexto RAG | Veredicto Manual |
|---|---------------------|-----------------|--------------|------------------|
| 1 | "quanto ele custa" | Cita R$23.990 (Scanner BLZ INO200) | Contexto tinha catalog_product com FAQ de preço | **FALSO POSITIVO** — dado estava no contexto |
| 2 | "não posso agendar uma apresentação online?" | "Sim, podemos agendar" | Contexto de Asiga MAX 2 | **FALSO POSITIVO** — resposta genérica adequada |
| 3 | "eu não tenho scanner ainda" | Sugere Scanner BLZ INO200 | Contexto de Asiga MAX 2 | **VERDADEIRO** — inventou sugestão fora do contexto |
| 4 | "qual impressora vem no combo?" | Cita Elegoo Mars 5 Ultra | Contexto de Chair Side Print 4.0 | **FALSO POSITIVO** — dado estava no FAQ do catálogo |
| 5 | "vocês não vendem os 2 juntos?" | Cita RayShape Edge Mini + ShapeWare 2.0 | Contexto de Smart Dent geral | **PARCIAL** — info pode estar no catálogo mas Judge não viu |
| 6 | "ouvi falar que tem software com IA" | Confirma ShapeWare 2.0 com IA | Contexto company_kb | **FALSO POSITIVO** — info no contexto |
| 7 | "como colocar suportes em placas miorrelaxantes?" | Cita vídeo do Lychee Slicer | Contexto weak (similarity 0.77) | **PARCIAL** — citou vídeo real mas com detalhes inventados |
| 8 | "informação de tratamento térmico está errada" | Dá protocolo "100°C por 15-20min" | Similarity 0.10 (sem contexto real) | **VERDADEIRO** — inventou protocolo |
| 9 | "como faço tratamento térmico?" | Dá protocolo genérico | Similarity 0.10 (sem contexto) | **VERDADEIRO** — inventou dados técnicos |
| 10 | "Vitality faz guias?" | Pergunta se cirúrgicas ou ortodônticas | Similarity 1.32 (bom contexto) | **FALSO POSITIVO** — resposta cautelosa e correta |

### Conclusão da Amostra

| Classificação | Total | % |
|---------------|-------|---|
| **Falso Positivo** (Judge errou) | **4** | 40% |
| **Verdadeiro** (LIA aluciou) | **3** | 30% |
| **Parcial** (resposta ok mas com imprecisões) | **3** | 30% |

**O Judge tem ~40% de falsos positivos.** Isso significa que a taxa real de alucinação é mais próxima de **20-22%**, não 37%.

Causa principal dos falsos positivos: O Judge não reconhece dados do `catalog_product` (FAQs, preços) como contexto válido — ele trata informações que vieram da busca de catálogo como "inventadas".

---

## 10. PONTOS CRÍTICOS PARA AUDITORIA

### 🔴 VERMELHO (Problemas Graves)

1. **Dataset de fine-tuning VAZIO** — Zero interações exportáveis (reviewed + score>=4 = 0). A edge function `dra-lia-export` é funcional mas inútil com dados atuais.

2. **Judge com ~40% de falsos positivos** — Classifica respostas comerciais com dados de catálogo como "alucinação". A métrica de 37% de hallucination é inflada.

3. **Similarity scores artificiais** — Múltiplas fontes usam scores fixos:
   - catalog_product: 0.90 (fixo)
   - processing_protocol: 0.95 (fixo)
   - parameter_set: 0.93 (fixo quando resin matched)
   - ILIKE articles: 0.10-0.50 (calculado mas não é similaridade real)
   Isso distorce o re-ranking e impede avaliação real de relevância.

4. **19 knowledge gaps com lixo** — Mensagens < 10 chars e agradecimentos estão sendo registradas como gaps. O filtro existe no evaluate-interaction mas NÃO no upsertKnowledgeGap.

### 🟡 AMARELO (Riscos Moderados)

5. **External KB fetch pode falhar silenciosamente** — O `fetchCompanyContext()` tem timeout de 3s e fallback hardcoded. Dados desatualizados sem alerta.

6. **Email regex frágil** — O regex `[\w.+-]+@[\w-]+\.[\w.-]+` falha com emails contendo caracteres especiais ou domínios internacionais.

7. **max_tokens comercial = 512** — Respostas comerciais com limite de 512 tokens podem truncar apresentações de produtos com preços.

8. **Apenas 2 leads** — O sistema de lead collection está ativo mas quase sem dados reais. Difícil validar SPIN progress em escala.

9. **top_similarity > 1.0 em vários registros** — Valores como 1.67, 1.75, 1.32 indicam que o cálculo de similarity está somando scores de múltiplas fontes em vez de usar o máximo, distorcendo métricas.

### 🟢 VERDE (Funcionando Bem)

10. **Cascata de busca** (vector > FTS > ILIKE > keyword) é robusta e cobre falhas graciosamente.

11. **Anti-alucinação no prompt** é extensiva (20 regras, checklist de vídeo em 3 passos).

12. **Fallback de modelos** (Gemini > Flash-Lite > GPT-4o-mini > GPT-4.1-mini) garante alta disponibilidade.

13. **Indexação sequencial** por estágio evita timeouts. Todos os 1.377 embeddings estão 100% preenchidos.

14. **Auth do export** funciona corretamente (retorna 401 sem token admin).

---

## 11. FUNCIONALIDADES NÃO VERIFICÁVEIS

| Funcionalidade | Motivo |
|----------------|--------|
| Fine-tuning export (dra-lia-export) | ZERO interações exportáveis |
| SPIN progress persistence em leads | Só 2 leads, 1 com SPIN completo |
| Continuidade de sessão (REGRA 5) | Sem evidência de retorno de lead |
| Memória Viva (LIA-Diálogos) | Depende de dados arquivados |
| External Brain (Google Drive) | Depende de sync-google-drive-kb trigger |

---

## 12. RECOMENDAÇÕES PRIORITÁRIAS

### Prioridade 1 — Corrigir antes da auditoria

1. **Corrigir o Judge** — Incluir dados de `catalog_product` e `processing_instructions` como contexto válido no prompt do evaluate-interaction. Isso eliminará ~40% dos falsos positivos.

2. **Filtrar knowledge gaps** — Adicionar filtro `LENGTH(question) >= 10` no upsertKnowledgeGap da dra-lia.

3. **Limpar gaps existentes** — DELETE dos 19 gaps com lixo (agradecimentos, interjeições).

### Prioridade 2 — Melhorar métricas

4. **Recalcular top_similarity** — Usar `MAX()` em vez de soma para evitar valores > 1.0.

5. **Reavaliar interações revisadas** — Re-rodar o Judge nas 24 revisadas após correção do prompt para obter scores mais precisos.

6. **Remover similarity fixos** — Usar scores reais do pgvector para catalog_product e processing_protocol.

### Prioridade 3 — Escalar dados

7. **Aumentar revisão humana** — Meta: 100 interações revisadas para dataset de fine-tuning.

8. **Validar SPIN com mais leads** — Testar o fluxo completo SDR com cenários simulados.

---

## 13. MÉTRICAS-RESUMO PARA AUDITORIA

| Indicador | Valor | Status |
|-----------|-------|--------|
| Embeddings totais | 1.377 | ✅ |
| Embeddings preenchidos | 100% | ✅ |
| Interações totais | 546 | ✅ |
| Taxa de avaliação (Judge) | 46% (251/546) | 🟡 |
| Taxa de "ok" (Judge) | 52.2% | 🟡 |
| Taxa de hallucination bruta | 36.3% | 🔴 |
| Taxa de hallucination real (estimada) | ~20-22% | 🟡 |
| Falsos positivos do Judge | ~40% | 🔴 |
| Interações revisadas por humano | 24 (4.4%) | 🔴 |
| Interações exportáveis (fine-tuning) | **0** | 🔴 |
| Knowledge gaps com lixo | 19 | 🔴 |
| Leads coletados | 2 | 🟡 |
| Brain Feeder textos | 5 | 🟡 |
| Fontes RAG ativas | 6 | ✅ |
| Modelos LLM com fallback | 4 | ✅ |
| Edge functions deployadas | 4+ | ✅ |
