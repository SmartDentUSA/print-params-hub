# Auditoria Completa — SmartDent Revenue Intelligence OS
**Data:** 16 de junho de 2026
**Versão:** 1.0
**Escopo:** Arquitetura · Engenharia · IA · SEO/GEO/SERP · E-E-A-T · Server-Side · Processos · Segurança
**Domínio:** `admin.smartdent.com.br` (produção) · `print-params-hub.lovable.app` (preview)
**Projeto Supabase:** `okeogjgqijbfkudfjadz`

---

## 0. Sumário Executivo

O **SmartDent Revenue Intelligence OS** é uma plataforma proprietária full-stack que orquestra **captação → qualificação → conversão → retenção → reativação** de leads no segmento de odontologia digital (impressão 3D, scanners, resinas, cursos). Combina:

- **CDP unificado** com Golden Rule de canonicalização (`merged_into IS NULL`).
- **Camada de IA** multi-provedor com roteamento dinâmico (Poe / Lovable Gateway / DeepSeek) e fallback automático.
- **Integrações bidirecionais** com 12+ sistemas externos (PipeRun, Omie, Sellflux, Loja Integrada, Meta Ads, Evolution, Astron, Panda Video, tl;dv, Zernio, Google Business, Google Drive).
- **Stack SEO AI-First 10/10** com SSR para bots, llms.txt/llms-full.txt, JSON-LD E-E-A-T e sitemap dinâmico segmentado.

### Score Geral

| Dimensão | Score | Status |
|---|---|---|
| Arquitetura de Dados | 9.0 | Excelente — CDP maduro, identity cascade documentada |
| Inteligência Artificial | 9.5 | Excelente — Router multi-provedor, RAG threshold tunado, anti-alucinação |
| SEO / GEO / E-E-A-T | 9.5 | Excelente — Stack AI-First raríssimo no setor |
| Integrações Externas | 9.0 | Excelente — 170 edge functions, resilência por locks TTL |
| Observabilidade | 7.0 | Bom — `system_health_logs` e `ai_token_usage`, falta dashboard unificado |
| Segurança | 7.5 | Bom — RLS na maioria das tabelas; ~20 tabelas com RLS off precisam revisão |
| Performance Frontend | 7.5 | Bom — Vite + code splitting; falta monitoramento Core Web Vitals |
| Documentação | 9.0 | Excelente — 80+ regras versionadas em `mem://` |
| **GERAL** | **8.5** | **Maduro — pronto para escala** |

### Top 5 Forças
1. **Memory architecture (`mem://`)** com 80+ regras de negócio versionadas — disciplina rara.
2. **AI Router com cascata de fallback** previne queda total por exaustão de créditos.
3. **Bot middleware Vercel → seo-proxy SSR** entrega HTML completo a Googlebot/GPTBot/PerplexityBot.
4. **Identity cascade `piperun_id > email > phone`** elimina duplicatas e protege LTV.
5. **Commercial Intent Guard** impede criação acidental de Deals para tráfego não-comercial.

### Top 5 Riscos
1. **Google Business Profile API** aguardando aprovação de quota (bloqueante para Reviews Vitrine).
2. **`lia_attendances` com 565 colunas** — sintoma de spillover; normalização parcial recomendada.
3. **~20 tabelas com RLS desabilitado** (`social_*`, `cad_*`, `astron_*`, `agent_actions_log`) — auditoria caso-a-caso.
4. **Dependência crítica do Evolution self-hosted** sem failover para WaLeads.
5. **Ausência de monitoramento Core Web Vitals** automatizado para SEO técnico.

---

## 1. Arquitetura & Engenharia

### 1.1 Stack Tecnológico

| Camada | Tecnologia | Versão | Observações |
|---|---|---|---|
| Frontend | React + Vite + TypeScript | 18 / 5 / 5 | SPA com lazy loading e ChunkErrorBoundary |
| UI | Tailwind CSS + shadcn/ui | v3 | Tokens semânticos em `index.css` |
| Estado | React Query + Context API | 5.x | Cache server-state, contextos para auth/data |
| Backend | Supabase (Postgres 15) | — | 190+ tabelas, RLS, triggers, RPC functions |
| Edge Functions | Deno (Supabase Edge Runtime) | — | 170 funções deployadas |
| Hosting Frontend | Lovable + Vercel | — | Vercel para SSR/bot middleware |
| AI Gateway | Poe / Lovable AI / DeepSeek | — | Roteamento via `ai_model_routing` |
| Mensageria | Evolution API (self-hosted) | — | WhatsApp per-instance |
| Tracking | GTM + Meta CAPI | — | `dataLayer.push` + server-side events |

### 1.2 Topologia

