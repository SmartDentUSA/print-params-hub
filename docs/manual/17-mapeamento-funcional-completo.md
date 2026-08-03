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

---

# 4. Módulo: Operações & Vendas / Marketing

## 4.1 Mapeamento 7×3

**1)** Motor de regras que cruza os 7 estágios do fluxo digital (scanner, CAD, impressão, pós-processamento, acabamento, cursos, milling) com 3 dimensões (produto concorrente, produto SmartDent, campo de formulário SDR), gerando o portfólio do lead e regras de upsell/cross-sell.
**2)** Grades por tipo de mapeamento (concorrente/produto/campo SDR) com "+ Adicionar" por célula; tabela de regras com toggle ativo e exclusão; `NewRuleForm`.
**3)** Escolher a dimensão → preencher células → criar regra (célula vazia → produto sugerido) → ativar → oportunidades passam a ser calculadas.
**4)** **Processamento:** `fn_sync_form_response_to_portfolio`, `fn_portfolio_cell_update`, `compute-opportunity-engine` (LLM calcula Next Best Action 0-100); trigger `trg_autoregister_product_taxonomy` evita erro 23503. **Tabelas:** `workflow_cell_mappings`, `opportunity_rules`, `lead_opportunities`, `product_taxonomy`, `system_a_catalog`, `smartops_form_fields`. **Dependências:** Formulários (entrada) → Campanhas/Reativação (saída).

## 4.2 Campanhas (Central de Campanhas)

**1)** Central de marketing outbound: biblioteca de conteúdo, wizard de campanha (segmento → mensagem → disparo), campanhas de WhatsApp em grupos, e-mail, SMS, bio-link e o painel **Origens**.
**2)** Abas/sub-painéis: Biblioteca de Conteúdo (sync do Sistema A), **Criar Campanha** (wizard 3 passos com segmentação por RFM/etapa/produto), `SmartOpsWaGroupCampaigns` (grupos + `PromoSeqInspector`), `MetaFormMappingsPanel` → **Origens** (formulários Meta + formulários próprios + origens orgânicas, mapeadas para produto e célula 7×3), `BioLinkPanel`, `EmailCampaignWizard` (fila, enviados, histórico), saldo/disparo de SMS, `CampaignLinkPicker` (usa short links existentes, nunca cria URL nova).
**3)** Sincronizar conteúdo → criar campanha → escolher segmento (apenas leads canônicos) → montar mensagem com link curto → agendar → acompanhar fila/enviados e atribuição de conversão.
**4)** **Inputs:** segmentos, templates, mídias, mapeamentos de origem. **Processamento:** edges `sync-content-from-a`, `smart-ops-sms-balance`, `smart-ops-sms-disparopro`, scheduler de e-mail (Gmail, 499/dia, janela 07:30-19:00), roteador WA; RPCs `fn_campaign_email_stats`, `fn_campaign_conversions`, `fn_sms_campaign_attribution`, `list_lead_origins`. **Outputs:** mensagens WA/SMS/e-mail, `campaign_send_log`, atribuição de receita. **Tabelas:** `campaigns`, `campaign_sessions`, `campaign_segments`, `campaign_send_log`, `campaign_links`, `short_links`, `meta_form_mappings`, `smartops_bio_pages`, `email_sequences`, `wa_groups`. **Integrações:** Meta Lead Ads/Zernio, EvolutionGO, DisparoPro, Gmail.

## 4.3 Distribuição

**1)** Hub de distribuidores/revendas: cadastro, catálogo liberado, tabela de preço por distribuidor e gerador de propostas comerciais (PDF/XLSX/DOCX), além do repositório **Mídias & Artes** (Google Drive).
**2)** Abas: **Distribuidores** (`SmartOpsDistributors`), **Catálogo** (`DealerCatalogGrid`), **Tabela de Preço** (`DealerPriceTable` + snapshots), **Gerar Proposta** (`DealerProposalWizard`), **Mídias & Artes** (`GoogleDriveGallery`, cards por categoria); `FxRateBadge` para câmbio.
**3)** Cadastrar distribuidor → montar tabela de preço (KIT primeiro, ordem lógica por nome, variações agrupadas) → snapshot → gerar proposta (prévia agrupada por categoria/subcategoria) → exportar PDF (cabeçalho completo só na pág. 1; páginas 2+ com nº da proposta e "Página X de N").
**4)** **Tabelas:** `distributors`, `dealers`, `dealer_price_lists`, `dealer_price_items`, `dealer_price_list_snapshots`, `dealer_proposals`, `system_a_catalog`, `catalog_product_variations`, `catalog_kit_components`. **Processamento:** geração client-side (`DealerProposalExport.ts`) com `kitFirst`/`categoryRank`; asset local `src/assets/proposal-bg.png`. **Integrações:** Google Drive (mídias), câmbio.

