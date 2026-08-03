# 03 — Catálogo de Abas, Ferramentas e Botões

Cada seção segue o mesmo gabarito: **objetivo de negócio · objetivo técnico · fluxo · abas · botões · campos · erros · status**.

Legenda de status: ✅ ativa · ⚠ parcial · ❌ morta/legada.

---

## 3.0 Barra de ações global do Smart Ops

Visível sempre que `activeSection` começa com `so-` (`AdminViewSecure.tsx:372-417`).

| Botão | Objetivo | Ação técnica | Tabelas | Validações | Erros | Criticidade |
|---|---|---|---|---|---|---|
| **Sync Incremental** | trazer alterações recentes do PipeRun | `functions.invoke('smart-ops-sync-piperun')` (modo incremental) | `deals`, `deal_items`, `lia_attendances`, `piperun_*_mirror` | sessão válida | timeout de função; erro exibido em toast | Alta |
| **Full Sync** | reprocessar todos os pipelines | idem, modo full | idem | nenhuma confirmação | execução longa; sem rollback | **Crítica** |
| **Exportar Tudo** | baixar CSVs de leads e deals | `POST /functions/v1/export-leads-full` com JWT do usuário + polling `job_id` (240×3 s) e download de URLs assinadas (`AdminViewSecure.tsx:104-152`) | `export_jobs`, Storage | sessão obrigatória (`:107`) | "Sessão expirada", `HTTP nnn`, "Timeout aguardando o export" | Alta (dado pessoal sai do sistema) |
| **Atualizar** | forçar remount da seção | `setRefreshKey(prev+1)` | — | — | — | Baixa |

Sem rollback: as três primeiras ações são idempotentes por upsert, mas não têm undo. Recomendação em cap. 11.

---

## 3.1 Catálogo → Modelos (`models` → `AdminModels`)

- **Por que existe**: manter marcas/modelos de impressoras e scanners que ancoram os parâmetros de impressão publicados no site.
- **Quem usa**: equipe de conteúdo técnico e produto.
- **Técnico**: CRUD sobre `brands`/`models`/`resins` via `useSupabaseCRUD`; alimenta rotas públicas `/:brandSlug/:modelSlug`.
- **Abas**: `basic` ("Informações Básicas"), `image` ("Imagem") — `AdminModels.tsx:288-289`.
- **Botões**: Salvar (upsert em `models`), Cancelar, Upload de imagem (Storage + `ImageUpload`), Excluir (delete com confirmação nativa).
- **Campos**: nome (obrigatório), marca (FK `brands.id`), slug (gerado por `useSlugGeneration`), tipo, imagem (URL de Storage), ativo (bool).
- **Status**: ✅ ativa — 58 modelos, 22 resinas, `parameter_sets` com 260 linhas.

## 3.2 Catálogo → Produtos (`catalog` → `AdminCatalog`)

- **Por que existe**: é o catálogo mestre (Sistema A) que alimenta site, propostas, social e IA. Sem ele, propostas e campanhas citam produto inexistente.
- **Abas** (`AdminCatalog.tsx:284-285`): `catalog` ("Catálogo") · `sku-mapping` ("Mapeamento de SKU", inclui filtro "fora de catálogo").
- **Ferramentas embutidas**: variações por produto (`catalog_product_variations`, 180 linhas) com peso/tamanho no rótulo e checkbox **Dist.** (visibilidade granular no catálogo de distribuição); componentes de kit (`catalog_kit_components`); vínculo de documentos (`catalog_documents`); aliases (`produto_aliases`).
- **Botões principais**: Novo produto · Salvar · Duplicar · Ativar/Desativar · Nova variação · Vincular documento · **Vincular SKU** (`rpc save_produto_alias`) · Criar nome canônico para item fora de catálogo · Sugerir match automático.
- **Fluxo do mapeamento de SKU**: `v_sku_mapping_inbox` (itens de proposta sem SKU) → operador escolhe variação ou cria alias → `produto_aliases` → `catalog-sku-resolver` passa a resolver nas próximas propostas.
- **Erros comuns**: item de proposta com nome livre não encontrado → permanece na inbox; SKU duplicado → constraint de unicidade.
- **Status**: ✅ ativa. Débito conhecido: cobertura de SKU incompleta em itens históricos de proposta (cap. 06).