```text
┌─────────────────────────────────────────────────────────────────┐
│  Bots (Googlebot, GPTBot, PerplexityBot, ClaudeBot)             │
│         ↓                                                        │
│  Vercel Edge Middleware (api/middleware-bot.ts)                 │
│         ↓ (rewrite)                                              │
│  Supabase Edge Function seo-proxy → HTML SSR                    │
└─────────────────────────────────────────────────────────────────┘
                          ↑
┌─────────────────────────────────────────────────────────────────┐
│  Usuários humanos → Lovable CDN → React SPA (Vite build)        │
│         ↓                                                        │
│  Supabase JS Client (anon key) → REST/RPC/Realtime              │
└─────────────────────────────────────────────────────────────────┘
                          ↕
┌─────────────────────────────────────────────────────────────────┐
│         Supabase Postgres (RLS + Triggers + RPC)                │
│                          ↕                                       │
│  170 Edge Functions (Deno)                                       │
│   ├─ Ingestão: smart-ops-meta-lead-webhook, smart-ops-ingest-*  │
│   ├─ IA: smart-ops-copilot, dra-lia, cognitive-lead-analysis    │
│   ├─ Integrações: piperun-*, omie-*, sellflux-*, wa-*           │
│   ├─ SEO/SSR: seo-proxy, llms-txt, llms-full-txt, *-sitemap     │
│   ├─ Conteúdo: ai-*, enrich-*, extract-*, social-*              │
│   └─ Cron/Backfill: backfill-*, sync-*, *-cron                  │
└─────────────────────────────────────────────────────────────────┘
                          ↕
┌─────────────────────────────────────────────────────────────────┐
│  APIs Externas                                                   │
│   PipeRun · Omie · Sellflux · Loja Integrada · Meta Graph       │
│   Evolution · Astron · Panda Video · tl;dv · Zernio · GBP       │
│   Google Drive · Google Search Console · OpenAI/Gemini/DeepSeek │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Inventário de Edge Functions (170 funções)

Agrupadas por domínio:

| Domínio | Qtd | Exemplos representativos |
|---|---|---|
| **Ingestão de Leads** | 8 | `smart-ops-meta-lead-webhook`, `smart-ops-ingest-lead`, `import-leads-csv`, `import-loja-integrada` |
| **CRM (PipeRun)** | 14 | `smart-ops-piperun-webhook`, `smart-ops-sync-piperun`, `piperun-full-sync`, `smart-ops-piperun-retry-failed-leads`, `smart-ops-piperun-funnel-reconciler`, `piperun-person-empty-sweeper` |
| **ERP (Omie)** | 4 | `omie-api-explorer`, `omie-lead-enricher` |
| **E-commerce** | 4 | `smart-ops-ecommerce-webhook`, `poll-loja-integrada-orders`, `register-loja-webhooks`, `sync-loja-integrada-clients` |
| **Sellflux** | 2 | `smart-ops-sellflux-sync`, `smart-ops-sellflux-webhook` |
| **WhatsApp / Evolution** | 13 | `wa-dispatcher`, `wa-broadcast-dispatch`, `wa-verify-lead`, `wa-sync-groups`, `wa-delivery-reconciler`, `smart-ops-wa-inbox-webhook`, `smart-ops-send-waleads` |
| **Zernio (Instagram/DM)** | 5 | `zernio-webhook`, `zernio-broadcast-dispatch`, `zernio-contacts-sync` |
| **IA — Copilot/LIA** | 11 | `smart-ops-copilot`, `dra-lia`, `dra-lia-whatsapp`, `cognitive-lead-analysis`, `batch-cognitive-analysis`, `automacoes-lia`, `system-watchdog-deepseek` |
| **IA — Conteúdo** | 10 | `ai-orchestrate-content`, `ai-metadata-generator`, `ai-generate-og-image`, `enrich-article-seo`, `format-processing-instructions`, `ai-enrich-pdf-content` |
| **SEO/SSR** | 10 | `seo-proxy`, `llms-txt`, `llms-full-txt`, `generate-sitemap`, `video-sitemap`, `generate-knowledge-sitemap`, `resubmit-sitemap-to-gsc`, `rss-feed` |
| **Conhecimento/RAG** | 8 | `knowledge-feed`, `ingest-knowledge-text`, `index-embeddings`, `heal-knowledge-gaps`, `link-videos-to-articles` |
| **Cursos/Astron** | 6 | `astron-postback`, `sync-astron-members`, `import-astron-csv`, `generate-certificate`, `smartops-gerar-crachas-turma` |
| **Meta Ads** | 3 | `smart-ops-meta-ads-insights`, `smart-ops-meta-ads-manager`, `smart-ops-meta-csv-backfill` |
| **Backfills/Migrações** | 12 | `backfill-deals-append`, `backfill-ltv`, `backfill-intelligence-score`, `smart-ops-backfill-equipment-from-deals` |
| **Google Reviews** | 4 | `google-oauth-callback`, `google-reviews-pull`, `google-reviews-respond`, `sync-google-reviews` |
| **Outros** | ~56 | Exportações, sincronizações, utilitários |

### 1.4 Inventário de Tabelas por Domínio (190+ tabelas)

| Domínio | Tabelas-chave | Observações |
|---|---|---|
| **CDP/Identidade** | `lia_attendances` (565 col), `people`, `identity_keys`, `person_company_relationship`, `companies` | Golden Rule `merged_into IS NULL` |
| **CRM** | `deals`, `deal_items`, `deal_status_history`, `piperun_*` (5 tabelas), `lead_*` (10+ tabelas) | Imutabilidade VENDAS |
| **ERP** | `omie_notas_fiscais`, `omie_nf_items`, `omie_parcelas`, `omie_snapshot_mensal`, `omie_vendedores` | Identity: `cnpj+uf` ou `cpf` |
| **Cursos** | `smartops_courses`, `smartops_course_turmas`, `smartops_course_enrollments`, `astron_*` (4) | Recurrence engine v1 |
| **IA/Agentes** | `ai_model_routing`, `ai_token_usage`, `agent_*` (8), `cognitive_lead_locks`, `lia_cognitive_insights` | TTL lock 30s |
| **Conhecimento** | `knowledge_contents` (54 col), `knowledge_videos` (50 col), `knowledge_categories`, `commercial_faqs`, `success_stories`, `agent_embeddings`, `image_embedding_cache`, `text_embedding_cache` | Taxonomia A-G |
| **WhatsApp** | `wa_*` (12 tabelas), `whatsapp_*` (3), `lia_attendances.evolution_*` | Per-instance creds |
| **Social** | `social_*` (18 tabelas) | RLS off — revisão pendente |
| **Campanhas** | `campaigns`, `campaign_*` (8), `wa_campaigns`, `wa_campaign_groups` | Canonical leads only |
| **Tracking** | `lead_page_views`, `lead_activity_log`, `meta_capi_event_log`, `meta_lead_event_buffer` | IP hash join |
| **Conteúdo Geração** | `content_bridge`, `content_requests`, `knowledge_gap_drafts`, `kb_assets` | Sem preços |
| **Catálogo Produto** | `products_catalog`, `system_a_catalog`, `produto_aliases`, `resins` (70 col), `models`, `brands` | Mirror canônico |
| **CAD/Marketplace** | `cad_*` (8 tabelas) | RLS off — revisão pendente |
| **Tickets/Suporte** | `technical_tickets`, `technical_ticket_messages`, `support_cases` | Workflow 5-step CBR |
| **tl;dv (reuniões)** | `tldv_*` (4 tabelas) | Intelligence per meeting |
| **Site/SEO** | `site_settings`, `external_links`, `sitemap_resubmit_state`, `google_indexing_log` | GSC indexing API |
| **Reviews Google** | `google_oauth_tokens`, `google_reviews` | ⏳ Aguardando quota |
| **Autenticação** | `user_roles`, `team_members` | `has_role()` security definer |

### 1.5 Cron Jobs Ativos

| Cron | Frequência | Função |
|---|---|---|
| `google-reviews-pull-3days` | `0 9 */3 * *` | Sincroniza reviews Google |
| `enrichment-safety-net-cron` | recorrente | Reprocessa enrichment falho |
| `wa-contact-sync-cron` | recorrente | Sincroniza contatos WhatsApp |
| `archive-daily-chats` | diário | Arquiva conversas LIA |
| `smart-ops-stagnant-processor` | recorrente | Reativa leads parados |
| `smart-ops-cs-processor` | recorrente | CS onboarding mover |
| `poll-loja-integrada-orders` | recorrente | Polling incremental e-commerce |
| `sync-pandavideo` | recorrente | Sync vídeos cursos |
| `sync-google-drive-kb` | recorrente | Sync docs KB |
| `system-watchdog-deepseek` | recorrente | Watchdog IA/health |

### 1.6 Locks de Concorrência

| Lock | Tipo | TTL | Propósito |
|---|---|---|---|
| `cognitive_lead_locks` | Row-based TTL | 30s | Previne análise cognitiva duplicada |
| `smartops_deal_note_locks` | Atômico RPC | — | `try_claim_seller_note_slot` único por slot |
| `lia_attendances.crm_lock_until` | Timestamp | 30s | Sync CRM externo |
| `briefing_locks` | Row | — | Geração de briefing IA |
| `boas_vindas_locks` | Row | — | Mensagens de boas-vindas |
| `lia_assign_note_dedup` | Row | — | Dedup notas de atribuição |

---

## 2. CDP & Identidade

### 2.1 Golden Rule

> **Toda query em `lia_attendances` DEVE incluir `WHERE merged_into IS NULL`** para processar apenas leads canônicos.

Aplicada em: webhooks Meta, sync PipeRun/Omie/Sellflux, campanhas, cálculos de LTV, dashboards BI, agentes IA.

### 2.2 Identity Cascade

Prioridade absoluta na resolução de identidade:
1. `piperun_id` (PipeRun é fonte de verdade do CRM)
2. `email` (normalizado lowercase)
3. `phone` (normalizado E.164 BR via `brazilian-phone-normalization`)

Regra crítica: **nunca mesclar pessoas distintas da mesma empresa**.

### 2.3 Person Origin Frozen

`createPerson` grava `origin_id` a partir de `origem_primeiro_contato` ou `form_name`. `updatePersonFields` **NÃO PODE** sobrescrever `origin` — origem é congelada no primeiro contato. Origem do *Deal* (campanha) é distinta e pode mudar.

### 2.4 Commercial Intent Guard

PipeRun Deal só é criado quando o lead atende a:
- Possui `form_name` válido OU
- `source` em whitelist (Meta lead form, formulário site) OU
- `piperun_id` já existente (lead reaparece) OU
- Flag `commercial_override` explícita

**Bloqueado**: Astron, e-commerce, WhatsApp cru, raw browsing. Implementado em `_shared/commercial-intent.ts`.

### 2.5 Smart Merge

`smart-ops-lead-merge` auto-mescla duplicatas ao acessar card; copia histórico incrementalmente; preserva `proposal_id` para dedup; lock previne race condition durante merge.

---

## 3. Inteligência Artificial

### 3.1 AI Router Multi-Provedor

```text
Request (task_type) ─→ ai_model_routing (cache 60s)
                          │
                          ├─ Primary: Poe / Lovable / DeepSeek
                          │     ↓ (se falhar 402/429/5xx/network)
                          └─ Fallback: provedor alternativo
                                ↓
                          ai_token_usage (log fire-and-forget)