## 4.4 Reativação & Fluxos

**1)** Motor de reativação por LTV e documentação viva das automações de CRM/ingestão — recupera clientes inativos com ofertas complementares baseadas no tempo médio de retorno.
**2)** Abas: **Regras LTV** (`LtvRules` + `LtvRunsPanel`), **Fluxos Editor** (canvas ReactFlow `OperationalFlowEditor`), **Ingestão de Leads** (`IngestionMap`), **Regras CRM** (`CrmRulesMap`), **Normalizar Campos** (`FieldNormalizer`, 32 campos com canônico + `derivedOptions`), **Configurações** (`ReactivationSettings` com pipelines PipeRun: CS, Vendas, LTV, LTV Lost).
**3)** Configurar pipelines → criar regra LTV (janela, produto complementar, canal) → simular → ativar → acompanhar runs → normalizar campos divergentes.
**4)** **Processamento:** `ltv_reactivation_rules`/`ltv_reactivation_runs`, `reactivation_rules`, `reactivation_sequences`, `operational_flows`/`_versions`/`shadow_log`; edges `smart-ops-field-normalize`, `smart-ops-piperun-webhook`; RPCs `fn_mark_reactivation_response`, `fn_pause_reactivation_manual`, `fn_close_reactivation_on_deal_won`. **Regra de ouro:** deals estagnados → `perdida` + **novo deal em Vendas**; CS e Comercial intocados. **Integrações:** PipeRun, Sellflux, Evolution.

## 4.5 Eventos

**1)** Cadastro de congressos/eventos exibidos na base de conhecimento e nas páginas públicas, com conteúdo multilíngue e pesquisa assistida por IA.
**2)** Tabela + modal (nome, país via `Country.getAllCountries()`, datas, cidade), `EventWebResearchButton` (pesquisa web por IA), `EventReferenceUploads`, `EventAboutByLanguage`, `EventCoverByLanguage`.
**3)** Novo evento → dados básicos → pesquisa IA para preencher "sobre" → capas por idioma → publicar.
**4)** **Tabelas:** `smartops_events`; trigger `fn_notify_event_changed`. **Integrações:** AI Gateway (pesquisa/redação), Storage de capas.

## 4.6 Copilot

**1)** Assistente executivo (persona Gerente Comercial Sênior) que responde sobre a operação e **executa ações** — nunca pergunta, executa. Fonte única de leitura = **Cérebro Comercial** (`copilot_brain`), zero alucinação.
**2)** Chat streaming com seletor de modelo (DS V4-Pro / V4-Flash / Gemini), microfone (speech-to-text), upload de arquivo (CSV inline; PDF/DOCX/TXT/MD via RAG), badges de sugestão, alertas realtime de novo lead.
**3)** Perguntar (ex.: "receita de julho vs junho") → receber resposta baseada no Cérebro → pedir ação (enviar WhatsApp, mover etapa, criar audiência, gerar relatório) → confirmar execução.
**4)** **Inputs:** prompt, arquivos, `BRAIN CONTEXT` injetado por turno. **Processamento:** edge `smart-ops-copilot` (SSE) + `copilot-ingest-method-doc`; `get_copilot_brain()` (SECURITY DEFINER); allowlist de ações (send_whatsapp, send_sms, notify_seller, send_to_sellflux, bulk_campaign, move_crm_stage, update_lead, add_tags, unify_leads, create_audience, generate_commercial_report, get_lead_card) + 5 tools RAG read-only. **Tabelas:** schema `copilot_brain` (`brain_overview`, `brain_sales_month`, `brain_sales_ranking`, `brain_pipeline`, `brain_products_sold`, `brain_equipment`, `brain_alerts`, `brain_meta`), `smartdent_method_docs`, `agent_embeddings`, `ai_token_usage`; Storage `smartdent-method-docs`; realtime em `lia_attendances`. **Integrações:** AI Gateway (DeepSeek/Gemini), Evolution, PipeRun, Sellflux.

