# Sistema B — Revenue Intelligence OS

> **Descrição Completa do Sistema**  
> **Versão:** 1.0 | **Data:** 2026-03-08  
> **Projeto Supabase:** `okeogjgqijbfkudfjadz`  
> **Domínio público:** `parametros.smartdent.com.br`  
> **Domínio preview:** `print-params-hub.lovable.app`

---

## 1. Identidade do Sistema

### Nomenclatura
| Nome | Uso |
|------|-----|
| **Sistema B** | Nome interno de engenharia |
| **Revenue Intelligence OS** | Nome comercial/técnico |
| **Smart Dent Digital Hub** | Nome público |

### Stack Tecnológico
| Camada | Tecnologias |
|--------|-------------|
| **Frontend** | React 18.3, Vite, TypeScript, Tailwind CSS, shadcn/ui, React Router 6.30, TanStack Query 5.83 |
| **Backend** | Supabase Edge Functions (Deno), PostgreSQL com RLS, Supabase Auth, Storage, Realtime |
| **IA / LLMs** | Lovable AI Gateway → Gemini 2.5 Flash (conteúdo), DeepSeek v3 (cognitivo), GPT-4.1 Mini (comparação) |
| **Integrações** | PipeRun CRM, SellFlux, WaLeads, Astron Members, Loja Integrada, PandaVideo, Google Drive/Reviews, Meta Ads |

---

## 2. Resumo Executivo

O **Revenue Intelligence OS** é uma plataforma proprietária de **Autonomia de Receita** que orquestra dois domínios críticos para operações comerciais e marketing digital no setor de odontologia 3D.

O primeiro domínio — **Lead Lifecycle Management** — gerencia todo o ciclo de vida do lead desde a captura multicanal (formulários, Meta Ads, e-commerce, webhooks de CRM) até a qualificação cognitiva via IA, sincronização bidirecional com CRM, automação de CS e reativação inteligente. Tudo centralizado em um CDP unificado de ~200 colunas (`lia_attendances`).

O segundo domínio — **Content Intelligence Platform** — implementa um pipeline completo de geração, formatação, tradução e publicação de conteúdo técnico odontológico. O sistema extrai conteúdo de PDFs e vídeos, processa via IA com regras anti-alucinação, gera HTML semântico otimizado para SEO e IA (17+ elementos estruturados), traduz para 3 idiomas e expõe via sitemaps, RSS, SSR e API REST.

---

