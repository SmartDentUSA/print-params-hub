

# Auditoria Avançada Completa — Revenue Intelligence OS

## Objetivo

Criar o documento `docs/AUDITORIA_AVANCADA_COMPLETA.md` (~1200-1500 linhas) com auditoria detalhada de **todos os fluxos do sistema**, mapeando para cada funcionalidade: onde a informação nasce, por onde passa, onde é armazenada, quem a consome (sistema vs usuario), e o desenho completo do fluxo.

## Estrutura do Documento

### Parte 1 — Mapa de Fluxos de Leads (8 fluxos)

Para cada fluxo, documentar: **Trigger → Função → Tabela → Downstream → UI**

1. **Formulario → Ingest → CRM → Cognitive**
   - Trigger: POST `smart-ops-ingest-lead`
   - Smart Merge (telefone → email → insert)
   - → `lia_attendances` (INSERT/UPDATE)
   - → `smart-ops-lia-assign` (PipeRun Person → Company → Deal)
   - → `smart-ops-send-waleads` (alerta vendedor)
   - → `cognitive-lead-analysis` (DeepSeek, 10 eixos)
   - → `intelligence_score` (RPC PostgreSQL)
   - UI: SmartOpsKanban, SmartOpsLeadsList, SmartOpsBowtie

2. **Meta Ads Webhook**
3. **SellFlux Webhook**
4. **E-commerce (Loja Integrada)**
5. **PipeRun Webhook (bidirecional)**
6. **Stagnation Processor (pg_cron)**
7. **Proactive Outreach (pg_cron)**
8. **WhatsApp Inbox → Intent Classification**

### Parte 2 — Mapa de Fluxos de Conteudo (7 fluxos)

1. **PDF → Extração → Orquestração → Publicação**
   - 4 funções de extração (text, raw, specialized, cache)
   - → `ai-orchestrate-content` (Gemini 2.5 Flash, 1238 linhas)
   - → Pós-processamento (reformat, enrich-seo, inject-cards, translate, og-image)
   - → `knowledge_contents` (INSERT/UPDATE)
   - UI: AdminKnowledge

2. **Video → Transcrição → Artigo**
3. **Google Drive KB → Embeddings**
4. **Apostila → Resinas**
5. **Knowledge Gaps → Drafts → Artigos**
6. **Tradução Pipeline (PT → EN/ES)**
7. **SEO Exposure Pipeline (SSR, Sitemaps, RSS)**

### Parte 3 — Mapa de Fluxos da Dra. L.I.A. (4 fluxos)

1. **Widget Web → dra-lia → RAG → Response**
2. **WhatsApp → dra-lia-whatsapp → Adaptador**
3. **Embed iframe → AgentEmbed**
4. **Indexação: index-embeddings (8 fontes)**

### Parte 4 — Mapa de Fluxos Inter-Sistemas (3 inbound + 7 outbound)

### Parte 5 — Inventario de Dados por Tabela
- Para cada tabela: quem escreve, quem le, de onde vem cada campo critico

### Parte 6 — Fluxos do Usuario (Admin)
- Tab por tab: o que o usuario faz, que funções são chamadas, que tabelas são afetadas

### Parte 7 — Diagramas ASCII de Sequencia
- Fluxo completo Lead Ingestion
- Fluxo completo Content Generation
- Fluxo completo Dra. L.I.A. RAG

### Parte 8 — Findings da Auditoria
- Componentes orfaos corrigidos (SmartOpsReports agora montado)
- SmartOpsGoals usado dentro de SmartOpsBowtie (não orfão)
- SmartOpsSellerAutomations usado dentro de SmartOpsTeam (não orfão)
- AdminViewSupabase é alternativa de AdminViewSecure (acessado diretamente, sem auth gate)
- 2 views de admin: Secure (com tabs, auth) e Supabase (scroll, sem tabs)
- Gaps e recomendações

## Arquivo

`docs/AUDITORIA_AVANCADA_COMPLETA.md`

## Fontes

Compilação direta do codigo-fonte auditado: App.tsx, AdminViewSecure.tsx, SmartOpsTab.tsx, todas as 85+ Edge Functions, _shared modules, hooks, e documentação existente.

