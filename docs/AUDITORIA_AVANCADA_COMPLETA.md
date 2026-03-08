# Auditoria Avançada Completa — Revenue Intelligence OS

> **Versão:** 1.0  
> **Data:** 2026-03-08  
> **Escopo:** Mapeamento exaustivo de todos os fluxos de dados, integrações, ferramentas e interações (sistema + usuário)  
> **Fontes:** Código-fonte auditado — 85+ Edge Functions, _shared modules, hooks, componentes React, App.tsx

---

## Índice

1. [Parte 1 — Fluxos de Leads (8 fluxos)](#parte-1--fluxos-de-leads)
2. [Parte 2 — Fluxos de Conteúdo (7 fluxos)](#parte-2--fluxos-de-conteúdo)
3. [Parte 3 — Fluxos da Dra. L.I.A. (4 fluxos)](#parte-3--fluxos-da-dra-lia)
4. [Parte 4 — Fluxos Inter-Sistemas (A ↔ B)](#parte-4--fluxos-inter-sistemas)
5. [Parte 5 — Inventário de Dados por Tabela](#parte-5--inventário-de-dados-por-tabela)
6. [Parte 6 — Fluxos do Usuário (Admin)](#parte-6--fluxos-do-usuário-admin)
7. [Parte 7 — Diagramas de Sequência ASCII](#parte-7--diagramas-de-sequência-ascii)
8. [Parte 8 — Findings da Auditoria](#parte-8--findings-da-auditoria)

---

## Parte 1 — Fluxos de Leads

### Fluxo 1: Formulário → Ingest → CRM → Cognitive

O fluxo principal de captura de leads. Todo lead novo entra por aqui.

```
TRIGGER: POST /functions/v1/smart-ops-ingest-lead
ENTRADA: Payload com email (obrigatório), nome, telefone, UTMs, campos de qualificação
```

**Etapa 1 — Normalização & Validação (`smart-ops-ingest-lead`)**
- `normalizePhone()`: Converte qualquer formato para `+55XXXXXXXXXXX`
- `extractField()`: Busca flexível em payloads com nomes de campos variáveis (TikTok, Meta, SellFlux)
- `detectProductFromFormName()`: Detecta produto de interesse pelo nome do formulário (Vitality, EdgeMini, IoConnect)
- **Filtro de teste**: E-mails `@test.com`, `@example.com` são silenciosamente descartados
- **Tabela afetada**: `lia_attendances`

**Etapa 2 — Smart Merge**
- Busca lead existente por `email` (chave de unicidade)
- Se existir → `smartMerge()`: Preenche APENAS campos NULL. Campos protegidos: `nome`, `email`, `telefone_normalized`, `piperun_id`, `proprietario_lead_crm`, `status_oportunidade`, `lead_stage_detected`, `entrada_sistema`
- UTMs sempre sobrescritos (última campanha vence)
- Histórico de submissões acumulado em `raw_payload.form_submissions[]`
- Se não existir → INSERT com `lead_status: "novo"`

**Etapa 3 — Intelligence Score (RPC PostgreSQL)**
- Fire-and-forget: `supabase.rpc("calculate_lead_intelligence_score", { p_lead_id })`
- 4 eixos: `sales_heat` (0.35), `behavioral_engagement` (0.25), `technical_maturity` (0.20), `purchase_power` (0.20)
- Guard: Não recalcula em < 60 segundos
- Resultado: Campos `intelligence_score` (JSONB), `intelligence_score_total` (numeric)

**Etapa 4 — Downstream Orquestração (fire-and-forget)**

| Função chamada | Propósito | Modelo IA |
|---|---|---|
| `smart-ops-lia-assign` | CRM sync + seller routing | DeepSeek Chat + Gemini Flash Lite |
| `cognitive-lead-analysis` | Análise psicológica 10 eixos | DeepSeek Chat |
| SellFlux Campanhas webhook | Cria/atualiza contato + automação | — |
| SellFlux Leads webhook | Atualiza dados do contato | — |

**Etapa 5 — LIA Assign (`smart-ops-lia-assign`, 1196 linhas)**

Hierarquia PipeRun completa:
1. `findPersonByEmail()` → Busca Pessoa no PipeRun
2. `createPerson()` ou `updatePersonFields()` → Cria/atualiza com custom fields (Área Atuação, Especialidade)
3. `findOrCreateCompany()` → Se pessoa já tem empresa → enriquece. Senão → cria e vincula
4. `fetchCompanyData()` → CNPJ, segmento, website → salva em `lia_attendances`
5. `findPersonDeals()` → Busca todos os deals não-deletados

**Regra de Ouro**: Se deal está ABERTO no funil de Vendas (status=0) → NÃO sobrescreve `owner_id` nem `stage`. Apenas atualiza `piperun_id` e `piperun_link`.

Se deal está em Estagnados → `moveDealToVendas()` (reativa o deal).

6. `generateAILeadGreeting()` → Mensagem personalizada vendedor→lead (Gemini 2.5 Flash Lite, max 200 tokens)
7. `buildSellerNotification()` → Template estruturado com:
   - Dados do lead (nome, email, tel, área, produto)
   - `generateHistoricoOportunidade()` → DeepSeek Chat gera briefing tático (histórico + oportunidade)
   - Análise cognitiva (confiança, estágio, urgência, perfil psicológico)
8. Envio via `smart-ops-send-waleads` → Alerta no WhatsApp do vendedor

**UI que consome**: `SmartOpsKanban`, `SmartOpsLeadsList`, `SmartOpsBowtie`, `SmartOpsIntelligenceDashboard`

---

### Fluxo 2: Meta Ads Webhook

```
TRIGGER: POST /functions/v1/smart-ops-meta-lead-webhook
ENTRADA: Facebook/Instagram Lead Ads webhook (leadgen_id, page_id, form_id)
```

1. **Verificação GET**: `hub.mode=subscribe` + `META_WEBHOOK_VERIFY_TOKEN`
2. **Fetch Graph API**: `GET https://graph.facebook.com/v21.0/{leadgen_id}?access_token=...`
3. **Parse field_data**: Array de `{ name, values }` → mapeado para campos normalizados
4. **Detecção de plataforma**: `body.object === "instagram"` → `utm_source: "instagram"`
5. **Forward**: Chama `smart-ops-ingest-lead` com payload normalizado
6. **Campos específicos**: `meta_leadgen_id`, `meta_page_id`, `meta_form_id`, `meta_created_time`, `meta_platform`
7. **Source**: `"meta_lead_ads"`, `utm_medium: "paid"`

**Secrets**: `META_LEAD_ADS_TOKEN`, `META_WEBHOOK_VERIFY_TOKEN`

---

### Fluxo 3: SellFlux Webhook

```
TRIGGER: POST /functions/v1/smart-ops-sellflux-webhook
ENTRADA: Payload flexível do SellFlux (contato, automação, e-commerce, tracking)
```

1. **Empty body guard**: Ignora pings de health check vazios
2. **Extract fields**: Email, nome, phone com mapeamento flexível
3. **Tag migration**: `migrateLegacyTags()` → Converte tags legadas para padrão v4
4. **SellFlux custom fields → JSONB**: `train_date`, `scheduled_by`, `group_train`, PIX/Boleto, tracking, transaction
5. **Detecção dinâmica de origem**:
   - Payload com `tracking` ou `transaction` ou tags e-commerce → `source: "loja_integrada"`
   - Payload com `automation_name` → `source: {automation_name}`
   - Default → `source: "sellflux_webhook"`
6. **Mapeamentos especiais**:
   - `atual-id-pipe` → `piperun_id`
   - `proprietario` → `proprietario_lead_crm`
   - `platform_mail` → `astron_email`
7. **Forward**: `smart-ops-ingest-lead`
8. **Health log**: `system_health_logs` com tags, extracted_fields, ingest_status

---

### Fluxo 4: E-commerce (Loja Integrada)

```
TRIGGER 1: POST /functions/v1/poll-loja-integrada-orders (pg_cron, a cada 30 min)
TRIGGER 2: POST /functions/v1/smart-ops-ecommerce-webhook (webhook direto da Loja)
TRIGGER 3: Via SellFlux (fluxo 3, com tracking/transaction objects)
```

**poll-loja-integrada-orders**:
- Consulta API da Loja Integrada por pedidos recentes
- Para cada pedido: busca cliente por ID, mapeia itens, endereço, pagamento
- Forward para `smart-ops-ingest-lead` com `source: "loja_integrada"`
- Campos enriquecidos: `lojaintegrada_*` (~25 campos no `lia_attendances`)

**smart-ops-ecommerce-webhook**:
- Recebe webhooks nativos da Loja Integrada (pedido criado/atualizado)
- Normaliza e forward para ingest-lead

**Secrets**: `LOJA_INTEGRADA_API_KEY`, `LOJA_INTEGRADA_APP_KEY`

---

### Fluxo 5: PipeRun Webhook (Bidirecional)

```
TRIGGER: POST /functions/v1/smart-ops-piperun-webhook
ENTRADA: Webhook PipeRun (deal created/updated/moved/closed)
```

**Inbound (PipeRun → Sistema B):**
1. `extractIds()`: stage, pipeline, owner (suporta objetos aninhados)
2. `extractWebhookCustomFields()`: Produto interesse, tem_scanner, tem_impressora, ID cliente, especialidade, país
3. **Auto-create**: Se deal não existe em `lia_attendances` → cria lead automaticamente
4. **Status mapping**: `STAGE_TO_ETAPA[stageId]` → traduz stage_id do PipeRun para lead_status interno
5. **Journey TAG logic**:
   - Entrada em Estagnados: `ultima_etapa_comercial` preservada, `lead_status` atualizado
   - Saída de Estagnados: TAG `C_RECUPERADO` adicionada, tags de estagnação removidas
   - Mudança normal: `computeTagsFromStage()` calcula novas tags
6. **Oportunidade encerrada (won/lost)**:
   - Won: Tags `J04_COMPRA`, `C_CONTRATO_FECHADO`, `C_PQL_RECOMPRA`, `COMPROU_{PRODUTO}`
   - Lost: Tags `NAO_COMPROU_{PRODUTO}`, `status_oportunidade: "perdida_renutrir"`
   - Ambos: `C_REENTRADA_NUTRICAO` para cross-sell
   - Won: `parseProposalItems()` → auto-popula equipamentos (scanner, impressora, CAD, notebook, insumos)
   - Won: `prediction_accuracy` calculada comparando `lead_stage_detected` vs resultado real
7. **SellFlux sync**: Tags atualizadas via `sendCampaignViaSellFlux()`

**Outbound (Sistema B → PipeRun):**
- `smart-ops-kanban-move`: Quando usuário move card no SmartOps Kanban
  - Recebe `piperun_id` + `new_status`
  - Mapeia via `ETAPA_TO_STAGE[new_status]` → `{ stage_id, pipeline_id }`
  - `piperunPut()` atualiza deal no PipeRun

**Bidirecional sync safety net**: `smart-ops-sync-piperun` roda via pg_cron a cada 20 min (`?full=true`)

---

### Fluxo 6: Stagnation Processor (pg_cron)

```
TRIGGER: pg_cron (periódico)
FUNÇÃO: smart-ops-stagnant-processor
```

**Progressão do funil de estagnação:**
```
est_etapa1 → est_etapa2 → est_etapa3 → est_etapa4 → est_apresentacao → est_proposta → estagnado_final
```

1. Busca todos leads com `lead_status LIKE 'est%'` e `≠ estagnado_final`
2. Para cada lead com `updated_at > 5 dias`:
3. **DeepSeek Decision** (max 20/run): Analisa perfil cognitivo → `{ vale_reativar, angulo, tom, cta, motivo_provavel }`
   - Se `vale_reativar: false` → skip lead
4. Avança para próximo estágio. Computa tag de estagnação
5. **Push para PipeRun**: `moveDealToStage()` atualiza deal
6. **Automação de mensagem**: Consulta `cs_automation_rules` para o estágio
   - SellFlux (preferencial): `sendCampaignViaSellFlux()`
   - ManyChat (fallback): `sendFlow`
7. **AI-powered message** (Gemini 2.5 Flash Lite): Gera mensagem de reativação personalizada com ângulo/tom do DeepSeek
8. **Cleanup**: Auto-descarta leads com `sem_interesse` do WhatsApp inbox (últimos 7 dias)

**Tabelas**: `lia_attendances` (R/W), `cs_automation_rules` (R), `message_logs` (W), `whatsapp_inbox` (R)

---

### Fluxo 7: Proactive Outreach (pg_cron)

```
TRIGGER: pg_cron (periódico)
FUNÇÃO: smart-ops-proactive-outreach
```

**4 tipos de outreach:**

| Tipo | Filtro | Cooldown |
|---|---|---|
| `acompanhamento` | Proposta enviada + >7 dias sem update | 5 dias |
| `reengajamento` | Lead quente (score≥60) + 3-15 dias inativo | 5 dias |
| `primeira_duvida` | Lead novo/qualificado + 2-10 dias + 0 proactivos | 5 dias |
| `recuperacao` | Lead perdido + ≤30 dias + 0 proactivos | 5 dias |

1. Busca candidatos (até 500) com telefone, não estagnado final/descartado, últimos 30 dias
2. Filtra por cooldown (`proactive_sent_at` + 5 dias)
3. Tenta match com OUTREACH_RULES (primeiro que bater)
4. Max 3 proativos por lead
5. **Envio via SellFlux** (preferencial) ou **WaLeads** (fallback)
6. Atualiza `proactive_sent_at`, `proactive_count`, `tags_crm` com `LIA_PROATIVO_{1|2|3}`
7. Log em `message_logs`

---

### Fluxo 8: WhatsApp Inbox → Intent Classification

```
TRIGGER: POST /functions/v1/smart-ops-wa-inbox-webhook
ENTRADA: Mensagem inbound do WhatsApp (texto, mídia, phone)
```

1. **Phone normalization**: `normalizePhoneForMatch()` → últimos 9 dígitos
2. **@lid resolution**: WhatsApp internal IDs → real phone via `senderPn`, `remoteJidAlt`, `participant`
3. **Lead matching**: `lia_attendances.telefone_normalized ILIKE '%{suffix}'`
4. **Intent classification** (rule-based v1):
   - 6 intents primários: `interesse_imediato` (90%), `interesse_futuro` (75%), `pedido_info` (80%), `objecao` (70%), `sem_interesse` (95%), `suporte` (85%)
   - 15+ padrões secundários: linguagem coloquial brasileira (Ex: "quanto custa", "me manda", "tá caro")
5. **Insert** em `whatsapp_inbox` (phone, message, intent, confidence, lead_id, raw_payload)
6. **Post-processing**:
   - `interesse_imediato` ou `interesse_futuro` → Alerta HOT LEAD para vendedor via `smart-ops-send-waleads`
   - `sem_interesse` → Tag `A_SEM_RESPOSTA` no lead
   - Se `total_messages ≥ 5` → Fire cognitive-lead-analysis

---

## Parte 2 — Fluxos de Conteúdo

### Fluxo 1: PDF → Extração → Orquestração → Publicação

```
TRIGGER: Usuário no AdminKnowledge seleciona PDFs e clica "Gerar com IA"
```

**Etapa 1 — Extração (4 funções)**

| Função | Método | Quando usar |
|---|---|---|
| `extract-pdf-text` | Parsing direto de texto | PDFs com texto selecionável |
| `extract-pdf-raw` | OCR ou parsing bruto | PDFs escaneados |
| `extract-pdf-specialized` | Extração com contexto técnico | FDS, IFU, Laudos |
| `extract-and-cache-pdf` | Cache em `catalog_documents.extracted_text` | Re-uso de extrações |

**Etapa 2 — Orquestração (`ai-orchestrate-content`, 1238 linhas)**
- Modelo: **Gemini 2.5 Flash** via `ai.gateway.lovable.dev`
- Prompt base: `SYSTEM_SUPER_PROMPT` (de `_shared/system-prompt.ts`)
- Prompts especializados: `TESTIMONIAL_PROMPT`, `DOCUMENT_PROMPTS[documentType]`
- Entity matching: `matchEntities()` + `buildEntityGraph()` (de `_shared/entity-dictionary.ts`)
- Citation building: `buildCitationBlock()`, `buildGeoContextBlock()`, `buildEntityGraphJsonLd()`

**Tipos de conteúdo suportados:**
- `tecnico`, `educacional`, `passo_a_passo`, `cases_sucesso`, `depoimentos`
- Tipos de documento: `perfil_tecnico`, `fds`, `ifu`, `laudo`, `catalogo`, `guia`, `certificado`

**Output**: HTML semântico + FAQs + metadata (educational level, proficiency, teaches[]) + schemas (HowTo, FAQPage) + veredictData

**Etapa 3 — Pós-processamento (5 funções)**

| Função | Propósito |
|---|---|
| `reformat-article-html` | Reformatação HTML com IA |
| `enrich-article-seo` | Meta description, keywords, ai_context |
| `auto-inject-product-cards` | Insere cards de produto inline no HTML |
| `translate-content` | Tradução PT → EN/ES |
| `ai-generate-og-image` | Gera banner Open Graph com IA |

**Tabela destino**: `knowledge_contents` (INSERT/UPDATE)

**UI**: `AdminKnowledge` (editor TipTap, seletor de PDFs, botão "Gerar com IA")

---

### Fluxo 2: Vídeo → Transcrição → Artigo

```
TRIGGER: Usuário no AdminKnowledge seleciona vídeo e usa "Gerar a partir de vídeo"
FUNÇÕES: extract-video-content → ai-orchestrate-content
```

1. `extract-video-content`: Busca vídeo no PandaVideo, extrai transcrição
2. Transcrição enviada como `videoTranscription` para o orquestrador
3. Mesmo pipeline de pós-processamento do Fluxo 1

**Tabelas**: `knowledge_videos` (R), `knowledge_contents` (W)

---

### Fluxo 3: Google Drive KB → Embeddings

```
TRIGGER: POST /functions/v1/sync-google-drive-kb (manual ou pg_cron)
```

1. Lista arquivos no Google Drive via API
2. Extrai texto de documentos (Google Docs, Slides, PDF)
3. Insert/update em `company_kb_texts` (tabela de knowledge base da empresa)
4. Log em `drive_kb_sync_log`
5. Downstream: `index-embeddings` inclui `company_kb_texts` como fonte

**Secret**: `GOOGLE_DRIVE_API_KEY`

---

### Fluxo 4: Apostila → Resinas

```
TRIGGER: Usuário no Admin → Ferramentas → "Exportar Apostila"
FUNÇÃO: enrich-resins-from-apostila
```

1. Processa apostila de parâmetros de impressão
2. Extrai perfis de resinas com parâmetros técnicos
3. Insert/update em `resins` e `parameter_sets`

**UI**: `ApostilaExport` (componente no tab "Ferramentas")

---

### Fluxo 5: Knowledge Gaps → Drafts → Artigos

```
TRIGGER 1: Dra. L.I.A. detecta pergunta sem resposta → agent_knowledge_gaps
TRIGGER 2: pg_cron periódico → heal-knowledge-gaps
```

1. `agent_knowledge_gaps` acumula perguntas não respondidas com frequência
2. `heal-knowledge-gaps`: Agrupa perguntas similares em clusters
3. Gera drafts via IA → `knowledge_gap_drafts` (título, excerpt, FAQ)
4. Reviewer humano aprova → publica como `knowledge_contents`

**Tabelas**: `agent_knowledge_gaps` (R/W), `knowledge_gap_drafts` (W), `knowledge_contents` (W)

---

### Fluxo 6: Tradução Pipeline (PT → EN/ES)

```
TRIGGER: Usuário no AdminBatchTranslator ou automação pós-publicação
FUNÇÃO: translate-content
```

1. Recebe content_id + target language (en/es)
2. Busca `knowledge_contents` → `content_html`, `title`, `excerpt`, `faqs`
3. Traduz via Gemini → salva em `content_html_en`/`content_html_es`, `title_en`/`title_es`, etc.
4. Gera `ai_context_en`/`ai_context_es` para RAG multilíngue

**UI**: `AdminBatchTranslator`

---

### Fluxo 7: SEO Exposure Pipeline

```
FUNÇÕES: seo-proxy, generate-sitemap, generate-knowledge-sitemap[-en|-es], generate-documents-sitemap, knowledge-feed
```

**seo-proxy (SSR para crawlers)**:
- Detecta User-Agent de bots (Googlebot, Bingbot, GPTBot, etc.)
- Gera HTML semântico com 17+ elementos estruturados:
  - JSON-LD (Article, HowTo, FAQPage, Product, VideoObject, BreadcrumbList, Organization)
  - Open Graph, Twitter Cards, hreflang, canonical
  - Assinatura do autor com schema Person

**Sitemaps**:
- `generate-sitemap`: Sitemap principal (produtos, categorias, depoimentos)
- `generate-knowledge-sitemap`: Artigos PT
- `generate-knowledge-sitemap-en`: Artigos EN
- `generate-knowledge-sitemap-es`: Artigos ES
- `generate-documents-sitemap`: Documentos técnicos

**knowledge-feed**: RSS/Atom/JSON para agregadores e LLMs

---

## Parte 3 — Fluxos da Dra. L.I.A.

### Fluxo 1: Widget Web → dra-lia → RAG → Response

```
TRIGGER: Usuário clica no widget da Dra. L.I.A. (canto inferior direito)
FUNÇÃO: dra-lia (5092 linhas — a maior Edge Function do sistema)
```

**Arquitetura do Agente:**

1. **Session Management**: `agent_sessions` com `current_state` (free_chat, spin_qualifier, etc.) e `extracted_entities`
2. **Topic Context Re-ranking**: `TOPIC_WEIGHTS` por rota (parameters, products, commercial, support)
3. **RAG Pipeline**:
   - Query → Gemini `gemini-embedding-001` → vector 768d
   - `match_agent_embeddings()` (RPC) → top 10 chunks com similarity > 0.70
   - Re-ranking por topic weights
4. **SDR Consultivo** (rota comercial):
   - `buildCommercialInstruction()`: Prompt modular dinâmico por etapa SPIN
   - 5 etapas: Saudação → Contexto → Apresentação → Fechamento → Agendamento
   - Régua de conhecimento por maturidade (MQL/PQL/SAL/SQL/CLIENTE)
5. **LLM Call**: Gemini 2.5 Flash (preferencial) com fallback
6. **Post-processing**:
   - `extractImplicitLeadData()`: NLP para capturar interesse em produtos (RayShape, Exoplan, Medit, etc.)
   - Atualiza `lia_attendances` com dados extraídos
   - Se `total_messages ≥ 5` ou `inatividade > 180s` → dispara `cognitive-lead-analysis`
7. **Feedback loop**: `evaluate-interaction` (trigger PostgreSQL) → Judge Score

**Tabelas**: `agent_sessions` (R/W), `agent_interactions` (W), `agent_embeddings` (R), `lia_attendances` (R/W), `leads` (R/W)

**UI**: Componente `DraLIA` renderizado globalmente via `DraLIAGlobal()` em `App.tsx` (exceto `/admin` e `/embed`)

---

### Fluxo 2: WhatsApp → dra-lia-whatsapp → Adaptador

```
TRIGGER: POST /functions/v1/dra-lia-whatsapp
ENTRADA: Mensagem WhatsApp via webhook (WaLeads, Z-API, etc.)
```

1. `extractFields()`: Phone, message, senderName de payloads flexíveis (10+ formatos)
2. **@lid resolution**: Resolve IDs internos do WhatsApp para telefone real
3. `stripMarkdownForWhatsApp()`: Remove formatação incompatível
4. **Dedup**: `DEDUP_OUTBOUND_MS` (30s) e `DEDUP_CONTENT_MINUTES` (5min)
5. **Stale filter**: Mensagens com > 120s são ignoradas
6. Lead matching por telefone → `lia_attendances`
7. **Forward para `dra-lia`** com adaptações:
   - Max output: `MAX_WHATSAPP_LENGTH` (4000 chars)
   - Formatação WhatsApp (*bold* ao invés de **bold**)
8. Resposta enviada de volta via `smart-ops-send-waleads`

---

### Fluxo 3: Embed iframe → AgentEmbed

```
ROTA: /embed/dra-lia
COMPONENTE: AgentEmbed.tsx → DraLIA embedded={true}
```

- Renderiza o componente `DraLIA` em modo embedded (sem header/footer)
- Para uso em iframes de terceiros
- Widget NÃO aparece nesta rota (filtrado pelo `DraLIAGlobal`)

---

### Fluxo 4: Indexação — index-embeddings (8 fontes)

```
TRIGGER: POST /functions/v1/index-embeddings (manual ou pg_cron)
FUNÇÃO: index-embeddings (1016 linhas)
```

**8 fontes de dados indexadas:**

| Fonte | source_type | Origem |
|---|---|---|
| Artigos KB | `article` | `knowledge_contents` |
| Vídeos | `video` | `knowledge_videos` |
| Resinas | `resin` | `resins` |
| Parâmetros | `parameter` | `parameter_sets` |
| Company KB | `company_kb` | `company_kb_texts` |
| Catálogo | `catalog_product` | `system_a_catalog` |
| Autores | `author` | `authors` |
| FAQ Autoheal | `faq_autoheal` | `knowledge_gap_drafts` |

**Pipeline:**
1. Coleta chunks de cada fonte (chunking semântico)
2. `fixEncoding()`: Corrige mojibake de latin1→UTF-8
3. `generateEmbedding()`: Gemini `gemini-embedding-001` → vector 768d
4. Upsert em `agent_embeddings` (content_id + source_type como chave)
5. Batch de 5 chunks com delay de 2s entre batches

**Tabela destino**: `agent_embeddings` (~768d vectors)

---

## Parte 4 — Fluxos Inter-Sistemas

### Inbound (Sistema A → Sistema B)

| # | Função | O que traz | Tabela destino |
|---|---|---|---|
| 1 | `sync-knowledge-base` | Produtos, depoimentos, links, categorias | `system_a_catalog`, `external_links` |
| 2 | `sync-sistema-a` | Dados técnicos detalhados | `products_catalog` (órfã) |
| 3 | `import-system-a-json` | Upload manual JSON + imagens | `system_a_catalog` |

### Outbound (Sistema B → Sistema A / Externos)

| # | Função | O que expõe | Formato |
|---|---|---|---|
| 1 | `data-export` | 14+ datasets (produtos, artigos, resinas, parâmetros, vídeos, FAQ, knowledge_graph) | JSON |
| 2 | `get-product-data` | Busca individual com fuzzy matching 4 níveis | JSON |
| 3 | `export-parametros-ia` | v2.0 dados estruturados para agentes IA | JSON |
| 4 | `knowledge-feed` | Artigos recentes | RSS/Atom/JSON |
| 5 | `seo-proxy` | HTML semântico para crawlers e LLMs | HTML |
| 6 | `generate-sitemap*` | 5 sitemaps (principal, KB pt/en/es, docs) | XML |
| 7 | `export-apostila-docx` | Apostila de parâmetros | DOCX (via JSZip) |

### Knowledge Graph (data-export, seção `knowledge_graph`)

```json
{
  "knowledge_graph": {
    "nodes": [
      { "id": "...", "type": "product|resin|article|video|author", "label": "...", "properties": {} }
    ],
    "relations": [
      { "source": "...", "target": "...", "type": "HAS_PARAMETER|RECOMMENDED_FOR|AUTHORED_BY|..." }
    ],
    "meta": { "total_nodes": N, "total_relations": N, "generated_at": "..." }
  }
}
```

---

## Parte 5 — Inventário de Dados por Tabela

### `lia_attendances` (~200 colunas) — CDP Central

| Domínio | Campos-chave | Quem escreve | Quem lê |
|---|---|---|---|
| **Identidade** | nome, email, telefone_normalized | ingest-lead, sellflux-webhook, piperun-webhook | Todos |
| **CRM** | piperun_id, piperun_link, proprietario_lead_crm, status_oportunidade | lia-assign, piperun-webhook | Kanban, Bowtie, Reports |
| **Empresa** | empresa_cnpj, empresa_nome, empresa_segmento | lia-assign (fetchCompanyData) | Briefing vendedor |
| **Qualificação** | area_atuacao, especialidade, como_digitaliza, tem_impressora | ingest-lead, sellflux-webhook | Cognitive, LIS |
| **Cognitivo** | cognitive_analysis, lead_stage_detected, urgency_level, recommended_approach | cognitive-lead-analysis | Kanban, Reports, LIA Assign |
| **Intelligence** | intelligence_score (JSONB), intelligence_score_total | RPC calculate_lead_intelligence_score | Intelligence Dashboard |
| **E-commerce** | lojaintegrada_* (~25 campos) | poll-loja-integrada-orders, sellflux-webhook | Purchase power calc |
| **Academy** | astron_* (~10 campos) | sync-astron-members | Academy score, briefing |
| **Equipamentos** | equip_scanner, equip_impressora, equip_cad, equip_notebook | piperun-webhook (parseProposalItems) | Upsell targeting |
| **Tags** | tags_crm[] | piperun-webhook, stagnant-processor, proactive-outreach | SellFlux sync, filtering |
| **SellFlux** | sellflux_custom_fields (JSONB) | sellflux-webhook | SellFlux sync |

### `knowledge_contents` — Artigos

| Campo | Quem escreve | Quem lê |
|---|---|---|
| content_html, title, excerpt | ai-orchestrate-content, AdminKnowledge (manual) | KnowledgeBase, seo-proxy, knowledge-feed |
| content_html_en/es, title_en/es | translate-content | KnowledgeBase (lang=en/es) |
| faqs, faqs_en, faqs_es | ai-orchestrate-content | seo-proxy (FAQPage schema) |
| ai_context, ai_context_en/es | enrich-article-seo | index-embeddings (RAG) |
| keywords, keyword_ids | enrich-article-seo, backfill-keywords | SEO, filtering |
| veredict_data | generate-veredict-data | VeredictBox component |
| og_image_url | ai-generate-og-image | seo-proxy, social sharing |
| author_id | AdminKnowledge (manual) | AuthorBio, AuthorSignature |

### `agent_embeddings` — RAG Vectors

| Campo | Quem escreve | Quem lê |
|---|---|---|
| chunk_text, embedding (vector 768d) | index-embeddings | dra-lia (via match_agent_embeddings RPC) |
| source_type, content_id | index-embeddings | Topic re-ranking |
| metadata (JSONB) | index-embeddings | Context enrichment |

### `agent_interactions` — Histórico de Chat

| Campo | Quem escreve | Quem lê |
|---|---|---|
| user_message, agent_response | dra-lia | evaluate-interaction, AdminDraLIAStats |
| judge_score, judge_verdict | evaluate-interaction | Quality dashboards |
| context_sources | dra-lia | Auditoria |
| lead_id | dra-lia | Ponte para leads (legado) |

### `whatsapp_inbox` — Mensagens WhatsApp

| Campo | Quem escreve | Quem lê |
|---|---|---|
| phone, message_text, direction | wa-inbox-webhook, dra-lia-whatsapp | SmartOpsWhatsAppInbox |
| intent_detected, confidence_score | wa-inbox-webhook (classifyMessage) | Stagnant processor, Reports |
| lead_id, matched_by | wa-inbox-webhook | Lead correlation |
| seller_notified | wa-inbox-webhook | Audit trail |

### `system_a_catalog` — Produtos Sincronizados

| Campo | Quem escreve | Quem lê |
|---|---|---|
| Todos campos | sync-knowledge-base, import-system-a-json | data-export, get-product-data, index-embeddings |
| extra_data.reviews_reputation | sync-google-reviews (RPC update_extra_data_reviews) | Google Reviews widget |

### `cs_automation_rules` — Réguas de Automação

| Campo | Quem escreve | Quem lê |
|---|---|---|
| trigger_event, mensagem_waleads, template_manychat | SmartOpsCSRules (admin) | stagnant-processor, proactive-outreach |
| waleads_ativo, manychat_ativo | SmartOpsCSRules (admin) | cs-processor |

### `team_members` — Equipe

| Campo | Quem escreve | Quem lê |
|---|---|---|
| nome_completo, piperun_owner_id, waleads_api_key | SmartOpsTeam (admin) | lia-assign, send-waleads, proactive-outreach |
| role (vendedor/cs/admin) | SmartOpsTeam (admin) | Routing logic |

---

## Parte 6 — Fluxos do Usuário (Admin)

### AdminViewSecure — Painel Principal

**Auth**: Verifica `user_roles` table via Supabase → roles `admin` ou `author`

| Tab | Componente | Funções chamadas | Tabelas afetadas | Role |
|---|---|---|---|---|
| **Modelos** | `AdminModels` | CRUD direto | `brands`, `models`, `parameter_sets` | admin |
| **Catálogo** | `AdminCatalog` | CRUD + `sync-knowledge-base` | `system_a_catalog` | admin |
| **Docs Sistema** | `AdminDocumentsList` | CRUD + `extract-*` | `catalog_documents` | admin |
| **Conteúdo** | `AdminKnowledge` | `ai-orchestrate-content`, `translate-content`, `enrich-article-seo`, `auto-inject-product-cards`, `ai-generate-og-image` | `knowledge_contents`, `knowledge_videos` | admin+author |
| **Autores** | `AdminAuthors` | CRUD | `authors` | admin+author |
| **Ferramentas** | `ApostilaExport`, `AdminArticleEnricher`, `AdminArticleReformatter`, `AdminParameterPages`, `AdminVideoProductLinks` | `export-apostila-docx`, `enrich-article-seo`, `reformat-article-html`, `generate-parameter-pages`, `link-videos-to-articles` | Várias | admin |
| **Estatísticas** | `AdminStats` + `AdminDraLIAStats` | Queries diretas | `agent_interactions`, `parameter_sets`, `knowledge_contents` | admin |
| **Usuários** | `AdminUsers` | `create-user` | `auth.users`, `user_roles` | admin |
| **Configurações** | `AdminSettings` | CRUD | `intelligence_score_config` | admin |
| **PandaVideo** | `AdminPandaVideoSync`, `AdminPandaVideoTest`, `AdminVideoAnalyticsDashboard` | `sync-pandavideo`, `pandavideo-test`, `sync-video-analytics` | `knowledge_videos` | admin |
| **Smart Ops** | `SmartOpsTab` (13 sub-tabs) | Ver abaixo | Várias | admin |

### SmartOpsTab — 13 Sub-tabs

| Sub-tab | Componente | O que o usuário faz | Funções backend | Tabelas |
|---|---|---|---|---|
| **Bowtie** | `SmartOpsBowtie` (contém `SmartOpsGoals`) | Visualiza funil bowtie + metas | Queries | `lia_attendances` |
| **Kanban** | `SmartOpsKanban` | Move cards entre colunas | `smart-ops-kanban-move` | `lia_attendances` (R/W) |
| **Leads** | `SmartOpsLeadsList` | Lista/filtra/busca leads | Queries | `lia_attendances` |
| **Equipe** | `SmartOpsTeam` (contém `SmartOpsSellerAutomations`) | Gerencia membros + automações por vendedor | CRUD | `team_members`, `cs_automation_rules` |
| **Automações** | `SmartOpsCSRules` | Configura réguas de automação | CRUD | `cs_automation_rules` |
| **Logs** | `SmartOpsLogs` | Visualiza logs de mensagens | Queries | `message_logs`, `system_health_logs` |
| **Relatórios** | `SmartOpsReports` | Dashboards de conversão e performance | Queries | `lia_attendances`, `lead_state_events` |
| **Conteúdo** | `SmartOpsContentProduction` | Pipeline de produção de conteúdo | Queries | `content_requests`, `knowledge_gap_drafts` |
| **Saúde** | `SmartOpsSystemHealth` | Monitora health do sistema | Queries | `system_health_logs` |
| **WhatsApp** | `SmartOpsWhatsAppInbox` | Visualiza inbox + intent classification | Queries | `whatsapp_inbox` |
| **Formulários** | `SmartOpsFormBuilder` | Cria/gerencia formulários públicos | CRUD | `public_forms` |
| **Tokens IA** | `SmartOpsAIUsageDashboard` | Monitora uso de tokens por modelo | Queries | `ai_token_usage` |
| **Intelligence** | `SmartOpsIntelligenceDashboard` | Dashboard de intelligence score | Queries | `lia_attendances`, `intelligence_score_config` |

### Rotas Públicas (Frontend)

| Rota | Componente | Dados |
|---|---|---|
| `/` | `Index` | `system_a_catalog` (produtos/marcas/modelos) |
| `/:brandSlug/:modelSlug/:resinSlug` | `Index` | Parâmetros filtrados |
| `/base-conhecimento/**` | `KnowledgeBase` (lang=pt) | `knowledge_contents`, `knowledge_categories` |
| `/en/knowledge-base/**` | `KnowledgeBase` (lang=en) | Idem, campos `*_en` |
| `/es/base-conocimiento/**` | `KnowledgeBase` (lang=es) | Idem, campos `*_es` |
| `/produtos/:slug` | `ProductPage` | `system_a_catalog` |
| `/depoimentos/:slug` | `TestimonialPage` | `system_a_catalog` (type=testimonial) |
| `/categorias/:slug` | `CategoryPage` | `knowledge_categories` |
| `/sobre` | `About` | Estático |
| `/f/:slug` | `PublicFormPage` | `public_forms` → `smart-ops-ingest-lead` |
| `/embed/dra-lia` | `AgentEmbed` | `dra-lia` |

---

## Parte 7 — Diagramas de Sequência ASCII

### Diagrama 1: Lead Ingestion Completo

```
Formulário/Meta/SellFlux/WhatsApp
         │
         ▼
┌─────────────────────────┐
│  smart-ops-ingest-lead  │
│  ┌───────────────────┐  │
│  │ normalizePhone()  │  │
│  │ extractField()    │  │
│  │ Smart Merge       │  │
│  └───────────────────┘  │
│         │                │
│    lia_attendances       │
│    INSERT/UPDATE         │
└─────────┬───────────────┘
          │
    ┌─────┼──────────────────────┐
    │     │                      │
    ▼     ▼                      ▼
┌────────┐ ┌──────────────┐  ┌──────────┐
│LIA     │ │cognitive-lead│  │SellFlux  │
│Assign  │ │analysis      │  │Webhook   │
│(1196L) │ │(481L)        │  │Push      │
└───┬────┘ └──────┬───────┘  └──────────┘
    │             │
    ▼             ▼
┌────────────┐ ┌──────────────────┐
│PipeRun API │ │lia_attendances   │
│Person →    │ │cognitive_analysis│
│Company →   │ │lead_stage_detected│
│Deal        │ │urgency_level     │
└────┬───────┘ └──────────────────┘
     │
     ▼
┌──────────────────┐
│send-waleads      │
│Alerta vendedor   │
│(AI greeting +    │
│ briefing tático) │
└──────────────────┘
     │
     ▼
┌──────────────────┐
│RPC: calculate_   │
│lead_intelligence │
│_score            │
│(4 eixos)         │
└──────────────────┘
```

### Diagrama 2: Content Generation Completo

```
Admin → AdminKnowledge
    │
    ├── Seleciona PDFs
    ├── Seleciona vídeos
    ├── Define tipo de conteúdo
    │
    ▼
┌─────────────────────────┐
│ extract-pdf-text/raw/   │
│ specialized/cache       │
│ extract-video-content   │
└─────────┬───────────────┘
          │ (texto extraído)
          ▼
┌─────────────────────────┐
│ ai-orchestrate-content  │
│ (1238 linhas)           │
│ ┌─────────────────────┐ │
│ │ SYSTEM_SUPER_PROMPT  │ │
│ │ + entity-dictionary  │ │
│ │ + citation-builder   │ │
│ │ + DOCUMENT_PROMPTS   │ │
│ └─────────────────────┘ │
│ Gemini 2.5 Flash        │
└─────────┬───────────────┘
          │ (HTML + FAQs + metadata)
          ▼
┌─────────────────────────┐
│ Pós-processamento:      │
│ ├── reformat-article    │
│ ├── enrich-article-seo  │
│ ├── inject-product-cards│
│ ├── translate (EN/ES)   │
│ └── generate-og-image   │
└─────────┬───────────────┘
          │
          ▼
┌─────────────────────────┐
│ knowledge_contents      │
│ INSERT/UPDATE           │
└─────────┬───────────────┘
          │
    ┌─────┼──────────┐
    ▼     ▼          ▼
  seo-  knowledge  index-
  proxy  -feed     embeddings
  (SSR)  (RSS)     (RAG)
```

### Diagrama 3: Dra. L.I.A. RAG Completo

```
Usuário (Web/WhatsApp/Embed)
         │
         ▼
┌─────────────────────┐
│ dra-lia (5092L)     │
│ ou dra-lia-whatsapp │
│ (adaptador)         │
└─────────┬───────────┘
          │
    ┌─────┼──────────────┐
    │     │              │
    ▼     ▼              ▼
┌────────┐ ┌───────────┐ ┌────────────┐
│Session │ │Embedding  │ │Lead        │
│Manager │ │Query      │ │Matching    │
│agent_  │ │gemini-    │ │lia_attend. │
│sessions│ │embedding  │ │by email/   │
│        │ │-001       │ │phone       │
└────────┘ └─────┬─────┘ └────────────┘
                 │
                 ▼
        ┌────────────────┐
        │match_agent_    │
        │embeddings()    │
        │RPC — top 10    │
        │similarity >0.70│
        └────────┬───────┘
                 │
                 ▼
        ┌────────────────┐
        │Topic re-ranking│
        │TOPIC_WEIGHTS   │
        │by route context│
        └────────┬───────┘
                 │
                 ▼
        ┌────────────────┐
        │Gemini 2.5 Flash│
        │+ system prompt │
        │+ commercial    │
        │  instruction   │
        │+ RAG context   │
        └────────┬───────┘
                 │
           ┌─────┼──────────┐
           ▼     ▼          ▼
     ┌────────┐ ┌──────┐ ┌──────────┐
     │agent_  │ │leads/│ │cognitive │
     │interact│ │lia_  │ │-lead-    │
     │ions    │ │attend│ │analysis  │
     │(W)     │ │(W)   │ │(trigger) │
     └────────┘ └──────┘ └──────────┘
```

---

## Parte 8 — Findings da Auditoria

### ✅ Componentes Verificados (Não Órfãos)

| Componente | Onde é usado | Status |
|---|---|---|
| `SmartOpsGoals` | Dentro de `SmartOpsBowtie` | ✅ Verificado |
| `SmartOpsSellerAutomations` | Dentro de `SmartOpsTeam` | ✅ Verificado |
| `SmartOpsReports` | Montado no `SmartOpsTab` (tab "reports") | ✅ Verificado |
| `AdminViewSupabase` | Rota alternativa (sem auth gate, scroll-based) | ✅ Alternativa deliberada |

### 🔍 Observações Arquiteturais

1. **Dois painéis admin**: `AdminViewSecure` (com tabs, auth obrigatória) e `AdminViewSupabase` (alternativa sem auth gate, layout scroll). Ambos acessam as mesmas tabelas.

2. **Tabela `products_catalog` órfã**: Populada por `sync-sistema-a` mas não utilizada por nenhum componente frontend nem pelo pipeline de conteúdo. O catálogo efetivo é `system_a_catalog`.

3. **Ponte leads ↔ lia_attendances**: `agent_interactions.lead_id` referencia `leads.id` (tabela legada). O cruzamento com `lia_attendances` é feito por email. A tabela `agent_sessions` usa `lia_id` diretamente.

4. **dra-lia é a maior função**: 5092 linhas. Contém lógica de session management, RAG, commercial SDR, SPIN selling, lead extraction, cognitive triggers. Candidata a refatoração.

5. **smart-ops-lia-assign**: 1196 linhas. Hierarquia PipeRun completa (Person → Company → Deal), AI greeting, AI briefing, WaLeads notification. Candidata a decomposição.

### 📊 Métricas do Sistema

| Métrica | Valor |
|---|---|
| Edge Functions | 85+ |
| Maior função | `dra-lia` (5092 linhas) |
| Tabelas principais | 30+ |
| Views | `lead_model_routing`, `v_lead_academy`, `v_lead_cognitive`, `v_lead_commercial`, `v_lead_ecommerce` |
| RPCs customizadas | `calculate_lead_intelligence_score`, `match_agent_embeddings`, `search_knowledge_base`, `get_rag_stats`, `get_brand_distribution` |
| Triggers | `trigger_recalculate_intelligence_score`, `trigger_evaluate_interaction`, `update_knowledge_videos_search_vector` |
| Shared Modules | `system-prompt.ts`, `entity-dictionary.ts`, `piperun-field-map.ts`, `sellflux-field-map.ts`, `citation-builder.ts`, `document-prompts.ts`, `testimonial-prompt.ts`, `log-ai-usage.ts`, `extraction-rules.ts`, `og-visual-dictionary.ts` |
| Modelos IA usados | Gemini 2.5 Flash, Gemini 2.5 Flash Lite, Gemini Embedding 001, DeepSeek Chat |
| Integrações externas | PipeRun, SellFlux, WaLeads, ManyChat, Astron Members, Loja Integrada, PandaVideo, Google Places, Google Drive, Meta Lead Ads |
| Storage Buckets | 6 (model-images, author-images, resin-documents, catalog-documents, catalog-images, knowledge-images) |
| Rotas frontend | 18 |
| Componentes React | ~120 |

### 🔴 Gaps e Recomendações

1. **Refatorar `dra-lia`** (5092L): Extrair session manager, RAG pipeline, commercial SDR e lead extraction para módulos separados.

2. **Refatorar `smart-ops-lia-assign`** (1196L): Extrair PipeRun hierarchy, AI briefing e WaLeads messaging para módulos shared.

3. **Deprecar `products_catalog`**: Migrar qualquer referência para `system_a_catalog` ou remover a tabela.

4. **Unificar ponte leads ↔ lia_attendances**: Migrar `agent_interactions.lead_id` para referenciar `lia_attendances.id` diretamente, eliminando a necessidade de lookup por email.

5. **Adicionar retry/dead-letter**: Os fire-and-forget calls em `ingest-lead` (lia-assign, cognitive-analysis, sellflux) não têm retry. Se falharem silenciosamente, o lead perde enriquecimento.

6. **Rate limiting em webhooks**: `meta-lead-webhook`, `sellflux-webhook`, `piperun-webhook` e `wa-inbox-webhook` não possuem rate limiting. Um burst pode sobrecarregar o sistema.

7. **Monitoramento de custos IA**: `ai_token_usage` registra uso mas não há alertas automáticos para anomalias de gasto.

---

> **Fim da Auditoria** — Este documento deve ser atualizado a cada mudança significativa no sistema.