```

Arquivo: `supabase/functions/_shared/ai-router.ts`
Tabela: `ai_model_routing` (15 colunas)

### 3.2 Agentes de IA

| Agente | Persona | Modelo Default | Restrições |
|---|---|---|---|
| **Copilot Senior** | Gerente Comercial Sênior. "Nunca pergunte, sempre execute" | DeepSeek + Gemini fallback | Lê apenas do schema `copilot_brain`. Tools de ação, não de leitura. Max 8 linhas. |
| **Dra. LIA** | Consultora Dental rigorosa | Gemini / DeepSeek por task | Anti prompt-injection. Progressive qualification (Name → Email → Phone → Area → Specialty). |
| **Cognitive Opportunity Engine** | Calculadora de Next Best Actions | LLM via router | Score 0-100. Lock TTL 30s. |
| **Visual Diagnostic** | Classifica imagens clínicas CBR | Gemini Flash Lite | Output JSON estruturado. |
| **Content Generator** | Geração de artigos/metadados | Multi-modelo | **NUNCA inclui preços**. |
| **Watchdog DeepSeek** | Monitor de saúde de IAs | DeepSeek | Detecta degradação por anomalias. |

### 3.3 RAG Architecture v4

- **Threshold de similaridade vetorial**: 0.56 (calibrado anti-alucinação).
- **Fallback FTS/ILIKE** se vector similarity < 0.5 (Complete Collection policy).
- **Deduplicação de títulos** no resultado.
- **Priorização**: structured content > media.
- **Embedding storage**: `agent_embeddings`, `text_embedding_cache`, `image_embedding_cache`.

### 3.4 Capability Snapshot (anti-alucinação)

`smart-ops-copilot` injeta a cada turno um bloco `CAPABILITY SNAPSHOT` com contagens reais de FAQs/cases/conteúdos (cache 5min). Proíbe respostas "0/10/não sei" quando snapshot mostra contagem > 0 antes de chamar a tool correspondente.

### 3.5 Anti-Prompt Injection

`isPromptInjection` (regex) bloqueia tentativas de:
- Consultar infra/config/credenciais.
- Burlar persona ("ignore instruções anteriores").
- Vazar prompts do sistema.

Implementado em todos os endpoints de IA voltados ao público.

### 3.6 Observabilidade IA

- **`ai_token_usage`**: log de cada chamada (provider, modelo, tokens, custo estimado, task).
- **`system_health_logs`**: anomalias, latência, `prompt_chars`.
- **`agent_actions_log`**: histórico de ações executadas pelos agentes.

---

## 4. Receita & Business Intelligence

### 4.1 Fórmula Canônica de Receita

```text
Receita_Lead = MAX(CRM_Won, Omie_Billing) + LTV_Ecommerce
```

Implementada em `query_sales_summary` (RPC) — IA agents **DEVEM** usar essa RPC, nunca SELECT direto.

### 4.2 Pipeline Funnel (4 bandas)

```text
< 60  → Discovery/Cold
60-80 → Qualified
90    → Proposal/Negotiation
100   → Won
```

Agregado por `stage_name` em `pipeline-funnel-data`.

### 4.3 Intelligence Score (4 eixos, 81 pts)

RPC SQL calcula score governado:
- Engagement
- Comercial Fit
- Financeiro
- Recência

Limite máximo 81 pontos.

### 4.4 RFM Scoring

| Tier | Critério | Score |
|---|---|---|
| VIP | 5+ deals ganhos | 280 |
| Premium | 3-4 deals | 200 |
| Active | 1-2 deals | 150 |

Baseado **apenas** em histórico de deals (não em pageviews).

### 4.5 Revenue Gauge

```text
Gauge = Pipeline_Existente / ((Meta - Won) × 3)
```

Indicador visual de saúde da meta no `SmartOpsIntelligenceDashboard`.

---

## 5. SEO / GEO / SERP / E-E-A-T

### 5.1 Arquitetura AI-First Semantic 10/10

Estrutura HEAD/BODY otimizada para LLMs e crawlers tradicionais:
- `<title>` único < 60 chars com keyword.
- Meta description < 160 chars.
- Canonical e og:url auto-referenciados.
- JSON-LD stackable por página.
- Person Schema E-E-A-T para autores.
- Breadcrumb Schema em todas as páginas internas.

### 5.2 GEO (Generative Engine Optimization)

- **`public/llms.txt`**: índice navegável para LLMs.
- **`/llms.txt` e `/llms-full.txt`** servidos via edge functions (`llms-txt`, `llms-full-txt`).
- **TL;DR visível** no topo de artigos.
- **Dataset schema** em páginas com dados estruturados.

### 5.3 Bot Rendering Middleware

```text
Crawler (Googlebot/GPTBot/PerplexityBot/ClaudeBot/Bingbot)
   ↓