## 3. Arquitetura Dual

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                              REVENUE INTELLIGENCE OS                             │
├──────────────────────────────────┬───────────────────────────────────────────────┤
│        LEAD LIFECYCLE            │         CONTENT INTELLIGENCE                  │
│        MANAGEMENT                │         PLATFORM                              │
├──────────────────────────────────┼───────────────────────────────────────────────┤
│                                  │                                               │
│  ┌─────────────────────────┐     │     ┌─────────────────────────┐               │
│  │   5 ENTRY POINTS        │     │     │   FONTES DE CONTEÚDO    │               │
│  │   ├─ Formulário         │     │     │   ├─ PDFs técnicos      │               │
│  │   ├─ Meta Ads           │     │     │   ├─ Vídeos (PandaVideo)│               │
│  │   ├─ SellFlux           │     │     │   ├─ Google Drive KB    │               │
│  │   ├─ E-commerce         │     │     │   └─ Texto direto       │               │
│  │   └─ PipeRun Webhook    │     │     └─────────────────────────┘               │
│  └───────────┬──────────────┘     │                    │                          │
│              │                   │                    ▼                          │
│              ▼                   │     ┌─────────────────────────┐               │
│  ┌─────────────────────────┐     │     │   AI ORCHESTRATOR       │               │
│  │   SMART MERGE           │     │     │   (1193 linhas)         │               │
│  │   + INGEST GATEWAY      │     │     │   SYSTEM_SUPER_PROMPT   │               │
│  └───────────┬──────────────┘     │     │   ANTI_HALLUCINATION    │               │
│              │                   │     └───────────┬─────────────┘               │
│              ▼                   │                 │                             │
│  ┌─────────────────────────┐     │                 ▼                             │
│  │   CDP UNIFICADO         │     │     ┌─────────────────────────┐               │
│  │   lia_attendances       │     │     │   PÓS-PROCESSAMENTO     │               │
│  │   (~200 colunas)        │     │     │   ├─ reformat-html      │               │
│  │   ├─ Core               │     │     │   ├─ enrich-seo         │               │
│  │   ├─ PipeRun CRM        │     │     │   ├─ translate (EN/ES)  │               │
│  │   ├─ Cognitive AI       │     │     │   ├─ inject-cards       │               │
│  │   ├─ E-commerce         │     │     │   └─ generate-og        │               │
│  │   ├─ Astron Academy     │     │     └───────────┬─────────────┘               │
│  │   ├─ SellFlux           │     │                 │                             │
│  │   └─ Intelligence Score │     │                 ▼                             │
│  └───────────┬──────────────┘     │     ┌─────────────────────────┐               │
│              │                   │     │   knowledge_contents    │               │
│              ▼                   │     │   (Publicação)          │               │
│  ┌─────────────────────────┐     │     └───────────┬─────────────┘               │
│  │   COGNITIVE ENGINE      │     │                 │                             │
│  │   (DeepSeek v3)         │     │                 ▼                             │
│  │   ├─ 10 eixos análise   │     │     ┌─────────────────────────┐               │
│  │   ├─ 5 estágios funil   │     │     │   EXPOSIÇÃO SEO/IA      │               │
│  │   └─ Intelligence Score │     │     │   ├─ seo-proxy (SSR)    │               │
│  └───────────┬──────────────┘     │     │   ├─ 5 Sitemaps         │               │
│              │                   │     │   ├─ RSS/Atom Feed      │               │
│              ▼                   │     │   ├─ 17+ JSON-LD schemas│               │
│  ┌─────────────────────────┐     │     │   └─ llms.txt           │               │
│  │   AUTOMATION ENGINE     │     │     └─────────────────────────┘               │
│  │   ├─ Stagnation (6 etapas)│   │                                               │
│  │   ├─ Proactive Outreach │     │                                               │
│  │   ├─ CS Automation      │     │                                               │
│  │   └─ System Watchdog    │     │                                               │
│  └─────────────────────────┘     │                                               │
│                                  │                                               │
├──────────────────────────────────┴───────────────────────────────────────────────┤
│                                                                                  │
│                         AGENTE DRA. L.I.A.                                       │
│                         (RAG + Embeddings Vetoriais)                             │
│                         WhatsApp | Web Embed | Widget Flutuante                  │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. CDP Unificado — `lia_attendances`

A tabela `lia_attendances` é o **Customer Data Platform (CDP)** central do sistema, com ~200 colunas organizadas em 8 domínios.

### 4.1 Domínios de Colunas

| Domínio | Colunas | Descrição |
|---------|---------|-----------|
| **Core** | ~15 | Identidade (nome, email, telefone), status, origem, data de entrada |
| **Qualificação SDR** | ~15 | 9 campos de interesse por produto + parâmetros técnicos + suporte |
| **PipeRun CRM** | ~40 | Oportunidade, Pessoa, Empresa, Propostas (JSONB), custom fields |
| **Cognitive AI** | ~15 | Análise DeepSeek (10 eixos), estágio detectado, profile psicológico |
| **Intelligence Score (LIS)** | ~5 | Score multidimensional (4 eixos: engagement, commercial, cognitive, ecommerce) |
| **Equipamentos** | ~20 | 5 tipos de equipamento com serial e data de ativação |
| **E-commerce (Loja Integrada)** | ~20 | Cliente ID, LTV, histórico de pedidos, endereço |
| **Astron Academy** | ~12 | Aluno ID, status, planos ativos, cursos completados |
| **Automação** | ~10 | Cooldowns, locks, timestamps de ações automatizadas |

### 4.2 Intelligence Score (LIS)

Fórmula calculada via RPC PostgreSQL:

```
LIS = (engagement × 25%) + (commercial × 35%) + (cognitive × 25%) + (ecommerce × 15%)
```

| Eixo | Componentes |
|------|-------------|
| **engagement** | total_sessions, total_messages, última_sessão_at |
| **commercial** | piperun_status, proposals_total_value, pipeline_stage |
| **cognitive** | confidence_score, stage_detected, eixos preenchidos |
| **ecommerce** | LTV, total_pedidos_pagos, última_compra |

### 4.3 Views de Domínio

