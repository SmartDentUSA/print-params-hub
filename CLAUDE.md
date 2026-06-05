# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Documento em português (idioma do projeto). Termos de domínio, strings de UI, identificadores e docs são em PT-BR — mantenha o padrão.

---

## ⚠️ Leitura obrigatória antes de mexer no domínio comercial/CRM

1. `docs/SKILL_SMARTDENT_REVENUE_OS.md` — contexto condensado: stack, schema atual, componentes relevantes, regras de negócio (Golden Rule, Smart Merge), tarefas pendentes e **o que NÃO alterar**.
2. `docs/AUDITORIA_WORKFLOW_FORMULARIOS_CRM.md` — documentação completa e autoritativa. **Sempre leia antes de implementar qualquer coisa ligada ao Workflow 7×3, formulários ou ingestão de leads.**

A pasta `docs/` contém auditorias/specs extensas (`AUDITORIA_*`, `REVENUE_INTELLIGENCE_OS_TECHNICAL_DOC.md`, `SYSTEM_DESCRIPTION.md`, `AI_*.md`). São a fonte da verdade — o codebase é grande e evolui rápido; prefira-os à inferência.

---

## O que é o projeto

**Sistema B** (`print-params-hub`) — hub de inteligência comercial da **SmartDent 3D** (odontologia digital / impressão 3D, Brasil). Produção: https://parametros.smartdent.com.br (também `print-params-hub.lovable.app`).

É ao mesmo tempo:
- **Site público multilíngue (PT/EN/ES)** — páginas de parâmetros de impressão 3D, base de conhecimento, chatbot RAG "Dra. L.I.A.", catálogo, depoimentos.
- **Revenue Intelligence OS interno** (atrás de `/admin`) — CDP de leads, sync de CRM, form builder, WhatsApp, dashboards de inteligência, publisher de redes sociais, gestão de treinamentos.

**Sistema A** é uma plataforma separada de marketing/conteúdo (outro repo, ~91 edge functions). Não está aqui — não mexer. Várias edge functions sincronizam **dados** do Sistema A (`sync-sistema-a`, `system-a-live.ts`), mas o código dele é externo.

---

## Comandos

Projeto gerenciado pelo **Lovable** (edições no Lovable auto-commitam aqui; pushes aqui refletem de volta). Gerenciador de pacotes intercambiável — `bun.lockb` e `package-lock.json` ambos versionados; `bun` é o lockfile de referência.

```sh
bun install          # ou: npm i
bun run dev          # Vite dev server em http://localhost:8080
bun run build        # build de produção (vite build)
bun run build:dev    # build em modo development (source maps, componentTagger)
bun run lint         # eslint . — ÚNICO check automatizado do repo
bun run preview      # serve o build de produção
```

**Não há suíte de testes.** `lint` é o único gate. Não existe comando de "single test". Note: `@typescript-eslint/no-unused-vars` está **desligado** em `eslint.config.js`, então variáveis não usadas não quebram o lint.

Edge functions Supabase rodam em **Deno** (não Node). Não há runner local configurado no repo; o deploy é via Supabase. JWT é configurado por função em `supabase/config.toml`.

---

## Arquitetura

### Frontend — Vite + React 18 + TypeScript (SPA)
- **Rotas**: `src/App.tsx` é a tabela única de rotas (`react-router-dom` v6). Ver "Mapa de rotas".
- **Alias**: `@/` → `src/` (`vite.config.ts` + tsconfig). Sempre importe via `@/...`.
- **UI**: shadcn/ui em `src/components/ui/` (Radix + CVA). Estilo: Tailwind (`tailwind.config.ts`, `src/index.css`). Toasts via `useToast()` (`@/hooks/use-toast`) e `sonner`. Config shadcn em `components.json`.
- **Data fetching/estado**: `@tanstack/react-query` + `useState`. Estado global em `src/contexts/`:
  - `DataContext` — provê brands/models/resins/parameters (compõe `useSupabaseData` + `useSupabaseCRUD` + `useRealtimeUpdates`).
  - `LanguageContext` — i18n pt/en/es (persistido em localStorage, sincroniza `html.lang`, fallback PT; traduções em `src/locales/*.json`).
