

# Plano: Gerar Documento de Auditoria Técnica Completa do Sistema

## Objetivo

Criar um arquivo Markdown exaustivo (`docs/AUDITORIA_TECNICA_COMPLETA_V6.md`) documentando absolutamente todos os componentes do Revenue Intelligence OS para auditoria funcional e tecnologica.

## Conteudo do Documento

O documento sera organizado nas seguintes secoes:

### 1. Arquitetura Geral
- Stack tecnologico (React, Vite, Supabase, Deno Edge Functions)
- Tabela principal: `lia_attendances` (428 campos)
- Tabelas auxiliares: `leads`, `agent_interactions`, `lead_activity_log`, `lead_state_events`, `ai_token_usage`, `system_health_logs`, `team_members`, etc.

### 2. Catalogo Completo de Edge Functions (95+ funcoes)
Organizadas por dominio:
- **Lead Lifecycle** (12): `smart-ops-ingest-lead`, `smart-ops-lia-assign`, `cognitive-lead-analysis`, `smart-ops-stagnant-processor`, `smart-ops-kanban-move`, `backfill-*`, etc.
- **CRM PipeRun** (6): `smart-ops-piperun-webhook`, `smart-ops-sync-piperun`, `piperun-full-sync`, `piperun-api-test`, `fix-piperun-links`, `backfill-deals-append`
- **SellFlux** (3): `smart-ops-sellflux-webhook`, `smart-ops-sellflux-sync`, `smart-ops-send-waleads`
- **E-commerce** (5): `smart-ops-ecommerce-webhook`, `poll-loja-integrada-orders`, `sync-loja-integrada-clients`, `register-loja-webhooks`, `import-loja-integrada`
- **Meta Ads** (3): `smart-ops-meta-lead-webhook`, `smart-ops-meta-ads-manager`, `smart-ops-meta-ads-insights`
- **Content Intelligence** (15): `ai-orchestrate-content`, `ai-content-formatter`, `ai-metadata-generator`, `ai-generate-og-image`, `extract-pdf-*`, `extract-video-content`, `reformat-article-html`, `enrich-article-seo`, `translate-content`, etc.
- **Dra. L.I.A.** (4): `dra-lia`, `dra-lia-whatsapp`, `dra-lia-export`, `evaluate-interaction`
- **SEO & Exposicao** (8): `seo-proxy`, `generate-sitemap`, `generate-knowledge-sitemap*`, `generate-documents-sitemap`, `knowledge-feed`, `document-proxy`
- **Copilot** (2): `smart-ops-copilot`, `smart-ops-cs-processor`
- **Dados & Export** (6): `data-export`, `get-product-data`, `export-parametros-ia`, `export-processing-instructions`, `export-apostila-docx`
- **Backfill & Manutencao** (10): `backfill-*`, `system-watchdog-deepseek`, `archive-daily-chats`

### 3. Modulos Compartilhados (_shared/) — 22 Arquivos
Documentacao detalhada de cada modulo com funcoes exportadas:
- `piperun-field-map.ts` (1184 linhas): Mapeamento de pipelines, stages, custom fields, users, deal parsing, rich snapshot builder
- `sellflux-field-map.ts` (514 linhas): Tag migration, webhook helpers, phone formatting
- `system-prompt.ts` (250 linhas): Super prompt anti-alucinacao + regras E-E-A-T + LLM Knowledge Layer
- `document-prompts.ts`: 7 prompts especializados (Perfil Tecnico, FDS, IFU, Laudo, Catalogo, Guia, Certificado)
- `lia-sdr.ts` (236 linhas): SDR consultivo SPIN, arquetipos, maturidade (MQL→SQL)
- `lia-escalation.ts` (219 linhas): Deteccao de intencao de escalacao, CTAs multilingue
- `lia-guards.ts` (220 linhas): Pattern detection (saudacoes, suporte, protocolo, off-topic)
- `lia-rag.ts` (519 linhas): Pipeline RAG com re-ranking por topico, ILIKE fallback
- `lia-printer-dialog.ts`: Fluxo guiado marca→modelo→resina
- `lia-lead-extraction.ts`: Extracao de dados do lead durante conversa
- `lead-enrichment.ts` (221 linhas): Smart merge com prioridade de fonte
- `generate-embedding.ts` (203 linhas): Embeddings Gemini 768d com cache SHA256
- `log-ai-usage.ts`: Tracking de custos por provider
- `waleads-messaging.ts` (388 linhas): Envio WhatsApp + greeting IA
- `citation-builder.ts`, `entity-dictionary.ts`, `extraction-rules.ts`, `og-visual-dictionary.ts`, `rate-limiter.ts`, `resilient-fetch.ts`, `piperun-hierarchy.ts`, `testimonial-prompt.ts`