| View | Exposição | Uso |
|------|-----------|-----|
| `v_lead_commercial` | Core + PipeRun + proposals | Dashboard comercial |
| `v_lead_cognitive` | Core + cognitive_analysis + LIS | Dashboard inteligência |
| `v_lead_academy` | Core + Astron + cursos | Dashboard educacional |
| `v_lead_ecommerce` | Core + Loja Integrada + LTV | Dashboard e-commerce |
| `lead_model_routing` | id + telefone + LIS + modelo recomendado | Roteamento IA |

---

## 5. Pipeline de Leads

### 5.1 Entry Points (5 canais)

| Função | Canal | Ação |
|--------|-------|------|
| `smart-ops-ingest-lead` | Formulário/SDK | Gateway unificado. Smart Merge via telefone/email. Detecção PQL. |
| `smart-ops-meta-lead-webhook` | Meta Ads | Captura leads Facebook/Instagram Ads |
| `smart-ops-sellflux-webhook` | SellFlux | Webhook com field mapping dinâmico |
| `smart-ops-ecommerce-webhook` | Loja Integrada | Webhook de pedidos. Calcula LTV. |
| `smart-ops-piperun-webhook` | PipeRun CRM | Bidirecional. Synca deal/pessoa/empresa |

### 5.2 Smart Merge Logic

1. Busca por `telefone_normalized` (match exato)
2. Busca por `email` (match exato, case-insensitive)
3. Se não encontrou → **INSERT** novo lead
4. Se encontrou → **UPSERT** com `protectedFields` (preserva dados CRM)

### 5.3 Cognitive Engine (DeepSeek v3)

Pipeline:
```
Lead data → Context assembly → DeepSeek prompt → JSON parsing → cognitive_analysis + LIS
```

**10 Eixos Cognitivos:**
1. lead_stage_detected
2. interest_timeline
3. urgency_level
4. psychological_profile
5. primary_motivation
6. objection_risk
7. recommended_approach
8. produto_interesse_auto
9. confidence_score_analysis
10. prediction_accuracy

### 5.4 Stagnation Processor (6 etapas)

| Etapa | Critério |
|-------|----------|
| 1. Novo sem contato | Lead sem resposta após X dias |
| 2. Em negociação parado | Deal sem movimento |
| 3. Pós-proposta sem retorno | Proposta enviada sem follow-up |
| 4. Recompra | Cliente ativo sem nova compra |
| 5. Churn risk | Sinais de abandono |
| 6. Reativação | Lead frio com potencial |

---

## 6. Pipeline de Conteúdo (14 etapas)

```
FONTES              EXTRAÇÃO              ORQUESTRAÇÃO           PÓS-PROCESSAMENTO         PUBLICAÇÃO
─────────────       ────────────          ─────────────          ─────────────────         ──────────
PDF ─────────────→ extract-pdf-* ────┐
Vídeo ───────────→ extract-video ────┼──→ ai-orchestrate ────→ reformat-html ─────→ knowledge_contents
Google Drive ────→ sync-drive-kb ────┤    (Gemini 2.5)        enrich-seo              │
Apostila ────────→ enrich-resins ────┘    SYSTEM_SUPER_PROMPT  translate (EN/ES)       │
                                          ANTI_HALLUCINATION   inject-product-cards    │
                                                               generate-og-image       │
                                                                      │                 │
                                                                      ▼                 ▼
                                                               Sitemaps (5) ←──── seo-proxy (SSR)
                                                               RSS/Atom Feed       Bot detection
                                                               llms.txt            JSON-LD schemas
```

### 6.1 Funções de Extração

| Função | Input | Output |
|--------|-------|--------|
| `extract-pdf-text` | PDF URL | Texto limpo |
| `extract-pdf-raw` | PDF URL | Texto bruto |
| `extract-pdf-specialized` | PDF URL + tipo | Texto estruturado por tipo (IFU, FDS, laudo) |
| `extract-and-cache-pdf` | PDF URL | Texto cached em `catalog_documents` |
| `extract-video-content` | PandaVideo ID | Transcrição |

### 6.2 Orquestrador Central — `ai-orchestrate-content`

**Arquivo:** 1193 linhas  
**Modelo:** Gemini 2.5 Flash via Lovable AI Gateway

