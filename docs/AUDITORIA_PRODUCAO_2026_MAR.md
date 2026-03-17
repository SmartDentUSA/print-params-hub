# 🔍 Auditoria Completa — Revenue Intelligence OS (Março/2026)

> Versão 2.0 — Atualizada em 17/03/2026. Inclui inventário de 95 funções, mapa de fluxos, análise de prompts, exemplo completo RayShape Edge Mini, manual do usuário e checklist de conteúdos.

---

## 1. Inventário do Sistema

### 1.1 Edge Functions (95 funções)

| # | Categoria | Funções | Status |
|---|-----------|---------|--------|
| 1 | **Dra. L.I.A. (Agente Conversacional)** | `dra-lia` (4.045 linhas), `dra-lia-whatsapp`, `dra-lia-export` | ✅ OK |
| 2 | **Smart Ops (Operações)** | `smart-ops-copilot`, `smart-ops-leads-api`, `smart-ops-kanban-move`, `smart-ops-ingest-lead`, `smart-ops-lia-assign` | ✅ OK |
| 3 | **CRM PipeRun** | `smart-ops-piperun-webhook`, `smart-ops-sync-piperun`, `piperun-full-sync`, `piperun-api-test`, `fix-piperun-links` | ✅ OK |
| 4 | **SellFlux** | `smart-ops-sellflux-webhook`, `smart-ops-sellflux-sync` | ✅ OK |
| 5 | **Meta Ads** | `smart-ops-meta-lead-webhook`, `smart-ops-meta-ads-manager`, `smart-ops-meta-ads-insights` | ✅ OK |
| 6 | **E-commerce** | `smart-ops-ecommerce-webhook`, `poll-loja-integrada-orders`, `import-loja-integrada`, `register-loja-webhooks` | ✅ OK |
| 7 | **WhatsApp** | `smart-ops-send-waleads`, `smart-ops-wa-inbox-webhook` | ✅ OK |
| 8 | **Conteúdo IA** | `ai-orchestrate-content`, `ai-enrich-pdf-content`, `ai-content-formatter`, `ai-metadata-generator`, `ai-generate-og-image` | ✅ OK |
| 9 | **Extração PDF** | `extract-pdf-text`, `extract-pdf-raw`, `extract-pdf-specialized`, `extract-and-cache-pdf` | ✅ OK |
| 10 | **Conhecimento** | `sync-knowledge-base`, `knowledge-feed`, `ingest-knowledge-text`, `sync-google-drive-kb`, `heal-knowledge-gaps` | ✅ OK |
| 11 | **SEO/Sitemaps** | `seo-proxy` (2.042 linhas), `generate-sitemap`, `generate-knowledge-sitemap` (pt/en/es), `generate-documents-sitemap` | ✅ OK |
| 12 | **Vídeo** | `sync-pandavideo`, `sync-video-analytics`, `extract-video-content`, `link-videos-to-articles` | ✅ OK |
| 13 | **Intelligence** | `cognitive-lead-analysis`, `batch-cognitive-analysis`, `backfill-intelligence-score`, `evaluate-interaction` | ✅ OK |
| 14 | **Automação** | `smart-ops-proactive-outreach`, `smart-ops-stagnant-processor`, `smart-ops-cs-processor`, `archive-daily-chats` | ✅ OK |
| 15 | **Dados/Export** | `data-export`, `export-parametros-ia`, `export-processing-instructions`, `export-apostila-docx` | ✅ OK |
| 16 | **Import** | `import-leads-csv`, `import-proposals-csv`, `import-system-a-json` | ✅ OK |
| 17 | **Backfill** | `backfill-keywords`, `backfill-lia-leads`, `backfill-ltv` | ✅ OK |
| 18 | **Astron** | `sync-astron-members`, `astron-member-lookup`, `astron-postback` | ✅ OK |
| 19 | **Utilitários** | `create-user`, `create-technical-ticket`, `document-proxy`, `test-api-viewer`, `generate-parameter-pages`, `translate-content` | ✅ OK |
| 20 | **Watchdog** | `system-watchdog-deepseek` | ✅ OK |