Vercel Edge Middleware (api/middleware-bot.ts) — detecta UA
   ↓ (rewrite)
Supabase Edge Function seo-proxy
   ↓
HTML totalmente renderizado server-side (meta + JSON-LD + conteúdo)
```

Humanos seguem fluxo SPA normal. Sem cloaking — conteúdo idêntico.

### 5.4 Sitemap Estratégia (multi-arquivo)

| Sitemap | Função | Conteúdo |
|---|---|---|
| `sitemap.xml` | Master | Páginas estáticas |
| `generate-sitemap` | Edge | Páginas dinâmicas |
| `generate-knowledge-sitemap` (PT/EN/ES) | Edge i18n | Artigos KB |
| `generate-documents-sitemap` | Edge | PDFs/docs |
| `video-sitemap` | Edge | Schema VideoObject |
| `sitemap-index.xml` | Index | Aponta para os demais |

Resubmissão automática ao GSC via `resubmit-sitemap-to-gsc` (Google Indexing API com log em `google_indexing_log`).

### 5.5 JSON-LD Stackable

Implementados:
- `Organization` (sitewide em `index.html`)
- `WebSite` (sitewide com `SearchAction`)
- `Article` + `Person` (autor) em artigos
- `Product` + `Offer` em catálogo
- `FAQPage` em páginas Q&A
- `BreadcrumbList` em todas internas
- `VideoObject` em páginas de vídeo
- `Dataset` em páginas com dados estruturados
- `Course` em cursos

### 5.6 Video Search Optimization

- Sitemap dedicado servido por edge function (`/video-sitemap.xml`).
- Schema VideoObject com `thumbnailUrl`, `uploadDate`, `duration`, `contentUrl`.
- Transcripts via `extract-video-content` aumentam superfície semântica.

### 5.7 Knowledge Base URL Integrity

4 camadas garantem canonical paths:
1. Roteamento React (`/base-conhecimento/{letter}/{slug}`)
2. Interceptação de cliques em SPA links
3. Sanitização de slugs (remove domínio externo)
4. Fallback 301 em `KnowledgeArticleRedirect`

### 5.8 E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness)

- **Authors table** com bios, fotos, credenciais, Person Schema completo (sameAs, alumniOf, jobTitle, worksFor).
- **AuthorBio** em todos os artigos.
- **AuthorSignature** com token verificável.
- **Testimonials** com Schema Review.
- **Success Stories** linkadas a casos reais.

---

## 6. Server-Side / Edge

### 6.1 Vercel Edge Middleware

`api/middleware-bot.ts` — detecta User-Agent de bots SEO/AI e faz rewrite transparente para `seo-proxy`. Humanos não são afetados.

### 6.2 SSR Edge Functions

| Função | Responsabilidade |
|---|---|
| `seo-proxy` | Renderiza HTML completo com meta tags, JSON-LD e conteúdo principal |
| `llms-txt` | Serve `/llms.txt` dinamicamente |
| `llms-full-txt` | Serve `/llms-full.txt` com corpus completo |
| `video-sitemap` | Gera sitemap de vídeos on-demand |
| `rss-feed` | RSS de artigos KB |

### 6.3 Configurações de Segurança (config.toml)

`verify_jwt = false` apenas em webhooks públicos:
- `smart-ops-meta-lead-webhook`
- `smart-ops-sellflux-webhook`
- `smart-ops-ecommerce-webhook`
- `smart-ops-piperun-webhook`
- `smart-ops-wa-inbox-webhook`
- `zernio-webhook`
- `astron-postback`
- `google-oauth-callback`
- `google-reviews-pull`
- `seo-proxy`, `llms-txt`, `llms-full-txt` (públicos)

Demais funções exigem JWT autenticado.

### 6.4 Evolution Per-Instance Credentials

Cada instância Evolution self-hosted tem `apikey`/`evolution_phone`/`evolution_lid` próprios em `team_members`. `EVO_KEY` global é **só fallback**. Nova instância **DEVE** ter credenciais cadastradas antes do 1º sync (senão 401 ou lista vazia).

---

## 7. Tracking & Analytics

### 7.1 Stack de Tracking

| Camada | Tecnologia | Destino |
|---|---|---|
| Client-side | GTM `GTM-NZ64Q899` | dataLayer.push |
| Server-side | Meta CAPI | `meta_capi_event_log` (dedup) |
| Page views | `lead_page_views` | 10 tipos taxonomizados (article, product, resin, course, homepage, support, knowledge_index, video, testimonial, parameter) |
| Sessão tracking | `sessionStorage` | Persiste contexto entre rotas SPA |
| IP hash | SHA-256 truncado | Une page_views ao lead anonimamente |

### 7.2 Eventos dataLayer

- `parameter_view` — visualização de parâmetro de impressão
- `parameter_copy` — cópia de receita
- `video_play` / `video_complete`
- `kb_article_read`
- `lead_form_submit`

### 7.3 Meta CAPI

Server-side via `smart-ops-meta-lead-webhook`. Dedup por `event_id`. Inclui `fbc`/`fbp` cookies + hash de email/phone (PII compliant LGPD).

---

## 8. Conteúdo & Knowledge Base

### 8.1 Taxonomia

| Letra | Categoria |
|---|---|
| A | Resinas |
| B | Impressoras |
| C | Scanners |
| D | Software CAD |
| E | Procedimentos clínicos |
| F | Vídeos / Mídia |
| G | Redireciona para `/support-resources` |

### 8.2 Pipeline de Geração de Conteúdo

```text
content_request → ai-orchestrate-content
                    ├─ ai-metadata-generator (title/meta/keywords)
                    ├─ ai-generate-og-image (banner)
                    ├─ ai-content-formatter (HTML semântico)
                    ├─ enrich-article-seo (JSON-LD, internal links)
                    └─ auto-inject-product-cards (CTAs)
                          ↓
                    knowledge_contents (status: draft → review → published)