## 3.3 Catálogo → Docs Sistema (`documents` → `AdminDocumentsList`)

Gestão de fichas técnicas/manuais (`catalog_documents` + `resin_documents`, 48 linhas), consumidos por `/docs/*` (proxy) e `/support-resources`. Botões: Upload, Editar metadados, Vincular a produto/resina, Excluir. ✅ ativa.

## 3.4 Conteúdo → Artigos (`knowledge` → `AdminKnowledge`)

- **Por que existe**: motor de SEO/GEO e de RAG. `knowledge_contents` tem 813 linhas e 64 colunas.
- **Abas de nível de tela** (`AdminKnowledge.tsx:1825-1831`): `roi-calculators` · `link-validator` · `support-cases`.
- **Abas por artigo** (`:2014-2019`): `content` · `ai-generation` · `seo` · `faqs` · `media` · `conversion`.
- **Ferramentas**: geração/enriquecimento por IA, reformatação de HTML (`reformat-article-html`), injeção de cards de produto (`auto-inject-product-cards`), tradução (`translate-content`), validação de link building, indexação Google (`submit-google-indexing`).
- **Botões críticos**: Publicar (muda `status` e dispara `fn_ping_google_on_publish` → indexação), Gerar com IA, Reformatar, Traduzir, Injetar cards, Validar links, Excluir.
- **Regra de negócio obrigatória**: conteúdo gerado por IA **nunca** contém preços (cap. 06).
- **Status**: ✅ ativa. Débito de UX: arquivo com 2.000+ linhas, 9 abas somadas — candidato número 1 a decomposição.

## 3.5 Conteúdo → Knowledge Hub (`knowledge-hub`)

Abas `faqs` ("FAQs Comerciais") · `datasheets` ("Fichas Técnicas") · `stories` ("Casos de Sucesso") — `AdminKnowledgeHub.tsx:432-434`. Alimenta `commercial_faqs`, `smartdent_method_docs`, `success_stories`, que por sua vez alimentam o RAG da Dra. LIA e a prova social do site. ✅ ativa.

## 3.6 Conteúdo → Autores (`authors`)

CRUD de `authors` (7 linhas, 32 colunas) para E-E-A-T: bio, credenciais, assinatura, foto, schema Person. ✅ ativa.

## 3.7 Smart Ops → Bowtie (`so-bowtie`)

Funil "bowtie" (aquisição → retenção → expansão) sobre `deals`/`lia_attendances`. Somente leitura, com filtros de período. ✅ ativa.

## 3.8 Smart Ops → Público / Lista (`so-kanban`)

- **Por que existe**: é o CRM operacional interno — lista/kanban de leads com ficha 360º.
- **Componentes**: `KanbanLeadDetail`, `LeadDetailPanel` (+ abas `ErpDataTab`, `FinanceiroTab`, "CS"), badges `DualStatusBadge`/`FinanceiroBadge`/`FreteStatusBadge`.
- **Ficha do lead agrega**: dados PipeRun (etapa, dono, histórico de deals), Omie (NFs, parcelas, score), e-commerce, mensagens WhatsApp, timeline unificada, NPS, oportunidades cognitivas, workflow 7×3.
- **Botões**: Enviar WhatsApp · Enviar e-mail · Nota do vendedor (lock atômico `try_claim_seller_note_slot`) · Reprocessar lead (`smart-ops-lia-assign`) · Abrir no PipeRun · Copiar telefone/e-mail · Exportar.
- **Movimentação de etapa**: **removida** — `smart-ops-kanban-move` foi desligada; mover etapa em Vendas é manual no PipeRun (memória `kanban-move-desligado`). ⚠ parcial por decisão de negócio.
- **Status**: ✅ ativa (33,9 k leads canônicos).

## 3.9 Smart Ops → Equipe (`so-equipe`)

`team_members` (18 linhas): vendedores, roles, metas, e credenciais WhatsApp por instância. UI com **duas seções independentes**: Evolution API (individual) e EvolutionGO (grupos), cada uma com `*_enabled` + `*_status`. Botões: Salvar membro · Testar conexão (`wa-provider-selftest`) · Ativar/Desativar provedor · Definir metas. Regra: cada instância tem `evolution_api_key`/`evolution_phone`/`evolution_lid` próprios; `EVO_KEY` global é apenas fallback. ✅ ativa.