- **SEO**: `react-helmet-async` + componentes `*SEOHead.tsx` emitindo Schema.org `@graph`. Crawlers/bots são reescritos server-side para a edge function `seo-proxy` (ver `vercel.json`) que serve HTML pré-renderizado — o SPA não é o que o crawler vê.
- **Libs notáveis**: TipTap (editor rich-text), `@xyflow/react` + `dagre` (visualizadores de fluxo WA/social), `@dnd-kit` (kanban/drag-drop), `recharts` (gráficos), `exceljs`/`xlsx`/`jszip` (import/export), `react-image-crop` (mídia social).

### Backend — Supabase (project ref `okeogjgqijbfkudfjadz`)
- **Client**: `src/integrations/supabase/client.ts` exporta o singleton `supabase` (chave anon pública embutida). Importe direto: `import { supabase } from "@/integrations/supabase/client"`.
- **Tipos gerados**: `src/integrations/supabase/types.ts` é **auto-gerado — NÃO editar à mão**. Regenere a partir do schema.
- **Edge Functions**: `supabase/functions/` (160+ funções Deno+TS). Lógica compartilhada em `_shared/`. CORS obrigatório (wildcard `*` + handler de `OPTIONS`). A maioria é webhook público (`verify_jwt = false`); poucas exigem JWT (ex.: `create-user`).
- **Migrations**: `supabase/migrations/` (380+ arquivos), **append-only — nunca edite uma migration passada; crie uma nova.**

### Hospedagem — Vercel
`vercel.json` é o plano de controle de roteamento/SEO: fallback SPA → `/index.html`; redirects; reescritas crawler→`seo-proxy`; e reescritas de `sitemap*.xml` / `llms*.txt` / `/docs/*` para edge functions Supabase. `api/` tem 2 endpoints serverless Vercel (`middleware-bot.ts`, `video-sitemap.ts`).

---

## Mapa de rotas (`src/App.tsx`)

| Rota | Página | Função |
|------|--------|--------|
| `/`, `/:brand`, `/:brand/:model`, `/:brand/:model/:resin` | `Index` | Hub de parâmetros 3D (árvore marca→modelo→resina) |
| `/base-conhecimento/*`, `/en/knowledge-base/*`, `/es/base-conocimiento/*` | `KnowledgeBase` | Base de conhecimento trilíngue |
| `/base-conhecimento/calculadora-roi/:slug` (+ en/es) | `ROICalculatorPage` | Calculadora de ROI |
| `/produtos/:slug` · `/categorias/:slug` · `/depoimentos/:slug` | `ProductPage` · `CategoryPage` · `TestimonialPage` | Catálogo / categoria / depoimento |
| `/sobre` · `/support-resources` · `/agenda` | `About` · `SupportResources` · `AgendaPublica` | Institucional / suporte / agenda de treinamentos |
| `/f/:slug` | `PublicFormPage` | Formulários públicos de captação |
| `/embed/dra-lia` | `AgentEmbed` | Dra. L.I.A. em iframe (sem header/footer) |
| `/admin` | `AdminViewSecure` | Hub admin (auth + roles) |
| `/admin/form-flow/:formId` | `SmartOpsFormFlowStandalone` | Preview standalone de fluxo de formulário |
| `/smartops/wa-flow-visualizer` | `WaFlowVisualizerPage` | Visualizador de fluxo WhatsApp |
| `/social/*` | `SocialLayout` + sub-rotas | Social Publisher (dashboard, banco, novo, calendário, analytics, flows, broadcasts, sequências, contatos) |
| `/docs/:filename` · `/resinas/:slug` · `*` | `DocumentProxyRoute` · `ResinRedirect` · `NotFound` | Proxy docs / redirect resina / 404 |

`DraLIAGlobal` e `FooterGlobal` ficam ocultos em `/admin`, `/embed`, `/social` e `/agenda`.

---

## Admin Hub (`src/pages/AdminViewSecure.tsx` + `AdminSidebar.tsx`)

Auth via Supabase com 3 papéis: **admin** (tudo), **author** (só conteúdo), **user** (leitura). A sidebar agrupa as seções:

- **Catálogo**: `AdminModels` (modelos/impressoras), `AdminCatalog` (produtos), `AdminDocumentsList` (docs do sistema), `AdminParameterPages` (geração de páginas de parâmetro Categoria F).
- **Conteúdo**: `AdminKnowledge` / `AdminKnowledgeHub` (artigos KB), `AdminAuthors` (autores E-E-A-T), enrichers/reformatters/translators de artigo.
- **Smart Ops** (o Revenue Intelligence OS — ~18 abas): ver seção dedicada abaixo.
- **Ferramentas**: import/export de dados, importadores (Astron, Apostila, Loja Integrada), validador de links, PandaVideo (test/sync/analytics/links).
- **Sistema**: `AdminStats`, `AdminUsers`, `AdminSettings`.