```

**Constraint absoluta**: nunca incluir preços ou valores comerciais.

### 8.3 Tabelas de Conhecimento

- `knowledge_contents` (54 col): artigos
- `knowledge_videos` (50 col): vídeos com metrics
- `commercial_faqs`: perguntas frequentes
- `success_stories`: casos
- `resin_documents`, `resin_presentations`: docs técnicos
- `system_a_content_library`: biblioteca espelhada
- `smartdent_method_docs`: documentação metodológica

### 8.4 Resilência de Renderização

Fallback para `content_html` cru se transformação markdown falhar (`knowledge-base-rendering-resilience`).

---

## 9. Integrações Externas

### 9.1 PipeRun (CRM)

- **5 tabelas staging**: `piperun_staging`, `piperun_pessoas_staging`, `piperun_webhook_events`, `piperun_stage_transitions`, `piperun_stage_map_overrides`
- **14 edge functions** dedicadas
- **Sync spec v6**: SKU priority cascade, ignora numeric owner_name
- **CustomFields flat hash** (constraint API)
- **Data cleansing**: rejeita Zapier, Plug & Play, date-prefixed names
- **Merge collision prevention**: clears identifiers de leads `merged_into`
- **Funnel reconciler**: 4 layers `workflow_cell_mappings`

### 9.2 Omie (ERP)

- **Identity v5**: normalized `cnpj+uf`, fallback `cpf`
- **Snapshot mensal**: `omie_snapshot_mensal`
- **Mapeamento direto** ao Hero Card via `useLeadErpData`

### 9.3 Sellflux (Checkout/Vendas)

- **Bidirecional**: webhook + sync periódico
- **Custom fields** PIX/Astron em `sellflux_custom_fields`
- **Timeline events** extraem timestamp original do payload

### 9.4 Loja Integrada (E-commerce)

- **Polling incremental** com cursor
- **Dedup por número de pedido**
- **Timeout 45s** por batch
- **Timestamps reais** da API (não `now()`)

### 9.5 Meta Ads

- `smart-ops-meta-ads-insights`: pull diário
- `smart-ops-meta-ads-manager`: pause/scale campanhas
- `smart-ops-meta-lead-webhook`: ingestão real-time
- Re-entregas com `form_name` aplicam enrichment + régua VENDAS universal

### 9.6 Evolution (WhatsApp self-hosted)

- 13 edge functions
- Per-instance credentials obrigatórias
- Failover: WaLeads (em deprecação)
- Dispatcher com retry, dedup (`wa_message_dedup`), reconciler

### 9.7 Zernio (Instagram/DM)

- Webhook + sync de contas/contatos/métricas
- Broadcast dispatch

### 9.8 Astron Academy (Cursos externos)

- `astron-postback`: aluno se matriculou
- `sync-astron-members`: bulk sync
- Importação CSV
- 4 tabelas: `astron_courses`, `astron_lessons`, `astron_modules`, `astron_member_access`

### 9.9 Panda Video

- `sync-pandavideo`: sync vídeos
- `link-videos-to-articles`: associação RAG
- Métricas em `knowledge_video_metrics_log`

### 9.10 tl;dv (Reuniões)

- 4 tabelas com intelligence por reunião
- Webhook + sync
- Extrai insights, próximos passos, participantes

### 9.11 Google Business Profile

- **⏳ Bloqueado**: aguardando aprovação de quota
- OAuth implementado
- Cascata de IA para resposta automática (`google-reviews-respond`)

### 9.12 Google Drive

- `sync-google-drive-kb`: ingestão de docs da pasta KB
- Log em `drive_kb_sync_log`

---

## 10. Funcionalidades Principais (Visão de Produto)

| Módulo | Função | Tabelas | Edge Functions |
|---|---|---|---|
| **Lead 360 Card** | Visão unificada do lead | `lia_attendances`, `deals`, `omie_*`, `sellflux_*` | `get_lead_card` (RPC) |
| **Kanban CRM** | Drag-drop entre estágios | `deals`, `deal_status_history` | `smart-ops-kanban-move` |
| **Campaign Central** | Wizard 3-step de campanhas | `campaigns`, `campaign_*` | `wa-campaign-builder` |
| **Reactivation Engine** | Auto ofertas complementares | `reactivation_rules`, `reactivation_sequences` | `sequence-runner` |
| **Knowledge Hub Admin** | CMS de artigos/vídeos | `knowledge_*`, `kb_assets` | `ai-orchestrate-content` |
| **Smart Ops Forms** | Form builder dinâmico | `smartops_forms`, `smartops_form_fields` | `smart-ops-ingest-lead` |
| **ROI Calculators** | Simuladores 7-stage dental workflow | `roi_cards`, `roi_card_items`, `roi_card_cad_types` | — |
| **Course Engine** | Turmas, matrículas, certificados | `smartops_course_*`, `smartops_enrollment_companions` | `generate-certificate`, `smartops-gerar-crachas-turma` |
| **WhatsApp Inbox** | Visualização de conversas | `whatsapp_inbox`, `lia_attendances` | `smart-ops-wa-inbox-webhook` |
| **Smart Ops Copilot** | Chat operacional sênior | `copilot_brain.*` | `smart-ops-copilot` |
| **Dra. LIA SDR** | SDR conversacional | `lia_attendances`, `agent_*` | `dra-lia`, `dra-lia-whatsapp` |
| **Social Reviews** | Vitrine Google Reviews | `google_reviews` | `google-reviews-pull/respond` |
| **Support Resources** | Catálogo unificado | `system_a_catalog`, `resins`, `catalog_documents` | `sync-content-from-a` |
| **Pipeline Funnel** | Visualização 4 bandas | `deals` | `pipeline-funnel-data` |
| **Intelligence Dashboard** | KPIs + Revenue Gauge | RPCs múltiplas | — |

---

## 11. Segurança

### 11.1 Modelo de Acesso

- **`user_roles`** + função `has_role()` security definer (anti-recursão RLS).
- **Anon key** apenas no frontend (`VITE_SUPABASE_PUBLISHABLE_KEY`).
- **Service role key** apenas em edge functions via `Deno.env.get()`.
- **JWT verification** habilitado por padrão; desabilitado apenas em webhooks públicos documentados.

### 11.2 RLS Coverage

✅ **Tabelas com RLS habilitado e policies** (maioria):
- `lia_attendances`, `deals`, `deal_items`, `people`, `companies`
- `knowledge_contents`, `knowledge_videos`, `commercial_faqs`
- `user_roles`, `team_members`
- Todas as `omie_*`, `piperun_*` staging

⚠️ **Tabelas com RLS desabilitado — REVISÃO NECESSÁRIA**:
- `agent_actions_log`, `agent_observations`, `agent_rules`, `agent_state`
- Todas as `social_*` (18 tabelas)
- Todas as `cad_*` (8 tabelas)
- Todas as `astron_*` (4 tabelas)
- Todas as `online_course_*` (3 tabelas)
- `kb_assets`, `dealers`, `classified_listings`
- `briefing_locks`, `boas_vindas_locks`, `lia_assign_note_dedup`
- `cs_onboarding_mover_*`, `campaign_content_posts`, `campaign_produto_map`
- `platform_*` (3 tabelas), `referrals`, `promotion_usage`, `smartpoints_ledger`
- `wa_lid_phone_map`, `smartdent_method_docs`'s related, `piperun_stage_map_overrides`

### 11.3 Anti Prompt Injection

`isPromptInjection` regex bloqueia queries de infra/config em todos os endpoints públicos de IA (Dra. LIA, WhatsApp inbox).

### 11.4 Secrets Management

Via Supabase Edge Functions Secrets (Vault). Nunca no código nem na tabela. Atualmente configurados (parcial):
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- `LOVABLE_API_KEY`, `DEEPSEEK_API_KEY`, `POE_API_KEY`
- `PIPERUN_API_KEY`, `OMIE_*`, `SELLFLUX_*`, `EVO_KEY`
- `META_ACCESS_TOKEN`, `META_APP_SECRET`
- `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`

### 11.5 Grants em Public Schema

Toda tabela criada em `public` segue padrão:
```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.<table> TO authenticated;
GRANT ALL ON public.<table> TO service_role;
-- GRANT SELECT ON public.<table> TO anon; (apenas se public-read)
```

Auditoria recomendada: rodar `supabase--linter` e revisar findings.

---

## 12. Observabilidade

### 12.1 Logs Disponíveis

| Tabela | Conteúdo |
|---|---|
| `system_health_logs` | Anomalias, latência, prompt_chars, alertas |
| `ai_token_usage` | Cada chamada de IA (custo, tokens, provider) |
| `agent_actions_log` | Ações executadas pelos agentes |
| `agent_interactions` | Conversas completas |
| `lead_activity_log` | Eventos de lead (timeline) |
| `meta_capi_event_log` | Eventos Meta CAPI |
| `meta_lead_ingestion_log` | Ingestão Meta webhook |
| `piperun_webhook_events` | Webhooks PipeRun recebidos |
| `wa_send_log` | Envios WhatsApp |
| `campaign_send_log` | Envios de campanha |
| `lead_enrichment_audit` | Auditoria de enriquecimento |
| `phone_dedup_log` | Dedup de telefones |
| `google_indexing_log` | Indexing API Google |
| `drive_kb_sync_log` | Sync Google Drive |

### 12.2 Edge Function Logs

Acessíveis via Supabase Dashboard. Padrão: `console.log/error` estruturado com prefixo `[function-name]`.

### 12.3 Gap: Dashboard Unificado

❌ **Não existe dashboard único** consolidando health, custos IA, throughput de webhooks e SLA. Recomendação P1.

---

## 13. Performance Frontend

### 13.1 Otimizações em Vigor

- Vite com code splitting automático
- `ChunkErrorBoundary` para falhas de chunk
- Lazy loading de rotas (`React.lazy`)
- `React.memo` em listas grandes
- Imagens via storage com `storageImage` helper

### 13.2 Gaps

- ❌ Sem monitoramento Core Web Vitals automatizado
- ❌ Sem Lighthouse CI no pipeline
- ⚠️ Algumas páginas KB carregam HTML pesado (rich content) — considerar streaming

---

## 14. Memory Architecture (`mem://`)

