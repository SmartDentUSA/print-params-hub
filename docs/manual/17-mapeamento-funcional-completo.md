# 17 — Mapeamento Funcional Completo (Enterprise)

> Especificação técnica e operacional de **todas** as seções do menu do sistema SmartDent (Sistema B — Supabase `okeogjgqijbfkudfjadz`).
> Estrutura por item: **1) Descrição & objetivo de negócio · 2) Componentes internos · 3) Passo a passo (how-to) · 4) Arquitetura de dados & engenharia fullstack**.

## Convenções e roteamento

| Camada | Implementação |
|---|---|
| Shell administrativo | `src/pages/AdminViewSecure.tsx` — `switch(activeSection)` (linhas 277-350) monta cada seção via lazy import |
| Menu | `src/components/AdminSidebar.tsx:55-130` (grupos Catálogo, Conteúdo, Smart Ops, Ferramentas, Sistema) |
| Social Publisher | Rotas aninhadas em `src/App.tsx:82-97`, shell `src/components/social/SocialLayout.tsx` + `SocialSidebar.tsx` |
| Acesso a dados | `@/integrations/supabase/client` — PostgREST (`.from`), RPC (`.rpc`), Edge Functions (`functions.invoke`) |
| Autorização | `user_roles` (`app_role`: admin, user, author, distribuidor) + RLS; seções `adminOnly` filtradas no sidebar |

**Regras globais que atravessam todos os módulos**
- **Golden Rule (CRM):** nunca alterar o Funil CS nem o Funil Comercial; novo interesse sempre abre deal novo no **Funil de Vendas** (`_shared/golden-rule-guard.ts`, `smart-ops-lia-assign`).
- **CDP:** toda leitura de `lia_attendances` usa `WHERE merged_into IS NULL` (lead canônico).
- **Receita:** `Max(CRM ganho, Faturamento Omie) + LTV e-commerce`.
- **WhatsApp:** Evolution API = individual · EvolutionGO = grupos · sem fallback entre provedores · credenciais por instância em `team_members`.
- **Datas:** eventos externos gravam sempre a data real do fato, nunca `now()`.

---

# 1. Módulo: Catálogo

## 1.1 Modelos

**1) Descrição & objetivo de negócio**
Cadastro-mestre de equipamentos (impressoras/scanners) por marca. Sustenta as páginas públicas de parâmetros de impressão, os filtros do catálogo e a taxonomia de equipamento usada no CRM (`equip_*`). O usuário vê uma tabela plana de modelos com marca, status ativo/inativo e imagem.

**2) Componentes internos**
- Botão **Novo Modelo** (`AdminModels.tsx:265`), ações de linha **Editar** (`:442`) e **Excluir** com `AlertDialog` de confirmação (`:449-473`).
- Modal com 2 abas: **Informações Básicas** e **Imagem** (`:286-361`); `Switch` ativo/inativo (`:345`); upload via `ImageUpload` (bucket `model-images`).
- Sem filtros — listagem completa.

**3) Passo a passo**
1. Abrir **Catálogo → Modelos**. 2. **Novo Modelo** → escolher marca, nome, slug, specs. 3. Aba **Imagem** → upload. 4. Salvar (grava e invalida cache do `DataContext`). 5. Para desativar sem perder histórico, usar o `Switch` (não excluir). 6. Excluir só se o modelo nunca foi referenciado por parâmetros/artigos.

**4) Arquitetura de dados**
- **Inputs:** formulário (marca, nome, slug, descrição, ativo, imagem).
- **Processamento:** `DataContext` (`src/contexts/DataContext.tsx:58-90`) → `useSupabaseData` (leitura) + `useSupabaseCRUD` (escrita); geração de slug via `useSlugGeneration`.
- **Outputs:** linhas em `models`, arquivo em Storage, revalidação das páginas públicas de parâmetros.
- **Tabelas:** `brands`, `models`, `parameter_sets` (consumidora), Storage `model-images`.
- **Integrações externas:** nenhuma.

## 1.2 Produtos (Gestão de Catálogo)

**1) Descrição & objetivo**
Fonte pública de produtos comerciais (`system_a_catalog`) — controla visibilidade, taxonomia, preço, SEO, CTAs e documentos. É o catálogo que alimenta site, propostas de distribuição, RAG da Dra. LIA e resolução de SKU nas propostas do CRM.