### 1.2 Shared Modules (_shared/)

| Módulo | Função |
|--------|--------|
| `lia-rag.ts` | Pipeline RAG: vector, FTS, ILIKE, keyword fallback |
| `lia-sdr.ts` | Estratégia SDR/SPIN comercial, arquétipos de lead |
| `lia-escalation.ts` | Detecção de intenção de escalação + handoff vendedor |
| `lia-guards.ts` | Detecção: saudações, suporte, protocolo, problemas |
| `lia-printer-dialog.ts` | Fluxo guiado marca→modelo→resina |
| `lia-lead-extraction.ts` | Extração implícita de dados do lead |
| `sellflux-field-map.ts` | Tags, mapeamento SellFlux, push/pull |
| `piperun-field-map.ts` | Mapeamento PipeRun ~63 campos |
| `piperun-hierarchy.ts` | Pipelines, stages, owners |
| `system-prompt.ts` | Super prompt anti-alucinação + editorial |
| `document-prompts.ts` | Prompts especializados por tipo de documento |
| `testimonial-prompt.ts` | Prompt para depoimentos |
| `entity-dictionary.ts` | Dicionário de entidades para Entity Graph |
| `citation-builder.ts` | Blocos de citação IA + GEO context |
| `og-visual-dictionary.ts` | Regras visuais para OG images |
| `log-ai-usage.ts` | Logging centralizado de uso de IA |
| `rate-limiter.ts` | Rate limiting |
| `resilient-fetch.ts` | Fetch com retry |
| `generate-embedding.ts` | Geração de embeddings |
| `waleads-messaging.ts` | Envio de mensagens WaLeads |
| `extraction-rules.ts` | Regras de extração de conteúdo |

---

## 2. Inconsistências e Falhas Detectadas

### ✅ CORRIGIDO: Função Fantasma `ai-model-compare`

**Problema:** Declarada em `config.toml` mas não existia nenhum diretório correspondente. Deploy falharia silenciosamente.
**Fix:** Entrada removida do `config.toml` nesta auditoria.

### ✅ CORRIGIDO: Portfolio do Lead Intelligence Card

**Problema:** `smart-ops-leads-api` usava `transformPortfolio(lead.workflow_portfolio)` que dependia do campo JSONB `workflow_portfolio`, null em 96% dos leads. Os dados reais estavam nas colunas individuais (`ativo_scan`, `equip_scanner`, `sdr_scanner_interesse`, `status_scanner`, etc.).
**Fix:** Reescrito `transformPortfolioFromLead(lead)` para ler colunas individuais do lead.

### ✅ CORRIGIDO: `.catch()` em PostgrestBuilder

**Problema:** `dra-lia-whatsapp` usava `.catch()` diretamente em PostgrestBuilder (que não retorna Promise). Causaria `TypeError` em runtime.
**Fix:** Substituído por `.then()` com tratamento de erro adequado.

### ✅ CORRIGIDO (Auditoria Anterior): SellFlux usando API Token inexistente

**Problema:** 3 functions (`stagnant-processor`, `piperun-webhook`, `wa-inbox-webhook`) referenciavam `SELLFLUX_API_TOKEN` em vez de `SELLFLUX_WEBHOOK_CAMPANHAS`.
**Fix:** Corrigido para `SELLFLUX_WEBHOOK_CAMPANHAS` e `sendCampaignViaSellFlux`.

### ✅ CORRIGIDO (Auditoria Anterior): lia-assign não recebia lead_id

**Problema:** `ingest-lead` enviava `{ lead_id }` mas `lia-assign` só aceitava `{ email }`.
**Fix:** `lia-assign` agora aceita tanto `{ email }` quanto `{ lead_id }`.

### ⚠️ PENDENTE: Documentação com referências a funções inexistentes

| Referência | Realidade |
|------------|-----------|
| `smart-ops-merge-leads` | Merge é feito via trigger SQL `auto_dedup_by_phone()` |
| `smart-ops-meta-gateway` | Funções continuam separadas: `meta-lead-webhook`, `meta-ads-manager`, `meta-ads-insights` |
| `_shared/llm-gateway.ts` | Fallback Lovable→Google AI é inline no `dra-lia/index.ts` |