**Input:**
- `sources`: rawText, pdfTranscription, videoTranscription, relatedPdfs, technicalSheet
- `contentType`: tecnico | educacional | depoimentos | passo_a_passo | cases_sucesso
- `documentType`: perfil_tecnico | fds | ifu | laudo | catalogo | guia | certificado
- `language`: pt | en | es

**Output:**
- `html`: HTML formatado com classes Tailwind
- `faqs`: Array de Q&A
- `metadata`: educationalLevel, learningResourceType, aiContext
- `schemas`: { howTo, faqPage }
- `veredictData`: Veredicto técnico (quando aplicável)

### 6.3 Regras Anti-Alucinação (6 regras absolutas)

| # | Regra | Implementação |
|---|-------|---------------|
| 1 | Fonte da Verdade | Conteúdo fornecido é ÚNICA fonte. Não busca externo. |
| 2 | Transcrição Literal | "147 MPa" nunca vira "~150 MPa" |
| 3 | Proibido Inventar | Não adiciona produtos/estudos/CTAs não mencionados |
| 4 | Ilegibilidade | Marca `[ilegível]` em vez de adivinhar |
| 5 | Dados Técnicos | Valores exatos preservados |
| 6 | Links/CTAs | Usa APENAS `external_links` aprovados |

---

## 7. Agente Dra. L.I.A.

### 7.1 Arquitetura RAG

```
User message → Embedding → Busca vetorial (agent_embeddings) → Context assembly → LLM → Response
```

### 7.2 Canais de Interação

| Canal | Função | Descrição |
|-------|--------|-----------|
| Widget flutuante | `DraLIA.tsx` | Renderizado globalmente (exceto /admin e /embed) |
| Embed iframe | `AgentEmbed.tsx` | Rota `/embed/dra-lia` para integração externa |
| WhatsApp | `dra-lia-whatsapp` | Adaptador para API WaLeads |

### 7.3 Funções de Suporte

| Função | Descrição |
|--------|-----------|
| `dra-lia` | Agente principal (5092 linhas) |
| `index-embeddings` | Indexação vetorial para RAG |
| `archive-daily-chats` | Arquivamento de conversas |
| `evaluate-interaction` | Judge model para qualidade |

---

## 8. Integrações Externas

| Sistema | Protocolo | Funções |
|---------|-----------|---------|
| **PipeRun CRM** | REST + Webhook | Sync bidirecional deals/pessoas/empresas |
| **SellFlux** | REST + Webhook | Push de leads e campanhas |
| **WaLeads** | REST | Envio de mensagens WhatsApp (texto, mídia) |
| **Astron Members** | Postback + REST | Sync cursos e planos |
| **Loja Integrada** | Webhook + Polling | E-commerce (pedidos, LTV) |
| **PandaVideo** | REST | Sync vídeos e analytics |
| **Google Drive** | REST | Sync KB texts |
| **Google Reviews** | REST | Avaliações e widget |
| **Meta Ads** | Webhook | Lead ads capture |

---

## 9. Fluxo Inter-Sistemas (A ↔ B)

### 9.1 Inbound (Sistema A → Sistema B)

| Pipeline | Endpoint | Dados |
|----------|----------|-------|
| Catálogo | `sync-sistema-a` | Produtos completos |
| JSON Import | `import-system-a-json` | Importação batch |
| Loja Integrada | `import-loja-integrada` | Produtos e-commerce |

### 9.2 Outbound (Sistema B → Sistema A)

| API | Endpoint | Formato |
|-----|----------|---------|
| `data-export` | `/data-export?format=ai_ready` | JSON completo com Knowledge Graph |
| `get-product-data` | `/get-product-data?id=X` | Produto individual |
| `export-parametros-ia` | `/export-parametros-ia` | Parâmetros de impressão 3D |
| `knowledge-feed` | `/knowledge-feed?format=rss` | RSS/Atom feed |
| Sitemaps (5) | Via `robots.txt` | XML Sitemaps |
| `seo-proxy` | Bot User-Agent | HTML SSR completo |

---

## 10. APIs Expostas

### 10.1 `data-export` — API Principal

**Formatos disponíveis:**