**2) Componentes internos**
- Abas: **Catálogo** e **Mapeamento de SKU** (`AdminCatalog.tsx:282-286`, `SkuMappingTab`, com filtro **Fora do Catálogo** para itens de proposta do CRM sem correspondência).
- Botões: **Regenerar Descrições (Resinas)** (`:302`), **Migrar Imagens** (`:323`), **Novo Produto** (`:331`), **Exportar XLSX** (`:335`), **Mostrar/Ocultar todos** por categoria (`:397`).
- Filtros: busca, categoria, status (ativo/inativo/aprovado/pendente/visível/oculto), origem (produtos × espelho de resinas).
- Tabela (`AdminCatalogTable.tsx`): checkbox **Dist.** por variação (visibilidade granular no catálogo de distribuição); ordenação global **KIT primeiro**, depois ordem lógica de nome com variações agrupadas (`types.ts` → `isKitProduct`, `kitFirst`).
- Modal `AdminModal`: dados comerciais, specs técnicas, indicações clínicas, CTAs 1-3, SEO, documentos, apresentações.

**3) Passo a passo**
1. Filtrar por categoria/status. 2. **Novo Produto** ou editar. 3. Definir `active`/`approved`/`visible_in_ui` e `display_order`. 4. Anexar PDFs (vão para `catalog_documents`). 5. Marcar **Dist.** nas variações liberadas para distribuidores. 6. Em **Mapeamento de SKU**, vincular nomes de itens vindos do CRM a variações canônicas ou criar nome de match.

**4) Arquitetura de dados**
- **Inputs:** formulário, upload de PDFs/imagens, itens de proposta importados do PipeRun.
- **Processamento:** `useCatalogCRUD.ts`; espelhamento `resins → system_a_catalog` via COALESCE (política *Resinas Canonical Mirror*); resolução de SKU por `_shared/catalog-sku-resolver.ts`.
- **Outputs:** catálogo público, XLSX, descrições/traduções geradas por IA, documentos publicados.
- **Tabelas:** `system_a_catalog`, `catalog_product_variations`, `catalog_kit_components`, `catalog_documents`, `products_catalog`, `produto_aliases`, `product_taxonomy`, `resins`; Storage `catalog-documents`.
- **Edge functions:** `migrate-catalog-images`, `smart-ops-generate-card-descriptions`, `translate-card-row`, `format-processing-instructions`.
- **Integrações:** Lovable AI Gateway (descrições/traduções); Sistema A (espelho de conteúdo).

## 1.3 Docs Sistema

**1) Descrição & objetivo**
Repositório unificado de documentos técnicos (catálogo + resinas) com extração de texto por IA, usado como matéria-prima do RAG e da base de conhecimento.

**2) Componentes internos**
- Filtros: nome, idioma, tipo de documento, status (pending/processing/completed/failed), origem (resin/catalog).
- Ações por linha: **Extrair/Re-extrair PDF**, editar texto extraído inline, **limpar texto**, edição inline de nome/descrição/categoria/subcategoria via popovers, **Publicar no Conhecimento**.
- Modal `DocumentContentGeneratorModal` (gera artigo a partir do documento).

**3) Passo a passo**
1. Filtrar documentos `pending`. 2. **Extrair** → aguardar `completed`. 3. Revisar/ajustar o texto. 4. **Publicar** → escolher categoria/autor → cria registro em `knowledge_contents`.

**4) Arquitetura de dados**
- **Inputs:** PDFs em Storage, metadados do documento.
- **Processamento:** `useAllDocuments.ts` (tabela dinâmica resin/catalog) + `usePdfExtraction.ts`; extração/OCR e sumarização por IA.
- **Outputs:** `extracted_text`, artigos publicados, embeddings para RAG.
- **Tabelas:** `catalog_documents`, `resin_documents`, `system_a_catalog`, `resins`, `knowledge_contents` (⚠️ documentos de resina e de catálogo **nunca** são unificados).
- **Edge functions:** `extract-and-cache-pdf`, `ai-enrich-pdf-content`.

---

# 2. Módulo: Conteúdo

## 2.1 Artigos

**1) Descrição & objetivo**
Editor completo da Base de Conhecimento (categorias A-H) com SEO/GEO, FAQs, mídias, CTAs comerciais e traduções PT/EN/ES. Objetivo: tráfego orgânico, resposta a IA generativa (AI-first) e sustentação do RAG da Dra. LIA.