## 3.10 Smart Ops → Automações (`so-reguas`)

Abas `comercial` · `fora` (`SmartOpsLiaAutomations.tsx:207-210`) sobre `lia_automations`/`cs_automation_rules`. Invoca `automacoes-lia`. **Botão "Nova automação" está `disabled` com `title="Em breve"`** (`:138-140`) → ⚠ parcial: só é possível editar/ativar regras existentes.

## 3.11 Smart Ops → Logs (`so-logs`)

Abas `envios` · `chegada` (`SmartOpsLogs.tsx:221-222`): saída de mensagens (`message_logs`, `wa_send_log`, `campaign_send_log`) e entrada de leads (`meta_lead_ingestion_log`, `lead_activity_log`). Filtros por período/canal/status. ✅ ativa.

## 3.12 Smart Ops → Relatórios (`so-reports`)

Relatório comercial (receita `Max(CRM ganho, faturamento Omie) + LTV e-commerce`, pipeline, mix de produto, metas). Botões: selecionar mês · exportar XLSX/CSV · atualizar. RPCs `fn_relatorio_mes_kpis`, `fn_mix_produtos_mes`, `fn_faturamento_mes`. ✅ ativa.

## 3.13 Smart Ops → Conteúdo (`so-conteudo`)

Pipeline de conteúdo operacional: pedidos (`content_requests`), ponte com Sistema A (`content_bridge`), lacunas de conhecimento (`agent_knowledge_gaps`, `knowledge_gap_drafts`). ⚠ parcial: várias tabelas de suporte estão vazias.

## 3.14 Smart Ops → Saúde do Sistema (`so-saude`)

Abas `check` · `incoming` · `functions` · `logs` (`SmartOpsSystemHealth.tsx:33-36`).

| Botão | Ação | Detalhe |
|---|---|---|
| Atualizar | refetch de `system_health_logs` (7 dias, limite 100) | `:66-94` |
| Executar Watchdog | `functions.invoke('system-watchdog-deepseek', {dry_run:false})` | `:116` |
| ✔ (resolver) | `update {resolved, resolved_at}` em `system_health_logs` | `:127-139` |

Semáforo: crítico se `criticals>0`; atenção se erros 24 h > 0 ou avisos > 3 (`:141-145`). Aba "Funções" lista `edge_function_catalog`. **Assinatura Realtime existe (`:99-110`) mas está inerte** pelo kill-switch do client → ⚠ parcial. Débito: `system_health_logs` com 2,6 M linhas / 1,7 GB e sem retenção.

## 3.15 Smart Ops → WhatsApp (`so-whatsapp`)

Instâncias, filas (`wa_message_queue` 385 linhas, `whatsapp_send_queue`), grupos (`wa_group_*`), broadcasts, captura de conversas (`whatsapp_inbox`), templates. Botões: Sincronizar grupos (`wa-sync-groups`) · Disparar broadcast (`wa-group-blast`) · Resolver LID (`smart-ops-wa-resolve-lid`) · Capturar conversas (`smart-ops-wa-capture-conversations`) · Preview IA (`wa-ai-preview`). Roteamento obrigatório por `_shared/wa-provider-router.ts`: individual → Evolution; grupo → EvolutionGO; nunca fallback cruzado. ✅ ativa.

## 3.16 Smart Ops → Formulários (`so-formularios`)

`smartops_forms` (55, 55 colunas), campos (`smartops_form_fields`), respostas (`smartops_form_field_responses`, 93), landing pages, short links, fluxo condicional (`/admin/form-flow/:formId`). Botões: Novo formulário · Editar campos · Publicar · Copiar link curto · Ver respostas · Métricas (`fn_form_metrics`). Regra: vitória de formulário só conta se a data do deal/pedido for posterior à submissão. ✅ ativa.

## 3.17 Smart Ops → Treinamentos (`so-treinamentos`)

