

## Auditoria Completa: Todas as Ferramentas da Dra. LIA

### Diagnostico por camada (dados reais 2026-02-24)

```text
CAMADA 1 — BASE DE DADOS (Matéria-Prima)
═════════════════════════════════════════
✅ OK    2.039 embeddings (100% com embedding)
✅ OK    304 artigos ativos (96% com keywords, 86% com ai_context)
⚠️ PROB  505 vídeos mas só 274 com transcript (54%) → 231 vídeos invisíveis pro RAG
🔴 CRIT  14 resinas ativas mas só 3 com processing_instructions (21%)
🔴 CRIT  14 resinas: apenas 3 com ai_context (21%)
⚠️ PROB  359 produtos catálogo: só 106 com FAQ/benefits/tech_specs (30%)
⚠️ PROB  0 produtos com clinical_brain (campo existe mas ninguém preencheu)
🔴 CRIT  8 textos company_kb com chunks_count=0 (não indexados)
           → 6 playbooks Edge Mini + 2 expertises de vídeo
           → Conteúdo COMERCIAL CRÍTICO que a LIA não consegue acessar

CAMADA 2 — BUSCA RAG (Recuperação)
═════════════════════════════════════════
✅ OK    Cascata Vector → FTS → ILIKE → Keyword funcional
✅ OK    top_similarity corrigido (0 registros > 1.0)
✅ OK    company_kb cap em 3 chunks por query
⚠️ PROB  company_kb com 397 chunks (era 76) — LIA-Dialogos injetando ruído
           → 10 textos com source_label "LIA-Dialogos" gerando 234 chunks
           → Conversas arquivadas competem com conteúdo técnico real
⚠️ PROB  searchCatalogProducts não indexa extra_data.sales_pitch (93 produtos)
           → Campo rico para argumentação comercial, ignorado na busca

CAMADA 3 — PRÉ-RAG (Interceptadores)
═════════════════════════════════════════
🔴 CRIT  Guided Dialog (marca/modelo/resina) NÃO salva context_raw
           → Linha 2148-2159: insert SEM context_raw
           → Essas interações NUNCA serão avaliadas pelo Judge
✅ OK    Lead collection salva context_raw "[INTERCEPTOR] lead_collection:*"
✅ OK    Support guard salva context_raw "[INTERCEPTOR] support_guard"
⚠️ PROB  398 interações históricas SEM context_raw (antes do fix)
           → Não há como avaliar retroativamente

CAMADA 4 — GERAÇÃO (LLM)
═════════════════════════════════════════
✅ OK    Modelo primário: gemini-2.5-flash
✅ OK    3 fallbacks: flash-lite → gpt-5-mini → gpt-5-nano
✅ OK    max_tokens: 1024 (geral) / 768 (comercial)
✅ OK    System prompt robusto com 24 regras anti-alucinação
✅ OK    SPIN progress detection funcional (7 leads com SPIN completo)
✅ OK    Regra anti-preço de scanners/equipamentos ativa
⚠️ PROB  Histórico limitado a últimas 8 mensagens no prompt
           → Conversas longas perdem contexto inicial

CAMADA 5 — AVALIAÇÃO (Judge)
═════════════════════════════════════════
✅ OK    491 avaliadas: 263 ok (54%), 175 halluc (36%), 34 off_topic, 19 incomplete
⚠️ PROB  508 NÃO avaliadas (50.4% do total)
           Causas: 398 sem context_raw + 147 msg curtas + 56 unanswered
🔴 CRIT  32 human_reviewed: 31 SEM verdict (Judge nunca rodou nelas)
           → Apenas 1 tem verdict (off_topic, score 2)
           → As 31 foram marcadas como revisadas ANTES do Judge avaliar
           → ZERO exportáveis para fine-tuning
⚠️ PROB  Judge pode classificar respostas de dialog guiado como hallucination
           (pois não tem context_raw para comparar)

CAMADA 6 — APRENDIZADO CONTÍNUO
═════════════════════════════════════════
🔴 CRIT  Dataset fine-tuning: ZERO interações exportáveis
           → dra-lia-export retorna 404 (precisa reviewed + score >= 4)
✅ OK    80 knowledge gaps (0 com lixo após limpeza)
✅ OK    15 leads com resumo IA gerado
⚠️ PROB  16 lia_attendances: ZERO com rota_inicial_lia preenchida
✅ OK    Timer inatividade 5min → summarize_session implementado
⚠️ PROB  faq_autoheal: 0 chunks indexados (heal-knowledge-gaps nunca rodou)

CAMADA 7 — DADOS NÃO UTILIZADOS (Desperdício)
═════════════════════════════════════════
🔴 CRIT  231 vídeos SEM transcript → invisíveis para vector search
           → Só aparecem via keyword search no título (fraco)
🔴 CRIT  11 resinas SEM processing_instructions
           → LIA inventa protocolos quando perguntam sobre essas resinas
🔴 CRIT  8 playbooks/expertises company_kb NÃO indexados (chunks_count=0)
           → Edge Mini: ficha técnica, pitch SDR, comparativo, FAQ, workflow
           → NanoClean PoD: expertise de vídeo
           → SmartGum: expertise de vídeo
⚠️ PROB  253 produtos catálogo SEM FAQ/benefits enriquecidos
⚠️ PROB  93 produtos com sales_pitch não usado pelo searchCatalogProducts
⚠️ PROB  0 produtos com clinical_brain (regras anti-alucinação por produto)
⚠️ PROB  0 produtos com competitor_comparison (apenas 2 no banco todo)
```