## 4.7 Rayshape

**1)** Rastreamento de proprietários da impressora **Rayshape Edge Mini**: quem comprou, quem recomprou consumível e quem está crítico/em atenção — base de recompra de resina e vitality shades.
**2)** Filtros por categoria (recomprou/crítico/atenção/cedo) e tipo de venda, busca, modal **Adicionar manualmente** (busca de lead, data da impressora, deal, nota), botão Atualizar; realtime em `deals`.
**3)** Filtrar "crítico" → abrir lead → acionar campanha/WhatsApp de recompra → registrar proprietário manual quando a venda não estiver no CRM.
**4)** **Processamento:** RPCs `fn_rayshape_owners`, `fn_rayshape_product_units`, `fn_rayshape_vitality_shades`. **Tabelas:** `deals`, `deal_items`, `rayshape_manual_owners`, `lia_attendances`. **Integração:** PipeRun (via espelho de deals).

## 4.8 Stripe / Pagamentos

**1)** Controle das unidades pagas via Stripe (licenças/assinaturas/dongles): status de cobrança, ativação, vencimento e vínculo com lead e vendedor.
**2)** Busca + filtro de status (todas/ativa/vencida/cancelada/trial), edição inline de status por linha, colunas de ativação/dongle/faturamento.
**3)** Buscar cliente → conferir assinatura → atualizar status operacional (ativação/dongle) → validar eventos `stripe_invoice_paid` na timeline.
**4)** **Inputs:** webhooks Stripe (checkout, invoice, subscription). **Processamento:** edge de webhook Stripe grava unidades/assinaturas e loga `lead_activity_log`. **Tabelas:** `stripe_payment_units`, `stripe_subscriptions`, `omie_vendedores` (lookup), `lia_attendances`, `deals`, `lead_activity_log`; campos `stripe_event_id`, `stripe_checkout_id`, `stripe_customer_id`, `stripe_subscription_id`. **Integrações:** Stripe API/Webhooks; Omie (nome do vendedor).

## 4.9 Cursos (Online / Astron)

**1)** Diretório de profissionais e cursos online (Astron Academy), com equipamento detectado automaticamente a partir dos deals ganhos — sustenta liberação de acesso e enriquecimento do CDP.
**2)** Lista de profissionais (`prof_*`), botão **Adicionar profissional** com `CoursesProfessionalProfile`, ações Editar perfil / Adicionar curso.
**3)** Buscar profissional → editar perfil (área, especialidade, instituição) → liberar curso/módulo → acompanhar progresso.
**4)** **Processamento:** detecção de equipamento por regex sobre `deal_items` (scanner/impressora), sync Astron. **Tabelas:** `lia_attendances`, `deals`, `deal_items`, `astron_courses`, `astron_modules`, `astron_lessons`, `astron_member_access`, `online_courses`, `lead_course_progress`, `cad_course_unlocks`. **Integrações:** Astron Academy, Sellflux, PandaVideo.

---

# 5. Módulo: Ferramentas & Mídia

## 5.1 Ferramentas

**1)** Caixa de ferramentas de conteúdo/SEO em lote: exportação de apostilas, enriquecimento SEO, reformatação de HTML por IA, geração de páginas de parâmetros (categoria F) e vínculo vídeo↔produto.
**2)** Painéis compostos: `ApostilaExport`, `AdminArticleEnricher`, `AdminArticleReformatter` (card "Reformatar HTML de Artigos com IA"), `AdminParameterPages`, `AdminVideoProductLinks`.
**3)** Selecionar escopo (categoria/lote) → executar → acompanhar progresso/erros → revisar em Artigos.
**4)** **Edge functions:** `generate-parameter-pages`, `reformat-article-html`, `enrich-article-seo`, `sync-pandavideo`. **Tabelas:** `knowledge_contents`, `parameter_sets`, `parameter_views`, `knowledge_videos`, `models`. **Integrações:** AI Gateway, PandaVideo.

## 5.2 PandaVideo