Agendamento de treinamento ancorado no **deal**: busca por `fn_search_deals_for_training` (fuzzy + telefone/CNPJ/CPF), matrícula em `smartops_course_enrollments` (99), acompanhantes, grupo de WhatsApp da turma, certificado (`generate-certificate`), crachás e comprovantes, NPS 24 h depois. Botões: Nova inscrição · Criar grupo WA · Gerar certificado/crachás · Enviar NPS · Adicionar acompanhante. ✅ ativa.

## 3.18 Smart Ops → Tokens IA (`so-tokens-ia`)

Consumo por modelo/função em `ai_token_usage`. ⚠ parcial: tabela sem linhas recentes nas estatísticas do planner (logging via `_shared/log-ai-usage.ts` existe, mas a série histórica está esvaziada).

## 3.19 Smart Ops → AI Routing (`so-ai-routing`)

`ai_model_routing`: qual modelo atende cada tarefa, com fallback. Botões: Salvar rota · Testar. ⚠ parcial (tabela sem dados nas estatísticas).

## 3.20 Smart Ops → Intelligence (`so-intelligence`)

Abas `overview` · `sentinela` (`IntelligenceWithSentinela.tsx:10-11`). Sentinela (`SentinelaTab.tsx:328-349`): filtros 24 h/7 d/30 d e abas `momentum`, `buy`, `atrito`, `comp`, `pred`, `cfg`, sobre `sentinela_group_messages`/`sentinela_insights`. Score de inteligência do lead via RPC (4 eixos, máx. 81 pontos). ✅ ativa.

## 3.21 Smart Ops → ROI (`so-roi`)

`roi_cards` (4) + `roi_card_items`/`roi_card_cad_types`, base da calculadora pública `/calculadora-roi` (7 estágios do fluxo digital, custo-hora do dentista). ✅ ativa, pouco povoada.

## 3.22 Smart Ops → Mapeamento 7×3 (`so-mapeamento`)

Abas `sdr` · `products` · `competitors` · `rules` (`SmartOpsWorkflowMapper.tsx:410-413`), sobre `workflow_cell_mappings`. É a fonte do briefing do vendedor gerado por `_shared/workflow-diagnosis.ts`. ✅ ativa.

## 3.23 Smart Ops → Campanhas (`so-campanhas`)

Abas (`SmartOpsCampaigns.tsx:2788-2820`): `biblioteca` · `criar` · `rascunhos` · `historico` · `grupos-wa` · `formularios-meta` (rotulada **"Origens"**) · `mapeamentos` · `link-na-bio`.

| Ferramenta | Função | Backend |
|---|---|---|
| Wizard de e-mail | 3 passos; abas `visual`/`html`/`sections` (`EmailCampaignWizard.tsx:368-370`) | fila `smartops-email-tick` (cron 1 min), limite ~499/dia, janela 07:30–19:00; usa short link existente, não cria URL nova |
| Fila e métricas | `rpc fn_email_queue_status` (`:454`), `rpc fn_email_campaign_metrics` (`:467`) | mostra enfileirados × enviados |
| SMS | `smart-ops-sms-disparopro` (HTTPS MT), saldo por `smart-ops-sms-balance` | `campaign_sms_responses` |
| Grupos WA | `SmartOpsWaGroupCampaigns`, `WaGroupBlastModal` | dedupe global + cooldown por grupo |
| Origens | `rpc list_lead_origins` / `list_unmapped_meta_forms`; mapeia formulário Meta → produto → célula 7×3 | `meta_form_mappings` (21) |
| Link na bio | `smartops_bio_pages` + short links | `/bio/:slug` |

✅ ativa (10 campanhas, 501 envios registrados).

## 3.24 Smart Ops → Distribuição (`so-distribuicao`)

Abas `cadastro` · `catalogo` · `tabela` (Tabela de Preço) · `proposta` (`DistributorsHub.tsx:47-50`), mais a galeria **Mídias & Artes** do Google Drive (`GoogleDriveGallery`). Kit do distribuidor em 3 idiomas (`DistributorKitDialog.tsx:153-155`). Tabelas: `distributors` (23), `dealer_price_lists`/`dealer_price_items`, `dealer_proposals` (2), `dealers`. Único acesso do role `distribuidor`. ✅ ativa.