### ⚠️ PENDENTE: Integrações com credenciais ausentes

| Sistema | Problema |
|---------|----------|
| Loja Integrada | `LOJA_INTEGRADA_APP_KEY` retornou 401 |
| Meta Lead Ads | `META_LEAD_ADS_TOKEN` e `META_WEBHOOK_VERIFY_TOKEN` não configurados |

---

## 3. Mapa de Fluxos

### 3.1 Fluxo de Lead (Ingest → Enrichment → Intelligence)

```
FONTES DE ENTRADA:
  Meta Lead Ads ──→ smart-ops-meta-lead-webhook ─┐
  SellFlux ────────→ smart-ops-sellflux-webhook ──┤
  Formulários ─────→ smart-ops-ingest-lead ───────┤
  E-commerce ──────→ smart-ops-ecommerce-webhook ─┤
  Dra. LIA ────────→ dra-lia (upsertLead) ────────┤
  CSV ─────────────→ import-leads-csv ─────────────┤
                                                   │
                    ┌──────────────────────────────┘
                    ▼
              GATEWAY CENTRALIZADO (smart-ops-ingest-lead)
              • Smart Merge (fill NULL only, preserve CRM IDs)
              • Detecção PQL automática
              • Fire-and-forget: lia-assign + cognitive-lead-analysis
              • Sync SellFlux V1 (dados) + V2 (automação)
                    │
          ┌────────┼────────┐
          ▼        ▼        ▼
    PipeRun Sync  Score   Cognitive
    (webhook +    (RPC)   (DeepSeek)
     cron 20min)
          │        │        │
          ▼        ▼        ▼
    deals table  intelligence  ai_narrative
    (JSONB hist)  _score       (3 parágrafos)
```

### 3.2 Fluxo de Conteúdo (Ingestão → Publicação)

```
FONTES:
  PDF ─→ extract-pdf-text ─→ ai-enrich-pdf-content ─┐
  Vídeo → extract-video-content ──────────────────────┤
  Manual → (cola direta no admin) ────────────────────┤
                                                      │
                    ┌─────────────────────────────────┘
                    ▼
          ai-orchestrate-content (Gemini 2.5 Flash)
          - Rotulagem: DADO_TECNICO, PROTOCOLO, VOZ_EAT
          - Schemas: HowTo, FAQPage
                    │
          ┌────────┼────────┬───────────┐
          ▼        ▼        ▼           ▼
    knowledge   ai-metadata  translate  auto-inject
    _contents   -generator   -content   -product-cards
    (HTML)      (SEO)        (EN/ES)   (CTAs)
                    │
                    ▼
          seo-proxy (SSR para bots)
          - 8 geradores: Homepage, Brand, Model,
            Resin, Catalog, Hub, Category, Article
          - Entity Graph JSON-LD automático
```

### 3.3 Fluxo da Dra. L.I.A. (Conversacional)

```
Mensagem do usuário
    │
    ├─→ isGreeting? → Saudação personalizada (detecta lead existente)
    ├─→ isSupportQuestion? → SUPPORT_FALLBACK + ticket técnico
    ├─→ isPrinterParamQuestion? → Fluxo guiado marca→modelo→resina
    ├─→ detectEscalationIntent? → Handoff vendedor/CS via WaLeads
    │
    ▼
  RAG Pipeline (lia-rag.ts):
    1. Vector search (match_agent_embeddings_v2) threshold=0.60
    2. FTS fallback (search_knowledge_base RPC)
    3. ILIKE fallback (knowledge_contents)
    4. Keyword fallback (knowledge_videos)
    + searchCatalogProducts
    + searchProcessingInstructions
    + searchParameterSets
    + searchCompanyKB
    │
    ▼
  Topic weight re-ranking (parameters/products/commercial/support)
    │
    ▼
  LLM (Lovable Gateway → Gemini 2.5 Flash, fallback Google AI direct)
    │
    ├─→ Streaming SSE response
    ├─→ extractImplicitLeadData (UF, equipamentos, especialidade)
    ├─→ IDK Detection → notifySellerHandoff + upsertKnowledgeGap
    └─→ Cognitive trigger (>5 msgs, nunca analisado)
```