**2) Componentes internos**
- Abas de categoria dinâmicas (`knowledge_categories`) + abas fixas **roi-calculators**, **link-validator**, **support-cases** (`AdminKnowledge.tsx:1817-1992`).
- Modal do artigo com 6 abas: 📝 Conteúdo · 🤖 IA · 🔍 SEO · ❓ FAQs · 🎬 Mídias · 💰 Conversão (`:2012-2020`).
- Componentes: `KnowledgeEditor` (visual/HTML, PT/ES/EN), `ProductCTAMultiSelect`, `VideoSelector`, `HeroAudioUpload` (player com velocidade 1x/1.5x/2x), `PDFTranscription`, `BlogPreviewFrame`, `AdminLinkBuildingValidator`.

**3) Passo a passo**
1. Escolher categoria. 2. Novo artigo → título/slug/autor. 3. Escrever ou gerar com IA (aba IA). 4. Preencher SEO (title <60, description <160, JSON-LD) e FAQs. 5. Vincular vídeos, PDFs e CTAs de produto. 6. Traduzir (EN/ES). 7. Publicar → URL canônica `/base-conhecimento/{letra}/{slug}`.

**4) Arquitetura de dados**
- **Inputs:** texto/HTML, imagens (`knowledge-images`), PDFs, seleção de vídeos e produtos.
- **Processamento:** `useKnowledge.ts`; enriquecimento e tradução via IA; validador de link building; geração de embeddings para RAG.
- **Outputs:** páginas públicas, sitemap/llms.txt, indexação Google, contexto do RAG.
- **Tabelas:** `knowledge_contents`, `knowledge_categories`, `knowledge_videos`, `authors`, `agent_embeddings`, `google_indexing_log`.
- **Edge functions:** `ai-enrich-pdf-content`, `translate-content`, `extract-and-cache-pdf`, `enrich-article-seo`, `reformat-article-html`, `seo-proxy`.
- **Integrações:** Lovable AI Gateway, Google Indexing API, PandaVideo (vídeos).

## 2.2 Knowledge Hub

**1) Descrição & objetivo**
Base comercial de apoio ao time: FAQs comerciais, fichas técnicas (datasheets) e casos de sucesso — consumidos por vendedores, Copilot e Dra. LIA.

**2) Componentes internos** — 3 abas (`AdminKnowledgeHub.tsx:430-439`)
- **FAQs Comerciais:** formulário (pergunta, categoria, prioridade, tags, produtos), toggle ativo, excluir → `commercial_faqs`.
- **Fichas Técnicas:** busca de produto, upload de datasheet, URL manual → `products_catalog` + Storage `product-datasheets`.
- **Casos de Sucesso:** cliente, slug, cidade/UF, produtos, ROI (meses), economia mensal → `success_stories`.

**3) Passo a passo:** escolher aba → preencher formulário → **Adicionar** → revisar na tabela → desativar/excluir quando obsoleto.

**4) Arquitetura de dados**
- **Tabelas:** `commercial_faqs`, `products_catalog`, `success_stories`; Storage `product-datasheets`.
- **Consumo cruzado:** RAG da Dra. LIA (`search_knowledge_rag`) e Copilot (tools read-only de conhecimento).

## 2.3 Autores

**1) Descrição & objetivo**
Cadastro E-E-A-T dos autores (Person Schema) que assinam os artigos — requisito de autoridade para SEO/GEO.

**2) Componentes:** botão **Novo Autor**, ações Editar/Excluir, modal único com nome, bio, credenciais, redes sociais e foto (`AuthorImageUpload`).

**3) Passo a passo:** Novo Autor → dados + foto → Salvar → vincular no seletor de autor do artigo.

**4) Arquitetura de dados:** tabela `authors` (via `useAuthors.ts`); saída = assinatura HTML (`src/utils/authorSignatureHTML.ts`) e JSON-LD Person nas páginas públicas. Sem integrações externas.

---

# 3. Módulo: Smart Ops

## 3.1 Bowtie

**1)** Visualização "gravata-borboleta" do funil (aquisição → conversão → expansão): contagem por etapa, taxas e pontos de queda. Objetivo: leitura executiva de gargalos.
**2)** Cards de KPI por estágio, tabela de detalhe, modal (`Dialog`) para editar metas/parâmetros do bowtie.
**3)** Selecionar período → ler estágios → clicar no estágio para detalhe → ajustar configuração no modal.
**4)** **Inputs:** período, configuração. **Processamento:** edge `pipeline-funnel-data` agrega deals em 4 bandas (<60, 60-80, 90, 100) por `stage_name`. **Outputs:** KPIs. **Tabelas:** `lia_attendances`, `deals`, `site_settings`. **Integração:** PipeRun (indireta, via espelho `deals`).