## 3.25 Smart Ops → Reativação & Fluxos (`so-reativacao`)

Abas `ltv` · `flows` · `ingestion` · `crm` · `normalize` · `settings` (`SmartOpsReactivationHub.tsx:40-45`).

- `ltv`: réguas de recompra (`ltv_reactivation_rules`, `reactivation_rules`).
- `flows`: editor visual ReactFlow (`OperationalFlowEditor`) sobre `operational_flows` (5) + versões + shadow log.
- `normalize`: **Normalizar Campos** — 32 campos canônicos via `smart-ops-field-normalize`, com contagem de ocorrências e `derivedOptions` para campos órfãos.
- `ingestion`/`crm`: reprocessamento e conciliação.
✅ ativa.

## 3.26 Smart Ops → Eventos (`so-eventos`)

`smartops_events` (42 colunas) + `EventAIPanels` (geração de imagem/copy por IA, `event-generate-image`). Página pública `/eventos`. ✅ ativa.

## 3.27 Smart Ops → Copilot (`so-copilot`)

Agente interno "gerente comercial sênior": lê exclusivamente o schema `copilot_brain` (snapshots) e executa ações (WhatsApp, mover CRM, e-commerce, relatórios, RAG read-only). Máx. 8 linhas de resposta, política de zero alucinação, `query_deal_history` obrigatório para vendas. ✅ ativa.

## 3.28 Smart Ops → Rayshape (`so-rayshape`)

Painel de impressoras Rayshape: `rpc fn_rayshape_status(p_lead_id)` (`RayshapePanel.tsx:121`), `rayshape_manual_owners`. ✅ ativa, nicho.

## 3.29 Smart Ops → Stripe / Pagamentos (`so-stripe`)

`stripe_subscriptions` (23), `stripe_webhook_events`, `stripe_payment_units`, `stripe_license_actions`, `platform_subscriptions`. Crons: lembrete de renovação (13 h) e retry de não-conciliados (20 min). Botões: Reprocessar evento · Vincular pagamento a lead · Enviar cobrança. ✅ ativa.

## 3.30 Smart Ops → Cursos (`so-cursos`)

Abas `agendamentos` · `catalogo` · `inscricoes` · `publica-imersoes` · `publica-aovivo` · `calendario` (`SmartOpsCourses.tsx:1294-1299`). `smartops_courses` (35), `smartops_course_turmas`, geração recorrente de turmas (`rpc fn_generate_recurrent_turmas`, `CourseCreateModal.tsx:627`), grupo WA compartilhado, páginas públicas `/inscricao/:slug`. **Botão "Adicionar curso" por profissional é placeholder** (`CoursesPage.tsx:262-270`) → ⚠ parcial.

## 3.31 Ferramentas (`tools`)

Cinco ferramentas empilhadas na mesma tela (`AdminViewSecure.tsx:288-306`): `ApostilaExport` · `AdminArticleEnricher` · `AdminArticleReformatter` · `AdminParameterPages` · `AdminVideoProductLinks`. Sem abas — rolagem longa; candidato a abas (cap. 11). ✅ ativas.

## 3.32 PandaVideo (`pandavideo-test`)

`AdminPandaVideoSync` + `AdminPandaVideoTest` + `AdminVideoAnalyticsDashboard`; `sync-pandavideo`, `sync-video-analytics`; `knowledge_videos` (602), `pandavideo_folders`. ✅ ativa (o nome "test" é enganoso — é a tela de produção de vídeos).

## 3.33 Sistema → Estatísticas (`stats`)

`AdminStats` + `AdminDraLIAStats`. Este último tem abas `overview` · `quality` · `rag` · `autoheal` · `alimentador` e sub-abas `gemini`/`deepseek` (`AdminDraLIAStats.tsx:772-798,1564-1565`), com `rpc get_rag_stats` (`:296`). ✅ ativa.

## 3.34 Sistema → Usuários (`users`)

`AdminUsers` sobre `user_roles` (5 linhas) + `create-user` (única function com `verify_jwt = true` de uso corrente). **Botão "Excluir usuário" não exclui**: dispara toast "Funcionalidade em desenvolvimento" (`AdminUsers.tsx:157-169`) → ⚠ parcial, risco de conformidade LGPD (direito ao apagamento).