---

## Módulos SmartOps — Revenue Intelligence OS

Superfície interna do pipeline comercial. Componentes `SmartOps*.tsx` (top-level) + `src/components/smartops/` + `src/components/leads/`.

| Área | Componentes-chave |
|------|-------------------|
| **Leads / Kanban** | `SmartOpsKanban` (board multi-stage, drag-drop via dnd-kit), `SmartOpsLeadsList` (lista filtrável + score), `smartops/LeadDetailPanel` (perfil completo + ERP/financeiro + portfolio — ⚠️ não alterar sem pedido), `KanbanLeadCard/Detail/Column`, `SmartOpsLeadImporter` |
| **Formulários** | `SmartOpsFormBuilder`, `SmartOpsFormEditor`, `SmartOpsSdrCaptacaoEditor`, `SmartOpsMappingFieldsEditor`, `SmartOpsFormFlowPreview`, `FormMetricsCard` |
| **Workflow 7×3** | `smartops/WorkflowPortfolio` (matriz portfolio), `smartops/SmartOpsWorkflowMapper` |
| **Equipe / Vendedores** | `SmartOpsTeam`, `SmartOpsSellerAutomations` |
| **Inteligência** | `SmartOpsIntelligenceDashboard` (scores, top leads), `SmartOpsBowtie` (funil MQL→SQL→Close + CS), `SmartOpsGoals`, `SmartOpsAudienceBuilder`, `LeadFieldsInventory` |
| **IA** | `SmartOpsCopilot` (assistente multi-modelo), `SmartOpsAIRouting` (matriz task→provider), `SmartOpsAIUsageDashboard` (custo/tokens), `SmartOpsLiaAutomations` |
| **WhatsApp** | `SmartOpsWhatsAppInbox`, `WaLeadsVariableBar`, `WaLeadsMediaPreview`, `smartops/wa-groups/*` (campanhas, flow builder/visualizer, blast) |
| **Campanhas** | `SmartOpsCampaigns`, `CampaignLinkPicker` |
| **Treinamentos** | `SmartOpsCourses`, `CourseCard/CreateModal`, `EnrollmentModal`, `TurmaCard`, `EquipmentSerialsSection`, botões de turma↔grupo WA |
| **CS / Automação** | `SmartOpsCSRules`, `SmartOpsContentProduction`, `SmartOpsSmartFlowAnalytics` |
| **Monitoramento** | `SmartOpsSystemHealth`, `SmartOpsLogs`, `SmartOpsReports`, `SmartOpsRayshape` (manutenção de impressoras), `admin/RelatorioMensalComercial`, `admin/CopilotBrainHealthCard` |

---

## Social Publisher (`src/components/social/`)

Agendador/analytics multi-canal + automação de DM Instagram. Layout: `SocialLayout` + `SocialSidebar`. Áreas:
- **Editor** (`editor/`): wizard 5 passos (Conteúdo, Mídia, Canais, Agenda, Revisão), `SocialPostPreview`, crop de mídia por aspect ratio de canal.
- **Calendário** (`calendar/`): visão mensal, chips por dia, reschedule.
- **Banco/Analytics**: `SocialPostsBank`, `SocialAnalytics`, `SocialDashboard`, `MetricCard`.
- **Flows** (`flows/`): builder node-based de automação DM Instagram, sessões.
- **Broadcasts** (`broadcasts/`): broadcasts, rebroadcast histórico, sequências, contatos.

Hooks em `src/hooks/social/` (post agendado, calendário, upload de mídia, geração de legenda IA, métricas, contas/sync Zernio). Integra a plataforma externa **Zernio** (agendamento/publicação social) via edge functions `zernio-*`.

---

## Site público