| Formato | Parâmetro | Descrição |
|---------|-----------|-----------|
| `full` | `?format=full` | JSON completo (default) |
| `compact` | `?format=compact` | JSON resumido |
| `ai_ready` | `?format=ai_ready` | Estruturado para consumo IA + Knowledge Graph |
| `catalog_only` | `?format=catalog_only` | Apenas catálogo |

### 10.2 Knowledge Graph (formato `ai_ready`)

```json
{
  "knowledge_graph": {
    "nodes": {
      "documents": [ { "id": "doc_XXX", "entity_type": "document", ... } ],
      "videos": [ { "id": "video_XXX", "entity_type": "video", ... } ],
      "authors": [ { "id": "author_XXX", "entity_type": "author", ... } ],
      "articles": [ { "id": "article_XXX", "entity_type": "article", ... } ]
    },
    "relations": [
      { "source_type": "video", "source_id": "video_X", "target_type": "product", "target_id": "Y", "relation": "demonstrates" },
      { "source_type": "article", "source_id": "article_X", "target_type": "author", "target_id": "Y", "relation": "authored_by" }
    ],
    "meta": {
      "node_count": 150,
      "relation_count": 320,
      "generated_at": "2026-03-08T..."
    }
  }
}
```

**Relações automaticamente inferidas:**
- `video → product/resin`: `demonstrates`
- `video → article`: `explains`
- `document → product/resin`: `technical_documentation`
- `article → author`: `authored_by`
- `article → resin`: `recommends`

---

## 11. Frontend

### 11.1 Rotas Públicas

| Rota | Componente | Descrição |
|------|------------|-----------|
| `/` | Index | Hub de parâmetros de impressão 3D |
| `/:brand/:model/:resin` | Index | Parâmetros específicos |
| `/base-conhecimento/**` | KnowledgeBase (PT) | Knowledge Base português |
| `/en/knowledge-base/**` | KnowledgeBase (EN) | Knowledge Base inglês |
| `/es/base-conocimiento/**` | KnowledgeBase (ES) | Knowledge Base espanhol |
| `/produtos/:slug` | ProductPage | Página de produto |
| `/depoimentos/:slug` | TestimonialPage | Página de depoimento |
| `/sobre` | About | Sobre a empresa |
| `/embed/dra-lia` | AgentEmbed | Widget embeddável |
| `/f/:slug` | PublicFormPage | Formulários públicos |

### 11.2 Admin Panel (`/admin`)

| Tab | Componente | Descrição |
|-----|------------|-----------|
| Stats | AdminStats | Dashboard métricas |
| Usuários | AdminUsers | Gestão usuários |
| KB | AdminKnowledge | Editor artigos TipTap |
| Autores | AdminAuthors | Gestão autores (E-E-A-T) |
| Catálogo | AdminCatalog | Produtos + documentos |
| Vídeos | AdminVideosList | Gestão PandaVideo |
| SmartOps | SmartOpsTab | Centro de operações (13 sub-tabs) |
| Dra.LIA | AdminDraLIAStats | Estatísticas agente |

### 11.3 SmartOps — 13 Sub-Tabs

| Sub-Tab | Componente |
|---------|------------|
| Bowtie | SmartOpsBowtie |
| Kanban | SmartOpsKanban |
| Leads | SmartOpsLeadsList |
| Equipe | SmartOpsTeam |
| Automações | SmartOpsCSRules |
| Logs | SmartOpsLogs |
| Relatórios | SmartOpsReports |
| Conteúdo | SmartOpsContentProduction |
| Saúde | SmartOpsSystemHealth |
| WhatsApp | SmartOpsWhatsAppInbox |
| Formulários | SmartOpsFormBuilder |
| Tokens IA | SmartOpsAIUsageDashboard |
| Intelligence | SmartOpsIntelligenceDashboard |

---

## 12. SEO & IA Exposure

### 12.1 Elementos SEO (17+ estruturados)

