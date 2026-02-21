
# Auditoria Tecnica Completa: Dra. L.I.A. - Sistema de IA Conversacional SmartDent

## 1. ARQUITETURA GERAL

O sistema e composto por 4 edge functions principais e 1 funcao de banco de dados:

```text
+-------------------+     +--------------------+     +---------------------+
|   Frontend React  |---->|  dra-lia (chat)     |---->| Gemini 2.5 Flash    |
|   (DraLIA.tsx)    |     |  2.209 linhas       |     | via Lovable Gateway |
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

---

## 2. FLUXO COMPLETO DA CONVERSA (Pipeline)

### Etapa 0: Interceptadores Pre-RAG (sem IA)

| Ordem | Interceptador | Condicao | Acao | Status |
|-------|--------------|----------|------|--------|
| 1 | Lead Collection: needs_name | Sem nome na sessao | Pede nome (sem RAG) | ATIVO |
| 2 | Lead Collection: needs_email | Tem nome, sem email | Pede email (sem RAG) | ATIVO |
| 3 | Lead Collection: collected | Nome + email | Salva lead, confirma | ATIVO |
| 4 | Support Guard | Regex de problema tecnico | Redireciona WhatsApp | ATIVO |
| 5 | Guided Printer Dialog | Regex de parametros | Fluxo marca>modelo>resina | ATIVO |

### Etapa 1: Busca RAG (Retrieval)

Busca paralela em 4 fontes:

| Fonte | Funcao | Condicao de Ativacao | Prioridade (similarity) |
|-------|--------|---------------------|------------------------|
| Knowledge Base (artigos/videos) | searchKnowledge() | Sempre | 0.10 - 0.95 (variavel) |
| Processing Instructions | searchProcessingInstructions() | Regex de protocolo | 0.95 (fixo) |
| Parameter Sets | searchParameterSets() | Nao e rota comercial | 0.78 - 0.93 |
| Catalog Products | searchCatalogProducts() | topic_context === "commercial" | 0.90 (fixo) |

### Etapa 2: Busca Knowledge Base - Cascata de 4 metodos

```text
1. Vector Search (pgvector + Gemini Embedding 001)
   threshold: 0.65 | match_count: 10
   |
   v (se falhar)
2. Full-Text Search (search_knowledge_base RPC, tsvector portugues)
   threshold: 0.10
   |
   v (se fraco: 0-2 resultados com relevance < 0.25)
3. ILIKE Search (busca no titulo/excerpt/ai_context)
   threshold: 0.20 | limite: 5 resultados
   |
   v (se falhar)
4. Keyword Search em Videos (ILIKE nos titulos)
   similarity fixa: 0.50
