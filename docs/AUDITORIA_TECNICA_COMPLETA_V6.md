# 🏗️ AUDITORIA TÉCNICA COMPLETA V6 — Revenue Intelligence OS

> **Gerado em**: 2026-03-24  
> **Fonte**: Código-fonte do projeto (leitura integral de todos os módulos)  
> **Objetivo**: Documentação exaustiva para auditoria funcional e tecnológica

---

## 📐 1. ARQUITETURA GERAL

### Stack Tecnológico

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + Vite 5 + TypeScript + Tailwind CSS 3 |
| UI | shadcn/ui + Radix UI + Framer Motion |
| Estado | TanStack React Query v5 |
| Backend | Supabase (PostgreSQL + Auth + Storage + Edge Functions) |
| Edge Functions | Deno (95+ funções) |
| IA - Conteúdo | Lovable AI Gateway → Google Gemini 2.5/3 Flash |
| IA - Cognitiva | DeepSeek Chat (deepseek-chat) |
| IA - Embeddings | Google Gemini Embedding 001 (768 dims) |
| Deploy | Vercel (SSR via Edge Functions) |
| CRM | PipeRun API v1 (bidirecional) |
| Automação | SellFlux (V1 GET + V2 POST + Webhook) |
| E-commerce | Loja Integrada (Dual-Auth + Webhooks) |
| Ads | Meta Ads (Lead Ads Webhook + Insights API) |
| Cursos | Astron Academy (Postback + Sync Members) |
| Vídeo | PandaVideo (Sync + Analytics) |
| WhatsApp | WaLeads Messaging API |
| Reviews | Google Reviews Sync |

### Tabela Principal: `lia_attendances` (428+ colunas)

Hub centralizado de dados de leads. Recebe dados de todas as integrações via Smart Merge com prioridade de fonte. Organizada em ~25 domínios funcionais (identificação, CRM, e-commerce, educação, engajamento, SDR, marketing, workflow, LTV, sistema).

### Tabelas Auxiliares Principais

| Tabela | Função |
|--------|--------|
| `leads` | Bridge table para `agent_interactions` (FK) |
| `agent_interactions` | Histórico de conversas Dra. LIA |
| `agent_sessions` | Estado de sessão (printer dialog, SPIN) |
| `agent_embeddings` | Vetores RAG (768d, dual column: embedding + vector_v2) |
| `agent_knowledge_gaps` | Perguntas sem resposta (auto-heal) |
| `agent_internal_lookups` | Cache de buscas (exact + FTS) |
| `deals` | Deals sincronizados do PipeRun |
| `deal_items` | Itens de proposta normalizados |
| `people` | Pessoas (graph de identidade) |
| `companies` | Empresas (graph de identidade) |
| `identity_keys` | Chaves de identidade (email, phone, CPF) |
| `team_members` | Equipe comercial + CS + WaLeads keys |
| `message_logs` | Log de mensagens WhatsApp enviadas |
| `lead_activity_log` | Timeline de atividades |
| `lead_state_events` | Eventos de mudança de estado |
| `ai_token_usage` | Tracking de custos IA por provider |
| `system_health_logs` | Logs de saúde + rate limiting + dead letters |
| `cs_automation_rules` | Regras de automação CS/WaLeads |
| `knowledge_contents` | Artigos da base de conhecimento |
| `knowledge_videos` | Vídeos (PandaVideo sync) |
| `knowledge_categories` | Categorias A-E |
| `catalog_documents` | Documentos técnicos (PDFs) |
| `system_a_catalog` | Catálogo de produtos |
| `resins` | Resinas com indicações clínicas |
| `parameter_sets` | Parâmetros de impressão (marca/modelo/resina) |
| `brands` / `models` | Marcas e modelos de impressoras |
| `authors` | Autores/KOLs |
| `external_links` | Links internos aprovados para IA |
| `company_kb_texts` | Textos da base de conhecimento da empresa |
| `content_requests` | Pendências de conteúdo detectadas pela LIA |
| `cron_state` | Estado de crons (cursor de sync) |
| `backfill_log` | Log de backfills |

---

## ⚡ 2. CATÁLOGO COMPLETO DE EDGE FUNCTIONS (95+)

### 2.1 Lead Lifecycle (12)

| Função | Descrição |
|--------|-----------|
| `smart-ops-ingest-lead` | Ingestão universal (80+ campos, multi-source) |
| `smart-ops-lia-assign` | Atribuição de lead qualificado → vendedor PipeRun |
| `cognitive-lead-analysis` | Análise cognitiva 10 eixos (DeepSeek) |
| `smart-ops-stagnant-processor` | Processamento de leads estagnados |
| `smart-ops-kanban-move` | Move deal entre etapas PipeRun |
| `smart-ops-proactive-outreach` | Outreach proativo via WaLeads |
| `backfill-lia-leads` | Backfill de leads LIA |
| `backfill-intelligence-score` | Recalcular intelligence scores |
| `backfill-ltv` | Recalcular LTV |
| `backfill-hits-granular` | Backfill de hits granulares |
| `batch-cognitive-analysis` | Análise cognitiva em lote |
| `import-leads-csv` | Importação CSV de leads |

### 2.2 CRM PipeRun (6)

| Função | Descrição |
|--------|-----------|
| `smart-ops-piperun-webhook` | Receptor de webhooks PipeRun (deal create/update/delete) |
| `smart-ops-sync-piperun` | Sync incremental (cursor-based, 500/chunk) |
| `piperun-full-sync` | Full sync de todos os pipelines |
| `piperun-api-test` | Teste de conexão API |
| `fix-piperun-links` | Correção de links PipeRun em leads |
| `backfill-deals-append` | Append de deals ao histórico |

### 2.3 SellFlux (3)