| Elemento | Arquivo/Função | Descrição |
|----------|----------------|-----------|
| `<title>` | KnowledgeSEOHead | < 60 chars com keyword |
| `<meta description>` | KnowledgeSEOHead | < 160 chars |
| `hreflang` PT/EN/ES | KnowledgeSEOHead | 3 alternates + x-default |
| Canonical | KnowledgeSEOHead | URL canônica i18n |
| Open Graph | KnowledgeSEOHead | title/description/image |
| Twitter Card | KnowledgeSEOHead | Summary large image |
| JSON-LD Article | KnowledgeSEOHead | MedicalWebPage/TechArticle |
| JSON-LD Organization | SEOHead | Dados empresa + contato |
| JSON-LD Product + Offer | SEOHead | Multi-CTA com preço |
| JSON-LD VideoObject | VideoSchema | transcript, duration |
| JSON-LD FAQPage | KnowledgeSEOHead | Auto-extraído de headings "?" |
| JSON-LD HowTo | KnowledgeSEOHead | 4 métodos extração |
| JSON-LD BreadcrumbList | SEOHead | Hierarquia navegação |
| `<meta ai-context>` | SEOHead | Contexto semântico LLMs |
| `llms.txt` | public/ | Instruções crawlers IA |
| `robots.txt` | public/ | Allow GPTBot, ClaudeBot |
| Sitemaps (5) | Edge functions | PT/EN/ES/docs/main |

### 12.2 SSR para Bots — `seo-proxy`

**Arquivo:** 2004 linhas

**Detecção de bots:**
- Googlebot, Bingbot, YandexBot
- GPTBot, ClaudeBot, PerplexityBot
- Facebookbot, Twitterbot, LinkedInBot
- WhatsApp, Telegram, Slack

**Renderiza:**
- HTML completo com JSON-LD schemas
- Content HTML do artigo
- Meta tags + hreflang
- Author signature (E-E-A-T)

---

## 13. Banco de Dados

### 13.1 Tabelas Principais (30+)

| Tabela | Colunas | RLS | Descrição |
|--------|---------|-----|-----------|
| `lia_attendances` | ~200 | admin_only | CDP unificado |
| `knowledge_contents` | ~40 | public read | Artigos KB |
| `knowledge_videos` | ~50 | public read | Vídeos KB |
| `system_a_catalog` | ~80 | public read | Catálogo produtos |
| `catalog_documents` | ~22 | public read | Documentos técnicos |
| `authors` | ~18 | public read | Autores E-E-A-T |
| `resins` | ~40 | public read | Resinas 3D |
| `agent_interactions` | ~20 | admin read | Chat Dra. L.I.A. |
| `agent_embeddings` | 8 | public read | Embeddings RAG |
| `ai_token_usage` | 11 | admin read | Log tokens IA |
| `cs_automation_rules` | ~15 | admin only | Regras CS |
| `external_links` | ~20 | public read | Links aprovados SEO |

### 13.2 Views

| View | Uso |
|------|-----|
| `v_lead_commercial` | Dashboard comercial |
| `v_lead_cognitive` | Dashboard inteligência |
| `v_lead_academy` | Dashboard Astron |
| `v_lead_ecommerce` | Dashboard e-commerce |
| `lead_model_routing` | Roteamento modelo IA |

### 13.3 RPCs

| RPC | Descrição |
|-----|-----------|
| `is_admin(user_id)` | Verifica admin |
| `calculate_intelligence_score(lead_id)` | Calcula LIS |
| `match_agent_embeddings(query, threshold, count)` | Busca semântica |

---

## 14. Edge Functions — Inventário (85+)

### 14.1 Leads & CRM (28 funções)

| Função | Status |
|--------|--------|
| `smart-ops-ingest-lead` | ✅ FUNCIONAL |
| `smart-ops-meta-lead-webhook` | ✅ FUNCIONAL |
| `smart-ops-sellflux-webhook` | ✅ FUNCIONAL |
| `smart-ops-ecommerce-webhook` | ✅ FUNCIONAL |
| `smart-ops-piperun-webhook` | ✅ FUNCIONAL |
| `smart-ops-lia-assign` | ✅ FUNCIONAL |
| `smart-ops-sync-piperun` | ✅ FUNCIONAL |
| `smart-ops-kanban-move` | ✅ FUNCIONAL |
| `cognitive-lead-analysis` | ✅ FUNCIONAL |
| `batch-cognitive-analysis` | ✅ FUNCIONAL |
| `smart-ops-stagnant-processor` | ✅ FUNCIONAL |
| `smart-ops-cs-processor` | ✅ FUNCIONAL |
| `smart-ops-proactive-outreach` | ✅ FUNCIONAL |
| `smart-ops-send-waleads` | ✅ FUNCIONAL |
| `smart-ops-wa-inbox-webhook` | ✅ FUNCIONAL |
| `smart-ops-sellflux-sync` | ✅ FUNCIONAL |
| `system-watchdog-deepseek` | ✅ FUNCIONAL |
| `sync-astron-members` | ✅ FUNCIONAL |
| `astron-member-lookup` | ✅ FUNCIONAL |
| `astron-postback` | ✅ FUNCIONAL |
| `poll-loja-integrada-orders` | ✅ FUNCIONAL |
| `register-loja-webhooks` | ✅ FUNCIONAL |
| `evaluate-interaction` | ✅ FUNCIONAL |
| `import-leads-csv` | ✅ FUNCIONAL |
| `piperun-full-sync` | ✅ FUNCIONAL |
| `backfill-intelligence-score` | 🔧 UTILITÁRIA |
| `backfill-lia-leads` | 🔧 UTILITÁRIA |
| `piperun-api-test` | 🧪 TESTE |