O projeto mantém **80+ regras versionadas** em `mem://`, organizadas em:
- **Core (sempre em contexto)**: 14 regras críticas (Golden Rule, Identity Cascade, Revenue Formula, etc.)
- **Categorias**: `architecture/`, `business/`, `catalog/`, `dra-lia/`, `features/`, `integration/`, `seo/`, `smart-ops/`, `strategy/`, `style/`, `ui/`, `tracking/`, `lead-tracking/`, `roi/`

Disciplina rara que garante:
- Onboarding rápido de novos contribuidores (humanos ou AI).
- Prevenção de retrabalho/regressões.
- Documentação viva de decisões arquiteturais.

---

## 15. Matriz de Riscos

| # | Risco | Probabilidade | Impacto | Severidade | Mitigação |
|---|---|---|---|---|---|
| R1 | RLS off em tabelas sensíveis (`social_*`, `cad_*`) | Média | Alto | 🔴 Alto | Auditoria e habilitação caso-a-caso |
| R2 | `lia_attendances` 565 colunas — schema bloat | Alta | Médio | 🟡 Médio | Normalização parcial via JSONB spillover |
| R3 | Google Business API sem quota | Alta | Médio | 🟡 Médio | Aguardar aprovação; manter banner UX |
| R4 | Dependência Evolution self-hosted | Média | Alto | 🟡 Médio | Documentar SLA + failover WaLeads transitório |
| R5 | Sem Core Web Vitals tracking | Média | Médio | 🟡 Médio | Adicionar `web-vitals` SDK + dashboard |
| R6 | Créditos IA exauridos sem alerta proativo | Média | Alto | 🟡 Médio | Threshold em `ai_token_usage` → email |
| R7 | Webhooks públicos sem rate limiting | Baixa | Alto | 🟡 Médio | Rate limit edge (cap por IP/hora) |
| R8 | Falta dashboard observabilidade unificada | Alta | Médio | 🟡 Médio | Construir `SmartOpsSystemHealth` expandido |
| R9 | Migrations antigas podem faltar GRANT | Baixa | Médio | 🟢 Baixo | `supabase--linter` periódico |
| R10 | Vetores RAG sem rebuild scheduled | Média | Médio | 🟡 Médio | Cron `index-embeddings` semanal |