```

### Etapa 3: Re-ranking por Topic Weights

Pesos aplicados pos-busca baseados no `topic_context` declarado pelo usuario:

| source_type | parameters | products | commercial | support |
|------------|-----------|----------|-----------|---------|
| parameter_set | 1.5x | 0.4x | 0.2x | 0.6x |
| resin | 1.3x | 1.4x | 0.5x | 0.7x |
| processing_protocol | 1.4x | 1.2x | 0.3x | 0.8x |
| article | 0.7x | 1.2x | 0.4x | 1.3x |
| video | 0.6x | 0.8x | 0.3x | 1.2x |
| catalog_product | 0.5x | 1.4x | **2.5x** | 0.5x |
| company_kb | 0.3x | 0.5x | **1.5x** | 0.4x |

### Etapa 4: Geracao (LLM)

| Modelo | Funcao | max_tokens |
|--------|--------|-----------|
| google/gemini-2.5-flash | Primario | 1024 (512 comercial) |
| google/gemini-2.5-flash-lite | Fallback 1 (se 500) | idem |
| openai/gpt-4o-mini | Fallback 2 (contexto truncado 6000 chars) | idem |
| openai/gpt-4.1-mini | Fallback 3 (ultimo recurso) | idem |

### Etapa 5: Pos-processamento

| Acao | Descricao | Status |
|------|-----------|--------|
| Salvar agent_interactions | user_message, agent_response, context_raw, top_similarity | ATIVO |
| Media Cards | So se usuario pediu video (regex) + gate de sub-tema | ATIVO |
| Knowledge Gap | Se topSimilarity < 0.35 ou sem resultados | ATIVO |

---

## 3. SISTEMA PROMPT PRINCIPAL (System Prompt)

O system prompt e montado dinamicamente com estas secoes:

1. **Identidade**: "Dra. L.I.A., especialista maxima em odontologia digital da Smart Dent (16 anos)"
2. **Lead Name Context**: Injeta nome/email se sessao ativa
3. **Topic Instruction**: Injeta SDR_COMMERCIAL_INSTRUCTION se rota comercial
4. **SPIN Progress Note**: Injeta etapas ja completadas do SPIN
5. **Memoria Viva**: Instrucao para usar dados de LIA-Dialogos
6. **Dados da Empresa**: Contexto ao vivo (fetchCompanyContext) com fallback hardcoded
7. **Personalidade**: 11 regras de ouro (tom, consultiva, sincera, etc)
8. **Knowledge Base**: ICP, Portfolio, NPS
9. **Estrategia de Transicao Humana**: Fallback para WhatsApp
10. **20 Regras de Resposta**: Anti-alucinacao, links, videos, protocolos

---

## 4. SDR CONSULTIVO (Rota Comercial)

### Regras (5 regras + 4 etapas)

| Regra | Descricao | Status |
|-------|-----------|--------|
| REGRA 1 | Max 1 pergunta por mensagem | ATIVO |
| REGRA 2 | Deteccao de intencao direta (produto especifico = responder imediato) | ATIVO |
| REGRA 3 | Limite de 3 perguntas de qualificacao | ATIVO |
| REGRA 4 | Anti-loop (releia historico antes de cada resposta) | ATIVO |
| REGRA 5 | Continuidade de sessao | ATIVO |

### Etapas SDR

| Etapa | Nome | Acao |
|-------|------|------|
| 0 | Identificacao | Nome/email ja coletados pelo sistema |
| 1 | Abertura | Saudacao + "Em qual produto voce esta interessado?" SEM citar produtos |
| 2 | Contexto Rapido | Max 1 pergunta se lead nao sabe o que quer |
| 3 | Apresentacao | 2-3 frases, oferecer demo/agendamento |
| 4 | Fechamento | Alta complexidade = agendamento, Baixa = link loja |

### SPIN Progress Detection (automatico)

O sistema analisa TODO o historico e detecta etapas completadas:

- equipamento_atual (analogico/digital)
- especialidade (implante/protese/etc)
- estrutura (consultorio)
- dor_principal
- tipo_fluxo
- pediu_preco

Resultado persistido em `agent_sessions.extracted_entities` e `leads`.

---

## 5. SISTEMA DE INDEXACAO (RAG)

### Edge Function: index-embeddings

| Estagio | Fonte | Chunks Atuais | Ultima Atualizacao |
|---------|-------|---------------|-------------------|
| articles | knowledge_contents (active) | **307** | 2026-02-21 |
| videos | knowledge_videos (com transcript) | **443** | 2026-02-21 |
| resins | resins (active) | **18** | 2026-02-21 |
| parameters | parameter_sets (active) | **260** | 2026-02-20 |
| company_kb | External KB + company_kb_texts | **76** | 2026-02-21 |
| catalog_products | system_a_catalog (active+approved) | **273** | 2026-02-21 |
| **TOTAL** | | **1.377 embeddings** | |

### Modelo de Embedding
- **Modelo**: gemini-embedding-001 (Gemini)
- **Dimensionalidade**: 768
- **Task Type**: RETRIEVAL_DOCUMENT (indexacao) / RETRIEVAL_QUERY (busca)
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

## 6. SISTEMA DE AVALIACAO AUTOMATICA (Judge)

### Edge Function: evaluate-interaction

- **Trigger**: Database webhook no INSERT/UPDATE de `agent_interactions`
- **Modelo**: google/gemini-3-flash-preview
- **Temperature**: 0.1

### Criterios de Score

| Score | Verdict | Significado |
|-------|---------|-------------|
| 0 | hallucination | Citou parametro tecnico AUSENTE no contexto |
| 1-2 | off_topic | Citou produto nao solicitado ou termos vagos |
| 3 | incomplete | Correta mas omitiu info importante |
| 4-5 | ok | Precisa, direta, baseada no contexto |

### Dados Reais do Judge (todos os tempos)

| Verdict | Total | Score Medio |
|---------|-------|-------------|
| ok | 129 (52%) | 4.84 |
| **hallucination** | **91 (37%)** | **0.00** |
| off_topic | 20 (8%) | 1.20 |
| incomplete | 8 (3%) | 3.00 |

**ALERTA CRITICO**: 37% das interacoes foram classificadas como alucinacao. Este numero e alto e precisa ser investigado. Nos ultimos 7 dias: **91 alucinacoes** (todas, indicando que o Judge esta processando retroativamente ou houve muito volume recente).

---

## 7. DADOS OPERACIONAIS EM TEMPO REAL

### Interacoes

| Metrica | Valor |
|---------|-------|
| Total de interacoes | 539 |
| Com judge score >= 4 | 120 (22%) |
| Revisadas por humano | 24 (4.5%) |
| Sem resposta (unanswered) | 34 (6.3%) |

### Knowledge Gaps

| Status | Total |
|--------|-------|
| Pending | 6 |
| Low Confidence | 41 |
| Resolved | 33 |
| **Total** | **80** |

**PROBLEMA**: Existem gaps pendentes com lixo (ex: "Clinica", "Ooe", "Lia") que deveriam ser filtrados. O filtro de mensagens curtas (< 10 chars) no evaluate-interaction nao esta sendo aplicado ao knowledge gap tracker.

### Leads

| Metrica | Valor |
|---------|-------|
| Total | 2 |
| SPIN completo | 1 |

### Brain Feeder (company_kb_texts)

| Metrica | Valor |
|---------|-------|
| Textos ativos | 5 |
| Chunks no RAG | 76 (inclui external KB) |

---

## 8. EXPORTACAO PARA FINE-TUNING

### Edge Function: dra-lia-export

- **Formato**: JSONL (Google AI Studio / Gemini format)
- **Filtro**: human_reviewed = true AND judge_score >= 4
- **Limite**: 1000 interacoes
- **Autenticacao**: Requer admin
- **Dados disponiveis**: 24 revisadas, mas so as com score >= 4 serao exportadas

**PROBLEMA**: Com apenas 24 interacoes revisadas por humano, o dataset de fine-tuning e extremamente pequeno. Precisa de muito mais revisoes manuais.

---

## 9. PONTOS CRITICOS PARA AUDITORIA

### VERMELHO (Problemas Graves)

1. **37% de alucinacoes** — O Judge detectou que 91 de 248 interacoes avaliadas sao alucinacoes. Causa provavel: o LLM recebe contexto RAG sobre tema X mas responde inventando dados sobre tema Y, especialmente em respostas comerciais onde o `catalog_product` tem similarity fixa de 0.90 (inflada artificialmente).

2. **Similarity scores artificiais** — Multiplas fontes usam scores fixos:
   - catalog_product: 0.90 (fixo)
   - processing_protocol: 0.95 (fixo)
   - parameter_set: 0.93 (fixo quando resin matched)
   - ILIKE articles: 0.10-0.50 (calculado mas nao e similaridade real)
   Isso distorce o re-ranking e impede avaliacao real de relevancia.

3. **Knowledge gaps com lixo** — Mensagens de 3-4 chars ("Lia", "Ooe") estao sendo registradas como gaps. O filtro de < 10 chars existe no evaluate-interaction mas NAO no upsertKnowledgeGap.

4. **External KB fetch pode falhar silenciosamente** — O `fetchCompanyContext()` tem timeout de 3s e fallback hardcoded, mas se os dados do endpoint externo mudarem, o fallback vai servir dados desatualizados sem alerta.

### AMARELO (Riscos Moderados)

5. **Email regex fragil** — Embora corrigido para espacos ao redor do @, o regex `[\w.+-]+@[\w-]+\.[\w.-]+` ainda falha com emails contendo caracteres especiais ou dominios internacionais.

6. **evaluate-interaction nao tem CORS** — Funciona via database webhook (trigger), mas se chamada diretamente, nao responderia a OPTIONS. Baixo risco porque o trigger e interno.

7. **max_tokens comercial = 512** — Respostas comerciais tem limite de 512 tokens, o que pode truncar apresentacoes de produtos com precos e detalhes.

8. **Apenas 2 leads** — O sistema de lead collection esta ativo mas quase sem dados reais. Dificil validar se o SPIN progress detection funciona em escala.

### VERDE (Funcionando Bem)

9. **Cascata de busca** (vector > FTS > ILIKE > keyword) e robusta e cobre falhas graciosamente.

10. **Anti-alucinacao no prompt** e extensiva (20 regras, checklist de video em 3 passos).

11. **Fallback de modelos** (Gemini > Flash-Lite > GPT-4o-mini > GPT-4.1-mini) garante alta disponibilidade.

12. **Indexacao sequencial** por estagio evita timeouts.

---

## 10. FUNCIONALIDADES NAO VERIFICAVEIS (nao testadas em producao)

| Funcionalidade | Motivo |
|----------------|--------|
| Fine-tuning export (dra-lia-export) | So 24 revisoes humanas, dataset insuficiente |
| SPIN progress persistence em leads | So 2 leads, 1 com SPIN completo |
| Continuidade de sessao (REGRA 5) | Sem evidencia de retorno de lead no historico |
| Memoria Viva (LIA-Dialogos) | Depende de dados arquivados, nao verificavel sem testar busca |
| External Brain (Google Drive) | Depende de `sync-google-drive-kb`, nao verificavel sem trigger |

---

## 11. RECOMENDACOES PARA AUDITORIA

1. **Revisar amostras de alucinacao** — Puxar 10 interacoes com `judge_verdict = 'hallucination'` e verificar manualmente se o Judge esta correto ou se e falso positivo.

2. **Adicionar filtro de tamanho ao knowledge gap** — Mensagens < 10 chars nao devem gerar gaps.

3. **Remover similarity scores fixos** — Usar scores reais baseados em relevancia, nao valores magicos como 0.90/0.95.

4. **Aumentar revisao humana** — 24 de 539 (4.5%) e muito pouco. Meta: revisar pelo menos 100 interacoes para dataset de fine-tuning.

5. **Documentar o pipeline em diagrama** — Para a auditoria, ter um diagrama visual do fluxo completo.

6. **Testar edge cases do email** — Emails com acentos, dominios .com.br longos, emails com +.