### 14.2 Content & Knowledge (26 funções)

| Função | Status |
|--------|--------|
| `ai-orchestrate-content` | ✅ FUNCIONAL |
| `ai-content-formatter` | ✅ FUNCIONAL |
| `reformat-article-html` | ✅ FUNCIONAL |
| `ai-metadata-generator` | ✅ FUNCIONAL |
| `ai-generate-og-image` | ✅ FUNCIONAL |
| `enrich-article-seo` | ✅ FUNCIONAL |
| `auto-inject-product-cards` | ✅ FUNCIONAL |
| `translate-content` | ✅ FUNCIONAL |
| `extract-pdf-text` | ✅ FUNCIONAL |
| `extract-pdf-raw` | ✅ FUNCIONAL |
| `extract-pdf-specialized` | ✅ FUNCIONAL |
| `extract-and-cache-pdf` | ✅ FUNCIONAL |
| `extract-video-content` | ✅ FUNCIONAL |
| `ai-enrich-pdf-content` | ✅ FUNCIONAL |
| `ai-model-compare` | ✅ FUNCIONAL |
| `generate-veredict-data` | ✅ FUNCIONAL |
| `sync-knowledge-base` | ✅ FUNCIONAL |
| `ingest-knowledge-text` | ✅ FUNCIONAL |
| `sync-google-drive-kb` | ✅ FUNCIONAL |
| `heal-knowledge-gaps` | ✅ FUNCIONAL |
| `link-videos-to-articles` | ✅ FUNCIONAL |
| `enrich-resins-from-apostila` | ✅ FUNCIONAL |
| `export-processing-instructions` | ✅ FUNCIONAL |
| `export-apostila-docx` | ✅ FUNCIONAL |
| `export-parametros-ia` | ✅ FUNCIONAL |
| `backfill-keywords` | 🔧 UTILITÁRIA |

### 14.3 Sitemaps & Discovery (8 funções)

| Função | Status |
|--------|--------|
| `generate-sitemap` | ✅ FUNCIONAL |
| `generate-knowledge-sitemap` | ✅ FUNCIONAL |
| `generate-knowledge-sitemap-en` | ✅ FUNCIONAL |
| `generate-knowledge-sitemap-es` | ✅ FUNCIONAL |
| `generate-documents-sitemap` | ✅ FUNCIONAL |
| `knowledge-feed` | ✅ FUNCIONAL |
| `seo-proxy` | ✅ FUNCIONAL |
| `document-proxy` | ✅ FUNCIONAL |

### 14.4 Agente Dra. L.I.A. (7 funções)

| Função | Status |
|--------|--------|
| `dra-lia` | ✅ FUNCIONAL |
| `dra-lia-whatsapp` | ✅ FUNCIONAL |
| `dra-lia-export` | ✅ FUNCIONAL |
| `index-embeddings` | ✅ FUNCIONAL |
| `index-spin-entries` | ✅ FUNCIONAL |
| `archive-daily-chats` | ✅ FUNCIONAL |
| `extract-commercial-expertise` | ✅ FUNCIONAL |

### 14.5 Sync & Misc (16 funções)