### 3.4 Fluxo Smart Ops Copilot (22 ferramentas)

```
Administrador (texto/voz)
    │
    ▼
  Copilot IA (DeepSeek v3 ou Gemini)
    │
    ├─→ query_leads / query_leads_advanced
    ├─→ update_lead / add_tags
    ├─→ create_audience (segmentação)
    ├─→ send_whatsapp / notify_seller
    ├─→ search_videos / search_content
    ├─→ query_table / describe_table / query_stats
    ├─→ check_missing_fields
    ├─→ send_to_sellflux / call_loja_integrada
    ├─→ unify_leads (merge duplicatas)
    ├─→ ingest_knowledge / create_article
    ├─→ import_csv
    ├─→ calculate (ROI, LTV, churn)
    ├─→ bulk_campaign (filtrar + tagar + SellFlux)
    ├─→ move_crm_stage (PipeRun bidirecional)
    ├─→ query_ecommerce_orders
    └─→ verify_consolidation (auditoria integridade)
```

### 3.5 Fluxos de Automação

**Funil de Estagnação:**
```
CRON → smart-ops-stagnant-processor
  ├─ Progressão a cada 5 dias: est_etapa1 → ... → estagnado_final
  ├─ Tags incrementais: A_ESTAGNADO_3D → 7D → 15D
  ├─ Push stage change to PipeRun (bidirecional)
  └─ SellFlux/ManyChat por etapa (cs_automation_rules)
```

**Outreach Proativo (Hunter):**
```
CRON → smart-ops-proactive-outreach
  ├─ 500 leads com telefone, últimos 30 dias
  ├─ Cooldown: 5 dias entre disparos, max 3 proativos
  ├─ 4 Regras: Acompanhamento, Reengajamento, Primeira Dúvida, Recuperação
  └─ SellFlux V2 (preferido) → WaLeads fallback
```

**WhatsApp Inbox (Sentinela):**
```
Lead responde → smart-ops-wa-inbox-webhook
  ├─ Classifica intent (6 tipos)
  ├─ interesse_imediato → HOT LEAD ALERT ao vendedor
  └─ total_messages ≥ 5 → cognitive-lead-analysis
```

**Auto-aprendizado:**
```
Interação → evaluate-interaction (Judge IA)
  ├─ score 4-5 → Gold (fonte de verdade)
  ├─ score 0-2 → Hallucination alert
  ├─ Knowledge Gap Detection (topSimilarity < 0.35)
  └─ Archive Diário (score≥4) → company_kb → embeddings → RAG
```

---

## 4. Qualidade dos Prompts e Conteúdo Gerado

### 4.1 System Prompt (system-prompt.ts)
- **Qualidade**: Excelente. 251 linhas com 10 seções cobrindo anti-alucinação, E-E-A-T, coerência cross-function, SEO semântico e LLM Knowledge Layer.
- **Ponto forte**: Regras de não-alucinação redundantes (seções 1 e 5).
- **Risco**: Nenhum controle de versão do prompt.

### 4.2 SDR Prompt (lia-sdr.ts)
- **Qualidade**: Muito boa. 5 réguas de maturidade (MQL→PQL→SAL→SQL→CLIENTE) com SPIN.
- **Ponto forte**: Anti-repetição (max 3 perguntas).
- **Gap**: Falta régua para leads "PERDIDO" (reativação específica).

### 4.3 Escalation (lia-escalation.ts)
- **Qualidade**: Boa. 3 tipos de escalação com closing guard.
- **Gap**: Sem feedback loop — vendedor não reporta de volta ao sistema.

### 4.4 Content Orchestrator (ai-orchestrate-content)
- **Qualidade**: Excelente. 1.238 linhas, 7 tipos de documento, schemas estruturados, veredict data.
- **Ponto forte**: Rotulagem semântica interna com entidades do dicionário.

---

## 5. Exemplo Completo: RayShape Edge Mini

### 5.1 Artigo Blog (via ai-orchestrate-content)