### Problemas priorizados e remediações

#### PRIORIDADE 1 — Bloqueiam o aprendizado

**P1.1: Guided Dialog não salva context_raw**
O handler do dialog guiado (marca→modelo→resina) nas linhas 2148-2159 faz `insert` sem `context_raw`. Essas interações nunca são avaliadas pelo Judge. Adicionar `context_raw: "[INTERCEPTOR] guided_dialog:${dialogState.state}"`.

**P1.2: 8 textos company_kb não indexados**
Os 6 playbooks Edge Mini + 2 expertises de vídeo têm `chunks_count = 0`. O `index-embeddings` processa `company_kb_texts` mas esses nunca foram indexados. Precisa re-rodar `index-embeddings?stage=company_kb&mode=full` para indexar.

**P1.3: 11 resinas sem processing_instructions**
Apenas 3 de 14 resinas ativas têm protocolos de processamento. Quando alguém pergunta "como processar a Smart Print Bio Clear Guide?", a LIA inventa o protocolo. Isso é a maior fonte de alucinações reais.

**P1.4: Human-reviewed sem verdict do Judge**
31 de 32 interações `human_reviewed = true` nunca foram avaliadas pelo Judge (`judge_verdict = NULL`). Precisam ter `judge_evaluated_at` resetado e o trigger re-disparado para o Judge avaliar.

#### PRIORIDADE 2 — Degradam a qualidade

**P2.1: 231 vídeos sem transcript**
54% dos vídeos só são encontrados por keyword match no título. Sem transcript, o vector search não os encontra. Os transcripts precisam ser extraídos via PandaVideo API ou Whisper.

**P2.2: LIA-Dialogos poluindo o RAG**
10 textos com source_label "LIA-Dialogos" geram 234 chunks de conversas arquivadas. Esses chunks competem com conteúdo técnico real. O cap de 3 por query ajuda, mas o volume dilui a relevância.

**P2.3: extra_data.sales_pitch não usado na busca**
93 produtos têm `sales_pitch` no extra_data — argumentação comercial pronta. Mas `searchCatalogProducts` não inclui esse campo na construção do chunk_text da busca direta, nem o `index-embeddings` indexa como chunk separado.

**P2.4: rota_inicial_lia nunca preenchida**
O `upsertLead` em lia_attendances não preenche `rota_inicial_lia`. O campo existe mas fica NULL para todos os 16 leads.

#### PRIORIDADE 3 — Otimizações

**P3.1: Resinas sem ai_context**
11 de 14 resinas não têm `ai_context`, que seria o resumo semântico para melhorar a busca RAG.

**P3.2: faq_autoheal nunca executado**
O source_type `faq_autoheal` tem 0 chunks. A edge function `heal-knowledge-gaps` deveria gerar FAQs a partir dos gaps resolvidos e indexá-las.

**P3.3: clinical_brain vazio**
Nenhum produto do catálogo tem `clinical_brain` preenchido — campo projetado para regras anti-alucinação por produto (obrigatório citar X, proibido citar Y).

### Plano de remediações

#### Código (3 arquivos)

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/dra-lia/index.ts` | (1) Adicionar `context_raw: "[INTERCEPTOR] guided_dialog:${state}"` no insert do dialog guiado (linha 2150). (2) Preencher `rota_inicial_lia` no upsert de `lia_attendances` dentro de `upsertLead`. (3) Incluir `extra_data.sales_pitch` no chunk_text do `searchCatalogProducts` para enriquecer busca comercial. |
| `supabase/functions/index-embeddings/index.ts` | (1) Adicionar chunk tipo `sales_pitch` para produtos que têm `extra_data.sales_pitch`. (2) Indexar `extra_data.technical_specifications` como campo nomeado (atualmente usa JSON bruto). |
| `supabase/functions/backfill-lia-leads/index.ts` | Adicionar preenchimento de `rota_inicial_lia` buscando o `topic_context` da sessão mais recente de cada lead. |

#### Ações de banco (SQL one-shot)

1. **Re-disparar Judge nas 31 human_reviewed sem verdict:**
   `UPDATE agent_interactions SET judge_evaluated_at = NULL WHERE human_reviewed = true AND judge_verdict IS NULL;`
   Isso faz o trigger `trg_evaluate_interaction` re-avaliar (precisa de um UPDATE no `agent_response` para disparar).

2. **Re-indexar company_kb para capturar os 8 textos não indexados:**
   Chamar `index-embeddings?stage=company_kb&mode=full` via curl.

#### Dados que precisam ser preenchidos manualmente (fora do código)

| Dado | Impacto | Qtd |
|------|---------|-----|
| `resins.processing_instructions` | Elimina alucinações de protocolo | 11 resinas |
| `resins.ai_context` | Melhora busca semântica | 11 resinas |
| `knowledge_videos.video_transcript` | Torna vídeos encontráveis | 231 vídeos |
| `system_a_catalog.extra_data.clinical_brain` | Anti-alucinação por produto | 359 produtos |
| `system_a_catalog.extra_data.faq/benefits` | Enriquece respostas comerciais | 253 produtos |