---

## 16. Recomendações Priorizadas (Roadmap)

### P0 — Crítico (próximas 2 semanas)
1. **Auditar RLS** em `social_*`, `cad_*`, `astron_*`, `agent_actions_log`. Habilitar onde houver dados de cliente.
2. **Rate limiting** em webhooks públicos (Meta, Sellflux, e-commerce, Zernio).
3. **Alerta de créditos IA**: trigger em `ai_token_usage` quando consumo diário > X.

### P1 — Importante (próximo mês)
4. **Dashboard observabilidade unificada**: ampliar `SmartOpsSystemHealth` com health/custo/SLA por edge function.
5. **Core Web Vitals tracking**: integrar SDK `web-vitals` → tabela `web_vitals_logs` → dashboard.
6. **Normalização parcial `lia_attendances`**: mover campos pouco usados para JSONB ou tabelas filhas.
7. **Failover documentado** Evolution → WaLeads em runbook.
8. **Resin/Knowledge SEO Audit Panel** já existe (`SEOAuditPanel`) — expandir para artigos e produtos.

### P2 — Estratégico (próximo trimestre)
9. **Lighthouse CI** no pipeline de deploy.
10. **Rebuild semanal de embeddings** RAG via cron.
11. **Documentar SLA** das cascatas IA (timeout, fallback).
12. **A/B testing framework** para conteúdo gerado por IA.
13. **Schema Markup Validator** automatizado (Schema.org test API).
14. **i18n completo** SEO (sitemaps EN/ES já existem; expandir hreflang).