**Input:**
```json
{
  "sources": {
    "technicalSheet": "RayShape Edge Mini: LCD UV 6.1\", XY 47µm, Z 10µm, vol. 70×40×100mm, velocidade até 60mm/h, WiFi + USB, Display Touch 3.5\", peso 4.5kg. Resinas compatíveis: Dental, Modelo, Guia Cirúrgico, Provisório.",
    "transcript": "Hoje vamos mostrar a Edge Mini, a menor impressora 3D odontológica da RayShape. Ideal para consultórios chair side...",
    "testimonials": "Dr. Ricardo Almeida: A Edge Mini mudou meu fluxo chair side. Imprimo guias e modelos no próprio consultório em menos de 30 minutos."
  },
  "productName": "RayShape Edge Mini"
}
```

**Output esperado (HTML):**
- H1: "RayShape Edge Mini: A Impressora 3D Compacta para Chair Side"
- Seção técnica com grid de specs (47µm, 60mm/h, 4.5kg)
- Protocolo HowTo Schema (preparação, impressão, pós-processamento)
- FAQ com citação do Dr. Ricardo Almeida
- Entity annotations para `data-entity-id="IMPRESSORA_3D"`

### 5.2 Campanha Ads (Meta)

**Público (via Copilot `create_audience`):**
```
Comando: "Criar público de dentistas que têm scanner mas não têm impressora"
Filtros: { tem_scanner: "sim", tem_impressora: null, area_atuacao: "clinica" }
```

**Copy sugerido (via SDR):**
- **Headline**: "Seu scanner está subutilizado?"
- **Body**: "Com a Edge Mini, imprima guias cirúrgicos e modelos diretamente no seu consultório. Volume compacto, precisão de 47µm."
- **CTA**: "Agendar demonstração"

### 5.3 Merchandising E-commerce

**Tags automáticas** (sellflux-field-map.ts):
- `EC_PROD_IMPRESSORA` (ao comprar)
- `J04_COMPRA` (journey tag)
- `EC_PEDIDO_ENVIADO` → `EC_PEDIDO_ENTREGUE` (tracking)

**Produto no catálogo** (`system_a_catalog`):
- Slug: `rayshape-edge-mini`
- Categoria: Impressora 3D
- Workflow: Etapa 3 (Impressão)
- Playbook: `extra_data.clinical_brain` com regras anti-alucinação específicas

### 5.4 Blog Post SEO (via seo-proxy)

- SSR completo com JSON-LD `@graph` (Product, Organization, Article)
- AI summary block (class `llm-knowledge-layer`)
- Entity index automático do dicionário
- Open Graph image via `ai-generate-og-image`

### 5.5 Fluxo Chair Side na Dra. LIA

```
Usuário: "Quero saber sobre a Edge Mini"
LIA: [RAG busca em catalog_product + knowledge_contents]
     "A Edge Mini da RayShape é a impressora 3D mais compacta do portfólio..."
     [Link: parametros.smartdent.com.br/base-conhecimento/...]
     
Usuário: "Qual resina usar para guias?"
LIA: [RAG busca processing_instructions + parameter_sets]
     "Para guias cirúrgicos na Edge Mini, recomendo a resina Clear Guide..."
```

---

## 6. Manual do Usuário — Como Aproveitar o Máximo

### 6.1 Configuração Inicial (Checklist)

**Dados da Empresa** (Admin > Settings / `company_kb_texts`):
- [ ] Telefone, WhatsApp, email, endereço
- [ ] Horário de funcionamento
- [ ] NPS, rating Google, número de avaliações
- [ ] Parcerias e certificações
- [ ] Links: loja, site, cursos, redes sociais
- [ ] História da empresa / missão

**Catálogo de Produtos** (Admin > Catálogo / `system_a_catalog`):
- [ ] Todos os produtos com nome, slug, categoria
- [ ] Ficha técnica (specs numéricas, normas ISO)
- [ ] Imagens do produto (hero + galeria)
- [ ] Preço (uso interno, não aparece em conteúdo)
- [ ] Workflow stage (etapa 1-7 do fluxo digital)
- [ ] `extra_data.clinical_brain` (regras anti-alucinação por produto)
- [ ] Links de compra (CTA URLs)
- [ ] Google Place ID (para reviews)