| Função | Descrição |
|--------|-----------|
| `smart-ops-sellflux-webhook` | Receptor de webhooks SellFlux |
| `smart-ops-sellflux-sync` | Sync bidirecional SellFlux |
| `smart-ops-send-waleads` | Envio de mensagens WhatsApp via WaLeads |

### 2.4 E-commerce Loja Integrada (5)

| Função | Descrição |
|--------|-----------|
| `smart-ops-ecommerce-webhook` | Receptor de webhooks e-commerce |
| `poll-loja-integrada-orders` | Polling de pedidos |
| `sync-loja-integrada-clients` | Sync de clientes |
| `register-loja-webhooks` | Registro de webhooks |
| `import-loja-integrada` | Importação manual |

### 2.5 Meta Ads (3)

| Função | Descrição |
|--------|-----------|
| `smart-ops-meta-lead-webhook` | Receptor Lead Ads |
| `smart-ops-meta-ads-manager` | Gerenciamento de campanhas |
| `smart-ops-meta-ads-insights` | Relatórios de performance |

### 2.6 Content Intelligence (15)

| Função | Descrição |
|--------|-----------|
| `ai-orchestrate-content` | Orquestrador principal (Gemini) |
| `ai-content-formatter` | Formatação HTML semântico |
| `ai-metadata-generator` | Metadados SEO + FAQs |
| `ai-generate-og-image` | Geração de imagens OG |
| `ai-enrich-pdf-content` | Enriquecimento de PDFs |
| `extract-pdf-text` | Extração de texto PDF |
| `extract-pdf-raw` | Extração raw PDF |
| `extract-pdf-specialized` | Extração especializada (7 tipos) |
| `extract-and-cache-pdf` | Extração com cache |
| `extract-video-content` | Extração de conteúdo de vídeo |
| `reformat-article-html` | Reformatação HTML |
| `enrich-article-seo` | Enriquecimento SEO |
| `translate-content` | Tradução PT→EN/ES |
| `auto-inject-product-cards` | Injeção de product cards |
| `enrich-resins-from-apostila` | Extração de dados de resinas |

### 2.7 Dra. L.I.A. (4)

| Função | Descrição |
|--------|-----------|
| `dra-lia` | Orquestrador conversacional principal (~4000 linhas) |
| `dra-lia-whatsapp` | Interface WhatsApp |
| `dra-lia-export` | Exportação de dados LIA |
| `evaluate-interaction` | Avaliação de qualidade (Judge DeepSeek + Gemini) |

### 2.8 SEO & Exposição (8)

| Função | Descrição |
|--------|-----------|
| `seo-proxy` | SSR para crawlers (HTML semântico) |
| `generate-sitemap` | Sitemap de produtos |
| `generate-knowledge-sitemap` | Sitemap PT |
| `generate-knowledge-sitemap-en` | Sitemap EN |
| `generate-knowledge-sitemap-es` | Sitemap ES |
| `generate-documents-sitemap` | Sitemap de documentos |
| `knowledge-feed` | RSS/Atom/JSON feed |
| `document-proxy` | Proxy de documentos |

### 2.9 Copilot & CS (3)

| Função | Descrição |
|--------|-----------|
| `smart-ops-copilot` | Copilot IA com 25 ferramentas (Tool Calling) |
| `smart-ops-cs-processor` | Processador de regras CS |
| `smart-ops-wa-inbox-webhook` | Receptor de inbox WhatsApp |

### 2.10 Dados & Exportação (8)

| Função | Descrição |
|--------|-----------|
| `data-export` | API master (14 datasets, 3 formatos) |
| `get-product-data` | Busca de produto (4-step fuzzy match) |
| `export-parametros-ia` | Parâmetros para agentes IA |
| `export-processing-instructions` | Protocolos de processamento |
| `export-apostila-docx` | Exportação DOCX |
| `generate-parameter-pages` | Geração de páginas de parâmetros |
| `generate-veredict-data` | Dados de veredito |
| `format-processing-instructions` | Formatação de instruções |

### 2.11 Integrações Complementares (12)

| Função | Descrição |
|--------|-----------|
| `sync-pandavideo` | Sync PandaVideo |
| `sync-video-analytics` | Analytics de vídeo |
| `link-videos-to-articles` | Vinculação vídeo↔artigo |
| `sync-google-reviews` | Sync Google Reviews |
| `sync-google-drive-kb` | Sync Google Drive → KB |
| `sync-astron-members` | Sync Astron Academy |
| `astron-member-lookup` | Lookup de membro Astron |
| `astron-postback` | Postback Astron |
| `import-astron-csv` | Importação CSV Astron |
| `pandavideo-test` | Teste PandaVideo |
| `import-proposals-csv` | Importação CSV propostas |
| `import-system-a-json` | Importação JSON Sistema A |

### 2.12 Backfill & Manutenção (8)

| Função | Descrição |
|--------|-----------|
| `system-watchdog-deepseek` | Watchdog de saúde do sistema |
| `archive-daily-chats` | Arquivamento de chats diários |
| `backfill-keywords` | Backfill de keywords |
| `index-embeddings` | Indexação de embeddings |
| `index-spin-entries` | Indexação SPIN |
| `heal-knowledge-gaps` | Auto-heal de gaps de conhecimento |
| `ingest-knowledge-text` | Ingestão de texto KB |
| `create-technical-ticket` | Criação de ticket técnico |

---

## 🧩 3. MÓDULOS COMPARTILHADOS (`_shared/`) — 22 Arquivos

### 3.1 `piperun-field-map.ts` (1184 linhas)

