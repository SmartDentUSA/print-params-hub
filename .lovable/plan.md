

# Plano: Documentação Completa do Smart Ops — Centro de Operações

## Formato de Entrega
Documento DOCX profissional com ~40 páginas cobrindo todas as 14 abas do Smart Ops, integrações CRM, edge functions e fluxos de automação.

## Estrutura do Documento

### 1. Capa e Sumário
- Título: "Smart Ops — Centro de Operações: Documentação Técnica e Operacional"
- Versão, data, índice

### 2. Visão Geral da Arquitetura
- Diagrama do fluxo de dados (Lead Ingestion → CRM → Automações → WhatsApp)
- Tabela principal: `lia_attendances` como hub central do CDP
- Integrações: PipeRun, SellFlux, WaLeads/Evolution, Meta Ads, Loja Integrada, Astron

### 3. Documentação por Aba (14 abas)

**3.1 Bowtie (Funil Bowtie)**
- Métricas: MQL, SQL, Vendas, CS Contratos/Onboarding/Ongoing
- Faixas de pipeline: Contato Realizado → Em Contato → Negociação → Fechamento
- Gauge de saúde do pipeline (meta vs realizado)
- Metas configuráveis via `admin_settings`
- Navegação por mês com comparativo

**3.2 Público / Lista (Leads)**
- Lista paginada (200/página) com filtros: Pipeline (Vendas, Estagnados, CS, Insumos, E-commerce, Ebook), Temperatura, Urgência, Oportunidade, Estágio (MQL/SAL/SQL/Cliente), Buyer Type
- Busca por nome/email/telefone
- Card de detalhe do lead (LeadDetailPanel — 1836 linhas):
  - Hero card com dados do lead, badges de consolidação
  - Resumo financeiro (CRM Won + LTV E-commerce)
  - Análise cognitiva IA (4 eixos do Intelligence Score)
  - Timeline unificada (10 fontes de dados)
  - Tabela de deals PipeRun com itens de proposta
  - Chamados técnicos de suporte
  - Oportunidades de upsell/cross-sell detectadas por IA
  - Workflow Portfolio 7x3
- Importador de leads CSV

**3.3 Equipe**
- CRUD de membros da equipe (vendedor, CS, suporte)
- Campos: nome, email, WhatsApp, PipeRun Owner ID, ManyChat API Key, WaLeads API Key
- Toggle ativo/inativo
- Teste de envio WaLeads por membro
- Sub-componente: Performance por Vendedor (SmartOpsSellerAutomations)
  - Ranking por taxa de conversão
  - Leads, Ganhos, % Conversão por vendedor
  - Distribuição por status

**3.4 Automações (Réguas)**
- Regras de automação por evento trigger: Novo Lead, Ganho, Estagnado, Perdido
- Filtro por produto de interesse
- Delay em dias
- Suporte a ManyChat e WaLeads
- Tipos WaLeads: Texto, Imagem, Áudio, Vídeo, Documento
- Variáveis dinâmicas nas mensagens (WaLeadsVariableBar)
- Preview de mídia (WaLeadsMediaPreview)
- Organização por seção: Vendedores, CS, Suporte

**3.5 Logs**
- Log de Mensagens: envios WaLeads/SellFlux com status (enviado/erro)
- Log de Chegada (Realtime): monitor em tempo real de eventos de entrada/saída
  - Fontes: PipeRun, SellFlux, WaLeads, E-commerce, Meta Ads, Astron, Formulários
  - Resolução de lead_id para nome real

**3.6 Relatórios**
- Base instalada de clientes (com data_contrato)
- Ativos monitorados: Scan, Notebook, CAD, CAD IA, Smart Slice, Print, Cura, Insumos
- Detecção de churn potencial (sem compra de insumos há 90 dias)
- Gap de ativos (clientes com 1-3 ativos de 8 possíveis)
- Exportação CSV com dados da Dra. L.I.A.

**3.7 Conteúdo**
- Fila de produção de conteúdo (content_requests)
- Status: Solicitado → Em Produção → Publicado / Descartado
- Tipos: artigo, FAQ, vídeo, landing page
- Priorização automática por frequência de demanda
- Vinculação com sessões de leads e produtos
- Geração de drafts via IA

**3.8 Saúde do Sistema**
- Dashboard de monitoramento: erros 24h, críticos, warnings, não resolvidos
- Logs de `system_health_logs` (últimos 7 dias)
- Severidade: critical, error, warning, info
- Análise IA automática + ação sugerida
- Auto-remediação
- Botão "Executar Watchdog" (system-watchdog-deepseek)

**3.9 WhatsApp Inbox**
- Interface de conversas tipo chat
- Lista de conversas por telefone normalizado
- Mensagens com direção (entrada/saída), intent detectado, confidence score
- Seleção de membro da equipe para envio
- Resposta direta via smart-ops-send-waleads
- Busca por nome/telefone
- Realtime via Supabase