## 3.2 Público / Lista (CDP)

**1)** Lista/kanban do CDP: todo lead canônico com identidade, origem, funil, produtos, financeiro, NPS e timeline unificada. É a tela central de atendimento e auditoria.
**2)** Busca (nome/e-mail/telefone/CNPJ/produto de proposta), filtros de etapa/origem/proprietário, `LeadDetailPanel` com abas (Visão geral, Produtos, Financeiro, CS/NPS, Timeline unificada), badges de NPS e ações de unificação.
**3)** Buscar lead → abrir card → validar identidade e histórico → agir (WhatsApp, mover etapa manual no CRM, editar campos, unificar duplicados).
**4)** **Inputs:** busca do operador; ingestão automática (Meta/Zernio, formulários, e-commerce, PipeRun, Omie, Sellflux). **Processamento:** RPC `fn_search_leads_by_proposal_product`, `smart-ops-leads-api` (agregação 360 + NPS), merge determinístico (`piperun_id` > e-mail > telefone). **Outputs:** card 360, notas no PipeRun, mensagens WA. **Tabelas:** `lia_attendances` (canônica, `merged_into IS NULL`), `deals`, `deal_items`, `lead_activity_log`, `lead_page_views`, `omie_notas_fiscais`, `smartops_nps_responses`, `whatsapp_inbox`. **Integrações:** PipeRun, Omie, Sellflux, Evolution.

## 3.3 Equipe

**1)** Gestão de vendedores/CS/suporte: dados, metas, papel, status ativo e credenciais WhatsApp por instância (Evolution + EvolutionGO). Define quem entra no rateio de distribuição de leads.
**2)** Tabela de membros; modal CRUD; `Switch` ativo/inativo; duas seções independentes de provedor WA (Evolution individual / EvolutionGO grupos) com status de conexão, QR/pareamento, teste de envio e webhook info.
**3)** Novo membro → e-mail, telefone, `piperun_owner_id` numérico → configurar instância Evolution (`evolution_instance_name`, `evolution_phone`, `evolution_api_key`) → verificar `connected` → testar envio → ativar.
**4)** **Inputs:** formulário, callbacks de status das APIs WA. **Processamento:** edges `smart-ops-evolution-manager`, `smart-ops-evogo-status`, `smart-ops-evolution-webhook-info`, `smart-ops-send-waleads`; roteador `_shared/wa-provider-router.ts`. **Outputs:** instâncias provisionadas, webhooks registrados, elegibilidade no round-robin de leads. **Tabelas:** `team_members`. **Integrações:** Evolution API, EvolutionGO, PipeRun (`owner_id`).
> ⚠️ Somente membros **ativos** com `piperun_owner_id` numérico participam do sorteio de leads (`smart-ops-lia-assign`).

## 3.4 Automações (Réguas CS/LIA)

**1)** Construtor de réguas de relacionamento (onboarding, CS, follow-up) e automações da Dra. LIA — mensagens disparadas por gatilho de etapa/tempo/evento.
**2)** Accordion de regras com editor (gatilho, atraso, canal, template com variáveis via `WaLeadsVariableBar`, mídia via `WaLeadsMediaPreview`), `Switch` de ativação, seletor de responsável; aba **Automações LIA** com listar/testar/executar.
**3)** Nova regra → escolher gatilho → escrever mensagem com variáveis → definir canal/instância → testar → ativar. Monitorar em **Logs**.
**4)** **Inputs:** definição da regra; eventos de mudança de etapa/tempo. **Processamento:** `cs_automation_rules` avaliadas por cron; edge `automacoes-lia`; roteador de provedor WA; janela de envio e limites por canal. **Outputs:** mensagens WhatsApp/SMS/e-mail, notas no CRM, registros em `message_logs`. **Tabelas:** `cs_automation_rules`, `team_members`, `message_logs`, `cs_onboarding_mover_queue`. **Integrações:** Evolution/EvolutionGO, DisparoPro (SMS), Gmail (e-mail).

## 3.5 Logs

**1)** Auditoria operacional: o que foi enviado e o que chegou. Base para investigar leads "perdidos" e falhas de mensagem.
**2)** Duas abas: **Logs de Envios** (`message_logs`) e **Log de Chegada** (`lead_activity_log` + `lia_attendances`), com busca por aba.
**3)** Escolher aba → buscar por lead/telefone → inspecionar status, provedor, erro e payload.
**4)** **Tabelas:** `message_logs`, `lead_activity_log`, `lia_attendances`, `team_members`. Somente leitura; sem edge functions.