---

## 17. Checklist de Conformidade

### SEO Técnico
- [x] `<title>` único por rota
- [x] Meta description única por rota
- [x] Canonical auto-referencial
- [x] og:* per-route via Helmet
- [x] sitemap.xml multi-arquivo
- [x] robots.txt configurado
- [x] llms.txt + llms-full.txt
- [x] JSON-LD por tipo de página
- [x] Person Schema E-E-A-T
- [x] BreadcrumbList em internas
- [x] VideoObject em vídeos
- [x] Bot middleware SSR
- [ ] Core Web Vitals monitoring
- [ ] Schema validator automatizado

### Segurança Supabase
- [x] RLS habilitado nas tabelas críticas
- [x] `has_role()` security definer
- [x] Grants explícitos em public
- [x] Service role apenas em edge
- [x] Anti prompt injection
- [ ] RLS auditado em todas as 190 tabelas
- [ ] Rate limiting em webhooks públicos
- [ ] Pen test anual documentado

### IA
- [x] Multi-provider router com fallback
- [x] Logging de tokens
- [x] Threshold RAG calibrado
- [x] Anti-alucinação via snapshot
- [x] Persona constraints por agente
- [ ] Alerta proativo de créditos
- [ ] SLA documentado por task

### CDP
- [x] Golden Rule aplicada
- [x] Identity cascade documentada
- [x] Smart Merge automatizado
- [x] Commercial Intent Guard
- [x] Person Origin Frozen
- [x] Timestamps reais (nunca `now()` em syncs)

---

## 18. Conclusão

O **SmartDent Revenue Intelligence OS** é uma plataforma **madura, defensável e diferenciada** no segmento odontológico digital. Sua combinação de **CDP robusto + IA multi-provedor com fallback + arquitetura SEO AI-First** está em um nível raramente visto em verticais de nicho.

**Pontos fortes** que devem ser preservados como vantagem competitiva:
- Memory architecture viva e versionada.
- Cascata de IA com fallback automático.
- SSR para bots SEO/AI.
- Disciplina de Golden Rules e Guards (Commercial Intent, Person Origin Frozen).

**Pontos a endereçar imediatamente**:
- Auditoria de RLS nas tabelas com proteção off.
- Rate limiting em webhooks públicos.
- Dashboard unificado de observabilidade.

Com a execução do roadmap P0+P1 (~6 semanas de esforço focado), o sistema atinge nível **9.5/10 production-ready enterprise grade**.

---

**Auditoria gerada automaticamente** a partir de:
- 170 edge functions deployadas
- 190+ tabelas Postgres mapeadas
- 80+ regras de negócio em `mem://`
- Code review de arquivos críticos (`_shared/ai-router.ts`, `google-reviews-pull`, `SEOAuditPanel`, etc.)

**Próxima auditoria recomendada**: Q4 2026 ou após qualquer mudança arquitetural significativa.