## 3.35 Sistema → Configurações (`settings`)

Abas `brands` · `models` · `resins` · `parameters` · `cta3` · `hub` · `seo` · `data` (`AdminSettings.tsx:650-678`). A aba `data` concentra import/export em massa (`useDataExportImport` sobre `parameter_sets`). Botões destrutivos de import sem dry-run → risco (cap. 11). ✅ ativa.

---

## 3.36 Sub-app Social Publisher (`/social/*`)

Menu com 11 itens (`SocialSidebar.tsx:9-20`) e 15 rotas (`App.tsx:82-101`).

| Tela | Objetivo | Backend |
|---|---|---|
| Dashboard | visão de publicações e métricas | `social_scheduled_posts` (28), `zernio-metrics-sync` |
| Criar Post / Editar | editor multi-canal, upload sem limite de tamanho, presets de imagem, legenda por IA | `social-caption-generator`, `social-generate-image`, Storage |
| Calendário | agenda de publicação (drag & drop) | `useCalendarPosts`, `useReschedulePost` |
| Banco de Posts | biblioteca reaproveitável; auto-blast para grupos WA | `social_posts_bank`, cron `social-post-auto-blast` (10 min) |
| Analytics | desempenho por canal | `zernio-metrics-sync`, `useSocialAnalytics` |
| Flows IG DM | comentário → DM (requer ID de automação Zernio provisionado) | `social_flows` (6), `zernio-provision-flow` |
| Broadcasts | disparo em massa | `social_broadcasts`, `zernio-broadcast-dispatch` |
| Sequências | régua de mensagens | `social_sequences`, `social_sequence_enrollments` |
| Contatos | base Zernio | `zernio-contacts-sync` (cron 30 min) |
| Avaliações | reviews Google | `sync-google-reviews`, `google_reviews` |
| Post Grupos | abas `instancias`/`historico` (`PostGrupos.tsx:96-97`) | `post_group_targets`, `wa_group_dispatch_log` |

Publicação real: `social-publish-worker` (cron a cada 2 min) + `social_zernio_accounts` (12 contas). ✅ ativa.

## 3.37 Painel Comercial de TV (`/painel-comercial`)

Composto por `KpiCard`, `FunnelPanel`, `SellerPerformanceTable`, `ActivityTable`, `OriginPanel`, `TopProductsGrid`. Lê **apenas** `painel_comercial_cache`, atualizado por `painel_comercial_refresh()` no cron de 15 min; nunca consulta `deals` direto. Seletor de mês no cabeçalho. ✅ ativa.

## 3.38 Telas públicas de conversão

| Tela | Função | Regras |
|---|---|---|
| `/f/:slug` | formulário dinâmico com condicionais | rate limit em `smart_form_rate_limit`; ingestão por `smart-ops-ingest-lead`; taxonomia canônica de área/especialidade |
| `/lp/:slug` | landing page gerada (IA/briefing/playbook — `LandingPageBuilderModal.tsx:323-326`) | `smartops_form_landing_pages` |
| `/bio/:slug` | link na bio | `smartops_bio_pages` |
| `/inscricao/:slug` | inscrição em turma | `smartops-public-enrollment`, contadores `smartops_turma_counters` |
| `/nps/:token` | NPS pós-treinamento (estrelas) | `smartops-public-nps` → `cs-nps-responder`; token expirado devolve 410; resposta espelhada como nota no PipeRun |
| `/cadastro-distribuidor` | candidatura de distribuidor | `distributors` |
| `/embed/dra-lia` | agente em iframe | RAG com limite 0,56 de similaridade; preços redirecionam para WhatsApp |

## 3.39 Telas e componentes mortos (detalhe em cap. 10)

| Item | Evidência |
|---|---|
| `src/pages/AdminViewSupabase.tsx` (193 linhas) | nenhuma `<Route>` aponta para ela |
| `src/components/SmartOpsTab.tsx` | réplica do switch de seções; nenhum import |
| `src/components/social/ComingSoon.tsx` | nenhum uso em JSX |
| `useRealtimeUpdates.ts` + assinaturas Realtime | client sobrescreve `channel` com no-op |