## 3.6 Relatórios

**1)** Relatório Mensal Comercial: receita, deals, ticket, ranking de vendedores, funil atual, origem, itens vendidos, recorrência e Astron. Fecha o mês para a diretoria.
**2)** Seletor de mês, cards de KPI, tabelas por vendedor com drill-down, gráficos por origem/categoria, export.
**3)** Escolher mês → conferir KPIs → abrir detalhe do vendedor → exportar.
**4)** **Processamento:** RPCs `fn_relatorio_mes_kpis`, `_vendedor`, `_vendedor_detalhe`, `_funil_atual`, `_origem`, `_itens_kpis`, `_itens_top`, `_itens_categoria`, `_itens_vendedor`, `_recorrencia`, `_astron`. **Regra:** receita = `Max(CRM ganho, Omie)`; funil = **apenas Funil de Vendas**. **Tabelas:** `deals`, `deal_items`, `lia_attendances`, `omie_notas_fiscais`, `smartops_course_enrollments`.

## 3.7 Conteúdo (Produção)

**1)** Fila de pedidos de conteúdo (briefings de artigo) entre comercial/marketing e produção editorial.
**2)** Filtro de status, modal de detalhe/edição, vínculo com o artigo publicado.
**3)** Criar pedido → priorizar → produzir em **Conteúdo → Artigos** → vincular `knowledge_contents` → concluir.
**4)** **Tabelas:** `content_requests`, `knowledge_contents`. Dependência: módulo Artigos.

## 3.8 Saúde do Sistema

**1)** Observabilidade: integridade de integrações, dados entrando, catálogo de edge functions e logs de erro. Detecta silenciosamente perdas de lead e crons parados.
**2)** Abas **Check** (`smart-ops-integration-check`), **Ingestão** (`IncomingDataPanel`), **Functions** (`EdgeFunctionsCatalog`), **Logs** (`system_health_logs`); botão de watchdog IA.
**3)** Rodar Check → ver integrações vermelhas → abrir logs do período → acionar watchdog para diagnóstico assistido por IA.
**4)** **Processamento:** edges `smart-ops-integration-check` (cron), `system-watchdog-deepseek` (cron). **Tabelas:** `system_health_logs`, `edge_function_catalog`, `meta_lead_ingestion_log`, `cron_state`. **Integrações:** DeepSeek/AI Gateway, todas as APIs monitoradas.

## 3.9 WhatsApp

**1)** Inbox unificada das conversas capturadas de todas as instâncias (vendedor/CS/suporte), vinculada ao lead canônico.
**2)** Lista de conversas com filtro por instância, thread de mensagens, vínculo lead/turma, botões de captura, resolução de `@lid` e envio.
**3)** Sincronizar conversas → abrir thread → confirmar o lead vinculado → responder pela instância correta.
**4)** **Inputs:** webhooks/pulls da Evolution. **Processamento:** `smart-ops-wa-capture-conversations` (cron), `smart-ops-wa-resolve-lid`, `smart-ops-send-waleads`; vínculo de `@lid` **somente por telefone real**. **Tabelas:** `whatsapp_inbox`, `lia_attendances`, `team_members`, `smartops_course_enrollments`, `message_logs`. **Integração:** Evolution API.

## 3.10 Formulários

**1)** Construtor de formulários e landing pages de captura, com métricas de conversão e short links — principal porta de entrada de leads próprios.
**2)** Lista de formulários com `FormMetricsCard/Row`, editor de campos (`smartops_form_fields`, condicionais), modos de exibição (inclusive `first_three`), `LandingPageBuilderModal` com geração por IA, gerador de short link, aba de respostas.
**3)** Novo formulário → campos e condições → publicar → gerar landing page/short link → divulgar → acompanhar métricas → respostas caem no CDP e na timeline.
**4)** **Inputs:** submissões públicas (`SmartOpsFormFlowStandalone`, `PublicLandingPage`), UTM/tracking persistido em `sessionStorage`. **Processamento:** RPC `fn_form_metrics`, `generate_short_link`; edge `landing-page-generator`; ingestão via `smart-ops-ingest-lead` → enrichment → `smart-ops-lia-assign` (Golden Rule + Commercial Intent Guard). **Outputs:** lead no CDP, deal no Funil de Vendas, nota no PipeRun, evento na timeline, célula do Workflow 7×3. **Tabelas:** `smartops_forms`, `smartops_form_fields`, `smartops_form_field_responses`, `smartops_form_landing_pages`, `lead_form_submissions`, `smartops_short_links`. **Integrações:** PipeRun, Meta (CAPI), GTM.