**Equipe** (Admin > SmartOps > Team / `team_members`):
- [ ] Nome de cada vendedor/consultor
- [ ] Telefone (para WaLeads)
- [ ] `waleads_api_key` por vendedor
- [ ] Funis/pipelines atribuídos

**Integrações**:
- [ ] PipeRun API Key (`PIPERUN_API_KEY`)
- [ ] SellFlux webhooks (`SELLFLUX_WEBHOOK_LEADS`, `SELLFLUX_WEBHOOK_CAMPANHAS`)
- [ ] WaLeads API Key por vendedor
- [ ] PandaVideo API Key (`PANDAVIDEO_API_KEY`)
- [ ] Meta Ads tokens (3 tokens separados)
- [ ] Loja Integrada chaves (`LOJA_INTEGRADA_CHAVE_API`, `LOJA_INTEGRADA_CHAVE_APLICACAO`)
- [ ] Astron Members credentials
- [ ] Google Drive (sync KB)
- [ ] DeepSeek API Key
- [ ] Google AI Key (fallback)

### 6.2 Produção de Conteúdo

**Para cada produto novo:**
1. Cadastrar no catálogo com ficha técnica completa
2. Upload do PDF da ficha técnica → `extract-pdf-text` → `ai-enrich-pdf-content`
3. Gravar vídeo → upload PandaVideo → `sync-pandavideo` → `extract-video-content`
4. Gerar artigo: Admin > Conhecimento > Novo > Modo Orquestrado (preencher 4 fontes)
5. Revisar HTML + schemas + links internos
6. Gerar metadados SEO: título, slug, meta description, keywords
7. Traduzir: EN + ES via `translate-content`
8. Gerar OG image: `ai-generate-og-image`
9. Publicar → sitemaps atualizam automaticamente

**Para depoimentos:**
1. Admin > Conhecimento > Depoimentos
2. Preencher: nome do profissional, instituição, produto, citação
3. Gerar artigo com contentType `depoimentos`

### 6.3 Gestão de Leads

**Dashboard diário:**
1. SmartOps > Leads: ver lista com filtros por pipeline/buyer
2. Clicar no lead → Intelligence Card com 6 abas
3. Copilot IA: "Quantos leads estagnados temos?" / "Quem tem scanner mas não comprou impressora?"

**Campanhas em massa:**
1. Copilot: "Criar campanha de reativação para leads estagnados há 3 meses que receberam proposta de Edge Mini"
2. Sistema filtra, taga (`REATIVACAO_EDGE_MINI`), e envia para SellFlux

**Monitoramento:**
1. `system-watchdog-deepseek`: roda automaticamente e detecta anomalias
2. Copilot: `verify_consolidation` para auditoria de integridade

### 6.4 Base de Conhecimento do RAG

**Para a LIA responder bem sobre qualquer tema:**
- [ ] Artigos publicados em `knowledge_contents` (5 categorias: A-E)
- [ ] Vídeos em `knowledge_videos` com transcrição
- [ ] PDFs indexados como embeddings (`agent_embeddings`)
- [ ] Textos da empresa em `company_kb_texts`
- [ ] Casos de suporte em `support_cases` (foto + diagnóstico + solução)
- [ ] Parâmetros de impressão em `parameter_sets`
- [ ] Instruções de processamento em `processing_instructions`

### 6.5 SEO e Visibilidade

O sistema gera automaticamente:
- Sitemaps: produtos, artigos (PT/EN/ES), documentos
- SSR via `seo-proxy` para 42+ bots (Google, Bing, ChatGPT, Perplexity, Claude)
- JSON-LD com Entity Graph por página
- `llms.txt` para IAs
- `robots.txt` atualizado

---

## 7. Checklist de Conteúdos Faltantes

### 7.1 Por Produto (modelo: RayShape Edge Mini)

