

## Auditoria Tecnica: Dados Coletados pela LIA para Aprendizado

### Diagnostico atual (dados reais de 2026-02-24)

```text
METRICAS CRITICAS
─────────────────────────────────────────────────────
Interacoes totais:        1.008
Com resposta:               999
Avaliadas pelo Judge:       511 (50.7%)
NAO avaliadas:              488 (48.4%)  ← PROBLEMA
  - Sem context_raw:        398
  - Mensagem curta (<10):   146
  - Unanswered:              56

JUDGE VERDICTS (dos 511 avaliados)
─────────────────────────────────────────────────────
ok:               263 (51.5%)
hallucination:    195 (38.2%)  ← INFLADO por falsos positivos
off_topic:         --
incomplete:        --

SIMILARIDADE MEDIA:   1.12 (deveria ser max 1.0)
Acima de 1.0:        351 registros (34.8%)  ← BUG DE CALCULO

HUMAN REVIEWED:       32 total
  - Sem verdict:      11 (revisadas mas Judge nao rodou)
  - hallucination:    20 (provavelmente ~8-10 sao falsos positivos)
  - off_topic:         1

EXPORTAVEIS (reviewed + score>=4): 0  ← DATASET VAZIO

KNOWLEDGE GAPS:      100 total
  - Lixo (<10 chars): 20 registros poluindo o sistema

EMBEDDINGS:        2.039 chunks (100% com embedding)
faq_autoheal:      0 chunks  ← heal-knowledge-gaps nao indexou nada

LIA_ATTENDANCES:   16 registros, ZERO com resumo IA
```

### Problemas identificados (priorizados)

```text
🔴 VERMELHO — Bloqueiam o aprendizado

1. 488 interacoes NAO avaliadas pelo Judge
   Causa: 398 nao tem context_raw salvo (interceptadores pre-RAG
   como lead collection, support guard nao salvam contexto).
   O trigger trg_evaluate_interaction pula records sem context_raw.
   Impacto: quase metade das conversas nao tem nota de qualidade.

2. top_similarity SOMA em vez de MAX → 351 registros com score > 1.0
   Valores como 2.9, 3.3, 4.8 distorcem completamente as metricas.
   O Judge recebe contexto com similarity inflada e nao consegue
   avaliar corretamente a relevancia real.

3. 20 knowledge gaps com lixo
   "Lia", "Ooe", "Clinica", "obrigado", "Que merda", "Olá"
   O filtro anti-noise JA EXISTE (linha 1121) mas esses 20 sao
   anteriores ao filtro. Precisam ser deletados.

4. Dataset de fine-tuning VAZIO
   32 revisadas: 20 hallucination (score 0), 11 sem verdict, 1 off_topic.
   ZERO com score >= 4. A funcao dra-lia-export retorna 404.

5. ZERO resumos IA em lia_attendances
   O timer de 5 min de inatividade foi implementado mas
   nenhum resumo foi gerado ainda. 16 leads sem contexto para
   o time comercial.

🟡 AMARELO — Degradam a qualidade

6. Judge com ~40% de falsos positivos nas "hallucinations"
   Respostas com dados de CATALOG_PRODUCT marcadas como alucinacao
   (mesmo com o prompt corrigido). Exemplos reais:
   - "Ioconnect vc conhece?" → LIA citou dados do catalogo → score 0
   - "Como podemos agendar?" → resposta de persona → score 0
   - "Dr Weber Ricci da aula?" → resposta sobre autor/KOL → score 0

7. company_kb com 397 chunks (era 76) — crescimento explosivo
   Conversas da LIA sendo indexadas via Google Drive sync estao
   poluindo o RAG com dialogos internos. Cada conversa gera
   multiplos chunks que competem com conteudo tecnico real.

8. 147 mensagens curtas (<10 chars) nao avaliadas nem filtradas
   "ok", "sim", "Danilo", emails — poluem agent_interactions
   sem contribuir para aprendizado.
```

### Plano de remediacoes

#### 1. Limpar knowledge gaps com lixo (SQL direto)

Deletar os 20 registros com `LENGTH(question) < 10` da tabela `agent_knowledge_gaps`. Sao agradecimentos, interjeicoes e ruido que nao representam lacunas reais de conhecimento.

#### 2. Corrigir calculo de top_similarity no `dra-lia/index.ts`

Localizar onde `topSimilarity` e calculado (soma de scores de multiplas fontes) e trocar para `Math.max()` com teto de 1.0. Isso corrige os 351 registros futuros e permite metricas confiaveis.

#### 3. Gerar resumos IA para os 16 leads existentes

Rodar o `backfill-lia-leads` novamente (ou criar script especifico) para gerar `resumo_historico_ia` para todos os leads com conversas. Atualmente os 16 registros em `lia_attendances` tem `has_summary = false`.

#### 4. Re-avaliar interacoes revisadas pelo Judge

Apos corrigir o top_similarity, re-rodar o `evaluate-interaction` nas 32 interacoes `human_reviewed = true` para obter scores mais precisos. Com o prompt corrigido + similarity real, muitas das 20 "hallucinations" devem virar "ok" (score 4-5), desbloqueando o dataset de fine-tuning.

#### 5. Salvar context_raw em interceptadores pre-RAG

Modificar os handlers de lead collection (`needs_name`, `needs_email`, `collected`) e support guard para salvar um `context_raw` minimo (ex: `"[INTERCEPTOR] lead_collection"`) antes de retornar. Isso permite que o Judge avalie todas as interacoes, nao apenas as que passam pelo RAG.

#### 6. Filtrar mensagens curtas de agent_interactions

Adicionar filtro no frontend (`DraLIA.tsx`) para nao enviar mensagens com menos de 3 caracteres. No backend, marcar interacoes com `user_message < 10 chars` com um flag para que nao poluam metricas.

#### 7. Limitar chunks de company_kb por consulta

Ja existe cap de 3 chunks por query (mencionado na memory). Verificar se esta ativo e se conversas arquivadas (LIA-Dialogos) estao recebendo peso adequado no re-ranking para nao suprimir conteudo tecnico real.

### Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/dra-lia/index.ts` | Corrigir calculo topSimilarity (MAX em vez de soma, teto 1.0); salvar context_raw minimo em interceptadores pre-RAG; filtrar msgs curtas |
| `supabase/functions/evaluate-interaction/index.ts` | Sem mudanca — prompt ja esta correto, problema e nos dados de entrada |
| `supabase/functions/backfill-lia-leads/index.ts` | Adicionar flag para forcar geracao de resumo IA em leads existentes |
| `src/components/DraLIA.tsx` | Filtro de mensagens curtas no frontend (< 3 chars) |

### Acoes de banco (SQL one-shot, sem migracao)

1. `DELETE FROM agent_knowledge_gaps WHERE LENGTH(question) < 10` — limpar 20 gaps com lixo
2. `UPDATE agent_interactions SET top_similarity = LEAST(top_similarity, 1.0) WHERE top_similarity > 1.0` — normalizar os 351 registros historicos
3. `UPDATE agent_interactions SET judge_evaluated_at = NULL WHERE human_reviewed = true AND judge_verdict = 'hallucination'` — forcar re-avaliacao das 20 falsas hallucinations