**Funções exportadas:**
- `PIPELINES` — 12 pipelines mapeados: VENDAS (18784), ATOS (73999), EXPORTACAO (39047), DISTRIBUIDOR_LEADS (70898), ESTAGNADOS (72938), EBOOK (82128), TULIP_TESTE (83813), CS_ONBOARDING (83896), INTERESSE_CURSOS (93303), INSUMOS (100412), ECOMMERCE (102702), GANHOS_ALEATORIOS (104500)
- `STAGES_*` — 50+ etapas mapeadas por pipeline (VENDAS: 7, ESTAGNADOS: 10, CS_ONBOARDING: 15, INSUMOS: 5, CURSOS: 2, ECOMMERCE: 8)
- `STAGE_TO_ETAPA` / `ETAPA_TO_STAGE` — Mapeamento bidirecional stage_id ↔ label
- `DEAL_CUSTOM_FIELDS` — 10 campos customizados de deal com hashes para PUT
- `PERSON_CUSTOM_FIELDS` / `PESSOA_CUSTOM_FIELDS` — Custom fields de pessoa
- `PIPERUN_USERS` — 12 vendedores mapeados (ID, nome, email, role, cellphone)
- `DEAL_STATUS_MAP` — 0=aberta, 1=ganha, 2=perdida
- `mapDealToAttendance()` — Mapeia deal PipeRun → 100+ campos do lia_attendances
- `parseProposalItems()` — Parser de itens de proposta (strip HTML, classificação por categoria)
- `buildRichDealSnapshot()` — Rich snapshot com proposals, persons, companies
- `piperunGet()` / `piperunPost()` / `piperunPut()` — HTTP helpers
- `addDealNote()` / `fetchDealNotes()` — Notas de deal
- `customFieldsToHashMap()` — Converte custom fields para hash map (PUT)
- `deepParseStringifiedFields()` — Parse de campos JSON stringificados
- `cleanDealName()` / `cleanPersonName()` — Limpeza de nomes (remove timestamps Zapier)
- `stripHtmlShared()` — Strip HTML de textos de proposta

### 3.2 `sellflux-field-map.ts` (514 linhas)

**Funções exportadas:**
- `TAG_PREFIXES` — J (Journey), EC_ (E-commerce), Q_ (Qualification), C_ (Commercial), CS_, LIA_, A_ (Alert)
- `JOURNEY_TAGS` — J01_CONSCIENCIA → J06_APOIO
- `ECOMMERCE_TAGS` — 16 tags (EC_VISITOU_LOJA → EC_PROD_SMARTMAKE)
- `STAGNATION_TAGS` — A_ESTAGNADO_3D/7D/15D, A_SEM_RESPOSTA, A_RISCO_CHURN
- `LEGACY_TAG_MAP` — 22 mapeamentos diretos (legacy → standard)
- `LEGACY_TAG_PATTERNS` — 13 patterns regex para tags com sufixos de vendedor
- `LEGACY_TAG_FIELD_MAP` — 6 tags que extraem campos (clinica-consul → area_atuacao: "Clínica")
- `migrateLegacyTags()` — Migração completa com standardized + extracted fields + unmapped
- `buildSellFluxLeadParams()` — 17 campos para V1 GET
- `buildSellFluxCampaignPayload()` — 25+ campos para V2 POST
- `sendLeadToSellFlux()` / `sendCampaignViaSellFlux()` — HTTP senders
- `fetchLeadFromSellFlux()` — Fetch com parse de tags, fields, tracking, transaction, PIX/boleto
- `formatPhoneForWaLeads()` — Formatação BR: digits only + country code 55
- `detectProductTags()` — Nome do produto → tags e-commerce
- `computeTagsFromStage()` — Etapa comercial → tags de jornada

### 3.3 `system-prompt.ts` (251 linhas)

**Conteúdo:** SYSTEM_SUPER_PROMPT completo com:
- `ANTI_HALLUCINATION_RULES` — 6 regras absolutas anti-alucinação
- Identidade Editorial (tom profissional, claro, didático)
- Princípios E-E-A-T (Experience, Expertise, Authority, Trust)
- Coerência entre 14 funções de IA
- Linha Editorial SmartDent
- SEO + IA-First (hierarquia, keywords, estrutura semântica)
- LLM Knowledge Layer (ai-citation-box, entity annotations, citação normativa, geo-context)

### 3.4 `document-prompts.ts` (391 linhas)

**7 Prompts Especializados:**

| Tipo | Prompt | Categoria |
|------|--------|-----------|
| Perfil Técnico | `PROMPT_PERFIL_TECNICO` | C – Ciência |
| FDS | `PROMPT_FDS` | E – Guias |
| IFU | `PROMPT_IFU` | A – Tutoriais |
| Laudo | `PROMPT_LAUDO` | C – Ciência |
| Catálogo | `PROMPT_CATALOGO` | C – Ciência |
| Guia | `PROMPT_GUIA` | E – Guias |
| Certificado | `PROMPT_CERTIFICADO` | C – Ciência |

Todos compartilham `CABECALHO_PUBLICADOR` com regras anti-alucinação e SEO AI-First.

### 3.5 `testimonial-prompt.ts` (104 linhas)

**Prompt:** `TESTIMONIAL_PROMPT` — Técnica da Falácia Verdadeira
- Concordância progressiva (verdades óbvias → solução natural)
- Proibido: texto institucional, promessas, gatilhos artificiais
- Foco: decisão segura, narrativa fluida, autoridade silenciosa

### 3.6 `lia-sdr.ts` (236 linhas)

**Funções exportadas:**
- `buildCommercialInstruction()` — Prompt dinâmico SDR com:
  - 5 etapas SPIN (etapa_1→etapa_5) com instruções de turno
  - 5 réguas de maturidade (MQL, PQL, SAL, SQL, CLIENTE)
  - Regras comerciais críticas (max 3 perguntas, nunca inventar preços)
  - Categorias de solução: Chair Side Print, Smart Lab, Resinas Biocompatíveis
- `determineLeadArchetype()` — 9 arquétipos: clinica_com/sem_impressora, lab_com/sem, lead_frio, lead_quente, cliente_ativo, estudante, novo
- `ARCHETYPE_STRATEGIES` — Estratégia detalhada por arquétipo
- `classifyLeadMaturity()` — Classificação MQL/PQL/SAL/SQL/CLIENTE via dados CRM