**1)** Diagnóstico e sincronização da videoteca PandaVideo: metadados, pastas, métricas de audiência e vínculo com produtos/artigos.
**2)** `AdminPandaVideoSync` (sincronizar), `AdminPandaVideoTest` (console de teste: `videoId`, `startDate`, `endDate`, path livre, detecção de estrutura da resposta), `AdminVideoAnalyticsDashboard`.
**3)** Rodar sync → testar endpoint específico se houver divergência → analisar métricas → vincular vídeo a produto/artigo.
**4)** **Edge functions:** `sync-pandavideo`, `pandavideo-test`. **Tabelas:** `knowledge_videos`, `knowledge_video_metrics_log`, `pandavideo_folders`. **Integração:** PandaVideo API; saída secundária = video sitemap (`api/video-sitemap.ts`).

---

# 6. Módulo: Administração & Sistema

## 6.1 Estatísticas

**1)** Painel de estatísticas do catálogo/parâmetros e da Dra. LIA (uso, RAG, cobertura) — visão de saúde de conteúdo e do agente.
**2)** `AdminStats` (cards + distribuição por marca via `DataContext`) e `AdminDraLIAStats` (RPC `get_rag_stats`).
**3)** Abrir a seção → ler cards → agir nas lacunas (conteúdo faltante, gaps de conhecimento).
**4)** **Tabelas:** `models`, `brands`, `parameter_sets`, `knowledge_contents`, `agent_embeddings`, `agent_knowledge_gaps`, `agent_interactions`.

## 6.2 Usuários

**1)** Gestão de contas de acesso ao admin e seus papéis (admin, author, user, distribuidor) — controle de superfície administrativa.
**2)** Botão de adicionar usuário (e-mail/senha/papel), modal de edição, exclusão com `AlertDialog`, badges de papel.
**3)** Adicionar usuário → definir papel → validar acesso (sidebar filtra por papel) → revogar quando necessário.
**4)** **Processamento:** edge `create-user` (usa service role no servidor). **Tabelas:** `user_roles` (papéis **nunca** em `profiles`), `auth.users` (gerida pelo Supabase), função `has_role(uuid, app_role)` SECURITY DEFINER usada nas RLS.
> ⚠️ Pendência técnica: a listagem em `AdminUsers.tsx` ainda usa dados mock (`mockUsers`) — a leitura real de `auth.users`/`user_roles` deve ser feita por edge function com service role.

## 6.3 Configurações

**1)** Configuração central do sistema: marcas, modelos, resinas, conjuntos de parâmetros, editor do KB Hub, auditoria SEO, import/export de dados e rotinas de manutenção.
**2)** `AdminModal` genérico (brand/model/resin/parameter), `AdminKbHubEditor`, `SEOAuditPanel`, `DataExport`, `DataImport`, `useAdminMaintenance`, `AdminParameterPages` embutido.
**3)** Escolher entidade → CRUD via modal → rodar auditoria SEO → exportar/importar CSV → executar manutenção (sync KB, reviews, export).
**4)** **Edge functions:** `sync-knowledge-base`, `sync-google-reviews`, `data-export`. **Tabelas:** `brands`, `models`, `resins`, `parameter_sets`, `site_settings`, `operational_settings`, `export_jobs`, `google_reviews`. **Integrações:** Google Business/Places, Sistema A.

---

# 7. Módulo: Social Publisher (`/social`)

Shell: `SocialLayout` + `SocialSidebar`; rotas em `src/App.tsx:82-97`. Publicação, DMs, métricas e contatos são intermediados pela **Zernio** (broker de Instagram/Facebook/TikTok/YouTube/Pinterest); grupos de WhatsApp via **EvolutionGO**; reputação via **Google**.

## 7.1 Dashboard
**1)** Visão geral: métricas do período e fila dos próximos 7 dias.
**2)** Botões **Sincronizar** e **Criar Post**; 4 `MetricCard`; lista de posts futuros com editar e **Reenfileirar** (retry).
**3)** Sincronizar → checar métricas → corrigir posts com falha → criar novo post.
**4)** Hooks `useSocialMetrics`, `useUpcomingPosts`, `useZernioSync`, `useRetryPublish`; tabelas `social_scheduled_posts`, `social_posts`; edge `social-posts-sync`.

## 7.2 Criar Post
**1)** Wizard de 5 passos (Conteúdo, Mídia, Canais, Agendamento, Revisão) para compor e agendar publicações multicanal; importa carrossel do Sistema A por query param.
**2)** `StepContent`/`StepMedia`/`StepChannels`/`StepSchedule`/`StepReview`, `SocialPostPreview`, `MediaCropDialog`, `MultiUploadChoiceDialog`, `SystemACarouselPicker`, `ChannelRequirementsPanel`, `MediaCompatibilityPanel`; upload **sem limite de tamanho**.
**3)** Escrever/gerar legenda por IA → subir mídia e cortar por formato → escolher canais (regras de compatibilidade) → agendar → revisar → salvar.
**4)** Tabelas `social_scheduled_posts`; Storage `wa-media`; edges `social-caption-generator`, `social-knowledge-fetch`, `social-generate-image`; integrações: AI Gateway + Zernio (publicação).