- **Parâmetros 3D**: `Index` + `ParameterTable`, `ResinAccordion`, `PrinterParamsFlow`, `BrandSelector`, `ModelGrid`. 260+ combinações resina×impressora com URLs SEO.
- **Base de conhecimento**: `KnowledgeContentViewer`, `KnowledgeSidebar`, `KnowledgeFeed`, `KnowledgeFAQ`, `KnowledgeCTA`, `KnowledgeCategoryPills`, `KnowledgeSEOHead`. Conteúdo multilíngue (campos `*_en`/`*_es`).
- **Dra. L.I.A.**: `DraLIA.tsx` (widget flutuante RAG; tópicos parâmetros/produtos/comercial/suporte; upload de imagem; transcrição de voz). Backend: edge function `dra-lia` (+ `dra-lia-whatsapp`).
- **Catálogo/Depoimentos**: `ProductPage`, `MentionedProducts`, `InlineProductCard`, `RelatedTestimonials`, `GoogleReviewsWidget`, `InstagramEmbed`.
- **SEO**: `SEOHead`, `OrganizationSchema`, `VideoSchema`, `*SEOHead.tsx`.

---

## Edge Functions — inventário por categoria (`supabase/functions/`)

> ~160 funções. Lista das principais por domínio. CORS obrigatório; maioria pública.

**Ingestão de leads / CRM / PipeRun**: `smart-ops-ingest-lead` (⭐ principal), `smart-ops-lia-assign` (briefing + roteamento de vendedor), `smart-ops-piperun-webhook`, `smart-ops-sync-piperun`, `piperun-full-sync`, `piperun-offline-enrich`, `smart-ops-piperun-retry-failed-leads`, `smart-ops-piperun-funnel-reconciler`, `smart-ops-piperun-backfill-customfields`, `piperun-person-contact-backfill`, `smart-ops-deal-form-note`, `smart-ops-kanban-move`.

**SellFlux / Meta Ads / e-commerce / Astron / Omie**: `smart-ops-sellflux-sync`/`-webhook`, `smart-ops-meta-lead-webhook`, `smart-ops-meta-ads-manager`/`-insights`/`-csv-backfill`, `smart-ops-ecommerce-webhook`, `import-loja-integrada`, `poll-loja-integrada-orders`, `sync-loja-integrada-clients`, `astron-postback`/`-member-lookup`/`sync-astron-members`, `omie-lead-enricher`/`omie-api-explorer`.

**Inteligência de leads**: `cognitive-lead-analysis` (DeepSeek), `batch-cognitive-analysis`, `backfill-intelligence-score`, `backfill-ltv`, `smart-ops-stagnant-processor`, `smart-ops-proactive-outreach`, `smart-ops-cs-processor`.

**Dra. L.I.A. / RAG / IA**: `dra-lia`, `dra-lia-whatsapp`, `dra-lia-export`, `automacoes-lia`, `evaluate-interaction` (LLM-as-a-Judge), `smart-ops-copilot`, `manychat-lia-bridge`.

**Geração de conteúdo / KB / Copilot**: `ai-orchestrate-content`, `ai-content-formatter`, `ai-metadata-generator`, `enrich-article-seo`, `reformat-article-html`, `translate-content`, `copilot-draft-knowledge-article`, `copilot-ingest-method-doc`, `copilot-publish-knowledge-article`, `heal-knowledge-gaps`, `index-embeddings`, `ingest-knowledge-text`, `sync-knowledge-base`, `sync-google-drive-kb`.

**PDF / extração**: `extract-pdf-text`/`-raw`/`-specialized`, `extract-and-cache-pdf`, `extract-commercial-expertise`, `enrich-resins-from-apostila`, `ai-enrich-pdf-content`.

**SEO / sitemaps / AI crawlers**: `seo-proxy`, `generate-sitemap`, `generate-knowledge-sitemap`(+`-en`/`-es`), `generate-documents-sitemap`, `video-sitemap`, `llms-txt`, `llms-full-txt`, `ai-generate-og-image`, `resubmit-sitemap-to-gsc`.

**WhatsApp / WaLeads / broadcasts**: `wa-dispatcher`, `wa-broadcast-dispatch`, `wa-campaign-builder`, `wa-group-blast`, `wa-sync-groups`, `wa-verify-lead`, `wa-delivery-reconciler`, `wa-contact-sync-cron`, `smart-ops-send-waleads`, `smart-ops-wa-inbox-webhook`. (Evolution/EvoGo API via `_shared/evolution.ts`.)

**Social / Zernio**: `social-caption-generator`, `social-publish-worker`, `flow-executor`, `sequence-runner`, `zernio-webhook`/`-accounts-sync`/`-contacts-sync`/`-broadcast-dispatch`/`-metrics-sync`.