## 3.11 Treinamentos

**1)** Operação de turmas presenciais/imersões: agenda, vagas, inscrições, acompanhantes, seriais de equipamento, certificados, grupo de WhatsApp e páginas públicas de inscrição.
**2)** Abas **Agendamentos**, **Catálogo**, **Inscrições**, **Página Pública Imersões**, **Página Pública Ao Vivo**, **Calendário**; modais `CourseCreateModal` (com geração de turmas recorrentes) e `EnrollmentModal` (busca fuzzy de cliente por nome/telefone/CPF/CNPJ); `EquipmentSerialsSection`; botões de certificado e comprovante.
**3)** Criar curso/turma → gerar recorrência → inscrever aluno (busca no CDP/deals ganhos) → registrar acompanhantes e seriais → enviar grupo WA → concluir → certificado → NPS pós-treinamento.
**4)** **Processamento:** RPCs `fn_generate_recurrent_turmas`, `fn_search_deals_for_training`, `fn_assign_turma_number`; edges `generate-certificate`, `smart-ops-deal-form-note`, NPS sender/responder. **Outputs:** PDF de certificado, nota no PipeRun, tag Sellflux `TREIN_{SLUG}_{DATE}`, link público `/nps/:token`. **Tabelas:** `smartops_courses`, `smartops_course_turmas`, `smartops_turma_days`, `smartops_course_enrollments`, `smartops_enrollment_companions`, `smartops_nps_responses`, `wa_groups`, `v_turmas_com_vagas`. **Integrações:** PipeRun, Sellflux, EvolutionGO, Google Drive (pastas/docs).

## 3.12 Tokens IA

**1)** Governança de custo de IA: consumo de tokens por modelo, função e período.
**2)** Filtros de data/modelo, gráficos e tabela de custo.
**3)** Selecionar período → identificar função mais custosa → ajustar roteamento em **AI Routing**.
**4)** **Tabela:** `ai_token_usage` (gravada por todas as edge functions de IA). **Dependência:** alimenta decisões de **AI Routing**.

## 3.13 AI Routing

**1)** Tabela de roteamento modelo↔tarefa: define qual modelo atende cada `task_type` (inclusive tarefas `auto_*` do sistema), permitindo trocar custo/qualidade sem deploy.
**2)** Lista separada em tarefas automáticas e manuais, `Switch` por rota, seleção de modelo, salvar por linha, recarregar.
**3)** Localizar `task_type` → escolher modelo → salvar → validar consumo em **Tokens IA**.
**4)** **Tabela:** `ai_model_routing`. **Consumidores:** Dra. LIA, Copilot, geração de conteúdo, watchdog. **Integração:** Lovable AI Gateway (Gemini, GPT, DeepSeek).

## 3.14 Intelligence

**1)** Duas frentes: **Visão Geral** (score de inteligência do lead, 4 eixos) e **Sentinela** (análise por IA das conversas de grupos WhatsApp, gerando insights comerciais e alertas).
**2)** Abas `overview` (`SmartOpsIntelligenceDashboard`) e `sentinela` (`SentinelaTab`: instâncias, configuração, mensagens capturadas, insights, registro de webhooks, botão de análise).
**3)** Registrar webhooks da instância → configurar grupos monitorados → rodar analyzer → ler insights e relatório diário.
**4)** **Processamento:** RPC `calculate_lead_intelligence_score` (máx. 81 pontos); edges `sentinela-analyzer` (cron), `sentinela-register-webhooks`, `sentinela-webhook-receiver`, `sentinela-daily-report`. **Tabelas:** `sentinela_instances`, `sentinela_config`, `sentinela_group_messages`, `sentinela_insights`, `wa_groups`, `intelligence_score_config`. **Integrações:** Evolution/EvolutionGO, AI Gateway.

## 3.15 ROI

**1)** Cards do simulador de ROI odontológico (fluxo digital em 7 estágios), usados em vendas e nas páginas públicas de calculadora.
**2)** Lista de `roi_cards` com badges e ações; a calculadora pública vive em `/roi` (`ROICalculatorPage`).
**3)** Selecionar card → revisar parâmetros (custo/hora do dentista, estágios delegáveis, resinas/modelos) → publicar.
**4)** **Tabelas:** `roi_cards`, `roi_card_items`, `roi_card_cad_types`, `resins`, `models`. Regra: dedução do custo-hora do dentista nos estágios delegáveis.