**3.10 Formulários**
- Builder de formulários públicos (smartops_forms)
- Propósitos: NPS, SDR, ROI, CS, Captação, Evento, SDR Captação, CM/CS/ST Update
- Editor de campos (SmartOpsFormEditor)
- Editor SDR Captação (SmartOpsSdrCaptacaoEditor)
- Campos: hero_image, campaign_identifier, product_catalog_id
- URL pública: `/formulario/{slug}`
- Duplicação, ativação/desativação
- Contagem de submissões

**3.11 Tokens IA**
- Dashboard de consumo de IA por função
- 20+ funções monitoradas (Dra. LIA, Judge, Formatador, SEO, etc.)
- Métricas: tokens de entrada/saída, custo estimado
- Gráficos: barras por função, linha temporal
- Filtros por período e provider (Lovable/Gemini, DeepSeek, Google Embed)

**3.12 Intelligence**
- Intelligence Score (4 eixos): Sales Heat, Technical Maturity, Behavioral Engagement, Purchase Power
- Top leads por score
- Distribuição por estágio (MQL/SAL/SQL/Cliente) — gráfico pizza
- Eventos recentes de transição (lead_state_events)
- Detecção de regressões
- Métricas: tempo médio MQL→SQL, taxa de regressão
- Backfill de scores

**3.13 ROI (Smart Flow)**
- Gerenciador de Cards ROI publicados
- Cards exibidos na calculadora pública `/calculadora-roi`
- Admin: criar/editar/publicar cards (SmartOpsROICardsManager)

**3.14 Copilot IA**
- Chat em linguagem natural com o sistema
- Modelos: DeepSeek, Gemini
- Entrada por texto ou voz (Web Speech API)
- Sugestões pré-definidas
- Upload de arquivos
- Histórico persistido em localStorage
- Realtime: notificação de novos leads
- Ações: filtrar leads, criar públicos, disparar campanhas SellFlux, consultar APIs, gerar relatórios

### 4. Edge Functions — Catálogo Completo
Tabela com todas as 25+ edge functions do Smart Ops:
- `smart-ops-ingest-lead`: Gateway de ingestão
- `smart-ops-lia-assign`: Atribuição CRM + saudação IA
- `smart-ops-sync-piperun`: Sync bidirecional com PipeRun (chunks de 500)
- `smart-ops-send-waleads`: Gateway de envio WhatsApp
- `smart-ops-wa-inbox-webhook`: Receptor de mensagens WhatsApp
- `smart-ops-sellflux-webhook`: Receptor SellFlux
- `smart-ops-sellflux-sync`: Push para SellFlux
- `smart-ops-piperun-webhook`: Receptor PipeRun
- `smart-ops-meta-lead-webhook`: Receptor Meta Ads
- `smart-ops-ecommerce-webhook`: Receptor E-commerce
- `smart-ops-kanban-move`: Movimentação de etapa
- `smart-ops-leads-api`: API de leads
- `smart-ops-copilot`: Backend do Copilot IA
- `smart-ops-cs-processor`: Processador CS
- `smart-ops-stagnant-processor`: Processador de estagnados
- `smart-ops-meta-ads-insights`: Insights Meta Ads
- `smart-ops-meta-ads-manager`: Gerenciador Meta Ads
- `smart-ops-proactive-outreach`: Outreach proativo automático
- `create-technical-ticket`: Criação de chamados técnicos
- `cognitive-lead-analysis`: Análise cognitiva IA
- `backfill-intelligence-score`: Backfill de scores
- `system-watchdog-deepseek`: Watchdog com IA

### 5. Fluxos de Dados Principais
- Lead Lifecycle: Ingestion → Dedup → CRM Sync → Atribuição → Saudação → Follow-up
- Proactive Outreach: 4 regras (acompanhamento, reengajamento, primeira dúvida, recuperação)
- Merge de Leads: deduplicação por pessoa_piperun_id, email, telefone

### 6. Tabelas do Banco de Dados
Lista das tabelas principais envolvidas: `lia_attendances`, `team_members`, `cs_automation_rules`, `message_logs`, `system_health_logs`, `lead_state_events`, `smartops_forms`, `smartops_form_fields`, `smartops_form_field_responses`, `content_requests`, `roi_cards`, `whatsapp_inbox`, `activity_log`, `ai_usage_logs`, `support_tickets`

## Implementação
- Gerar DOCX via `docx-js` com formatação profissional
- Seções com headings, tabelas de referência, badges de status
- ~3000 palavras, foco operacional e técnico
- Salvar em `/mnt/documents/SmartOps_Documentacao_Completa.docx`