**Vídeo / PandaVideo**: `sync-pandavideo`, `sync-video-analytics`, `extract-video-content`, `link-videos-to-articles`.

**Catálogo / produtos**: `get-product-data`, `auto-inject-product-cards`, `generate-parameter-pages`, `migrate-catalog-images`.

**Geração de documentos**: `export-apostila-docx`, `smartops-gerar-comprovante-imersao`, `smartops-gerar-crachas-turma`, `smartops-gerar-doc-turma`, `generate-certificate`, `generate-veredict-data`.

**Export / API**: `data-export`, `export-leads-full`, `export-parametros-ia`, `smart-ops-leads-api`, `knowledge-feed`.

**Backfill / cron / manutenção**: `backfill-primary-deal`, `backfill-deals-append`, `backfill-stranded-won-deals`, `backfill-hits-granular`, `enrichment-safety-net-cron`, `archive-daily-chats`, `import-leads-csv`/`-proposals-csv`, `create-user`, `system-watchdog-deepseek`, `fix-*`.

**Utilidades**: `document-proxy`, `mcp-server` (Model Context Protocol), `create-technical-ticket`.

### Módulos `_shared/` (44 utilitários)
- **Leads/identidade**: `lead-enrichment.ts` (Smart Merge), `identity-utils.ts`, `lead-identity-guard.ts`, `phone-normalize.ts`, `commercial-intent.ts`.
- **PipeRun**: `piperun-field-map.ts` (mapeamento central — usado por 14+ funções), `piperun-primary-deal.ts` (snapshot do deal primário), `piperun-person-resolver.ts`, `piperun-deal-hydrate.ts`, `piperun-hierarchy.ts`.
- **SellFlux**: `sellflux-field-map.ts`.
- **L.I.A./RAG**: `lia-rag.ts` (multi-search RAG), `lia-sdr.ts`, `lia-guards.ts`, `lia-escalation.ts`, `lia-printer-dialog.ts`, `lia-lead-extraction.ts`, `method-docs-rag.ts`, `product-rag.ts`, `system-prompt.ts`, `system-a-live.ts` (anti-alucinação).
- **IA**: `ai-router.ts` (roteia por task_type → Poe/Lovable/DeepSeek/Gemini), `providers/poe.ts`, `generate-embedding.ts` (Gemini 768-dim com cache SHA256), `log-ai-usage.ts`.
- **WhatsApp**: `evolution.ts`, `waleads-messaging.ts`, `wa-intent.ts`, `wa-ai-content.ts`.
- **Conteúdo/SEO**: `citation-builder.ts`, `entity-dictionary.ts`, `extraction-rules.ts`, `document-prompts.ts`, `og-visual-dictionary.ts`, `testimonial-prompt.ts`, `dental-taxonomy.ts`.
- **Infra**: `resilient-fetch.ts`, `rate-limiter.ts`, `timezone.ts` (São Paulo), `seller-note-lock.ts`, `workflow-diagnosis.ts`.

---

## Hooks / lib / utils (`src/`)

- **Hooks de dados** (`src/hooks/`): `useSupabaseData` / `useSupabaseCRUD` (brands/models/resins/parameter_sets), `useCatalogCRUD`/`useCatalogProducts`, `useKnowledge`/`useKnowledgeSearch` (RPC `search_knowledge_base`), `useDealSearch` (RPC `fn_search_deals_for_training` + `fn_get_deal_from_history`), `useLeadErpData`/`useLeadFinanceiro` (Omie/ERP), `useRealtimeUpdates` (subscriptions realtime), `usePageTracking` (GA4/GTM/Meta/TikTok), `useEnrollment` (edge `enroll-lead`), `useEquipmentProvenance`, `useTurmaWaGroup`, `useAllVideos`/`useVideoOpportunities`.
- **lib** (`src/lib/`): `dentalTaxonomy.ts` (canonicaliza especialidades), `formConditions.ts` (visibilidade condicional de campos — AND/OR, equals/in/is_empty), `formFlowBroadcast.ts` (BroadcastChannel p/ preview), `socialChannels.ts`, `courseUtils.ts`/`courseWhatsapp.ts`, `wikidata-entities.ts`, `utils.ts` (`cn()`), `social/` (schema/validação de post).
- **utils** (`src/utils/`): `security.ts` (validações prod/dev, rate limiter, mensagens sanitizadas), `logger.ts` (dev-only), `leadParsers.ts` (normaliza PipeRun/Manychat/FB Ads — 60+ colunas), `leadDisplay.ts` (placeholder detection), `i18nPaths.ts`/`knowledgeUrls.ts` (URLs i18n), `authorSignature*.ts`, `videoThumbnails.ts`, `uploadExternalImage.ts`, `clearData.ts`.