### 3.7 `lia-escalation.ts` (219 linhas)

**Funções exportadas:**
- `detectEscalationIntent()` — Detecção de intenção:
  - `vendedor`: desconto, orçamento, proposta, compra, concorrência
  - `cs_suporte`: defeito, garantia, troca, devolução
  - `especialista`: frustração, insatisfação, 3+ fallbacks consecutivos
  - Guard: saudações/agradecimentos não trigaram escalação
- `ESCALATION_RESPONSES` — CTAs multilíngue (PT/EN/ES)
- `FALLBACK_MESSAGES` — Mensagens de fallback multilíngue
- `notifySellerEscalation()` — Notificação completa com bloco cognitivo, log em message_logs, envio WaLeads

### 3.8 `lia-guards.ts` (220 linhas)

**Funções exportadas:**
- `isGreeting()` — Detecção de saudação (PT/EN/ES, ≤5 palavras)
- `isSupportQuestion()` — 20+ patterns de suporte técnico
- `isSupportInfoQuery()` — Consulta informacional sobre tickets (não cria novo)
- `isProtocolQuestion()` — Detecção de protocolo de processamento
- `isPrinterParamQuestion()` — 17 patterns de parâmetros de impressora
- `isMetaArticleQuery()` — Consulta sobre artigos/autores
- `GENERAL_KNOWLEDGE_PATTERNS` — Filtro anti off-topic
- `PRICE_INTENT_PATTERNS` — Detecção de intenção de preço
- `upsertKnowledgeGap()` — Registro de gaps com dedup + frequência
- `STOPWORDS_PT` — 36 stopwords compartilhadas com RAG

### 3.9 `lia-rag.ts` (519 linhas)

**Funções exportadas:**
- `TOPIC_WEIGHTS` — Re-ranking por tópico (parameters, products, commercial, support) com 9 source_types
- `applyTopicWeights()` — Aplica pesos ao similarity score
- `searchByILIKE()` — Busca ILIKE em knowledge_contents (title, excerpt, ai_context)
- `searchCompanyKB()` — Busca em company_kb_texts com contexto de conversa
- `CONTENT_REQUEST_REGEX` — Detecção de pedido de conteúdo
- `searchContentDirect()` — Busca direta com cache (exact + FTS):
  1. Cache check (exact hit → FTS fallback, validade 30 dias para hits, 24h para misses)
  2. Vídeos (FTS portuguese), Artigos (ILIKE), Documentos (ILIKE), Resinas (ILIKE)
  3. Cache upsert fire-and-forget
- `searchProcessingProtocols()` — Busca em protocolos de processamento
- `searchParameterSets()` — Busca em parameter_sets
- `searchCatalogProducts()` — Busca em system_a_catalog
- `searchAuthors()` — Busca em authors
- `searchFAQAutoHeal()` — Busca em content_requests resolvidos

### 3.10 `lia-printer-dialog.ts` (341 linhas)

**Funções exportadas:**
- `DialogState` — 7 estados: needs_brand, needs_model, needs_resin, has_resin, brand_not_found, model_not_found, not_in_dialog
- `isOffTopicFromDialog()` — 15+ patterns de quebra de diálogo
- `detectPrinterDialogState()` — State machine principal com session persistence (2h timeout)
- `fetchActiveBrands()` / `fetchBrandModels()` / `fetchAvailableResins()` — DB helpers
- `findBrandInMessage()` / `findModelInList()` / `findResinInList()` — Matching fuzzy
- Mensagens localizadas: `ASK_BRAND`, `ASK_MODEL`, `ASK_RESIN`, `RESIN_FOUND`, `RESIN_NOT_FOUND`, `BRAND_NOT_FOUND`, `MODEL_NOT_FOUND` (PT/EN/ES)

### 3.11 `lia-lead-extraction.ts` (165 linhas)

**Função principal:** `extractImplicitLeadData()` — Extração NLP de:
- UF (27 estados + regex "sou de/moro em")
- Equipamento (tem_impressora/tem_scanner)
- Modelos de impressora (13: phrozen, anycubic, elegoo, etc.)
- Modelos de scanner (7: medit, 3shape, trios, etc.)
- Software CAD (9: exocad, 3shape, blender, etc.)
- Volume mensal (regex + categories)
- Aplicação principal (7: provisórios, guias, modelos, placas, coroas, alinhadores, moldeiras)
- Produto de interesse (24 patterns NLP)
- Concorrentes (31 marcas)
- Estrutura consultório, conhecimento SmartDent, motivo de não uso

### 3.12 `lead-enrichment.ts` (221 linhas)

**Funções exportadas:**
- `SOURCE_PRIORITY` — 10 fontes rankeadas: piperun_webhook (1) > sellflux (5) > meta_ads (6) > formulario (7) > default (10)
- `mergeSmartLead()` — Smart Merge com 5 categorias de campo:
  1. **PROTECTED**: id, email, entrada_sistema, piperun_id (nunca sobrescreve)
  2. **ALWAYS_UPDATE**: utm_*, tags_crm, valor, status, temperatura, proprietario
  3. **MERGE_ARRAY**: tags_crm, emails_secundarios, telefones_secundarios
  4. **MERGE_JSONB**: sellflux_custom_fields, raw_payload (deep merge)
  5. **ENRICHMENT_ONLY** (default): preenche se null
- `logEnrichmentAudit()` — Log em lead_enrichment_audit

### 3.13 `generate-embedding.ts` (203 linhas)

**Funções exportadas:**
- `generateEmbedding()` — Embedding (768 dims) com cache SHA256:
  - Suporta text-only (gemini-embedding-001) e multimodal (embedding-2-preview)
  - Cache em text_embedding_cache/image_embedding_cache com hit_count
  - Returns null on failure (fail-safe)