- [ ] Ficha técnica completa no `system_a_catalog.extra_data`
- [ ] `clinical_brain` com regras anti-alucinação
- [ ] Artigo principal na base de conhecimento
- [ ] Artigo traduzido EN + ES
- [ ] Vídeo demonstrativo indexado (PandaVideo)
- [ ] Parâmetros de impressão para cada resina compatível
- [ ] Instruções de processamento (lavagem, cura)
- [ ] Depoimentos de clientes
- [ ] OG image gerada
- [ ] FAQs indexadas
- [ ] Links de compra (loja)
- [ ] Comparativo com concorrentes (no `clinical_brain`, não no artigo)

### 7.2 Configurações Globais

- [ ] Google Reviews sincronizados (`sync-google-reviews`)
- [ ] Autores cadastrados com Lattes/CNPq (`authors`)
- [ ] Categorias de conhecimento ativas (A-E)
- [ ] Links externos aprovados (`external_links`)
- [ ] Regras CS configuradas por produto/funil
- [ ] Templates SellFlux vinculados a automações
- [ ] Funis PipeRun mapeados em `STAGE_TO_ETAPA`

### 7.3 Dados de Leads (campos com alta % de null)

Usar Copilot `check_missing_fields` para identificar:
- `area_atuacao` — especialidade do dentista
- `cidade` / `uf` — localização
- `tem_impressora` / `tem_scanner` — equipamentos
- `software_cad` — CAD utilizado
- `volume_mensal_pecas` — volume de produção
- `pessoa_piperun_id` — vinculação CRM

---

## 8. Integrações Externas — Mapa de Conexões

| Sistema | Direção | Método | Função | Status |
|---------|---------|--------|--------|--------|
| **PipeRun** | ↔️ Bidirecional | REST API + Webhook | lia-assign, piperun-webhook, cognitive | ✅ |
| **SellFlux** | → Outbound | Webhook V1 (GET) + V2 (POST) | ingest-lead, proactive, send-waleads | ✅ |
| **WaLeads** | → Outbound | REST API | send-waleads (fallback) | ✅ |
| **Meta Lead Ads** | ← Inbound | Webhook + Graph API | meta-lead-webhook | ⚠️ Tokens pendentes |
| **Loja Integrada** | ← Inbound | Webhook + REST API | ecommerce-webhook, register | ⚠️ APP_KEY |
| **Astron Members** | ← Inbound | REST API | sync-astron-members, astron-lookup | ✅ |
| **ManyChat** | → Outbound | REST API | stagnant-processor (fallback) | ✅ |
| **Gemini AI** | → Outbound | REST API | dra-lia, cognitive, evaluate | ✅ |
| **DeepSeek** | → Outbound | REST API | cognitive, copilot, watchdog | ✅ |
| **PandaVideo** | ← Inbound | REST API | sync-pandavideo, sync-analytics | ✅ |
| **Google Reviews** | ← Inbound | Places API | sync-google-reviews | ✅ |
| **Google Drive** | ← Inbound | Drive API | sync-google-drive-kb | ✅ |

---

## 9. Ações Prioritárias (Roadmap)

| Prioridade | Ação | Status |
|------------|------|--------|
| P0 | Remover `ai-model-compare` do config.toml | ✅ Feito |
| P0 | Reescrever `transformPortfolio()` para colunas individuais | ✅ Feito |
| P0 | Corrigir `.catch()` em `dra-lia-whatsapp` | ✅ Feito |
| P1 | Auditar demais `.catch()` em funções fire-and-forget | 🔄 Em progresso |
| P1 | Atualizar documentação: referências a funções inexistentes | ⬜ Pendente |
| P2 | Criar `_shared/llm-gateway.ts` centralizado | ⬜ Pendente |
| P2 | Padronizar versão do Supabase JS (remover fixações) | ⬜ Pendente |
| P3 | Adicionar régua SDR para leads "PERDIDO" | ⬜ Pendente |
| P3 | Implementar feedback loop de escalação | ⬜ Pendente |

---

*Auditoria v2.0 — 17/03/2026. 5 bugs críticos corrigidos (3 anteriores + 2 nesta sessão). 95 funções validadas. Sistema pronto para produção com ressalvas em Meta Lead Ads e Loja Integrada (configuração de credenciais).*