### 4. Prompts de IA Completos
Transcricao integral de cada prompt utilizado:
- **SYSTEM_SUPER_PROMPT**: Identidade editorial, E-E-A-T, anti-alucinacao, SEO AI-First, LLM Knowledge Layer
- **7 Document Prompts**: Perfil Tecnico, FDS, IFU, Laudo, Catalogo, Guia, Certificado
- **TESTIMONIAL_PROMPT**: Tecnica da Falacia Verdadeira
- **Cognitive Analysis Prompt**: 10 eixos de classificacao DeepSeek
- **SDR Consultivo Prompt**: Instrucoes por etapa SPIN + reguas por maturidade (MQL, PQL, SAL, SQL, CLIENTE)
- **Copilot System Prompt**: Regra absoluta de execucao autonoma

### 5. Copilot IA — 19 Ferramentas (Tool Calling)
Catalogo completo com parametros:
`query_leads`, `update_lead`, `add_tags`, `create_audience`, `send_whatsapp`, `notify_seller`, `search_videos`, `search_content`, `query_table`, `describe_table`, `query_stats`, `check_missing_fields`, `send_to_sellflux`, `call_loja_integrada`, `unify_leads`, `ingest_knowledge`, `create_article`, `import_csv`, `calculate`, `query_leads_advanced`, `bulk_campaign`, `move_crm_stage`, `query_ecommerce_orders`, `verify_consolidation`, `query_deal_history`

### 6. Fluxos de Dados de Leads
Diagrama de cada fluxo de ingestao com campos mapeados:
- **PipeRun → Sistema**: 100+ campos via `mapDealToAttendance()`
- **SellFlux → Sistema**: Tags + custom fields via `migrateLegacyTags()`
- **Sistema → SellFlux**: 25 campos via `buildSellFluxLeadParams()` e `buildSellFluxCampaignPayload()`
- **Sistema → PipeRun**: Custom fields via `mapAttendanceToDealCustomFields()`
- **Meta Ads → Sistema**: Lead Ads webhook
- **Loja Integrada → Sistema**: Pedidos, status, LTV

### 7. Mapeamento Completo de Campos (428 colunas)
Listagem por dominio funcional com tipo e descricao

### 8. Mapeamento de Tags CRM
Tabela completa dos 40+ legacy tags → tags padronizadas + patterns regex

### 9. Hierarquia de Funil e Stages
- PipeRun: 12 pipelines, 50+ stages mapeados
- Lead Status: visitante → lead → MQL → PQL → SAL → SQL → CLIENTE_ativo
- Deal Status: aberta (0), ganha (1), perdida (2)

### 10. Integrações Externas
- **PipeRun**: API v1, bidirectional, custom fields hash mapping
- **SellFlux**: V1 (GET), V2 (POST), Webhook receiver
- **Loja Integrada**: Dual-Auth, polling + webhooks
- **Meta Ads**: Gateway consolidado
- **Astron Academy**: Postback + sync members
- **PandaVideo**: Sync + analytics
- **Google Reviews**: Sync
- **WaLeads**: Messaging API
- **Google AI**: Embeddings (gemini-embedding-001)
- **Lovable AI Gateway**: Gemini 3 Flash + DeepSeek

### 11. Secrets e Configuracao
Lista de todas as env vars necessarias

### 12. Tabelas do Sistema
Catalogo de todas as tabelas com funcao

## Implementacao

Um unico arquivo sera gerado: `docs/AUDITORIA_TECNICA_COMPLETA_V6.md` (~25.000-35.000 caracteres), contendo toda a informacao acima extraida diretamente do codigo-fonte.

## Arquivos Lidos para Construcao

| Modulo | Arquivo |
|--------|---------|
| Shared | Todos os 22 arquivos em `_shared/` |
| Edge Functions | 95+ funcoes catalogadas |
| Tipos | `integrations/supabase/types.ts` |
| Docs existentes | 17 documentos em `docs/` |
| Config | `supabase/config.toml`, `.env`, `vercel.json` |