- `generateTextEmbedding()` — Conveniência para indexação (throws on failure)
- `generateImageEmbedding()` — Multimodal com contexto textual
- `isMultimodalEnabled()` — Check se modelo suporta imagem

### 3.14 `log-ai-usage.ts` (63 linhas)

**Funções exportadas:**
- `logAIUsage()` — Tracking em ai_token_usage com custo estimado
- `extractUsage()` — Extração de usage de resposta OpenAI-compatible
- `COST_RATES` — Custos por 1M tokens: lovable ($0.15/$0.60), deepseek ($0.14/$0.28), google ($0.01/$0.01)

### 3.15 `waleads-messaging.ts` (388 linhas)

**Funções exportadas:**
- `sendWaLeadsMessage()` — Envio via smart-ops-send-waleads
- `generateAILeadGreeting()` — Saudação IA personalizada (Gemini 2.5 Flash Lite)
- `buildSellerNotification()` — Notificação completa para vendedor com:
  - Dados do lead (nome, email, telefone, área, especialidade, interesse)
  - Última pergunta do lead
  - HISTÓRICO gerado por IA
  - OPORTUNIDADE gerada por IA
  - Bloco de Análise Cognitiva completo
- `generateHistoricoOportunidade()` — IA gera histórico + oportunidade

### 3.16 `citation-builder.ts` (78 linhas)

**Funções exportadas:**
- `buildCitationBlock()` — Bloco LLM-ready invisível (ai-citation-box) com sr-only h2
- `buildGeoContextBlock()` — Div geo-context para crawlers IA (BR-SP, Smart Dent/Mmtech, 2009)
- `buildEntityAnnotation()` — Span com data-entity-id + data-wikidata
- `buildEntityGraphJsonLd()` — JSON-LD schema about/mentions

### 3.17 `entity-dictionary.ts` (217 linhas)

**Conteúdo:** `INTERNAL_ENTITY_INDEX` — 19 entidades Wikidata-linked:
- Odontologia, Odontologia Digital, Implante, Prótese, Ortodontia
- Resina Composta, Zircônia, Cerâmica, PMMA
- Impressão 3D, CAD/CAM, Scanner Intraoral, Fotopolimerização, DLP, LCD/mSLA, SLA
- ISO 4049, ISO 10993, RDC 185 ANVISA
- Fluxo Chairside, Guia Cirúrgico, Modelo de Estudo
- ANP Technology (proprietário SmartDent)

**Funções:** `matchEntities()`, `buildEntityGraph()`

### 3.18 `extraction-rules.ts` (153 linhas)

**Conteúdo:** Regras compartilhadas para extração e publicação:
- `PRINCIPIO_MAE` — PDF é a fonte da verdade
- `REGRAS_ANTI_ALUCINACAO` — 7 proibições absolutas
- `CONTEXTO_GEO` — Mercado BR, odontologia digital
- `CABECALHO_EXTRATOR` / `CABECALHO_PUBLICADOR` — Headers padronizados

### 3.19 `og-visual-dictionary.ts` (474 linhas)

**Conteúdo:** Dicionário visual para geração de imagens OG:
- 10 tipos de documento: guia_workflow, laudo, catalogo, ifu, fds, perfil_tecnico, manual_tecnico, certificado, guia, outro
- 6 Golden Rules de override por contexto (splint/bruxismo, Vitality, ISO 10993-*, guia cirúrgico, ortodontia, prótese removível)
- `detectGenerationMode()` — EDIT / COMPOSITE / EQUIPMENT / CONCEPTUAL / GENERATE
- `buildSmartPrompt()` — Prompt IA contextualizado com regras anti-alucinação visual

### 3.20 `rate-limiter.ts` (95 linhas)

**Funções exportadas:**
- `checkRateLimit()` — Rate limiting via system_health_logs (requests/minuto)
- `rateLimitResponse()` — Resposta 429 com Retry-After header
- Fail-open: permite request se contagem falhar

### 3.21 `resilient-fetch.ts` (85 linhas)

**Funções exportadas:**
- `resilientFetch()` — Retry com exponential backoff:
  - maxRetries=3, backoff=500ms, timeout=15s
  - Dead letter logging em system_health_logs
  - Não retenta 400/404 (client error)

### 3.22 `piperun-hierarchy.ts` (283 linhas)

**Funções exportadas:**
- `findPersonByEmail()` — Busca pessoa por email na API PipeRun
- `createPerson()` — Cria pessoa com custom fields
- `updatePersonFields()` — Atualiza campos da pessoa
- `findOrCreateCompany()` — Busca ou cria empresa
- `fetchCompanyData()` — Fetch dados da empresa
- `findPersonDeals()` — Busca deals da pessoa
- `updateExistingDeal()` — Atualiza deal existente com nota
- `moveDealToVendas()` — Move deal de Estagnados → Vendas
- `createNewDeal()` — Cria novo deal com nota
- `resolveFirstStage()` — Resolve primeira etapa do pipeline

---

## 🤖 4. PROMPTS DE IA COMPLETOS

### 4.1 SYSTEM_SUPER_PROMPT (system-prompt.ts)

Transcrição integral na seção 3.3. Prompt principal de ~250 linhas que governa toda geração de conteúdo com:
- Anti-alucinação (6 regras absolutas)
- E-E-A-T (Google)
- Consistência entre 14 funções de IA
- LLM Knowledge Layer (citation box, entity annotations, normas, geo-context)

### 4.2 Cognitive Analysis Prompt (cognitive-lead-analysis)

Prompt de ~40 linhas que classifica leads em 10 eixos via DeepSeek:

1. **lead_stage_detected**: MQL_pesquisador | PQL_recompra | SAL_comparador | SQL_decisor | CLIENTE_ativo
2. **interest_timeline**: imediato | 3_6_meses | 6_12_meses | indefinido
3. **urgency_level**: alta | media | baixa
4. **psychological_profile**: Frase descritiva
5. **primary_motivation**: Motivação principal
6. **objection_risk**: Objeção provável
7. **recommended_approach**: Instrução imperativa para IA
8. **confidence_score_analysis**: 0-100
9. **stage_trajectory**: Evolução temporal (ex: "MQL→SAL→abandono→MQL")
10. **seasonal_pattern**: Padrões temporais de contato

**Override determinístico:** Se `status_oportunidade = 'ganha'` e reentrada autônoma → força PQL_recompra.

### 4.3 SDR Consultivo Prompt (lia-sdr.ts)

5 réguas de maturidade detalhadas na seção 3.6. Cada régua define:
- Objetivo, Tom, Abordagem, Foco
- O que enviar / O que proibir
- Exemplos de cross-sell (PQL)

### 4.4 Copilot System Prompt

Regra absoluta de execução autônoma: o Copilot SEMPRE executa as ferramentas necessárias sem pedir confirmação. Usa DeepSeek ou Gemini 3 Flash conforme seleção do usuário.

---

## 🔧 5. COPILOT IA — 25 FERRAMENTAS (Tool Calling)

| # | Ferramenta | Descrição |
|---|-----------|-----------|
| 1 | `query_leads` | Busca leads por filtros (até 50) |
| 2 | `update_lead` | Atualiza campos de um lead |
| 3 | `add_tags` | Adiciona tags ao tags_crm |
| 4 | `create_audience` | Cria público/segmento |
| 5 | `send_whatsapp` | Envia WhatsApp via WaLeads |
| 6 | `notify_seller` | Notifica vendedor |
| 7 | `search_videos` | Busca vídeos KB |
| 8 | `search_content` | Busca artigos KB |
| 9 | `query_table` | Consulta genérica qualquer tabela |
| 10 | `describe_table` | Lista colunas/tipos de tabela |
| 11 | `query_stats` | Métricas agregadas |
| 12 | `check_missing_fields` | Auditoria de campos nulos |
| 13 | `send_to_sellflux` | Envia lead para SellFlux |
| 14 | `call_loja_integrada` | Consulta API Loja Integrada |
| 15 | `unify_leads` | Merge de duplicatas |
| 16 | `ingest_knowledge` | Injeta texto no RAG |
| 17 | `create_article` | Cria artigo via orquestrador IA |
| 18 | `import_csv` | Importa CSV para leads |
| 19 | `calculate` | Cálculos: ROI, LTV, churn, conversão |
| 20 | `query_leads_advanced` | Busca avançada (JSONB, datas, ranges, arrays) até 200 |
| 21 | `bulk_campaign` | Campanha em lote (filtro + tags + SellFlux) até 500 |
| 22 | `move_crm_stage` | Move lead no funil CRM (PipeRun + local) |
| 23 | `query_ecommerce_orders` | Consulta pedidos e-commerce |
| 24 | `verify_consolidation` | Auditoria de consolidação de dados |
| 25 | `query_deal_history` | Busca no histórico de deals (JSONB lateral join) |

---

## 🔄 6. FLUXOS DE DADOS DE LEADS

### 6.1 PipeRun → Sistema (100+ campos)

Via `mapDealToAttendance()`:
- **Identificação**: piperun_id, email (cascade: person.contact_emails → person.emails → reference → company.emails), nome (cleanPersonName), telefone (whatsapp CF → person.phones → company.phones)
- **CRM**: funil_entrada_crm, ultima_etapa_comercial, proprietario_lead_crm, status_oportunidade, valor_oportunidade
- **Pessoa**: hash, CPF, cargo, gênero, LinkedIn, Facebook, nascimento, endereço, LGPD
- **Empresa**: hash, razão social, CNPJ, IE, CNAE, segmento, situação, porte, website, endereço
- **Deal**: hash, description, frozen, probability, lead_time, MRR, tags, activities, forms
- **Propostas**: proposals_data, proposals_total_value, proposals_total_mrr, itens_proposta_parsed (com classificação de equipamentos)
- **Custom Fields**: especialidade, produto_interesse, tem_scanner, tem_impressora, país, informação desejada, código contrato, data treinamento

### 6.2 Sistema → PipeRun

Via `mapAttendanceToDealCustomFields()` e `piperun-hierarchy.ts`:
- Custom fields: especialidade, produto_interesse, area_atuacao, tem_scanner, tem_impressora, whatsapp, banco_dados_id
- Person: nome, telefone, job_title, custom_fields (area_atuacao, especialidade)
- Company: nome, emails, phones, CNPJ, segmento, website
- Deal notes: notificações LIA com bloco cognitivo

### 6.3 SellFlux → Sistema

Via `smart-ops-sellflux-webhook`:
- Tags legacy migradas via `migrateLegacyTags()` (22 direct + 13 patterns)
- Custom fields: atual-id-pipe → piperun_id, tracking, transaction, PIX/boleto
- Detecção de origem: e-commerce (tracking/transaction) vs automação

### 6.4 Sistema → SellFlux

Via `buildSellFluxLeadParams()` (V1 GET — 17 campos):
- email, nome, phone, area_atuacao, especialidade, produto_interesse, impressora, scanner, resina, cidade, uf, source, score, status_lead, proprietario, piperun_id, software_cad, volume_pecas, aplicacao

Via `buildSellFluxCampaignPayload()` (V2 POST — 25+ campos):
- Todos os acima + primeiro_nome, template_id, tags, etapa_comercial, atual-id-pipe, bought-resin, platform_mail/pass, train_date, scheduled_by

### 6.5 Meta Ads → Sistema

Via `smart-ops-meta-lead-webhook`:
- Lead Ads: nome, email, telefone, platform_lead_id, platform_campaign_id, platform_form_id
- Integração com ingest-lead → smart merge

### 6.6 Loja Integrada → Sistema