## 7.3 Calendário
**1)** Calendário mensal de posts agendados/publicados com reagendamento por drag-and-drop.
**2)** Navegação de mês, `CalendarFilters` (plataforma/status), `CalendarDayCell`, `CalendarPostChip`, `RescheduleDialog`.
**3)** Arrastar o chip para o novo dia → confirmar no diálogo → data atualizada.
**4)** Hooks `useCalendarPosts`, `useReschedulePost`; tabelas `social_scheduled_posts`, `social_posts`.

## 7.4 Banco de Posts
**1)** Acervo dos posts publicados sincronizados, reutilizável para campanhas e grupos de WhatsApp.
**2)** Chips de plataforma, busca textual, filtros de formato/período/ordenação, botão **Sincronizar**, grid `SocialPostCard`.
**3)** Sincronizar → filtrar → reutilizar post (broadcast histórico ou Post Grupos).
**4)** Hook `useSocialPostsBank`; tabela `social_posts`; edge `social-posts-sync`; integração Zernio.

## 7.5 Analytics
**1)** Desempenho de conteúdo: engajamento, alcance, impressões e views, com melhor horário e top 10.
**2)** Seletor de período (7/30/90), filtro de plataforma, **Sync**, **CSV**; gráficos `recharts` (linha, barra por plataforma, heatmap hora×dia), tabela top 10.
**3)** Escolher período → sincronizar métricas → ler heatmap → exportar CSV.
**4)** Hooks `useSocialAnalytics`, `useResyncMetrics`; tabela `social_posts`; edge `zernio-metrics-sync`.

## 7.6 Flows IG DM
**1)** Automações comentário→DM no Instagram (palavra-chave dispara entrega de link/mídia) — captura de lead direto da rede social.
**2)** Lista com criar/duplicar/editar/excluir e `Switch` de ativação; editor com configuração de trigger, `LinkPicker`/`SocialPostLinkPicker`, `ImageLibraryDialog`, `ZernioStatsButton` (triggers/DMs/contatos únicos); tela de **Sessões**.
**3)** Criar fluxo → definir palavra-chave e post-alvo → montar mensagem/link → ativar → provisionar automação Zernio → monitorar sessões e stats.
**4)** Tabelas `social_flows`, `social_triggers`, `social_flow_midias`, `social_flow_links_manuais`, view `v_flow_link_picker`, `social_sessions`; edge `zernio-copa-setup`; integrações Zernio ("Copa") + Instagram.
> Requisito: fluxos comentário→DM exigem ID de automação Zernio provisionado.

## 7.7 Broadcasts
**1)** Disparo pontual de DM no Instagram para um segmento de contatos.
**2)** Diálogo multi-etapa (nome → conta/mensagem com `EmojiPicker` → filtros de audiência `onlyFollowers`/`onlySubscribed`/tags → seleção de contatos → agendamento) e **Disparar**; `HistoricalPostBroadcast` para reenviar post antigo.
**3)** Sincronizar contatos → criar broadcast → filtrar audiência → agendar/disparar → conferir status.
**4)** Tabelas `social_zernio_accounts`, `social_contacts`, `social_broadcasts`; edges `zernio-contacts-sync`, `zernio-broadcast-dispatch`.

## 7.8 Sequências
**1)** Réguas de nutrição em múltiplos passos (mensagem, link IG, link YouTube, promo_seq) com delays entre etapas.
**2)** Lista com `Switch` ativo, duplicar e excluir (`AlertDialog`); editor com construtor de passos, `SocialPostLinkPicker`, `PromoSeqInspector` (compartilhado com WA Grupos), prévia de contagem de contatos.
**3)** Nova sequência → adicionar passos e delays → escolher audiência → ativar.
**4)** Tabelas `social_sequences`, `social_contacts`; ponte com as sequências promocionais de WhatsApp (`components/smartops/wa-groups`).