---

## Schema do banco (resumo por domínio)

> Schema completo em `types.ts` (gerado). 100+ tabelas/views.

- **Lead / CRM**: `lia_attendances` (⭐ hub canônico do lead/CDP), `lead_activity_log` (timeline), `lead_enrichment_audit`, `lead_opportunities`, `identity_keys`, `people`, `person_company_relationship`, `person_ltv`.
- **Forms**: `smartops_forms`, `smartops_form_fields`, `smartops_form_field_responses`, `workflow_cell_mappings`.
- **Deals / PipeRun**: `deals`, `deal_items`, `deal_status_history`, `piperun_deals_history`, `piperun_staging`.
- **Workflow/Portfolio (views)**: `v_workflow_portfolio` (filtra `merged_into IS NULL`), `v_workflow_timeline`, `v_lead_pipeline`, `v_reactivation_candidates`, `v_portfolio_*`, `v_bi_funil_mensal`.
- **Catálogo / conteúdo**: `system_a_catalog` (454 produtos/conteúdos sincronizados; categorias resin/printer/accessory/video_testimonial/google_review/company_info/…), `products_catalog`, `knowledge_contents`/`knowledge_categories`/`knowledge_videos`, `smartdent_method_docs`.
- **ERP / receita (Omie)**: `omie_notas_fiscais`/`_nf_items`/`_vendedores`/`_snapshot_mensal`, `company_ltv`, `crm_product_sales`.
- **WhatsApp / Social**: `wa_campaigns`/`wa_groups`/`wa_message_queue`/`wa_send_log`/`whatsapp_inbox`/`whatsapp_templates`, `social_flows`/`social_sequences`/`social_posts`/`social_scheduled_posts`/`social_broadcasts`.
- **IA / agente**: `agent_interactions` (logs + score do juiz), `agent_embeddings` (busca vetorial), `agent_actions_log`, `cognitive_lead_locks`.
- **Sistema**: `system_health_logs`, `system_config`, `cron_state`, `team_members` (vendedores/CS/suporte).

**Colunas-chave de `lia_attendances`**: identidade (`id`, `email` UNIQUE, `telefone_normalized`, `merged_into`, `pessoa_piperun_id`, `empresa_piperun_id`), snapshot PipeRun (`piperun_id`, `piperun_stage_name`, `piperun_owner_id`, `status_oportunidade`, `valor_oportunidade`), equipamentos (`equip_*`, `tem_scanner/impressora`, `impressora_modelo`, `software_cad`), SDR (`sdr_*_interesse`), `portfolio_json` (JSONB), `cognitive_analysis` (JSONB), `lead_intelligence_score`, campos Omie.

**Triggers/RPCs principais**: `fn_log_form_submission_to_timeline()` (form → activity_log), `fn_notify_treinamento_agendado()`, `trg_portfolio_cell_on_response`→`fn_portfolio_cell_update()` (jsonb_set cirúrgico no portfolio), `compute_lead_portfolio_from_mappings(p_lead_id)`, `calculate_lead_intelligence_score(p_lead_id)`, `try_claim_seller_note_slot()` (lock anti-burst de notas), `fn_search_deals_for_training()`.

**Desenvolvimento recente (jun/2026)**: locks de nota de deal (anti-burst/anti-duplicação em PipeRun), clonagem de formulários IoConnect (`clone_ioconnect_form()` → 52 forms product-specific), notificações de matrícula de treinamento, logging de submissão de form na timeline, limpeza de identificadores PipeRun em leads mesclados.

---

## Fluxo de ingestão de leads (`smart-ops-ingest-lead`)