Via `smart-ops-ecommerce-webhook` + `poll-loja-integrada-orders`:
- Pedidos: status, valor, data, itens, rastreamento
- Cliente: li_cliente_id, lojaintegrada_ltv, ultimo_pedido_*
- Tags automáticas: EC_PAGAMENTO_APROVADO, EC_PROD_RESINA, etc.

---

## 🏷️ 7. MAPEAMENTO DE TAGS CRM

### Tags de Jornada (J)
| Tag | Significado |
|-----|-------------|
| J01_CONSCIENCIA | Consciência — primeiro contato |
| J02_CONSIDERACAO | Consideração — em análise |
| J03_NEGOCIACAO | Negociação — proposta/negociação ativa |
| J04_COMPRA | Compra — contrato fechado |
| J05_RETENCAO | Retenção — cliente ativo |
| J06_APOIO | Apoio — embaixador/referência |

### Tags E-commerce (EC_)
16 tags: EC_VISITOU_LOJA, EC_ADICIONOU_CARRINHO, EC_ABANDONOU_CARRINHO, EC_INICIOU_CHECKOUT, EC_GEROU_BOLETO, EC_BOLETO_VENCIDO, EC_PAGAMENTO_APROVADO, EC_PEDIDO_CANCELADO, EC_PEDIDO_ENVIADO, EC_PEDIDO_ENTREGUE, EC_CLIENTE_RECORRENTE, EC_CLIENTE_INATIVO, EC_PROD_RESINA, EC_PROD_INSUMO, EC_PROD_KIT_CARAC, EC_PROD_SMARTMAKE

### Tags de Estagnação (A_)
A_ESTAGNADO_3D, A_ESTAGNADO_7D, A_ESTAGNADO_15D, A_SEM_RESPOSTA, A_RISCO_CHURN

### Tags LIA
LIA_LEAD_NOVO, LIA_LEAD_REATIVADO, LIA_LEAD_ATIVADO, LIA_ATENDEU

### Legacy Tags Mapeadas (22 diretos)
compra-realizada → EC_PAGAMENTO_APROVADO + J04_COMPRA, pedido-pago → EC_PAGAMENTO_APROVADO, cancelado → EC_PEDIDO_CANCELADO, aguardando-pagamento → EC_INICIOU_CHECKOUT, gerou-boleto → EC_GEROU_BOLETO, bought-resin-auto → EC_PROD_RESINA, ios-comprado → Q_TEM_SCANNER, cliente-smart → J05_RETENCAO, chatbot-client-enviado → LIA_ATENDEU, etc.

---

## 🎯 8. HIERARQUIA DE FUNIL E STAGES

### Lead Status (Lifecycle)
```
visitante → lead → MQL_pesquisador → PQL_recompra → SAL_comparador → SQL_decisor → CLIENTE_ativo
```

### Deal Status (PipeRun)
| Código | Status |
|--------|--------|
| 0 | aberta |
| 1 | ganha |
| 2 | perdida |

### Pipelines e Stages Mapeados

**Funil de Vendas (18784)**: sem_contato → contato_feito → em_contato → apresentacao → proposta_enviada → negociacao → fechamento

**Funil Estagnados (72938)**: est_etapa1 → est_etapa2 → est_etapa3 → est_etapa4 → est_apresentacao → est_proposta → estagnado_final + auxiliar + get_new_owner

**CS Onboarding (83896)**: 15 etapas: auxiliar_email → em_espera → sem_data_agendar → nao_quer_imersao → treinamento_agendado → treinamento_realizado → enviar_imp3d → equipamentos_entregues → retirar_scan_imp3d → acompanhamento_15d → acomp_30d_comercial → acompanhamento_atencao → acompanhamento_finalizado

**Funil Insumos (100412)**: sem_contato → contato_feito → amostra_enviada → retorno_amostra → fechamento

**E-commerce (102702)**: visitantes → navegacao → checkout → abandono → transacao → pedido → pos_venda → ativacao_mensal

---

## 🔌 9. INTEGRAÇÕES EXTERNAS

### 9.1 PipeRun (CRM)
- **API**: v1 REST (`https://api.pipe.run/v1`)
- **Direção**: Bidirecional
- **Auth**: Token API (env: `PIPERUN_API_KEY`)
- **Sync**: Webhook (deal create/update/delete) + Incremental cursor (500/chunk) + Full sync
- **Custom Fields**: 10 deal CFs + 2 person CFs com hash mapping para PUT
- **Vendedores**: 12 mapeados com ID, email, role, cellphone

### 9.2 SellFlux (Automação)
- **Push V1**: GET com query params (17 campos)
- **Push V2**: POST com JSON (25+ campos)
- **Webhook Receiver**: Detecção dinâmica de origem
- **Auth**: URLs de webhook (env: `SELLFLUX_WEBHOOK_LEADS`, `SELLFLUX_WEBHOOK_CAMPAIGNS`)

### 9.3 Loja Integrada (E-commerce)
- **Auth**: Dual-Auth (chave_aplicacao + chave_api)
- **Sync**: Polling + Webhooks
- **Env**: `LOJA_INTEGRADA_CHAVE_API`, `LOJA_INTEGRADA_CHAVE_APLICACAO`

### 9.4 Meta Ads
- **API**: Lead Ads Webhook + Ads Insights
- **Auth**: Via Lovable AI Gateway consolidado
- **Env**: `META_ACCESS_TOKEN`, `META_PAGE_ID`

### 9.5 Astron Academy
- **Sync**: Postback + sync members
- **Auth**: `ASTRON_API_KEY`
- **Dados**: Cursos, planos, login, progresso

### 9.6 PandaVideo
- **Sync**: Sync de vídeos + analytics
- **Auth**: `PANDAVIDEO_API_KEY`
- **Dados**: Vídeos, transcrições, thumbnails, tags, views

### 9.7 Google Reviews
- **Auth**: `GOOGLE_MAPS_API_KEY`
- **Dados**: Reviews, rating, place_id

