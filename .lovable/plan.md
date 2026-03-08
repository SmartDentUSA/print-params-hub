# Revenue Intelligence OS — Documento Técnico Completo

**Versão:** 3.0 | **Última atualização:** 2026-03-06
**Plataforma:** Smart Dent Revenue Intelligence OS
**Stack:** React + Vite + Tailwind + TypeScript (frontend) | Supabase Edge Functions + Deno (backend)
**Supabase Project:** `okeogjgqijbfkudfjadz`

---

## ÍNDICE

1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Frontend — Páginas e Componentes](#2-frontend)
3. [Backend — Edge Functions (85+)](#3-edge-functions)
4. [Módulos Compartilhados (_shared)](#4-módulos-compartilhados)
5. [Sistema de IA — Modelos e Uso](#5-sistema-de-ia)
6. [Integrações Externas](#6-integrações-externas)
7. [CDP — lia_attendances (~200 colunas)](#7-cdp)
8. [Geração de Conteúdo — Pipeline Completo](#8-geração-de-conteúdo)
9. [Gestão de Leads — Fluxo Completo](#9-gestão-de-leads)
10. [WhatsApp Loop — Hunter/Sentinela/Reativação](#10-whatsapp-loop)
11. [Sincronização CRM (PipeRun)](#11-piperun-sync)
12. [Base de Conhecimento e SEO](#12-knowledge-base)
13. [Qualidade do Sistema — Avaliação](#13-qualidade)
14. [Funções Subutilizadas / Sem Uso](#14-funcoes-subutilizadas)
15. [Bugs Corrigidos](#15-bugs-corrigidos)
16. [Pendências](#16-pendências)
17. [Secrets e Configuração](#17-secrets)
18. [Checklist de Deploy](#18-checklist)

---

## 1. Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                     FONTES DE ENTRADA                           │
│  WaLeads · SellFlux · Meta Leads · PipeRun · Loja Integrada    │
│  Astron Members · Google Reviews · Google Drive · Formulários   │
└──────────────┬──────────────────────────────────────────────────┘
               │ webhooks / APIs
┌──────────────▼──────────────────────────────────────────────────┐
│              EDGE FUNCTIONS (Supabase, 85+ funções)             │
│                                                                  │
│  ┌─ INGESTÃO ──────────────────────────────────────────────┐    │
│  │ smart-ops-ingest-lead    smart-ops-piperun-webhook      │    │
│  │ smart-ops-meta-lead-webhook  smart-ops-ecommerce-webhook│    │
│  │ smart-ops-sellflux-webhook   import-leads-csv           │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─ INTELIGÊNCIA / IA ─────────────────────────────────────┐    │
│  │ dra-lia (5092 linhas — agente principal)                 │    │
│  │ dra-lia-whatsapp (540 linhas — agente WhatsApp)          │    │
│  │ cognitive-lead-analysis (481 linhas — perfil psicográfico)│    │
│  │ batch-cognitive-analysis   evaluate-interaction          │    │
│  │ ai-orchestrate-content   ai-content-formatter            │    │
│  │ ai-metadata-generator    ai-model-compare                │    │
│  │ ai-generate-og-image     ai-enrich-pdf-content           │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─ ORQUESTRAÇÃO COMERCIAL ────────────────────────────────┐    │
│  │ smart-ops-lia-assign (1196 linhas — roteamento PipeRun)  │    │
│  │ smart-ops-sync-piperun   smart-ops-kanban-move           │    │
│  │ smart-ops-proactive-outreach  smart-ops-stagnant-processor│   │
│  │ smart-ops-send-waleads   smart-ops-wa-inbox-webhook      │    │
│  │ smart-ops-sellflux-sync  piperun-full-sync               │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─ CONTEÚDO / SEO ────────────────────────────────────────┐    │
│  │ generate-sitemap   generate-knowledge-sitemap(-en/-es)   │    │
│  │ generate-documents-sitemap   generate-parameter-pages    │    │
│  │ translate-content   enrich-article-seo   backfill-keywords│   │
│  │ reformat-article-html   auto-inject-product-cards        │    │
│  │ knowledge-feed    heal-knowledge-gaps                     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─ PDF / DOCUMENTOS ──────────────────────────────────────┐    │
│  │ extract-pdf-text   extract-pdf-raw   extract-pdf-specialized│  │
│  │ extract-and-cache-pdf   document-proxy   export-apostila-docx│ │
│  │ seo-proxy                                                 │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─ INTEGRAÇÕES ───────────────────────────────────────────┐    │
│  │ sync-pandavideo   sync-video-analytics   link-videos     │    │
│  │ sync-google-reviews   sync-google-drive-kb               │    │
│  │ sync-astron-members   astron-member-lookup                │    │
│  │ import-loja-integrada   poll-loja-integrada-orders        │    │
│  │ register-loja-webhooks                                    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─ SISTEMA / MONITORAMENTO ───────────────────────────────┐    │
│  │ system-watchdog-deepseek   backfill-intelligence-score   │    │
│  │ backfill-lia-leads   index-embeddings   index-spin-entries│   │
│  │ create-user   data-export   test-api-viewer              │    │
│  └─────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────────────────┐
│              BANCO DE DADOS (Supabase Postgres)                  │
│                                                                  │
│  lia_attendances (CDP ~200 cols)   leads (legado)               │
│  agent_interactions   agent_sessions   agent_embeddings         │
│  whatsapp_inbox   message_logs   lead_state_events              │
│  knowledge_contents   knowledge_categories   knowledge_videos   │
│  system_a_catalog   catalog_documents   resins   brands/models  │
│  team_members   cs_automation_rules   external_links            │
│  ai_token_usage   system_health_logs   intelligence_score_config│
│  content_requests   knowledge_gap_drafts   company_kb_texts     │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Frontend — Páginas e Componentes

### 2.1 Páginas Públicas

| Rota | Arquivo | Descrição |
|------|---------|-----------|
| `/` | `Index.tsx` | Homepage — catálogo de parâmetros por Marca → Modelo → Resina |
| `/:brandSlug` | `Index.tsx` | Lista modelos de uma marca |
| `/:brandSlug/:modelSlug` | `Index.tsx` | Lista resinas/parâmetros de um modelo |
| `/:brandSlug/:modelSlug/:resinSlug` | `Index.tsx` | Parâmetros específicos |
| `/base-conhecimento` | `KnowledgeBase.tsx` | Base de conhecimento pública (artigos SEO) |
| `/base-conhecimento/:letter/:slug` | `KnowledgeBase.tsx` | Artigo individual |
| `/en/knowledge-base/...` | `KnowledgeBase.tsx` | Versão inglês |
| `/es/base-conocimiento/...` | `KnowledgeBase.tsx` | Versão espanhol |
| `/produtos/:slug` | `ProductPage.tsx` | Página de produto do catálogo |
| `/depoimentos/:slug` | `TestimonialPage.tsx` | Depoimento individual |
| `/categorias/:slug` | `CategoryPage.tsx` | Categoria de conteúdo |
| `/sobre` | `About.tsx` | Sobre a empresa |
| `/docs/:filename` | `DocumentProxyRoute.tsx` | Proxy para documentos técnicos |
| `/embed/dra-lia` | `AgentEmbed.tsx` | Widget da Dra. LIA para iframe |
| `/f/:slug` | `PublicFormPage.tsx` | Formulários públicos |
| `/resinas/:slug` | `ResinRedirect.tsx` | Redirect para resinas |

### 2.2 Painel Admin

| Rota | Arquivo | Descrição |
|------|---------|-----------|
| `/admin` | `AdminViewSecure.tsx` | Painel admin protegido por auth |

### 2.3 Componentes Admin (aba por aba)

| Componente | Funcionalidade | Status |
|------------|---------------|--------|
| `AdminCatalog` | CRUD de produtos do catálogo | ✅ Ativo |
| `AdminKnowledge` | Editor de artigos (TipTap), geração por IA | ✅ Ativo |
| `AdminModels` | CRUD de marcas/modelos/parâmetros | ✅ Ativo |
| `AdminVideosList` | Gestão de vídeos + sync PandaVideo | ✅ Ativo |
| `AdminDocumentsList` | Gestão de documentos técnicos | ✅ Ativo |
| `AdminAuthors` | CRUD de autores | ✅ Ativo |
| `AdminExternalLinks` | Gestão de links SEO | ✅ Ativo |
| `AdminStats` | Dashboard de estatísticas | ✅ Ativo |
| `AdminUsers` | Gestão de usuários/auth | ✅ Ativo |
| `AdminSettings` | Configurações gerais | ✅ Ativo |
| `AdminDraLIAStats` | Métricas da Dra. LIA | ✅ Ativo |
| `AdminPandaVideoSync` | Sincronização PandaVideo | ✅ Ativo |
| `AdminArticleEnricher` | Enriquecimento SEO de artigos | ✅ Ativo |
| `AdminArticleReformatter` | Reformatação HTML de artigos | ✅ Ativo |
| `AdminBatchTranslator` | Tradução em lote (PT→EN/ES) | ✅ Ativo |
| `AdminParameterPages` | Geração de páginas por parâmetro | ✅ Ativo |
| `AdminApostilaImporter` | Importação de apostilas | ✅ Ativo |
| `AdminLinkBuildingValidator` | Validação de link building | ✅ Ativo |
| `SEOAuditPanel` | Painel de auditoria SEO | ✅ Ativo |

### 2.4 Componentes SmartOps (CRM)

| Componente | Funcionalidade | Status |
|------------|---------------|--------|
| `SmartOpsKanban` | Kanban bidirecional com PipeRun (11 funis) | ✅ Ativo |
| `SmartOpsLeadsList` | Lista de leads filtrada | ✅ Ativo |
| `SmartOpsWhatsAppInbox` | Inbox de mensagens WA | ✅ Ativo |
| `SmartOpsIntelligenceDashboard` | Dashboard de inteligência | ✅ Ativo |
| `SmartOpsGoals` | Metas da equipe | ✅ Ativo |
| `SmartOpsTeam` | Gestão da equipe | ✅ Ativo |
| `SmartOpsLogs` | Logs do sistema | ✅ Ativo |
| `SmartOpsReports` | Relatórios | ✅ Ativo |
| `SmartOpsContentProduction` | Produção de conteúdo | ✅ Ativo |
| `SmartOpsCSRules` | Regras de automação CS | ✅ Ativo |
| `SmartOpsFormBuilder` | Construtor de formulários públicos | ✅ Ativo |
| `SmartOpsFormEditor` | Editor de formulários | ✅ Ativo |
| `SmartOpsBowtie` | Visualização bowtie | ✅ Ativo |
| `SmartOpsModelCompare` | Comparação de modelos de IA | ✅ Ativo |
| `SmartOpsSellerAutomations` | Automações de vendedores | ✅ Ativo |
| `SmartOpsLeadImporter` | Importação de leads (CSV) | ✅ Ativo |
| `SmartOpsSystemHealth` | Saúde do sistema | ✅ Ativo |
| `SmartOpsAIUsageDashboard` | Dashboard de uso de IA/tokens | ✅ Ativo |

### 2.5 Widget Flutuante

| Componente | Descrição |
|------------|-----------|
| `DraLIA` | Widget flutuante da Dra. LIA — presente em todas as páginas públicas (exceto admin e embed) |

---

## 3. Edge Functions — Inventário Completo

### 3.1 Dra. LIA — Agente Principal

| Função | Linhas | Descrição |
|--------|--------|-----------|
| `dra-lia` | 5092 | Agente conversacional principal. RAG multi-fonte (8 indexes), diálogo guiado de parâmetros (Marca→Modelo→Resina), SDR consultivo com SPIN selling, detecção de suporte, SSE streaming |
| `dra-lia-whatsapp` | 540 | Agente autônomo WhatsApp. Recebe webhooks, resolve @lid, dedup 4 camadas, chama dra-lia via SSE, envia resposta via WaLeads |
| `dra-lia-export` | ~100 | Exporta histórico de conversas da LIA |

**Lógica do `dra-lia` (5092 linhas):**

1. **RAG Pipeline:** Busca em `agent_embeddings` (similarity search) + fallback ILIKE em `knowledge_contents` + `company_kb_texts`
2. **Topic Re-ranking:** Pesos por contexto (parameters: 1.5x parameter_set, commercial: 1.8x catalog_product)
3. **Diálogo Guiado de Parâmetros:** Estado de máquina brand→model→resin com fuzzy matching
4. **SDR Consultivo:** Instruções dinâmicas por etapa SPIN (etapa_1 a etapa_5) + régua de maturidade (MQL/PQL/SAL/SQL/CLIENTE)
5. **Anti-alucinação:** Regras estritas — só cita dados das fontes
6. **Detecção de Suporte:** Regex para problemas técnicos → redirect WhatsApp
7. **Detecção de Greeting:** Regex multi-idioma → resposta curta sem RAG
8. **Problem Guard:** Intercepta relatos de falha antes do diálogo de parâmetros
9. **Dialog Break Detection:** Detecta mudança de assunto durante diálogo guiado
10. **Extração implícita de dados:** NLP para capturar interesses em produtos (RayShape, Exoplan, Medit)
11. **Trigger cognitivo:** Dispara `cognitive-lead-analysis` após 5+ msgs ou 180s inatividade
12. **Finalização:** Salva resumo, incrementa counters, persiste sessão

### 3.2 Orquestração Comercial

| Função | Linhas | Descrição |
|--------|--------|-----------|
| `smart-ops-lia-assign` | 1196 | Roteamento PipeRun: Pessoa→Empresa→Oportunidade. Regra de Ouro (não sobrescreve owner de deals abertos em Vendas). Gera saudação AI (Gemini Flash Lite) + briefing estratégico (DeepSeek). Provisiona Astron. |
| `smart-ops-ingest-lead` | 327 | Gateway de ingestão universal. Smart Merge (nunca sobrescreve campos protegidos). Detecta PQL determinístico. Dispara lia-assign + cognitive-analysis + SellFlux sync. |
| `smart-ops-sync-piperun` | 291 | Sincronização bidirecional. Modo orquestrador (11 pipelines) + modo single. Smart merge, detecção estagnado↔resgatado. Safe JSON parsing. |
| `smart-ops-kanban-move` | 68 | Move deal entre etapas no PipeRun quando card é arrastado no Kanban |
| `smart-ops-stagnant-processor` | 345 | Motor de estagnação (5 dias/etapa). DeepSeek para decisão estratégica, Gemini para mensagem. Clean-up de `sem_interesse`. |
| `smart-ops-proactive-outreach` | 280 | Hunter: 4 regras (acompanhamento 7d, reengajamento 3-15d, primeira_duvida 2-10d, recuperação 30d). SellFlux preferencial, WaLeads fallback. |
| `smart-ops-send-waleads` | 198 | Envio unificado via WaLeads + SellFlux. Persiste outbound em `whatsapp_inbox`. Substituição de variáveis. |
| `smart-ops-wa-inbox-webhook` | 285 | Classificador de intenção (7 categorias regex). Hot Lead Alert para vendedores. |
| `smart-ops-meta-lead-webhook` | ~200 | Recebe leads do Meta (Facebook/Instagram) |
| `smart-ops-piperun-webhook` | ~300 | Recebe webhooks do PipeRun (mudança de etapa, deal criado) |
| `smart-ops-ecommerce-webhook` | ~250 | Recebe eventos e-commerce (Loja Integrada) |
| `smart-ops-sellflux-webhook` | ~300 | Recebe webhooks SellFlux (bidirecional) |
| `smart-ops-sellflux-sync` | ~200 | Pull de dados do SellFlux |
| `smart-ops-cs-processor` | ~200 | Processador de regras CS (automações pós-venda) |
| `piperun-full-sync` | ~100 | Wrapper para sync completo (50 páginas/pipeline, pg_cron 20min) |
| `piperun-api-test` | ~50 | Teste de conectividade PipeRun |

### 3.3 Análise Cognitiva

| Função | Linhas | Descrição |
|--------|--------|-----------|
| `cognitive-lead-analysis` | 481 | Perfil psicográfico via DeepSeek Chat. 10 eixos analíticos (stage, urgência, motivação, objeção, approach, trajectory, seasonal). Memória longitudinal (sessões + PipeRun notes + Astron + e-commerce). PQL determinístico. Hash audit trail. |
| `batch-cognitive-analysis` | ~150 | Processamento em lote (pg_cron 4h). Processa leads com ≥5 msgs não analisados. |
| `backfill-intelligence-score` | ~100 | Recalcula intelligence score retroativamente |
| `evaluate-interaction` | ~200 | Avaliação de qualidade de interações da LIA (judge score) |

### 3.4 Geração de Conteúdo

| Função | Linhas | Descrição |
|--------|--------|-----------|
| `ai-orchestrate-content` | 1193 | Orquestrador principal: multi-fonte (PDF, vídeo, texto), anti-alucinação, enriquecimento via CTAs, internal linking automático, prompts especializados (depoimentos, documentos técnicos) |
| `ai-content-formatter` | 556 | Formatação HTML + SEO. Keywords repository, link tracking, validação de estrutura |
| `ai-metadata-generator` | 478 | Gera slug, meta description, keywords, FAQs, título, excerpt. Gemini 2.5 Flash + tool calling |
| `ai-generate-og-image` | ~200 | Gera imagem OG para artigos |
| `ai-enrich-pdf-content` | ~300 | Enriquece conteúdo extraído de PDF com IA |
| `ai-model-compare` | ~200 | Compara modelos de IA para decisão de roteamento |
| `reformat-article-html` | ~200 | Reformata HTML de artigos existentes |
| `auto-inject-product-cards` | ~250 | Injeta cards de produtos nos artigos |
| `enrich-article-seo` | ~200 | Enriquece artigos com dados SEO |
| `translate-content` | ~300 | Tradução PT→EN/ES com preservação semântica |
| `heal-knowledge-gaps` | ~250 | Gera drafts de artigos para lacunas de conhecimento |

### 3.5 Extração de PDF/Documentos

| Função | Linhas | Descrição |
|--------|--------|-----------|
| `extract-pdf-text` | ~200 | Extração básica de texto de PDF |
| `extract-pdf-raw` | ~150 | Extração bruta de PDF |
| `extract-pdf-specialized` | ~300 | Extração especializada (perfil técnico, FDS, IFU, laudo) |
| `extract-and-cache-pdf` | ~200 | Extrai e cacheia PDF para visualização |
| `extract-video-content` | ~200 | Extrai conteúdo de vídeo (transcrição) |
| `document-proxy` | ~100 | Proxy para servir documentos |
| `seo-proxy` | ~100 | Proxy SEO para renderização server-side |

### 3.6 Sitemaps e SEO

| Função | Linhas | Descrição |
|--------|--------|-----------|
| `generate-sitemap` | ~200 | Sitemap principal (marcas, modelos, resinas) |
| `generate-knowledge-sitemap` | ~150 | Sitemap da base de conhecimento (PT) |
| `generate-knowledge-sitemap-en` | ~150 | Sitemap EN |
| `generate-knowledge-sitemap-es` | ~150 | Sitemap ES |
| `generate-documents-sitemap` | ~150 | Sitemap de documentos técnicos |
| `generate-parameter-pages` | ~200 | Gera páginas estáticas de parâmetros |

### 3.7 Integrações Externas

| Função | Linhas | Descrição |
|--------|--------|-----------|
| `sync-pandavideo` | ~300 | Sincroniza vídeos com PandaVideo API |
| `sync-video-analytics` | ~200 | Puxa métricas de vídeo do PandaVideo |
| `link-videos-to-articles` | ~200 | Vincula vídeos a artigos por similaridade |
| `sync-google-reviews` | ~200 | Sincroniza avaliações do Google |
| `sync-google-drive-kb` | ~300 | Sincroniza Google Drive → base de conhecimento |
| `sync-astron-members` | ~200 | Sincroniza membros do Astron Members |
| `astron-member-lookup` | ~150 | Busca aluno no Astron por e-mail |
| `astron-postback` | ~100 | Recebe postback do Astron |
| `import-loja-integrada` | ~300 | Importa produtos da Loja Integrada |
| `poll-loja-integrada-orders` | ~200 | Poll de pedidos da Loja Integrada |
| `register-loja-webhooks` | ~100 | Registra webhooks na Loja Integrada |
| `pandavideo-test` | ~50 | Teste de conectividade PandaVideo |

### 3.8 Utilitários e Sistema

| Função | Linhas | Descrição |
|--------|--------|-----------|
| `system-watchdog-deepseek` | 263 | Watchdog: detecta leads órfãos, missing PipeRun, missing cognitive. Auto-remediação (re-ingest 3 leads). DeepSeek para análise. |
| `index-embeddings` | ~200 | Indexa embeddings para RAG |
| `index-spin-entries` | ~100 | Indexa entradas SPIN |
| `ingest-knowledge-text` | ~150 | Ingere texto na base de conhecimento |
| `knowledge-feed` | ~100 | Feed RSS da base de conhecimento |
| `data-export` | ~200 | Exporta dados em CSV/JSON |
| `create-user` | ~100 | Cria usuário (admin) |
| `test-api-viewer` | ~50 | Visualizador de API para testes |
| `create-test-articles` | ~100 | Cria artigos de teste |
| `backfill-keywords` | ~150 | Backfill de keywords em artigos |
| `backfill-lia-leads` | ~150 | Backfill de leads da LIA |
| `import-leads-csv` | ~200 | Importação de leads via CSV |
| `archive-daily-chats` | ~100 | Arquiva chats diários |
| `fix-piperun-links` | ~100 | Corrige links PipeRun |
| `migrate-catalog-images` | ~100 | Migra imagens do catálogo |
| `export-apostila-docx` | ~200 | Exporta apostila em DOCX |
| `export-parametros-ia` | ~150 | Exporta parâmetros para IA |
| `export-processing-instructions` | ~150 | Exporta instruções de processamento |
| `format-processing-instructions` | ~150 | Formata instruções de processamento |
| `get-product-data` | ~100 | API pública para dados de produto |
| `enrich-resins-from-apostila` | ~200 | Enriquece resinas com dados de apostila |
| `extract-commercial-expertise` | ~200 | Extrai expertise comercial de conversas |
| `import-system-a-json` | ~100 | Importa JSON do Sistema A |
| `generate-veredict-data` | ~200 | Gera dados de veredito para laudos |
| `sync-knowledge-base` | ~100 | Sync externo da KB |
| `sync-sistema-a` | ~100 | Sync com Sistema A |

---

## 4. Módulos Compartilhados (_shared)

| Módulo | Linhas | Descrição |
|--------|--------|-----------|
| `system-prompt.ts` | 211 | Super-prompt ANTI-ALUCINAÇÃO. 9 seções: identidade editorial, E-E-A-T, coerência, linha editorial, regras anti-alucinação, SEO, funções específicas, padrão de resposta, objetivo final |
| `piperun-field-map.ts` | 722 | Mapeamento centralizado PipeRun. 11 pipelines, ~50 stages, custom fields (deal + person), 12 vendedores. Funções: `mapDealToAttendance`, `piperunGet/Post/Put`, `addDealNote`, `customFieldsToHashMap`, `moveDealToStage` |
| `sellflux-field-map.ts` | 514 | Tags CRM (Journey, E-commerce, Qualification, Commercial, CS, LIA, Alert, Stagnation). Funções: `mergeTagsCrm`, `computeTagsFromStage`, `migrateLegacyTags`, `sendLeadToSellFlux`, `sendCampaignViaSellFlux`, `formatPhoneForWaLeads`, `normalizePhoneForMatch`, `fetchLeadFromSellFlux` |
| `log-ai-usage.ts` | ~50 | Logger de uso de tokens de IA. Persiste em `ai_token_usage` |
| `testimonial-prompt.ts` | ~100 | Prompt especializado para depoimentos (Falácia Verdadeira) |
| `document-prompts.ts` | ~200 | Prompts especializados por tipo de documento (perfil_tecnico, fds, ifu, laudo, catalogo, guia, certificado) |
| `extraction-rules.ts` | ~100 | Regras de extração de PDF |
| `og-visual-dictionary.ts` | ~100 | Dicionário visual para OG images |

---

## 5. Sistema de IA — Modelos e Uso

### 5.1 Modelos em Produção

| Modelo | Provider | Funções | Propósito |
|--------|----------|---------|-----------|
| `google/gemini-2.5-flash` | Lovable Gateway | ai-orchestrate-content, ai-content-formatter, ai-metadata-generator, ai-generate-og-image | Geração de conteúdo (alta qualidade, tool calling) |
| `google/gemini-2.5-flash-lite` | Lovable Gateway | smart-ops-lia-assign (greeting), smart-ops-stagnant-processor (reativação) | Mensagens curtas, baixo custo |
| `deepseek-chat` | DeepSeek API | cognitive-lead-analysis, smart-ops-stagnant-processor (decisão), system-watchdog-deepseek, dra-lia (thinker mode) | Raciocínio técnico, análise profunda |
| `deepseek-reasoner` | DeepSeek API | dra-lia (leads quentes, score > 70) | Raciocínio avançado para leads prioritários |
| Modelo via Lovable Gateway | Lovable Gateway | dra-lia (principal) | Agente conversacional (SSE stream) |

### 5.2 Roteamento por Intelligence Score

Via view `lead_model_routing`:
- **Score < 40 (frio):** `gemini-flash-lite` — respostas rápidas, tokens limitados
- **Score 40-70 (morno):** `deepseek-chat` — análise moderada
- **Score > 70 (quente):** `deepseek-reasoner` — raciocínio profundo, mais tokens

### 5.3 Tracking de Uso

Tabela `ai_token_usage` registra cada chamada:
- `function_name`, `action_label`, `model`, `provider`
- `prompt_tokens`, `completion_tokens`, `total_tokens`
- `estimated_cost_usd` (calculado por modelo)

---

## 6. Integrações Externas

| Sistema | Tipo | Direção | Funções |
|---------|------|---------|---------|
| **PipeRun CRM** | API REST | Bidirecional | sync-piperun, lia-assign, kanban-move, piperun-webhook |
| **SellFlux** | Webhook | Bidirecional (Push V2, Pull V1, Webhook Receiver) | sellflux-sync, sellflux-webhook, send-waleads |
| **WaLeads** | API REST | Saída (envio) + Entrada (webhook) | send-waleads, wa-inbox-webhook, dra-lia-whatsapp |
| **Meta (Facebook/Instagram)** | Webhook | Entrada | meta-lead-webhook |
| **PandaVideo** | API REST | Pull | sync-pandavideo, sync-video-analytics |
| **Google Reviews** | API | Pull | sync-google-reviews |
| **Google Drive** | API | Pull | sync-google-drive-kb |
| **Astron Members** | API REST | Bidirecional | sync-astron-members, astron-member-lookup |
| **Loja Integrada** | API REST + Webhook | Bidirecional | import-loja-integrada, poll-orders, ecommerce-webhook |
| **DeepSeek** | API REST | Saída | cognitive-lead-analysis, stagnant-processor, watchdog |
| **Lovable AI Gateway** | API REST | Saída | dra-lia, ai-orchestrate, ai-content-formatter, ai-metadata |

---

## 7. CDP — lia_attendances (~200 colunas)

### Domínios de dados:

| Domínio | Exemplos de Campos | Nº Cols |
|---------|-------------------|---------|
| **Identidade** | nome, email, telefone_raw, telefone_normalized | ~10 |
| **Qualificação** | area_atuacao, especialidade, como_digitaliza, tem_impressora | ~15 |
| **CRM/PipeRun** | piperun_id, piperun_link, piperun_pipeline_name, piperun_stage_name, proprietario_lead_crm | ~30 |
| **Pessoa/Empresa** | pessoa_piperun_id, empresa_cnpj, empresa_razao_social, empresa_segmento | ~15 |
| **Propostas** | proposals_data, proposals_total_value, proposals_total_mrr | ~5 |
| **Equipamentos** | equip_scanner, equip_impressora, equip_cad, equip_notebook, equip_pos_impressao + seriais + datas | ~15 |
| **Ativos** | ativo_scan, ativo_print, ativo_cad, data_ultima_compra_* | ~16 |
| **Cognitivo** | cognitive_analysis, lead_stage_detected, urgency_level, psychological_profile, primary_motivation | ~12 |
| **Intelligence Score** | intelligence_score (JSONB), intelligence_score_total, intelligence_score_updated_at | ~4 |
| **Astron** | astron_user_id, astron_plans_active, astron_courses_completed, astron_last_login_at | ~12 |
| **E-commerce** | lojaintegrada_cliente_id, lojaintegrada_ltv, lojaintegrada_historico_pedidos | ~20 |
| **SellFlux** | sellflux_custom_fields (JSONB), sellflux_synced_at | ~2 |
| **SDR** | sdr_scanner_interesse, sdr_impressora_interesse, ... | ~15 |
| **Tags/Status** | tags_crm[], lead_status, temperatura_lead, motivo_perda | ~10 |
| **Automação** | proactive_sent_at, proactive_count, crm_lock_until, automation_cooldown_until | ~5 |
| **Sessões** | total_sessions, total_messages, historico_resumos (JSONB), resumo_historico_ia | ~5 |
| **UTM/Origem** | utm_source/medium/campaign/term, ip_origem, pais_origem | ~8 |

### Views de Domínio

- `v_lead_commercial` — dados comerciais
- `v_lead_cognitive` — dados cognitivos
- `v_lead_academy` — dados Astron/cursos
- `v_lead_ecommerce` — dados e-commerce
- `lead_model_routing` — roteamento de modelo de IA por score

---

## 8. Geração de Conteúdo — Pipeline Completo

```
┌──────────────────────────────────────────────────────────┐
│ 1. FONTES DE ENTRADA                                      │
│                                                            │
│  Texto bruto (colado) ─┐                                  │
│  PDF (upload) ─────────┤                                  │
│  Vídeo (transcrição) ──┼──▶ ai-orchestrate-content        │
│  PDFs da KB ───────────┤    (1193 linhas, Gemini 2.5 Flash)│
│  Prompt personalizado ─┘                                  │
└────────────────────────────┬─────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────┐
│ 2. ORQUESTRAÇÃO                                           │
│                                                            │
│  ✓ Seleciona prompt base (SYSTEM_SUPER_PROMPT ou           │
│    TESTIMONIAL_PROMPT ou DOCUMENT_PROMPTS[tipo])           │
│  ✓ Enriquece com dados do banco (produtos, resinas,        │
│    parâmetros, artigos)                                     │
│  ✓ Injeta CTAs de produtos selecionados                    │
│  ✓ Busca external_links para internal linking               │
│  ✓ Regras anti-alucinação                                  │
│  ✓ Retorna: HTML + FAQs + metadata + veredictData          │
└────────────────────────────┬─────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────┐
│ 3. FORMATAÇÃO HTML (ai-content-formatter)                  │
│                                                            │
│  ✓ Keywords repository (external_links + knowledge +       │
│    documents)                                               │
│  ✓ Priorização por score (monthly_searches, relevance,     │
│    intent, keyword_type)                                    │
│  ✓ Internal linking automático (max 15 links/artigo)       │
│  ✓ Validação de estrutura (cards, grids, CTAs, h2, links)  │
│  ✓ Tracking de keyword usage                               │
└────────────────────────────┬─────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────┐
│ 4. METADADOS SEO (ai-metadata-generator)                   │
│                                                            │
│  ✓ Slug (único, verificado no DB)                          │
│  ✓ Meta description (≤160 chars)                           │
│  ✓ Keywords (8-12, via tool calling)                        │
│  ✓ FAQs (3-5, via tool calling)                            │
│  ✓ Título SEO (≤60 chars)                                  │
│  ✓ Excerpt (≤160 chars)                                    │
└────────────────────────────┬─────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────┐
│ 5. PÓS-PROCESSAMENTO                                      │
│                                                            │
│  ✓ auto-inject-product-cards (injeta cards de produto)     │
│  ✓ enrich-article-seo (enriquece com dados SEO)            │
│  ✓ translate-content (PT → EN/ES)                          │
│  ✓ generate-sitemap (atualiza sitemaps)                    │
│  ✓ index-embeddings (indexa para RAG)                      │
└──────────────────────────────────────────────────────────┘
```

---

## 9. Gestão de Leads — Fluxo Completo

```
┌─ ENTRADA ──────────────────────────────────────────────────┐
│                                                              │
│  Formulário web ──────┐                                     │
│  Meta (FB/IG) ────────┤                                     │
│  Dra. LIA (chat) ─────┼──▶ smart-ops-ingest-lead            │
│  WhatsApp (resposta) ──┤    ✓ Smart Merge (nunca sobrescreve)│
│  Loja Integrada ───────┤    ✓ Detecta PQL (recompra)        │
│  CSV manual ───────────┤    ✓ Filtra test emails             │
│  SellFlux webhook ─────┤    ✓ Calcula intelligence score     │
│  PipeRun webhook ──────┘    ✓ Dispara lia-assign             │
│                              ✓ Dispara cognitive-analysis    │
│                              ✓ Sync SellFlux                 │
└────────────────────────┬─────────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────────┐
│ ROTEAMENTO CRM (smart-ops-lia-assign)                         │
│                                                                │
│  1. Resolve Pessoa no PipeRun (por e-mail)                    │
│  2. Busca deals existentes da pessoa                           │
│  3. REGRA DE OURO: deal aberto em Vendas → NÃO muda owner     │
│  4. Deal em Estagnados → move para Vendas (reativação)         │
│  5. Sem deal → cria novo (Pessoa + Empresa + Deal)             │
│  6. Gera saudação AI (Gemini Flash Lite)                       │
│  7. Gera briefing estratégico (DeepSeek)                       │
│  8. Envia briefing como Nota no PipeRun                        │
│  9. Notifica vendedor via WaLeads                              │
│  10. Provisiona Astron Members (se necessário)                 │
└────────────────────────┬─────────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────────┐
│ PROCESSAMENTO CONTÍNUO                                        │
│                                                                │
│  cognitive-lead-analysis (5+ msgs → perfil psicográfico)      │
│  stagnant-processor (5 dias → avança funil estagnação)         │
│  proactive-outreach (Hunter: 4 regras, max 20 msgs/run)       │
│  sync-piperun (20 min cron → espelha CRM)                     │
│  system-watchdog (detecta anomalias → auto-remediação)         │
│  backfill-intelligence-score (recalcula scores)                │
└──────────────────────────────────────────────────────────────┘
```

### Hierarquia de Estágios do Funil

```
visitante → lead → MQL_pesquisador → PQL_recompra → SAL_comparador → SQL_decisor → CLIENTE_ativo
```

### Pipeline de Estagnação

```
est_etapa1 → est_etapa2 → est_etapa3 → est_etapa4 → est_apresentacao → est_proposta → estagnado_final
(5 dias entre cada avanço)
```

---

## 10. WhatsApp Loop — Hunter/Sentinela/Reativação

```
┌─ HUNTER (proactive-outreach) ─────────────────────────────┐
│  4 regras: acompanhamento 7d, reengajamento 3-15d,        │
│  primeira_duvida 2-10d, recuperação 30d                    │
│  Envia via SellFlux (preferencial) + WaLeads (fallback)    │
└──────────────────────┬────────────────────────────────────┘
                       │ Lead responde via WhatsApp
                       ▼
┌─ SENTINELA ──────────────────────────────────────────────┐
│  Rota A: dra-lia-whatsapp (agente autônomo)              │
│    ✓ Resolve @lid → telefone real                        │
│    ✓ Dedup: fromMe, stale, content, outbound             │
│    ✓ Match lead via ILIKE %ultimos9digitos               │
│    ✓ Cria lead placeholder se não encontra               │
│    ✓ Pre-seed agent_sessions (bypass email collection)   │
│    ✓ Filtra email-loop do histórico                      │
│    ✓ Response Guard (intercepta email requests)          │
│    ✓ Chama dra-lia SSE → formata → envia WaLeads        │
│    ✓ Persiste inbound + outbound em whatsapp_inbox       │
│                                                           │
│  Rota B: wa-inbox-webhook (classificação de campanha)    │
│    ✓ Classifica intent (7 categorias regex)              │
│    ✓ Hot Lead Alert → notifica vendedor                  │
│    ✓ sem_interesse → tag A_SEM_RESPOSTA                  │
│    ✓ 5+ msgs → cognitive-lead-analysis                   │
└──────────────────────┬───────────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────────┐
│ PROCESSADORES ASYNC                                       │
│  stagnant-processor: avança funil + clean-up sem_interesse│
│  cognitive-lead-analysis: perfil psicográfico (5+ msgs)   │
│  batch-cognitive-analysis: processamento em lote (4h)     │
│  sync-piperun: espelha alterações no CRM                  │
└──────────────────────────────────────────────────────────┘
```

### Classificador de Intenção (wa-inbox-webhook)

| Intent | Confiança | Ação |
|--------|-----------|------|
| `interesse_imediato` | 90% | Hot Lead Alert → vendedor |
| `interesse_futuro` | 75% | Hot Lead Alert → vendedor |
| `pedido_info` | 80% | Persiste |
| `objecao` | 70% | Persiste |
| `sem_interesse` | 95% | Tag A_SEM_RESPOSTA |
| `suporte` | 85% | Persiste |
| `indefinido` | 20% | Persiste |

---

## 11. Sincronização CRM (PipeRun)

### Pipelines Sincronizados (11)

| ID | Nome | Stages |
|----|------|--------|
| 18784 | Funil de Vendas | sem_contato → contato_feito → em_contato → apresentação → proposta → negociação → fechamento |
| 72938 | Estagnados | etapa_00 → etapa_01 → etapa_02 → etapa_03 → etapa_04 → apresentação → proposta → final |
| 83896 | CS Onboarding | auxiliar → espera → agendamento → treinamento → entrega → acompanhamento → finalizado |
| 100412 | Insumos | sem_contato → contato → amostra → retorno → fechamento |
| 102702 | E-commerce | visitantes → navegação → checkout → abandono → transação → pedido → pós-venda → ativação |
| 73999 | Atos | (via STAGE_TO_ETAPA) |
| 39047 | Exportação | (via STAGE_TO_ETAPA) |
| 70898 | Distribuidor Leads | (via STAGE_TO_ETAPA) |
| 82128 | E-book | (via STAGE_TO_ETAPA) |
| 83813 | Tulip Teste | (via STAGE_TO_ETAPA) |
| 93303 | Interesse Cursos | (via STAGE_TO_ETAPA) |

### Mecanismo de Lock

`crm_lock_until` + `crm_lock_source` — trava de 30s para evitar race conditions entre webhooks simultâneos.

---

## 12. Base de Conhecimento e SEO

### Estrutura

- **knowledge_categories** — Categorias (letras A-Z)
- **knowledge_contents** — Artigos com HTML, tradução EN/ES, FAQs, keywords, meta, OG
- **knowledge_videos** — Vídeos vinculados a artigos (PandaVideo)
- **external_links** — Repositório de links SEO (keywords + URLs curadas)
- **catalog_documents** — Documentos técnicos de produtos
- **resins** + `resin_documents` — Resinas e seus documentos

### Sitemaps

- `/functions/v1/generate-sitemap` — Parâmetros
- `/functions/v1/generate-knowledge-sitemap` — KB (PT)
- `/functions/v1/generate-knowledge-sitemap-en` — KB (EN)
- `/functions/v1/generate-knowledge-sitemap-es` — KB (ES)
- `/functions/v1/generate-documents-sitemap` — Documentos

### SEO Features

- Schema.org (JSON-LD): Article, FAQ, HowTo, Organization, Video
- OG images geradas por IA
- Meta tags dinâmicas (Helmet)
- Internal linking automático via keywords repository
- Breadcrumbs semânticos
- Canonical tags
- Hreflang (PT/EN/ES)

---

## 13. Qualidade do Sistema — Avaliação

### 13.1 Pontos Fortes ✅

| Área | Avaliação |
|------|-----------|
| **Arquitetura CDP** | Excelente — tabela única `lia_attendances` com ~200 colunas, views de domínio, sem fragmentação |
| **Anti-alucinação** | Excelente — regras em 3 camadas (system-prompt, por-função, validação de output) |
| **Sync bidirecional PipeRun** | Muito bom — 11 pipelines, Regra de Ouro, smart merge, pg_cron 20min |
| **RAG Pipeline** | Muito bom — 8 fontes, re-ranking por tópico, ILIKE fallback, company_kb |
| **Cognitivo** | Muito bom — 10 eixos, memória longitudinal, PQL determinístico, hash audit trail |
| **Módulos compartilhados** | Excelente — field maps centralizados, funções reutilizáveis |
| **Tracking de IA** | Bom — `ai_token_usage` em todas as chamadas |
| **Watchdog** | Bom — detecção de anomalias + auto-remediação |
| **SEO** | Muito bom — sitemaps, Schema.org, OG, meta, internal linking |
| **i18n** | Bom — 3 idiomas (PT/EN/ES) em rotas e conteúdo |

### 13.2 Pontos de Atenção ⚠️

| Área | Avaliação | Recomendação |
|------|-----------|--------------|
| **dra-lia (5092 linhas)** | Monolítico — difícil manutenção | Extrair diálogo guiado, RAG, SDR, finalização em módulos _shared |
| **lia-assign (1196 linhas)** | Grande mas coeso | Considerar extrair PipeRun hierarchy helpers |
| **ai-orchestrate-content (1193 linhas)** | Grande | Extrair prompt builders em _shared |
| **piperun-field-map (722 linhas)** | Crescendo | Considerar split por domínio (stages, users, helpers) |
| **Duplicação de lógica phone** | normalizePhone em 3+ locais | ✅ Já centralizado em sellflux-field-map.ts |
| **agent_sessions FK** | `lead_id` aponta para `leads.id`, incompatível com `lia_attendances.id` | Workaround implementado (extracted_entities JSONB) |
| **leads vs lia_attendances** | Tabela `leads` é legada mas ainda usada por agent_interactions FK | Migração pendente |

### 13.3 Cobertura de Testes

- **Testes automatizados:** Não existem testes unitários para edge functions
- **Monitoramento:** Watchdog (pg_cron) + system_health_logs
- **Logging:** Console.log extensivo em todas as funções com prefixos `[function-name]`

---

## 14. Funções Subutilizadas / Sem Uso

### 14.1 Potencialmente Subutilizadas

| Função | Motivo |
|--------|--------|
| `generate-veredict-data` | Usado apenas para tipo documento `laudo`/`certificado` — nicho |
| `extract-commercial-expertise` | Extração de expertise comercial — execução manual |
| `format-processing-instructions` | Formatação de instruções — execução manual |
| `export-processing-instructions` | Exportação de instruções — execução manual |
| `index-spin-entries` | Indexação SPIN — execução manual |
| `create-test-articles` | Utilitário de desenvolvimento |
| `test-api-viewer` | Utilitário de desenvolvimento |
| `pandavideo-test` | Utilitário de teste |
| `piperun-api-test` | Utilitário de teste |
| `fix-piperun-links` | One-shot fix |
| `migrate-catalog-images` | One-shot migration |

### 14.2 Redundância Parcial

| Par | Observação |
|-----|-----------|
| `dra-lia` + `dra-lia-whatsapp` | O WhatsApp wrapper chama o dra-lia internamente — correto, mas a lógica de phone/dedup poderia ser _shared |
| `smart-ops-wa-inbox-webhook` + `dra-lia-whatsapp` | Ambos recebem mensagens WA e persistem em whatsapp_inbox. Rota A = agente autônomo, Rota B = classificação. Correto mas endpoint deve ser claro para o provedor. |
| `sync-pandavideo` + `sync-video-analytics` | Separação correta (metadata vs analytics) |
| `backfill-lia-leads` + `backfill-intelligence-score` + `backfill-keywords` | Três backfills separados — execução manual, OK |

### 14.3 Funções Legacy

| Função | Status |
|--------|--------|
| `import-system-a-json` | Legacy — Sistema A migrado |
| `sync-sistema-a` | Legacy — Sistema A migrado |

---

## 15. Bugs Corrigidos (Sessão Atual)

### 15.1 @lid — WhatsApp Internal ID Resolution

**Problema:** WhatsApp envia `phone` como `XXXXXXXXXXX@lid` (ID interno Meta) em vez do número real.
**Correção:** Resolução via `senderPn`, `remoteJidAlt`, `participant` (nested em `data`, `key`, `_data.key`).
**Arquivos:** `dra-lia-whatsapp/index.ts:49-65`, `wa-inbox-webhook/index.ts:103-120`

### 15.2 session_id Estável

**Problema:** UUID aleatório a cada mensagem → histórico nunca recuperado.
**Correção:** `session_id = "wa_${phoneDigits}"` (determinístico por telefone).

### 15.3 History Query (session_id vs lead_id)

**Problema:** Query ao `agent_interactions` usava `lead_id` (frequentemente null).
**Correção:** Query usa `.eq("session_id", sessionId)`.

### 15.4 agent_sessions FK Violation

**Problema:** Upsert escrevia `lia_attendances.id` na coluna `lead_id` (FK para `leads.id`).
**Correção:** Lead info em `extracted_entities` (JSONB), não na coluna FK.

### 15.5 Email-Loop Guard

**Problema:** LIA pedia e-mail repetidamente para leads já conhecidos.
**Correção:** (1) History filter remove mensagens de email da IA; (2) Response Guard intercepta e substitui.

### 15.6 sync-piperun HTML Crash

**Problema:** `res.json()` falhava quando sub-chamada retornava HTML (timeout/erro).
**Correção:** Validação de `Content-Type` antes de `.json()`.

---

## 16. Pendências

### 16.1 Técnicas

- [ ] Limpeza de leads duplicados (`wa_*@whatsapp.lead` com telefone @lid)
- [ ] Migração da tabela `leads` → consolidação com `lia_attendances`
- [ ] Testes automatizados para edge functions críticas
- [ ] Refatoração do `dra-lia` (5092 linhas → módulos)
- [ ] Classificador de intenção v2 (LLM para confidence < 50)

### 16.2 Monitoramento

- [ ] Validar logs `[dra-lia-wa] Resolved @lid` (72h pós-deploy)
- [ ] Validar logs `[dra-lia-wa] Email-loop guard activated` (esperado diminuir)
- [ ] Validar `[sync-piperun] Pipeline X returned non-JSON` (identificar timeouts)
- [ ] Dashboard de métricas WhatsApp (inbound vs outbound, intents, response time)

### 16.3 Evoluções Planejadas

- [ ] Intent `agendamento` no classificador
- [ ] Feedback loop: `seller_notified=true` + resultado em `lead_status` → validar acurácia
- [ ] Batch cognitive via pg_cron incluir leads WhatsApp (session_id = "wa_*")

---

## 17. Secrets Necessárias

| Secret | Usado por | Tipo |
|--------|-----------|------|
| `SUPABASE_URL` | Todas | Sistema |
| `SUPABASE_SERVICE_ROLE_KEY` | Todas | Sistema |
| `SUPABASE_ANON_KEY` | dra-lia-whatsapp | Sistema |
| `LOVABLE_API_KEY` | dra-lia, ai-orchestrate, ai-content-formatter, ai-metadata, lia-assign, stagnant-processor | IA |
| `GOOGLE_AI_KEY` | dra-lia | IA |
| `DEEPSEEK_API_KEY` | cognitive-lead-analysis, stagnant-processor, watchdog | IA |
| `OPENAI_API_KEY` | dra-lia (fallback) | IA |
| `PIPERUN_API_KEY` | sync-piperun, lia-assign, stagnant-processor, kanban-move | CRM |
| `SELLFLUX_WEBHOOK_LEADS` | ingest-lead, sellflux-sync | Integração |
| `SELLFLUX_WEBHOOK_CAMPANHAS` | wa-inbox-webhook, stagnant-processor, proactive-outreach, send-waleads | Integração |
| `PANDAVIDEO_API_KEY` | sync-pandavideo, sync-video-analytics | Integração |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | sync-google-reviews, sync-google-drive-kb | Integração |
| `ASTRON_API_KEY` | sync-astron-members, astron-member-lookup | Integração |
| `MANYCHAT_API_KEY` | stagnant-processor (fallback) | Integração |
| `LOJA_INTEGRADA_API_KEY` | import-loja-integrada, poll-orders | Integração |

---

## 18. Checklist de Deploy

### Edge Functions

- [x] Todas as 85+ funções listadas em `config.toml` com `verify_jwt` adequado
- [x] Webhooks públicos sem JWT: wa-inbox, dra-lia-whatsapp, meta-lead, piperun, ecommerce, sellflux
- [x] Funções admin com JWT: create-user, create-test-articles, heal-knowledge-gaps

### Banco de Dados

- [x] Tabela `whatsapp_inbox` criada com índices e RLS
- [x] Views de domínio (v_lead_commercial, v_lead_cognitive, v_lead_academy, v_lead_ecommerce)
- [x] View `lead_model_routing` para roteamento de modelo IA
- [x] RLS configurada em todas as tabelas (admin_only ou public read)
- [x] `intelligence_score_config` com pesos e thresholds

### Cron Jobs (pg_cron)

- sync-piperun: a cada 20 minutos (`?orchestrate=true&full=true`)
- batch-cognitive-analysis: a cada 4 horas
- stagnant-processor: diário
- system-watchdog: diário
- archive-daily-chats: diário
- poll-loja-integrada-orders: a cada 30 minutos

### Correções Recentes

- [x] @lid resolution (dra-lia-whatsapp + wa-inbox-webhook)
- [x] session_id estável (wa_phoneDigits)
- [x] History query por session_id
- [x] agent_sessions pre-seed sem FK violation
- [x] Email-loop guard (history filter + response guard)
- [x] sync-piperun safe JSON parsing
- [ ] Limpeza de leads duplicados @lid
- [ ] Monitoramento 72h pós-deploy