## 7.9 Contatos
**1)** Base unificada de contatos sociais (IG/FB/WhatsApp/TikTok) sincronizada da Zernio — audiência dos broadcasts e sequências.
**2)** Busca (`ig_username`, `ig_user_id`, `custom_fields->>platformIdentifier`), filtro de plataforma, **Sincronizar**, copiar ID, badges por canal.
**3)** Sincronizar → filtrar canal → localizar contato → usar em broadcast/sequência.
**4)** Tabela `social_contacts`; edge `zernio-contacts-sync`.

## 7.10 Avaliações
**1)** Reputação Google: avaliações públicas (Places) e respostas automáticas geradas por IA (Business Profile, sob OAuth).
**2)** Botão **Sincronizar agora**, cards (Total / Média / Última sincronização), alternador de idioma (pt/en/es), badge de conexão (Conectado / Token expirado / Desconectado), botões **Conectar/Reconectar Google Business Profile**, tabela de respostas com status (Publicado/Gerando/Erro).
**3)** Conectar OAuth → sincronizar → revisar avaliações → publicar resposta gerada.
**4)** Hooks `useGoogleConnection`, `useGoogleReviews`, `usePlacesReputation`; tabelas `google_reviews`, `google_oauth_tokens`; edges `sync-google-reviews`, `google-oauth-callback`; integrações Google Places + Business Profile + AI Gateway.

## 7.11 Post Grupos
**1)** Distribuição automática de todo post novo para grupos de WhatsApp, por instância EvolutionGO — amplia alcance orgânico sem trabalho manual.
**2)** Abas **Instâncias** e **Histórico de disparos**; cards de resumo (membros impactados / grupos selecionados); card por instância com toggle de ativação, flag de primária, `PostGruposAddModal` (adicionar grupos), remoção de alvo; tabela de fingerprints enviados.
**3)** Ativar a instância → adicionar grupos-alvo → novos posts sincronizados são disparados automaticamente → auditar no histórico (dedupe por fingerprint e cooldown).
**4)** Tabelas `team_members` (`evolution_instance_name`, `evolution_phone`), `post_group_instance_config`, `post_group_targets`, view `v_post_group_targets_detail`, `wa_groups`, `wa_group_sent_fingerprints`; RPCs `fn_check_group_global_dedup`, `fn_check_group_send_cooldown`, `claim_pending_social_posts`; disparo por cron server-side; integração EvolutionGO.

---

# 8. Mapa de dependências entre módulos

| Origem | Destino | Ponto de integração |
|---|---|---|
| Formulários / Origens | Público-Lista (CDP) | `smart-ops-ingest-lead` → `smart-ops-lia-assign` (Golden Rule) |
| Público-Lista | Campanhas / Sequências | segmentos sobre leads canônicos (`merged_into IS NULL`) |
| Mapeamento 7×3 | Reativação & Campanhas | `lead_opportunities` + `opportunity_rules` |
| Catálogo (Produtos) | Distribuição / Propostas / RAG | `system_a_catalog` + `catalog_product_variations` + SKU resolver |
| Artigos / Knowledge Hub | Dra. LIA & Copilot | `agent_embeddings` + tools RAG read-only |
| Tokens IA | AI Routing | custo por `task_type` orienta escolha de modelo |
| Equipe | Automações / WhatsApp / Distribuição de leads | credenciais por instância + `piperun_owner_id` |
| PipeRun webhook | Relatórios / Bowtie / Painel TV | `deals`, `piperun_stage_transitions`, `painel_comercial_cache` |
| Treinamentos | NPS / Público-Lista | `smartops_nps_responses` → nota no CRM + badge no card |
| Banco de Posts | Post Grupos / Broadcasts | `social_posts` → `post_group_targets` / `social_broadcasts` |
| Stripe | Público-Lista / Cursos | `stripe_payment_units` → ativação e `lead_activity_log` |

# 9. Pendências e riscos identificados

1. **Usuários** — listagem mock; expor via edge function com service role (P1 segurança/operação).
2. `lia_attendances` com 610 colunas — normalização progressiva recomendada (ver cap. 16).
3. Post Grupos não tem chamada de disparo no frontend: a execução é cron/server-side; monitorar em Saúde do Sistema.
4. Documentos de resina × catálogo permanecem separados por decisão arquitetural — não unificar.
5. Cobertura histórica de atividades/propostas do CRM depende de backfills; validar antes de fechar indicadores retroativos.