### 9.8 WaLeads (WhatsApp)
- **API**: Messaging (text, image, audio, video, document)
- **Auth**: `waleads_api_key` por team_member
- **Dados**: Envio de mensagens, notificações de escalação

### 9.9 Google AI (Embeddings)
- **Model**: gemini-embedding-001 (768 dims)
- **Auth**: `GOOGLE_AI_KEY`
- **Cache**: SHA256 em text_embedding_cache

### 9.10 Lovable AI Gateway (LLM)
- **Models**: google/gemini-2.5-flash-lite, google/gemini-3-flash-preview
- **Auth**: `LOVABLE_API_KEY`
- **Uso**: Conteúdo, saudações, OG images, copilot

### 9.11 DeepSeek (Cognitive)
- **Model**: deepseek-chat
- **Auth**: `DEEPSEEK_API_KEY`
- **Uso**: Análise cognitiva, watchdog

---

## 🔐 10. SECRETS E CONFIGURAÇÃO

### Environment Variables Necessárias

| Secret | Usado em |
|--------|---------|
| `SUPABASE_URL` | Todas as functions |
| `SUPABASE_SERVICE_ROLE_KEY` | Todas as functions |
| `PIPERUN_API_KEY` | CRM sync, lia-assign, kanban-move |
| `DEEPSEEK_API_KEY` | cognitive-lead-analysis, copilot, watchdog |
| `LOVABLE_API_KEY` | ai-orchestrate, ai-content-formatter, copilot, waleads-messaging, dra-lia |
| `GOOGLE_AI_KEY` | generate-embedding, index-embeddings |
| `META_ACCESS_TOKEN` | meta-ads-manager, meta-ads-insights |
| `META_PAGE_ID` | meta-lead-webhook |
| `PANDAVIDEO_API_KEY` | sync-pandavideo, sync-video-analytics |
| `ASTRON_API_KEY` | sync-astron-members, astron-member-lookup |
| `LOJA_INTEGRADA_CHAVE_API` | poll-loja-integrada, sync-clients |
| `LOJA_INTEGRADA_CHAVE_APLICACAO` | poll-loja-integrada, sync-clients |
| `SELLFLUX_WEBHOOK_LEADS` | sellflux-sync, copilot |
| `SELLFLUX_WEBHOOK_CAMPAIGNS` | sellflux-sync, copilot |
| `GOOGLE_DRIVE_FOLDER_ID` | sync-google-drive-kb |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | sync-google-drive-kb, sync-google-reviews |

### Supabase Config (config.toml)

- **Projeto**: `okeogjgqijbfkudfjadz`
- **JWT Verificação**: Apenas 3 funções exigem JWT (`create-user`, `ai-metadata-generator`, `heal-knowledge-gaps`, `create-test-articles`). As 90+ restantes são `verify_jwt = false` (service-to-service ou webhooks públicos).

---

## 📊 11. DATABASE FUNCTIONS

| Função | Propósito |
|--------|---------|
| `normalize_text()` | Remove acentos (transliteração manual) |
| `normalize_name_for_compare()` | Normaliza nome para comparação (unaccent + lowercase) |
| `search_knowledge_base()` | Busca KB com similarity + FTS (artigos + vídeos) |
| `match_agent_embeddings()` | Busca vetorial 768d (cosine, threshold 0.70) |
| `match_agent_embeddings_v2()` | Busca vetorial v2 (vector_v2, threshold 0.60) |
| `get_rag_stats()` | Estatísticas RAG por source_type |
| `increment_lookup_hit()` | Incrementa hit_count em cache |
| `merge_tags_crm()` | Merge de tags (append + dedup + sort) |
| `fn_calc_workflow_score()` | Calcula workflow_score (0-10, 5 etapas) |
| `fn_trigger_workflow_score()` | Trigger para recalcular score |
| `fn_normalize_phone()` | Trigger para normalizar telefone |
| `fn_portfolio_cell_update()` | Trigger para atualizar portfolio_json |
| `fn_get_lead_context()` | Contexto completo do lead (cursos, compras, carrinhos, SDR) |
| `fn_search_leads_by_proposal_product()` | Busca leads por produto na proposta (JSONB lateral) |
| `fn_list_proposal_products()` | Lista produtos mais frequentes em propostas |
| `fn_search_deals_by_status()` | Busca deals por status/produto/vendedor/valor |
| `fn_deduplicate_proposal_csv()` | Deduplicação de CSV de propostas |
| `fn_map_lead_source()` | Detecta fonte do lead (meta/loja/sellflux/formulário) |
| `sync_lia_to_people_graph()` | Trigger: sincroniza LTV para people |
| `trigger_evaluate_interaction()` | Trigger: avalia interação via edge function |
| `validate_support_case_status()` | Validação de status de caso de suporte |
| `update_extra_data_reviews()` | Atualiza reviews em system_a_catalog |
| `update_knowledge_videos_search_vector()` | Atualiza tsvector de busca de vídeos |

---

## 🏁 12. RESUMO EXECUTIVO

| Métrica | Valor |
|---------|-------|
| Edge Functions | 95+ |
| Módulos Compartilhados | 22 |
| Tabelas do Sistema | 30+ |
| Colunas em lia_attendances | 428+ |
| Integrações Externas | 11 |
| Ferramentas do Copilot | 25 |
| Prompts de IA | 12 (system + 7 docs + testimonial + cognitive + SDR + copilot) |
| Pipelines CRM | 12 |
| Stages Mapeados | 50+ |
| Tags Padronizadas | 40+ |
| Entidades Wikidata | 19 |
| Vendedores Mapeados | 12 |
| Idiomas Suportados | 3 (PT/EN/ES) |
| Secrets Necessários | 16+ |

---

*Documento gerado por análise integral do código-fonte. Todas as informações foram extraídas diretamente dos arquivos do projeto.*