Múltiplas camadas de deduplicação antes do Smart Merge:
1. **Telemetria** — log fire-and-forget em `system_health_logs` antes de validar.
2. **Hard-dedupe por `platform_lead_id`** (Meta leadgen_id já persistido → skip).
3. **Family-key dedupe (Meta, vitalício)** — mesmo form_id + (email OU telefone) → arquiva leadgen e skip.
4. **Activity-log dedupe (janela 6h)**.
5. **Form-history dedupe (Meta, 12h)** — enriquecimento incremental apenas.
6. **Rota universal de re-entrega Meta** — novo form_name em lead canônico → enrichment + roteamento de deal (preserva deal de VENDAS aberto).
7. **Cascata de identidade + merge** — resolve canônico (email → telefone normalizado → últimos 9 dígitos → segue `merged_into`), aplica `mergeSmartLead()`.

Guard de novo lead: exige nome + email + telefone; rejeita domínios de teste. Downstream (fire-and-forget): `smart-ops-lia-assign`, `cognitive-lead-analysis`, webhooks SellFlux, `calculate_lead_intelligence_score()`. Detecção de produto por padrões no `form_name` (INO110→BLZ INO100, GLAZEON→GlazeON, etc.).

---

## Regras de negócio críticas (não violar)

- **Golden Rule**: se existe deal **aberto no pipeline de VENDAS** no PipeRun → **nunca** sobrescrever `owner_id` nem `stage_id`. Seleção do deal primário (`piperun-primary-deal.ts`): deal aberto mais recente > fechado mais recente > criado mais recente > maior `deal_id`.
- **Smart Merge** (`_shared/lead-enrichment.ts`) — estratégia por campo:
  - `PROTECTED`: nunca sobrescrever (id, created_at, email, piperun_id, pessoa_piperun_id, origem_primeiro_contato…).
  - `ALWAYS_UPDATE`: último vence (utm_*, status_oportunidade, temperatura_lead, equipamentos, sdr_*…).
  - `MERGE_ARRAYS`: append + dedup (tags_crm, emails/telefones secundários).
  - `MERGE_JSONB`: deep merge (raw_payload, sellflux_custom_fields, form_data).
  - `ENRICHMENT_ONLY` (padrão): só preenche se null. Prioridade de fonte: piperun_webhook > ecommerce > astron > sellflux > meta_ads > formulario > manual.
- **portfolio_json**: célula vazia → escreve; já tem dado → COALESCE; marca concorrente → camada `conc`; produto SmartDent → camada `ativo` (prioridade máxima). Prioridade de camadas: `ativo` > `conc` > `sdr` > `mapeamento` > `vazio`.
- **Reativação SDR-CAPTAÇÃO**: lead existente em "reativação" preenche form `sdr_captacao` → fecha deal antigo como Perdido (`reativacao_formulario`), cria novo no Round Robin (não herda owner anterior).

---

## Integrações externas

PipeRun (CRM principal: Pessoa→Empresa→Deal), SellFlux (automação mkt), WhatsApp via Evolution/EvoGo + WaLeads, Meta Ads (webhook de leads), Loja Integrada (e-commerce), Astron (membros/postback), Omie ERP (faturamento/LTV), PandaVideo (vídeos/analytics), Zernio (publicação social), ManyChat, Google (Drive KB / Reviews). IA: Gemini (embeddings RAG), Lovable AI Gateway (LLM streaming), DeepSeek (análise cognitiva), Poe (fallback). Storage: bucket `catalog-images`.

**SEO/Tracking**: GTM-NZ64Q899, GA4 G-59WWJQN34P, Meta Pixel 167413567155597, TikTok D05CI83C77UE5QUU9FR0. Wikidata SmartDent: Q138636902. `llms.txt` em `/public/` + edge functions.

---

## Convenções de código

- TypeScript em todo o projeto; imports via alias `@/`.
- Erros visíveis ao usuário → `console.error` + toast; erros não-bloqueantes → `try/catch` só com `console.error`.
- Edge functions: Deno + TS, CORS headers obrigatórios, compartilhe código via `_shared/`, JWT em `config.toml`.
- Conteúdo KB é multilíngue (campos `*_pt`/`*_en`/`*_es`).
- Logging dev-only via `@/utils/logger`; validações de segurança via `@/utils/security`.

---

## O que NÃO alterar sem pedido explícito

- `src/components/smartops/LeadDetailPanel.tsx`
- Schema de `lead_activity_log`
- Comportamento das integrações existentes (PipeRun / SellFlux / Meta Ads)
- Políticas RLS de tabelas existentes
- `src/integrations/supabase/types.ts` (gerado)
- Migrations passadas (crie novas)
- Golden Rule do PipeRun (nunca violar)
- Sistema A (repositório separado)