| Função | Status |
|--------|--------|
| `sync-pandavideo` | ✅ FUNCIONAL |
| `sync-video-analytics` | ✅ FUNCIONAL |
| `sync-google-reviews` | ✅ FUNCIONAL |
| `sync-sistema-a` | ✅ FUNCIONAL |
| `import-system-a-json` | ✅ FUNCIONAL |
| `import-loja-integrada` | ✅ FUNCIONAL |
| `create-user` | ✅ FUNCIONAL |
| `data-export` | ✅ FUNCIONAL |
| `get-product-data` | ✅ FUNCIONAL |
| `generate-parameter-pages` | ✅ FUNCIONAL |
| `format-processing-instructions` | ✅ FUNCIONAL |
| `migrate-catalog-images` | 🔧 UTILITÁRIA |
| `pandavideo-test` | 🧪 TESTE |
| `test-api-viewer` | 🧪 TESTE |
| `fix-piperun-links` | 🔧 UTILITÁRIA |
| `create-test-articles` | 🔧 UTILITÁRIA |

---

## 15. Shared Modules (`_shared/`)

| Módulo | Linhas | Descrição |
|--------|--------|-----------|
| `system-prompt.ts` | 251 | SYSTEM_SUPER_PROMPT + ANTI_HALLUCINATION_RULES |
| `testimonial-prompt.ts` | ~100 | Prompt especializado depoimentos |
| `document-prompts.ts` | ~200 | 7 prompts por tipo documento |
| `extraction-rules.ts` | ~150 | Regras extração PDF |
| `log-ai-usage.ts` | ~50 | Logger tokens → ai_token_usage |
| `piperun-field-map.ts` | ~200 | Mapeamento PipeRun ↔ lia_attendances |
| `sellflux-field-map.ts` | ~200 | Mapeamento SellFlux ↔ lia_attendances |
| `og-visual-dictionary.ts` | ~100 | Dicionário visual OG images |
| `entity-dictionary.ts` | ~150 | Entidades Wikidata-linked |
| `citation-builder.ts` | ~100 | Builder de citações acadêmicas |

---

## 16. Segurança

### 16.1 Row Level Security (RLS)

| Padrão | Tabelas |
|--------|---------|
| `admin_only` | lia_attendances, cs_automation_rules, team_members |
| `public_read + admin_CUD` | knowledge_contents, knowledge_videos, system_a_catalog |
| `service_insert + admin_read` | ai_token_usage, lead_state_events |

### 16.2 JWT Configuration

**`verify_jwt = false`:** 80+ funções (webhooks, APIs públicas)

**`verify_jwt = true`:**
- `create-user`
- `ai-metadata-generator`
- `create-test-articles`
- `heal-knowledge-gaps`

### 16.3 Secrets Necessários

| Secret | Funções |
|--------|---------|
| `SUPABASE_URL` | Todas |
| `SUPABASE_SERVICE_ROLE_KEY` | Todas |
| `LOVABLE_API_KEY` | Funções IA |
| `PIPERUN_API_TOKEN` | CRM Sync |
| `WALEADS_API_KEY` | WhatsApp |
| `SELLFLUX_API_KEY` | SellFlux |
| `PANDAVIDEO_API_KEY` | Vídeos |
| `ASTRON_API_KEY` | Academy |
| `GOOGLE_DRIVE_API_KEY` | KB Sync |
| `GOOGLE_PLACES_API_KEY` | Reviews |
| `META_WEBHOOK_VERIFY_TOKEN` | Meta Ads |

---

## 17. Métricas do Sistema

| Métrica | Valor |
|---------|-------|
| **Tabelas PostgreSQL** | 30+ |
| **Views** | 5 |
| **Edge Functions** | 85+ |
| **Componentes React** | 100+ |
| **Shared Modules** | 10 |
| **Linhas de código (Edge Functions)** | ~50,000 |
| **Colunas no CDP (lia_attendances)** | ~200 |
| **Idiomas suportados** | 3 (PT/EN/ES) |
| **Entry points de leads** | 5 |
| **Eixos cognitivos** | 10 |
| **Sitemaps** | 5 |
| **JSON-LD schemas** | 17+ |
| **Integrações externas** | 9 |

---

## 18. Changelog

### v1.0 (2026-03-08)
- Documento inicial com descrição completa do sistema
- Incorporado Knowledge Graph da API `data-export`
- Mapeamento completo de 85+ Edge Functions
- Arquitetura dual documentada (Leads + Content)

---

*Documento gerado em 2026-03-08 como especificação técnica completa do Sistema B.*
