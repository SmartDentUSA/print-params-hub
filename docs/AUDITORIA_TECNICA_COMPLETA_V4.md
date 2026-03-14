# Auditoria Técnica Completa — Revenue Intelligence OS v4.0

> **Data:** 2026-03-14  
> **Sistema:** Revenue Intelligence OS (Sistema B / Smart Dent Digital Hub)  
> **Versão:** 4.0  
> **Escopo:** Engenharia, UX/UI, SEO E-E-A-T, Fluxos de Atendimento, Fluxos de Leads, Campos, Tabelas, Endpoints, Integrações, Qualidade HTML

---

## Índice

1. [Identidade e Stack](#parte-1--identidade-e-stack)
2. [Arquitetura Dual](#parte-2--arquitetura-dual)
3. [CDP Unificado](#parte-3--cdp-unificado-lia_attendances)
4. [Inventário de Endpoints](#parte-4--inventário-completo-de-endpoints)
5. [Fluxos de Leads](#parte-5--fluxos-de-leads)
6. [Fluxos de Conteúdo](#parte-6--fluxos-de-conteúdo)
7. [Fluxos de Atendimento](#parte-7--fluxos-de-atendimento-dra-lia)
8. [Integrações Externas](#parte-8--integrações-externas)
9. [Qualidade Técnica do HTML](#parte-9--qualidade-técnica-do-html-gerado)
10. [SEO E-E-A-T Compliance](#parte-10--seo-e-e-a-t-compliance)
11. [UX/UI Architecture](#parte-11--uxui-architecture)
12. [Banco de Dados](#parte-12--banco-de-dados)
13. [Shared Modules](#parte-13--shared-modules-_shared)
14. [Secrets & Segurança](#parte-14--secrets--segurança)
15. [Métricas do Sistema](#parte-15--métricas-do-sistema)
16. [Findings e Recomendações](#parte-16--findings-e-recomendações)

---

## Parte 1 — Identidade e Stack

### 1.1 Nomenclatura

| Nome | Contexto |
|---|---|
| **Sistema B** | Nome interno de referência cruzada (distingue do Sistema A — catálogo de produtos) |
| **Revenue Intelligence OS** | Nome técnico oficial da plataforma |
| **Smart Dent Digital Hub** | Nome público voltado ao usuário final |

### 1.2 Stack Frontend

| Camada | Tecnologia | Versão |
|---|---|---|
| Framework | React | 18.3 |
| Bundler | Vite | 5.x |
| Linguagem | TypeScript | 5.x |
| Estilização | Tailwind CSS | 4.x (tokens semânticos HSL) |
| Component Library | shadcn/ui | Latest |
| Data Fetching | TanStack React Query | 5.83 |
| Rich Text Editor | TipTap | 3.7.2 |
| Animações | Framer Motion | (pontual) |
| Roteamento | React Router DOM | 7.x |
| Notificações | Sonner | Latest |
| Formulários | React Hook Form + Zod | Latest |
| Charts | Recharts | 2.x |
| Ícones | Lucide React | Latest |

### 1.3 Stack Backend

| Camada | Tecnologia |
|---|---|
| Runtime | Supabase Edge Functions (Deno) |
| Banco de Dados | PostgreSQL 15+ (Supabase managed) |
| Auth | Supabase Auth (JWT) |
| Storage | Supabase Storage (buckets) |
| Realtime | Supabase Realtime (Postgres Changes) |
| Vetores | pgvector (embeddings 768d / 1536d) |
| Full-text Search | PostgreSQL tsvector + pg_trgm |

### 1.4 Modelos de IA

| Modelo | Uso | Provider |
|---|---|---|
| **Gemini 2.5 Flash** | Geração de conteúdo, orquestração, formatação HTML, OG images, metadata | Google AI |
| **DeepSeek v3** | Análise cognitiva de leads (10 eixos), judge evaluator, knowledge gap drafts | DeepSeek |
| **GPT-4.1 Mini** | Comparação de modelos (ai-model-compare), avaliação alternativa | OpenAI |
| **text-embedding-3-small** | Embeddings vetoriais para RAG (1536d) | OpenAI |
| **text-embedding-004** | Embeddings vetoriais v2 (768d) | Google AI |

### 1.5 Integrações Externas (9 sistemas)

1. **PipeRun CRM** — REST + Webhook bidirecional
2. **SellFlux** — REST + Webhook + Campanhas
3. **WaLeads** — REST (envio de mensagens WhatsApp)
4. **Astron Members** — Postback + REST (academy/cursos)
5. **Loja Integrada** — Webhook + Polling (e-commerce)
6. **PandaVideo** — REST (vídeos + analytics)
7. **Google Drive** — REST (documentos Knowledge Base)
8. **Google Reviews** — REST (avaliações Google Maps)
9. **Meta Ads** — Webhook + Graph API (Lead Ads + Ads Manager + Insights)

---

## Parte 2 — Arquitetura Dual

### 2.1 Lead Lifecycle Management

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ENTRY POINTS (5 fontes)                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐│
│  │Formulário│ │Meta Ads  │ │SellFlux  │ │E-commerce│ │WhatsApp  ││
│  │  Web     │ │Lead Ads  │ │Webhook   │ │Loja Int. │ │Inbox     ││
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘│
│       │            │            │            │            │       │
│       └────────────┴────────────┴────────────┴────────────┘       │
│                              │                                     │
│                    ┌─────────▼──────────┐                          │
│                    │ smart-ops-ingest-  │                          │
│                    │ lead (GATEWAY)     │                          │
│                    │ • Smart Merge      │                          │
│                    │ • Phone Normalize  │                          │
│                    │ • Source Detection  │                          │
│                    └─────────┬──────────┘                          │
│                              │                                     │
│                    ┌─────────▼──────────┐                          │
│                    │  lia_attendances   │                          │
│                    │  (CDP ~200 cols)   │                          │
│                    └─────────┬──────────┘                          │
│                              │                                     │
│              ┌───────────────┼───────────────┐                     │
│              │               │               │                     │
│    ┌─────────▼─────┐ ┌──────▼──────┐ ┌─────▼──────────┐          │
│    │ cognitive-    │ │ PipeRun     │ │ Intelligence   │          │
│    │ lead-analysis │ │ Sync (bi)   │ │ Score Calc     │          │
│    │ (DeepSeek v3) │ │             │ │ (4 eixos)      │          │
│    └───────────────┘ └─────────────┘ └────────────────┘          │
│                              │                                     │
│              ┌───────────────┼───────────────┐                     │
│              │               │               │                     │
│    ┌─────────▼─────┐ ┌──────▼──────┐ ┌─────▼──────────┐          │
│    │ Stagnation    │ │ Proactive   │ │ CS Automation  │          │
│    │ Processor     │ │ Outreach    │ │ Rules          │          │
│    └───────────────┘ └─────────────┘ └────────────────┘          │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Content Intelligence Platform

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FONTES DE CONTEÚDO                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐              │
│  │ PDFs     │ │ Vídeos   │ │ Google   │ │ Apostila │              │
│  │ Técnicos │ │ PandaV.  │ │ Drive    │ │ Resinas  │              │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘              │
│       │            │            │            │                     │
│  ┌────▼─────┐ ┌────▼─────┐ ┌───▼──────┐ ┌───▼──────┐              │
│  │extract-  │ │extract-  │ │sync-     │ │enrich-   │              │
│  │pdf-text  │ │video-    │ │google-   │ │resins-   │              │
│  │pdf-raw   │ │content   │ │drive-kb  │ │from-     │              │
│  │pdf-spec. │ │          │ │          │ │apostila  │              │
│  └────┬─────┘ └────┬─────┘ └───┬──────┘ └───┬──────┘              │
│       │            │            │            │                     │
│       └────────────┴────────────┴────────────┘                     │
│                              │                                     │
│                    ┌─────────▼──────────┐                          │
│                    │ ai-orchestrate-    │                          │
│                    │ content            │                          │
│                    │ (Gemini 2.5 Flash) │                          │
│                    └─────────┬──────────┘                          │
│                              │                                     │
│              ┌───────┬───────┼───────┬───────┐                     │
│              │       │       │       │       │                     │
│         ┌────▼──┐┌───▼──┐┌──▼───┐┌──▼──┐┌───▼────┐                │
│         │format ││SEO   ││trans-││OG   ││product │                │
│         │HTML   ││enrich││late  ││image││cards   │                │
│         └───────┘└──────┘└──────┘└─────┘└────────┘                │
│                              │                                     │
│                    ┌─────────▼──────────┐                          │
│                    │ knowledge_contents │                          │
│                    │ + SEO Exposure     │                          │
│                    │ (SSR + Sitemaps)   │                          │
│                    └───────────────────┘                          │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.3 Agente Dra. L.I.A. (RAG + 3 Canais)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CANAIS DE ENTRADA                               │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐               │
│  │ Widget Web   │ │ WhatsApp     │ │ Embed iframe │               │
│  │ (DraLIA.tsx) │ │ (dra-lia-wa) │ │ (AgentEmbed) │               │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘               │
│         │                │                │                        │
│         └────────────────┴────────────────┘                        │
│                          │                                         │
│                ┌─────────▼──────────┐                              │
│                │ dra-lia (5092 LOC) │                              │
│                │ • Session Mgmt    │                              │
│                │ • Lead Gate       │                              │
│                │ • Intent Classify │                              │
│                │ • RAG Pipeline    │                              │
│                │ • SPIN Selling    │                              │
│                │ • Topic Re-rank   │                              │
│                └─────────┬──────────┘                              │
│                          │                                         │
│            ┌─────────────┼─────────────┐                           │
│            │             │             │                           │
│   ┌────────▼────┐ ┌──────▼─────┐ ┌────▼────────┐                  │
│   │ match_agent │ │ System     │ │ Entity      │                  │
│   │ _embeddings │ │ Prompt     │ │ Dictionary  │                  │
│   │ _v2 (768d)  │ │ (guardrails│ │ (produtos)  │                  │
│   └─────────────┘ │ + persona) │ └─────────────┘                  │
│                    └────────────┘                                   │
│                                                                     │
│   8 Fontes Vetoriais:                                              │
│   ① catalog_document  ② knowledge_article  ③ knowledge_faq        │
│   ④ testimonial        ⑤ kb_text            ⑥ video_transcript    │
│   ⑦ processing_instruction  ⑧ product_parameters                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Parte 3 — CDP Unificado (`lia_attendances`)

A tabela `lia_attendances` é o hub central do sistema com ~200 colunas organizadas em 9 domínios.

### 3.1 Core (~15 colunas)

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | Identificador único do lead |
| `nome` | text | Nome completo |
| `email` | citext | E-mail (case-insensitive, chave de dedup) |
| `telefone_raw` | text | Telefone como recebido |
| `telefone_normalized` | text | Telefone normalizado (+55...) |
| `lead_status` | text | Status atual do funil |
| `source` | text | Fonte original (meta, sellflux, formulario, etc.) |
| `original_source` | text | Fonte preservada (não sobrescrita) |
| `form_name` | text | Nome do formulário de entrada |
| `entrada_sistema` | timestamptz | Data de entrada no sistema |
| `score` | numeric | Score calculado |
| `reuniao_agendada` | boolean | Se tem reunião agendada |
| `created_at` | timestamptz | Data de criação do registro |
| `updated_at` | timestamptz | Última atualização |
| `person_id` | uuid FK | Referência à tabela `people` (Person-centric) |

### 3.2 Qualificação SDR (~15 colunas)

| Coluna | Tipo | Descrição |
|---|---|---|
| `sdr_impressora_interesse` | text | Interesse em impressoras 3D |
| `sdr_scanner_interesse` | text | Interesse em scanners |
| `sdr_resina_interesse` | text | Interesse em resinas |
| `sdr_software_cad_interesse` | text | Interesse em software CAD |
| `sdr_pos_impressao_interesse` | text | Interesse em pós-impressão |
| `sdr_cursos_interesse` | text | Interesse em cursos |
| `sdr_dentistica_interesse` | text | Interesse em dentística |
| `sdr_insumos_interesse` | text | Interesse em insumos |
| `sdr_assistencia_interesse` | text | Interesse em assistência técnica |
| `sdr_impressora_param` | text | Parâmetro específico de impressora |
| `sdr_resina_param` | text | Parâmetro específico de resina |
| `sdr_scanner_param` | text | Parâmetro específico de scanner |
| `sdr_suporte_tecnico` | text | Necessidade de suporte técnico |
| `sdr_suporte_tipo` | text | Tipo de suporte necessário |
| `sdr_suporte_detalhes` | text | Detalhes do suporte |

### 3.3 PipeRun CRM (~40 colunas)

| Coluna | Tipo | Descrição |
|---|---|---|
| `piperun_id` | integer | ID do deal no PipeRun |
| `piperun_title` | text | Título do deal |
| `piperun_status` | text | Status (open, won, lost) |
| `piperun_pipeline_id` | integer | ID do pipeline |
| `piperun_pipeline_name` | text | Nome do pipeline |
| `piperun_stage_id` | integer | ID da etapa |
| `piperun_stage_name` | text | Nome da etapa |
| `piperun_owner_id` | integer | ID do responsável |
| `piperun_owner_name` | text | Nome do responsável |
| `piperun_value` | numeric | Valor do deal |
| `piperun_last_sync` | timestamptz | Última sincronização |
| `piperun_created_at` | timestamptz | Data de criação no CRM |
| `piperun_updated_at` | timestamptz | Última atualização no CRM |
| `piperun_won_at` | timestamptz | Data de ganho |
| `piperun_lost_at` | timestamptz | Data de perda |
| `piperun_lost_reason` | text | Motivo da perda |
| `piperun_tags` | text[] | Tags do deal |
| `piperun_notes` | text | Notas/observações |
| `piperun_deals_history` | jsonb | Histórico completo de deals (array) |
| `pessoa_nome` | text | Nome da pessoa (PipeRun) |
| `pessoa_email` | text | E-mail da pessoa |
| `pessoa_telefone` | text | Telefone da pessoa |
| `pessoa_cpf` | text | CPF |
| `pessoa_cidade` | text | Cidade |
| `pessoa_uf` | text | Estado |
| `pessoa_cro` | text | CRO (registro profissional) |
| `pessoa_especialidade` | text | Especialidade odontológica |
| `empresa_nome` | text | Nome da empresa |
| `empresa_cnpj` | text | CNPJ |
| `empresa_cidade` | text | Cidade da empresa |
| `empresa_uf` | text | UF da empresa |
| `empresa_segmento` | text | Segmento |
| `empresa_porte` | text | Porte |
| `proposals_data` | jsonb | Dados de propostas |
| `proposals_total_value` | numeric | Valor total de propostas |
| `proposals_count` | integer | Quantidade de propostas |
| `ltv_total` | numeric | Lifetime Value total (calculado via trigger) |
| `total_deals` | integer | Total de deals (calculado via trigger) |
| `anchor_product` | text | Produto âncora (calculado via trigger) |

### 3.4 Cognitive AI (~15 colunas)

| Coluna | Tipo | Descrição |
|---|---|---|
| `cognitive_analysis` | jsonb | Análise cognitiva completa (10 eixos) |
| `cognitive_analyzed_at` | timestamptz | Data da análise |
| `cognitive_model_used` | text | Modelo usado (deepseek-chat) |
| `eixo_maturidade_digital` | numeric | Score maturidade digital (0-100) |
| `eixo_prontidao_compra` | numeric | Score prontidão de compra |
| `eixo_capacidade_investimento` | numeric | Score capacidade de investimento |
| `eixo_complexidade_caso` | numeric | Score complexidade do caso |
| `eixo_potencial_expansao` | numeric | Score potencial de expansão |
| `eixo_engajamento` | numeric | Score engajamento |
| `eixo_fit_produto` | numeric | Score fit com produto |
| `eixo_risco_churn` | numeric | Score risco de churn |
| `eixo_influencia_mercado` | numeric | Score influência no mercado |
| `eixo_lifetime_value_potencial` | numeric | Score LTV potencial |
| `confidence_score_analysis` | numeric | Confiança da análise (0-100) |
| `cognitive_summary` | text | Resumo da análise em texto livre |

### 3.5 Intelligence Score (~5 colunas)

| Coluna | Tipo | Descrição |
|---|---|---|
| `intelligence_score` | jsonb | Score detalhado por eixo |
| `intelligence_score_total` | numeric | Score total consolidado (0-100) |
| `intelligence_score_updated_at` | timestamptz | Última atualização do score |

**Fórmula do Intelligence Score (4 eixos):**

```
score = (sales_heat × 0.35) + (technical_maturity × 0.20) + 
        (behavioral_engagement × 0.25) + (purchase_power × 0.20)
```

- **sales_heat**: urgency_level (45%) + interest_timeline (40%) + recency_bonus (15%)
- **technical_maturity**: tem_impressora + tem_scanner + software_cad + volume_mensal_pecas (25% cada)
- **behavioral_engagement**: messages_score (35%) + sessions_score (35%) + confidence (30%)
- **purchase_power**: proposals (50%) + ecommerce (30%) + academy (20%)

### 3.6 Equipamentos & Ativos (~20 colunas)

| Coluna | Tipo | Descrição |
|---|---|---|
| `equip_impressora` | text | Modelo da impressora |
| `equip_scanner` | text | Modelo do scanner |
| `equip_pos_impressao` | text | Equipamento de pós-impressão |
| `equip_software` | text | Software CAD utilizado |
| `equip_forno` | text | Modelo do forno |
| `equip_serial_*` | text | Números de série |
| `equip_ativacao_*` | timestamptz | Datas de ativação |
| `ativo_scan` | boolean | Possui scanner ativo |
| `ativo_cad` | boolean | Possui CAD ativo |
| `ativo_print` | boolean | Possui impressora ativa |
| `ativo_cura` | boolean | Possui cura ativa |
| `ativo_forno` | boolean | Possui forno ativo |
| `ativo_fresadora` | boolean | Possui fresadora ativa |
| `ativo_articulador` | boolean | Possui articulador ativo |
| `ativo_insumos` | boolean | Compra insumos regularmente |
| `data_ultima_compra_impressora` | timestamptz | Última compra de impressora |
| `data_ultima_compra_scanner` | timestamptz | Última compra de scanner |
| `data_ultima_compra_resina` | timestamptz | Última compra de resina |
| `data_ultima_compra_insumo` | timestamptz | Última compra de insumo |

### 3.7 E-commerce Loja Integrada (~25 colunas)

| Coluna | Tipo | Descrição |
|---|---|---|
| `lojaintegrada_cliente_id` | text | ID do cliente na Loja Integrada |
| `lojaintegrada_ultimo_pedido_id` | text | ID do último pedido |
| `lojaintegrada_ultimo_pedido_status` | text | Status do último pedido |
| `lojaintegrada_ultimo_pedido_valor` | numeric | Valor do último pedido |
| `lojaintegrada_ultimo_pedido_data` | timestamptz | Data do último pedido |
| `lojaintegrada_total_pedidos` | integer | Total de pedidos |
| `lojaintegrada_historico_pedidos` | jsonb | Histórico completo de pedidos |
| `lojaintegrada_endereco` | jsonb | Endereço do cliente |
| `lojaintegrada_tags` | text[] | Tags do e-commerce |
| `lojaintegrada_ltv` | numeric | LTV calculado via e-commerce |
| `lojaintegrada_primeiro_pedido_data` | timestamptz | Data do primeiro pedido |
| `lojaintegrada_dias_entre_pedidos` | numeric | Média de dias entre pedidos |
| `lojaintegrada_categoria_principal` | text | Categoria mais comprada |
| `lojaintegrada_ultimo_tracking` | jsonb | Dados de rastreamento |
| `lojaintegrada_payment_method` | text | Método de pagamento preferido |
| `ec_cliente_recorrente` | boolean | Tag: cliente recorrente |
| `ec_cliente_inativo` | boolean | Tag: cliente inativo |

### 3.8 Astron Academy (~12 colunas)

| Coluna | Tipo | Descrição |
|---|---|---|
| `astron_user_id` | text | ID do usuário na Astron |
| `astron_status` | text | Status (active, inactive, expired) |
| `astron_plans` | jsonb | Planos ativos |
| `astron_courses_access` | text[] | Cursos com acesso |
| `astron_courses_total` | integer | Total de cursos |
| `astron_courses_completed` | integer | Cursos completados |
| `astron_last_login` | timestamptz | Último login |
| `astron_login_url` | text | URL de login direto |
| `astron_progress` | jsonb | Progresso por curso |
| `astron_certificate_count` | integer | Certificados obtidos |
| `astron_enrolled_at` | timestamptz | Data de matrícula |
| `astron_synced_at` | timestamptz | Última sincronização |

### 3.9 Automação (~10 colunas)

| Coluna | Tipo | Descrição |
|---|---|---|
| `proactive_sent_at` | timestamptz | Última abordagem proativa enviada |
| `proactive_sent_count` | integer | Total de abordagens proativas |
| `proactive_type_last` | text | Tipo da última abordagem |
| `crm_lock_until` | timestamptz | Lock de sincronização CRM até |
| `crm_lock_source` | text | Fonte do lock (kanban_move, webhook, etc.) |
| `automation_cooldown_until` | timestamptz | Cooldown de automação até |
| `last_outbound_at` | timestamptz | Último envio outbound |
| `last_inbound_at` | timestamptz | Último recebimento inbound |
| `total_messages` | integer | Total de mensagens trocadas |
| `total_sessions` | integer | Total de sessões de chat |
| `ultima_sessao_at` | timestamptz | Data da última sessão |

### 3.10 Workflow & Status (~10 colunas)

| Coluna | Tipo | Descrição |
|---|---|---|
| `status_scanner` | text | Status no estágio Scanner |
| `status_cad` | text | Status no estágio CAD |
| `status_impressora` | text | Status no estágio Impressão |
| `status_pos_impressao` | text | Status no estágio Pós-Impressão |
| `status_insumos` | text | Status no estágio Insumos |
| `workflow_score` | integer | Score de workflow (0-10, via trigger) |
| `urgency_level` | text | Nível de urgência (alta/media/baixa) |
| `interest_timeline` | text | Timeline de interesse |
| `tem_impressora` | text | Situação de impressora |
| `tem_scanner` | text | Situação de scanner |
| `software_cad` | text | Software CAD utilizado |
| `volume_mensal_pecas` | text | Volume mensal de peças |

---

## Parte 4 — Inventário Completo de Endpoints

### 4.1 Leads & CRM (30 funções)

| # | Edge Function | LOC | JWT | IA | Tabelas Lidas | Tabelas Escritas |
|---|---|---|---|---|---|---|
| 1 | `smart-ops-ingest-lead` | ~400 | ❌ | — | lia_attendances | lia_attendances |
| 2 | `smart-ops-piperun-webhook` | ~350 | ❌ | — | lia_attendances | lia_attendances |
| 3 | `smart-ops-sync-piperun` | ~500 | ❌ | — | lia_attendances, team_members | lia_attendances |
| 4 | `piperun-full-sync` | ~600 | ❌ | — | lia_attendances | lia_attendances, deal_items |
| 5 | `smart-ops-sellflux-webhook` | ~400 | ❌ | — | lia_attendances | lia_attendances |
| 6 | `smart-ops-sellflux-sync` | ~300 | ❌ | — | lia_attendances | lia_attendances |
| 7 | `smart-ops-ecommerce-webhook` | ~450 | ❌ | — | lia_attendances | lia_attendances |
| 8 | `poll-loja-integrada-orders` | ~500 | ❌ | — | lia_attendances, message_logs | lia_attendances, message_logs |
| 9 | `cognitive-lead-analysis` | ~350 | ❌ | DeepSeek v3 | lia_attendances | lia_attendances, ai_token_usage |
| 10 | `batch-cognitive-analysis` | ~200 | ❌ | DeepSeek v3 | lia_attendances | lia_attendances |
| 11 | `smart-ops-stagnant-processor` | ~400 | ❌ | DeepSeek v3 | lia_attendances | lia_attendances, message_logs |
| 12 | `smart-ops-proactive-outreach` | ~350 | ❌ | — | lia_attendances, cs_automation_rules | lia_attendances, message_logs |
| 13 | `smart-ops-cs-processor` | ~300 | ❌ | — | cs_automation_rules, lia_attendances | message_logs |
| 14 | `smart-ops-kanban-move` | ~200 | ❌ | — | lia_attendances | lia_attendances |
| 15 | `smart-ops-lia-assign` | ~150 | ❌ | — | lia_attendances, team_members | lia_attendances |
| 16 | `smart-ops-send-waleads` | ~200 | ❌ | — | team_members, lia_attendances | message_logs, whatsapp_inbox |
| 17 | `smart-ops-wa-inbox-webhook` | ~350 | ❌ | — | lia_attendances | whatsapp_inbox |
| 18 | `smart-ops-copilot` | ~400 | ❌ | Gemini 2.5 | lia_attendances, multiple | — |
| 19 | `import-leads-csv` | ~300 | ❌ | — | — | lia_attendances |
| 20 | `import-proposals-csv` | ~250 | ❌ | — | lia_attendances | deal_items, lia_attendances |
| 21 | `backfill-lia-leads` | ~200 | ❌ | — | lia_attendances | lia_attendances |
| 22 | `backfill-intelligence-score` | ~150 | ❌ | — | lia_attendances | lia_attendances |
| 23 | `backfill-ltv` | ~150 | ❌ | — | lia_attendances | lia_attendances |
| 24 | `backfill-keywords` | ~200 | ❌ | — | knowledge_contents | knowledge_contents |
| 25 | `fix-piperun-links` | ~150 | ❌ | — | lia_attendances | lia_attendances |
| 26 | `piperun-api-test` | ~100 | ❌ | — | — | — |
| 27 | `sync-astron-members` | ~300 | ❌ | — | lia_attendances | lia_attendances |
| 28 | `astron-member-lookup` | ~150 | ❌ | — | lia_attendances | — |
| 29 | `astron-postback` | ~200 | ❌ | — | lia_attendances | lia_attendances |
| 30 | `create-technical-ticket` | ~150 | ❌ | — | — | support_cases |

### 4.2 Content & Knowledge (28 funções)

| # | Edge Function | LOC | JWT | IA | Descrição |
|---|---|---|---|---|---|
| 1 | `ai-orchestrate-content` | ~800 | ❌ | Gemini 2.5 Flash | Orquestrador principal de conteúdo |
| 2 | `ai-content-formatter` | ~400 | ❌ | Gemini 2.5 Flash | Formatação HTML semântico |
| 3 | `ai-enrich-pdf-content` | ~300 | ❌ | Gemini 2.5 Flash | Enriquecimento de conteúdo PDF |
| 4 | `ai-metadata-generator` | ~250 | ✅ | Gemini 2.5 Flash | Geração de metadata SEO |
| 5 | `ai-generate-og-image` | ~350 | ❌ | Gemini 2.5 Flash | Geração de imagens OG |
| 6 | `extract-pdf-text` | ~200 | ❌ | — | Extração de texto de PDFs |
| 7 | `extract-pdf-raw` | ~200 | ❌ | — | Extração raw de PDFs |
| 8 | `extract-pdf-specialized` | ~300 | ❌ | Gemini 2.5 Flash | Extração especializada com IA |
| 9 | `extract-and-cache-pdf` | ~250 | ❌ | — | Extração com cache |
| 10 | `extract-video-content` | ~300 | ❌ | Gemini 2.5 Flash | Extração de conteúdo de vídeo |
| 11 | `reformat-article-html` | ~400 | ❌ | Gemini 2.5 Flash | Reformatação de HTML |
| 12 | `enrich-article-seo` | ~350 | ❌ | Gemini 2.5 Flash | Enriquecimento SEO |
| 13 | `auto-inject-product-cards` | ~300 | ❌ | — | Injeção de product cards |
| 14 | `translate-content` | ~250 | ❌ | Gemini 2.5 Flash | Tradução PT→EN/ES |
| 15 | `create-test-articles` | ~200 | ✅ | — | Criação de artigos de teste |
| 16 | `link-videos-to-articles` | ~200 | ❌ | — | Vinculação vídeos ↔ artigos |
| 17 | `sync-pandavideo` | ~350 | ❌ | — | Sincronização PandaVideo |
| 18 | `sync-video-analytics` | ~250 | ❌ | — | Sync analytics de vídeo |
| 19 | `sync-knowledge-base` | ~500 | ❌ | — | Sync Knowledge Base do Sistema A |
| 20 | `sync-google-drive-kb` | ~350 | ❌ | — | Sync Google Drive |
| 21 | `sync-google-reviews` | ~200 | ❌ | — | Sync Google Reviews |
| 22 | `enrich-resins-from-apostila` | ~300 | ❌ | Gemini 2.5 Flash | Enriquecimento resinas |
| 23 | `ingest-knowledge-text` | ~200 | ❌ | — | Ingestão de texto KB |
| 24 | `index-embeddings` | ~300 | ❌ | OpenAI/Google | Indexação de embeddings |
| 25 | `index-spin-entries` | ~200 | ❌ | OpenAI/Google | Indexação SPIN selling |
| 26 | `heal-knowledge-gaps` | ~400 | ✅ | DeepSeek v3 | Healing de knowledge gaps |
| 27 | `generate-veredict-data` | ~300 | ❌ | Gemini 2.5 Flash | Geração de dados de veredicto |
| 28 | `generate-parameter-pages` | ~250 | ❌ | — | Geração de páginas de parâmetros |

### 4.3 Sitemaps & Discovery (8 funções)

| # | Edge Function | JWT | Descrição |
|---|---|---|---|
| 1 | `generate-sitemap` | ❌ | Sitemap principal (produtos, marcas, modelos) |
| 2 | `generate-knowledge-sitemap` | ❌ | Sitemap Knowledge Base (PT) |
| 3 | `generate-knowledge-sitemap-en` | ❌ | Sitemap Knowledge Base (EN) |
| 4 | `generate-knowledge-sitemap-es` | ❌ | Sitemap Knowledge Base (ES) |
| 5 | `generate-documents-sitemap` | ❌ | Sitemap de documentos técnicos |
| 6 | `knowledge-feed` | ❌ | RSS/Atom/JSON feed |
| 7 | `seo-proxy` | ❌ | SSR para bots (2004 LOC) |
| 8 | `document-proxy` | ❌ | Proxy de documentos técnicos |

### 4.4 Agente Dra. L.I.A. (7 funções)

| # | Edge Function | LOC | IA | Descrição |
|---|---|---|---|---|
| 1 | `dra-lia` | 5092 | Gemini 2.5 Flash | Core do agente conversacional |
| 2 | `dra-lia-whatsapp` | ~400 | — | Adaptador WhatsApp (dedup, stale filter) |
| 3 | `dra-lia-export` | ~200 | — | Exportação de conversas |
| 4 | `evaluate-interaction` | ~300 | DeepSeek v3 | Judge evaluator de qualidade |
| 5 | `extract-commercial-expertise` | ~250 | DeepSeek v3 | Extração de expertise comercial |
| 6 | `archive-daily-chats` | ~150 | — | Arquivamento diário |
| 7 | `system-watchdog-deepseek` | ~200 | DeepSeek v3 | Watchdog de qualidade |

### 4.5 Sync & Misc (16 funções)

| # | Edge Function | JWT | Descrição |
|---|---|---|---|
| 1 | `sync-sistema-a` | ❌ | Sync catálogo Sistema A → products_catalog |
| 2 | `import-system-a-json` | ❌ | Import bulk Sistema A |
| 3 | `import-loja-integrada` | ❌ | Import Loja Integrada |
| 4 | `register-loja-webhooks` | ❌ | Registro de webhooks LI |
| 5 | `data-export` | ❌ | API de exportação (14 datasets) |
| 6 | `get-product-data` | ❌ | Busca de produto (4-step fuzzy) |
| 7 | `export-parametros-ia` | ❌ | Exportação params IA |
| 8 | `export-processing-instructions` | ❌ | Export instruções processamento |
| 9 | `export-apostila-docx` | ❌ | Export apostila DOCX |
| 10 | `format-processing-instructions` | ❌ | Formatação instruções |
| 11 | `migrate-catalog-images` | ❌ | Migração de imagens |
| 12 | `pandavideo-test` | ❌ | Teste PandaVideo |
| 13 | `test-api-viewer` | ❌ | Viewer de teste de API |
| 14 | `create-user` | ✅ | Criação de usuário admin |
| 15 | `smart-ops-copilot` | ❌ | Copilot inteligente (Dual Brain) |
| 16 | `ai-model-compare` | ❌ | Comparação de modelos IA |

### 4.6 Meta Ads (3 funções — pendente consolidação)

| # | Edge Function | JWT | IA | Secret | Status |
|---|---|---|---|---|---|
| 1 | `smart-ops-meta-lead-webhook` | ❌ | — | META_LEAD_ADS_TOKEN, META_WEBHOOK_VERIFY_TOKEN | ⚠️ 404 (limite funções) |
| 2 | `smart-ops-meta-ads-manager` | ❌ | — | META_ADS_MANAGER_TOKEN | ⚠️ 404 |
| 3 | `smart-ops-meta-ads-insights` | ❌ | — | META_ADS_INSIGHTS_TOKEN | ⚠️ 404 |

> **Nota:** Estas 3 funções precisam ser consolidadas em `smart-ops-meta-gateway` para resolver o limite de Edge Functions do Supabase.

---

## Parte 5 — Fluxos de Leads

### Fluxo 1: Formulário Web → CDP

```
Trigger: Formulário público (PublicFormPage.tsx) ou Dra. L.I.A.
Entrada: { nome, email, telefone, area_atuacao, especialidade, form_name }

┌──────────────────┐
│ PublicFormPage    │ → POST smart-ops-ingest-lead
└────────┬─────────┘
         │
┌────────▼──────────────────────────────────────┐
│ smart-ops-ingest-lead                         │
│ 1. Normaliza telefone (+55...)                │
│ 2. Normaliza email (lowercase)                │
│ 3. Busca lead existente (email OR telefone)   │
│ 4. Smart Merge: upsert sem sobrescrever       │
│    campos já preenchidos                      │
│ 5. Detecta source via fn_map_lead_source()    │
│ 6. Define lead_status = 'lead'                │
│ 7. Chama cognitive-lead-analysis (async)      │
└────────┬──────────────────────────────────────┘
         │
┌────────▼─────────┐
│ lia_attendances  │ (upsert)
└────────┬─────────┘
         │ (async)
┌────────▼──────────────────────────────────────┐
│ cognitive-lead-analysis (DeepSeek v3)         │
│ 1. Carrega contexto completo do lead          │
│ 2. Prompt estruturado com 10 eixos            │
│ 3. Gera análise JSONB                         │
│ 4. Atualiza cognitive_analysis + 10 eixos     │
│ 5. Dispara calculate_intelligence_score()     │
└───────────────────────────────────────────────┘

Campos de entrada: nome, email, telefone, area_atuacao, especialidade, 
                   form_name, utm_source, utm_medium, utm_campaign
Campos de saída:   id, lead_status, source, cognitive_analysis, 
                   intelligence_score_total, 10× eixo_*
Tabelas afetadas:  lia_attendances, ai_token_usage
Secrets:           DEEPSEEK_API_KEY
```

### Fluxo 2: Meta Ads → CDP

```
Trigger: Meta Lead Ads form submission
Entrada: { leadgen_id, page_id, form_id } via webhook

┌──────────────────┐
│ Meta Platform    │ → POST smart-ops-meta-lead-webhook
└────────┬─────────┘
         │
┌────────▼──────────────────────────────────────┐
│ smart-ops-meta-lead-webhook                   │
│ 1. GET verificação (hub.mode=subscribe)       │
│ 2. POST: parse entry[].changes[]              │
│ 3. Filtra field=leadgen                       │
│ 4. Fetch Graph API v21.0/{leadgen_id}         │
│ 5. Parse field_data[] → { email, full_name,   │
│    phone_number, especialidade, city, state }  │
│ 6. Normaliza payload                          │
│ 7. POST → smart-ops-ingest-lead              │
└────────┬──────────────────────────────────────┘
         │
┌────────▼─────────┐
│ ingest-lead      │ (smart merge + cognitive)
└──────────────────┘

Campos de entrada Meta: leadgen_id, page_id, form_id, created_time,
                        field_data[].{name, values[]}
Campos normalizados:    email, full_name, phone_number, especialidade,
                        area_atuacao, city, state, source='meta_lead_ads',
                        utm_source='facebook'|'instagram', utm_medium='paid'
Secrets:                META_LEAD_ADS_TOKEN, META_WEBHOOK_VERIFY_TOKEN
```

### Fluxo 3: SellFlux → CDP

```
Trigger: SellFlux webhook (automação ou formulário)
Entrada: Payload variável com custom_fields

┌──────────────────┐
│ SellFlux         │ → POST smart-ops-sellflux-webhook
└────────┬─────────┘
         │
┌────────▼──────────────────────────────────────┐
│ smart-ops-sellflux-webhook                    │
│ 1. Detecta health check (payload vazio)       │
│ 2. Detecção dinâmica de origem:               │
│    - tracking/transaction → 'loja_integrada'  │
│    - tags específicas → automação name         │
│    - default → automação/formulário            │
│ 3. Map 'atual-id-pipe' → piperun_id           │
│ 4. Armazena em sellflux_custom_fields:        │
│    - dados de treinamento                     │
│    - credenciais Astron                       │
│    - códigos de pagamento (PIX/Boleto)        │
│ 5. Normaliza email (lowercase)                │
│ 6. Forward → smart-ops-ingest-lead            │
└────────┬──────────────────────────────────────┘
         │
┌────────▼─────────┐
│ ingest-lead      │ (smart merge)
└──────────────────┘

Campos de entrada SellFlux: email, phone, name, tags, custom_fields,
                            tracking_data, transaction_data, automation_name,
                            form_name, atual-id-pipe
Campos escritos no CDP:     sellflux_custom_fields (JSONB), tags_crm,
                            piperun_id, utm_source/medium/campaign
Secrets:                    SELLFLUX_API_KEY, SELLFLUX_WEBHOOK_CAMPANHAS
```

### Fluxo 4: E-commerce (Loja Integrada) → CDP

```
Trigger 1: Webhook de novo pedido
Trigger 2: Polling a cada 30min (poll-loja-integrada-orders)
Trigger 3: Webhook de status change

┌──────────────────┐   ┌──────────────────┐
│ LI Webhook       │   │ pg_cron polling  │
└────────┬─────────┘   └────────┬─────────┘
         │                      │
         └──────────┬───────────┘
                    │
┌───────────────────▼──────────────────────────┐
│ smart-ops-ecommerce-webhook /                │
│ poll-loja-integrada-orders                   │
│ 1. Autenticação: chave_api + chave_aplicacao │
│    (query params, NÃO headers)               │
│ 2. Parse order → resource_uri                │
│ 3. Fetch client data via resource_uri        │
│ 4. Map status IDs (3=pago, 5=entregue)       │
│ 5. Idempotency via message_logs (1h window)  │
│ 6. Fetch historical orders → calc LTV        │
│ 7. Tags: EC_CLIENTE_RECORRENTE,              │
│    EC_CLIENTE_INATIVO                         │
│ 8. Forward → ingest-lead                     │
└───────────────────┬──────────────────────────┘
                    │
┌───────────────────▼─────────┐
│ lia_attendances             │
│ + lojaintegrada_* (~25 cols)│
└─────────────────────────────┘

Campos de entrada LI: order_id, client.resource_uri, items[], address,
                      payment, shipping, status_id, created, number
Campos escritos:      lojaintegrada_cliente_id, _ultimo_pedido_*,
                      _total_pedidos, _historico_pedidos, _endereco,
                      _ltv, _dias_entre_pedidos, ec_cliente_recorrente,
                      ec_cliente_inativo
Secrets:              LOJA_INTEGRADA_API_KEY, LOJA_INTEGRADA_APP_KEY
```

### Fluxo 5: PipeRun Bidirecional

```
═══ INBOUND (PipeRun → CDP) ═══

Trigger: Webhook de deal update OU pg_cron sync (cada 20min)

┌──────────────────┐
│ PipeRun Webhook  │ → POST smart-ops-piperun-webhook
└────────┬─────────┘
         │
┌────────▼──────────────────────────────────────┐
│ smart-ops-piperun-webhook                     │
│ 1. Parse deal: id, stage, pipeline, value     │
│ 2. Fetch person (GET /persons/{id})           │
│ 3. Fetch company (GET /companies/{id})        │
│ 4. Fetch proposals (GET /deals/{id}/proposals)│
│ 5. Map piperun-field-map.ts                   │
│    (~40 campos mapeados)                      │
│ 6. Upsert lia_attendances                     │
│ 7. Track lead_state_events (regressão check)  │
└────────┬──────────────────────────────────────┘
         │
┌────────▼─────────┐
│ lia_attendances  │ (upsert ~40 colunas piperun_*)
└──────────────────┘

═══ OUTBOUND (CDP → PipeRun) ═══

Trigger: Kanban move no SmartOps UI

┌──────────────────┐
│ SmartOpsKanban   │ → POST smart-ops-kanban-move
└────────┬─────────┘
         │
┌────────▼──────────────────────────────────────┐
│ smart-ops-kanban-move                         │
│ 1. Recebe { lead_id, target_stage_id }        │
│ 2. Atualiza piperun_stage_id local            │
│ 3. PUT /deals/{piperun_id} no PipeRun         │
│ 4. Insere nota (briefing/análise cognitiva)   │
│ 5. Set crm_lock (30s anti-race)               │
└───────────────────────────────────────────────┘

Campos de entrada PipeRun: deal_id, pipeline_id, stage_id, owner_id,
                           person_id, company_id, value, custom_fields,
                           proposals[], tags[], activities[]
Campos escritos no CDP:    piperun_id/title/status/pipeline_*/stage_*/
                           owner_*/value/tags/notes/created_at/updated_at/
                           won_at/lost_at/lost_reason + pessoa_* + empresa_*
                           + proposals_data/total_value/count + deals_history
Secrets:                   PIPERUN_API_TOKEN
```

### Fluxo 6: Stagnation Processor

```
Trigger: pg_cron diário

┌──────────────────────────────────────────────┐
│ smart-ops-stagnant-processor                 │
│ 1. Query leads estagnados:                   │
│    updated_at < NOW() - interval '7 days'    │
│    AND lead_status NOT IN ('won','lost')      │
│ 2. Para cada lead estagnado:                 │
│    a. Carrega contexto (deals, messages)     │
│    b. Prompt DeepSeek v3:                    │
│       "Analise por que este lead estagnou    │
│        e sugira próxima ação"                │
│    c. Gera recomendação estruturada          │
│ 3. Classifica ação:                          │
│    - reengagement_call                       │
│    - content_nudge                           │
│    - price_adjustment                        │
│    - mark_lost                               │
│ 4. Atualiza lead com recomendação            │
│ 5. Opcional: envia mensagem proativa         │
└──────────────────────────────────────────────┘

Campos de entrada: lead completo (contexto)
Campos de saída:   stagnation_analysis, recommended_action, 
                   stagnation_days, last_stagnation_check
Secrets:           DEEPSEEK_API_KEY
```

### Fluxo 7: Proactive Outreach

```
Trigger: pg_cron ou manual

┌──────────────────────────────────────────────┐
│ smart-ops-proactive-outreach                 │
│ 1. Consulta cs_automation_rules (ativas)     │
│ 2. Para cada regra:                          │
│    - Filtra leads elegíveis:                 │
│      • automation_cooldown_until < NOW()     │
│      • proactive_sent_count < max            │
│      • last_outbound_at < threshold          │
│ 3. 4 tipos de outreach:                      │
│    a. welcome_onboarding (novos leads)       │
│    b. reengagement (leads inativos)          │
│    c. upsell (clientes ativos)               │
│    d. support_followup (pos-suporte)         │
│ 4. Envia via SellFlux Campaign ou WaLeads    │
│ 5. Registra em message_logs                  │
│ 6. Atualiza proactive_sent_at/count          │
└──────────────────────────────────────────────┘

Regras de elegibilidade:
- Cooldown mínimo: 72h entre abordagens
- Máximo 5 abordagens proativas por lead
- Não enviar se crm_lock ativo
- Respeitar horário comercial (8h-18h BRT)
```

### Fluxo 8: WhatsApp Inbox → Intent Classification

```
Trigger: Webhook WaLeads (mensagem recebida)

┌──────────────────────────────────────────────┐
│ smart-ops-wa-inbox-webhook                   │
│ 1. Parse: phone, message_text, senderName,   │
│    media_url, media_type                     │
│ 2. Normaliza telefone                        │
│ 3. Insere em whatsapp_inbox                  │
│ 4. Match lead via telefone_normalized        │
│ 5. Intent Classification (6 primários):      │
│    ┌─────────────────────────────────────┐   │
│    │ ① suporte_tecnico                   │   │
│    │ ② compra_interesse                  │   │
│    │ ③ status_pedido                     │   │
│    │ ④ agendamento                       │   │
│    │ ⑤ reclamacao                        │   │
│    │ ⑥ informacao_geral                  │   │
│    └─────────────────────────────────────┘   │
│ 6. 15 intents secundários:                   │
│    produto_especifico, preco, prazo_entrega, │
│    garantia, treinamento, resina_especifica, │
│    parametros_impressao, assistencia,        │
│    devolucao, nota_fiscal, rastreamento,     │
│    parceria, revenda, feedback, outros       │
│ 7. Atualiza lead: last_inbound_at,           │
│    total_messages++                           │
└──────────────────────────────────────────────┘
```

---

## Parte 6 — Fluxos de Conteúdo

### Fluxo 1: PDF → Artigo Publicado

```
┌─────────────────────────────────────────────────────────────────────┐
│ EXTRAÇÃO (4 funções)                                               │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │extract-pdf-  │  │extract-pdf-  │  │extract-pdf-  │              │
│  │text (básico) │  │raw (OCR)     │  │specialized   │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                 │                 │                       │
│         └─────────────────┴─────────────────┘                       │
│                           │                                         │
│              ┌────────────▼────────────┐                            │
│              │ extract-and-cache-pdf   │                            │
│              │ (dedup via file_hash)   │                            │
│              └────────────┬────────────┘                            │
│                           │ extracted_text                          │
└───────────────────────────┼─────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────────┐
│ ORQUESTRAÇÃO                                                        │
│                                                                     │
│  ┌────────────────────────────────────────────────────┐              │
│  │ ai-orchestrate-content (Gemini 2.5 Flash)          │              │
│  │                                                    │              │
│  │ Input (OrchestrationRequest):                      │              │
│  │ {                                                  │              │
│  │   pdf_text: string,                                │              │
│  │   product_name: string,                            │              │
│  │   product_slug: string,                            │              │
│  │   reference_images?: string[],                     │              │
│  │   existing_article?: string,                       │              │
│  │   language: 'pt' | 'en' | 'es',                   │              │
│  │   content_type: 'technical' | 'commercial'         │              │
│  │ }                                                  │              │
│  │                                                    │              │
│  │ Output (OrchestrationResponse):                    │              │
│  │ {                                                  │              │
│  │   title: string,                                   │              │
│  │   slug: string,                                    │              │
│  │   excerpt: string,                                 │              │
│  │   content_html: string,                            │              │
│  │   meta_description: string,                        │              │
│  │   keywords: string[],                              │              │
│  │   faqs: { question, answer }[],                    │              │
│  │   ai_context: string,                              │              │
│  │   recommended_products: string[],                  │              │
│  │   veredict_data: object                            │              │
│  │ }                                                  │              │
│  └────────────────────────┬───────────────────────────┘              │
└───────────────────────────┼─────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────────┐
│ PÓS-PROCESSAMENTO (6 funções)                                      │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │reformat-     │  │enrich-       │  │auto-inject-  │              │
│  │article-html  │  │article-seo   │  │product-cards │              │
│  │(HTML cleanup)│  │(meta, FAQs)  │  │(inline CTAs) │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │translate-    │  │ai-generate-  │  │ai-metadata-  │              │
│  │content      │  │og-image      │  │generator     │              │
│  │(PT→EN/ES)   │  │(banner)      │  │(SEO tags)    │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                  ┌─────────▼──────────┐
                  │ knowledge_contents │
                  │ (publicado)        │
                  └────────────────────┘
```

### Fluxo 2: Vídeo → Artigo

```
PandaVideo API → sync-pandavideo → knowledge_videos
                                        │
                                  extract-video-content
                                  (transcrição → artigo)
                                        │
                               ai-orchestrate-content
                                        │
                               knowledge_contents
```

### Fluxo 3: Google Drive → Knowledge Base

```
Google Drive API → sync-google-drive-kb → company_kb_texts
                                              │
                                        index-embeddings
                                              │
                                        agent_embeddings
```

### Fluxo 4: Apostila → Resinas

```
catalog_documents (PDF apostila)
        │
  enrich-resins-from-apostila (Gemini)
        │
  system_a_catalog (atualização dados técnicos)
```

### Fluxo 5: Knowledge Gaps → Artigos

```
agent_knowledge_gaps (perguntas sem resposta)
        │
  heal-knowledge-gaps (DeepSeek v3)
        │
  knowledge_gap_drafts (rascunhos)
        │ (review humano)
  knowledge_contents (publicação)
```

### Fluxo 6: Tradução Pipeline

```
knowledge_contents.content_html (PT)
        │
  translate-content (Gemini 2.5 Flash)
        │
  ┌─────┴─────┐
  │            │
content_html_en  content_html_es
title_en         title_es
excerpt_en       excerpt_es
faqs_en          faqs_es
ai_context_en    ai_context_es
```

### Fluxo 7: SEO Exposure Pipeline

```
knowledge_contents (artigos publicados)
        │
  ┌─────┼─────────────────────────────────┐
  │     │                                 │
  │  seo-proxy                      generate-*-sitemap
  │  (SSR para bots)                (5 sitemaps XML)
  │  • 15+ User-Agents              │
  │  • 8 generators                  knowledge-feed
  │  • Full HTML semântico           (RSS/Atom/JSON)
  │  • JSON-LD injection             │
  │  • 2004 LOC                      llms.txt
  │                                  robots.txt
  └──────────────────────────────────┘
```

---

## Parte 7 — Fluxos de Atendimento (Dra. L.I.A.)

### 7.1 Widget Web → RAG → Response

```
┌─────────────────────────────────────────────────────────────────────┐
│ DraLIA.tsx (Widget Web)                                            │
│                                                                     │
│ 1. Usuário abre widget (canto inferior direito)                    │
│ 2. Session Management:                                              │
│    - Gera session_id (UUID)                                         │
│    - Armazena em agent_sessions (current_state)                     │
│                                                                     │
│ 3. Lead Gate (coleta obrigatória sequencial):                      │
│    ┌──────────────────────────────────────┐                         │
│    │ Gate 1: email (obrigatório)          │                         │
│    │ Gate 2: nome (obrigatório)           │                         │
│    │ Gate 3: telefone (obrigatório)       │                         │
│    │ Gate 4: area_atuacao (obrigatório)   │                         │
│    │ Gate 5: especialidade (obrigatório)  │                         │
│    └──────────────────────────────────────┘                         │
│    Após coleta → upsert lia_attendances via ingest-lead            │
│                                                                     │
│ 4. POST → dra-lia Edge Function                                    │
│    { session_id, message, lead_id?, lang }                         │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────────┐
│ dra-lia (5092 LOC)                                                  │
│                                                                     │
│ Pipeline RAG:                                                       │
│ 1. Gera embedding da mensagem (text-embedding-004, 768d)           │
│ 2. match_agent_embeddings_v2(embedding, threshold=0.60, count=10)  │
│ 3. Re-ranking por tópico (boost fontes relevantes):                │
│    - catalog_document: +0.15 se pergunta sobre produto             │
│    - knowledge_article: +0.10 se pergunta conceitual               │
│    - processing_instruction: +0.20 se pergunta sobre protocolo     │
│ 4. Compõe contexto (top 5 chunks, max 4000 tokens)                 │
│                                                                     │
│ System Prompt (system-prompt.ts):                                   │
│ - Persona: Dra. L.I.A. (consultora técnica Smart Dent)             │
│ - Guardrails (lia-guards.ts):                                      │
│   • Não inventar especificações                                    │
│   • Não comparar com concorrentes                                  │
│   • Não dar conselhos médicos                                      │
│   • Sempre citar fonte                                             │
│ - SPIN Selling consultivo:                                         │
│   • Situação → Problema → Implicação → Necessidade                │
│ - Entity Dictionary: resolve nomes de produtos                     │
│                                                                     │
│ 5. Gemini 2.5 Flash → resposta                                     │
│ 6. Insere em agent_interactions                                     │
│ 7. Extrai entidades → lia-lead-extraction → atualiza SDR fields    │
│ 8. Detecta knowledge gaps → agent_knowledge_gaps                    │
│ 9. Trigger: evaluate-interaction (judge, async)                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.2 WhatsApp → Adaptador

```
┌──────────────────────────────────────────────┐
│ dra-lia-whatsapp                             │
│                                               │
│ Adaptações sobre dra-lia:                    │
│ 1. Deduplicação: ignora mensagens duplicadas │
│    (mesmo phone + message em 60s window)     │
│ 2. Stale Filter: ignora mensagens > 5min     │
│ 3. Formato WhatsApp:                         │
│    - Remove HTML tags                        │
│    - Converte links em texto plano           │
│    - Limita a 4096 chars                     │
│    - Emoji-friendly formatting               │
│ 4. Auto-respond via WaLeads API              │
│ 5. Insere resposta em whatsapp_inbox         │
│    (direction='outbound')                    │
└──────────────────────────────────────────────┘
```

### 7.3 Embed iframe

```
┌──────────────────────────────────────────────┐
│ AgentEmbed.tsx                                │
│                                               │
│ Rota: /agent-embed                           │
│ Props: <DraLIA embedded={true} />            │
│ Layout: full-screen, sem header/footer       │
│                                               │
│ Uso: iframe em sites parceiros               │
│ <iframe src="/agent-embed" />                │
└──────────────────────────────────────────────┘
```

### 7.4 Fluxo de Suporte Técnico

```
Usuário descreve problema técnico
        │
  Intent: suporte_tecnico
        │
  ┌─────▼──────────────────────────────────────┐
  │ 5 Estágios de Coleta:                      │
  │ ① Equipamento: qual modelo?                │
  │ ② Problema: descrição detalhada            │
  │ ③ Contexto: quando começou? frequência?    │
  │ ④ Tentativas: o que já tentou?             │
  │ ⑤ Urgência: impacto na produção?           │
  └─────┬──────────────────────────────────────┘
        │
  create-technical-ticket
        │
  ┌─────▼──────────────────────────────────────┐
  │ support_cases                              │
  │ • status: pending                          │
  │ • lead_id: FK                              │
  │ • equipment_model                          │
  │ • problem_description                      │
  │ • urgency_level                            │
  │ • resolution_notes (preenchido depois)     │
  └────────────────────────────────────────────┘
```

### 7.5 Indexação (8 fontes vetoriais)

| # | source_type | Origem | Pipeline |
|---|---|---|---|
| 1 | `catalog_document` | catalog_documents.extracted_text | Chunk 500 tokens → embed |
| 2 | `knowledge_article` | knowledge_contents.content_html | Strip HTML → chunk → embed |
| 3 | `knowledge_faq` | knowledge_contents.faqs | Q+A concat → embed |
| 4 | `testimonial` | system_a_catalog (testimonials) | Full text → embed |
| 5 | `kb_text` | company_kb_texts.content | Chunk → embed |
| 6 | `video_transcript` | knowledge_videos.video_transcript | Chunk → embed |
| 7 | `processing_instruction` | export-processing-instructions | Formatted → embed |
| 8 | `product_parameters` | parameter_sets + models | Structured → embed |

---

## Parte 8 — Integrações Externas

### 8.1 PipeRun CRM

| Atributo | Valor |
|---|---|
| **Protocolo** | REST API (v1) + Webhook bidirecional |
| **Base URL** | `https://api.pipe.run/v1` |
| **Autenticação** | Bearer token |
| **Secret** | `PIPERUN_API_TOKEN` |
| **Direção** | Bidirecional (inbound webhook + outbound API calls) |
| **Funis mapeados** | 11 (Vendas, Estagnados, CS, Insumos, E-commerce, Atos, Exportação, Distribuidor, etc.) |

**Campos de entrada (o que chega do PipeRun):**

| Campo | Tipo | Mapeamento CDP |
|---|---|---|
| `deal.id` | integer | piperun_id |
| `deal.title` | string | piperun_title |
| `deal.status` | string | piperun_status |
| `deal.pipeline_id` | integer | piperun_pipeline_id |
| `deal.pipeline.name` | string | piperun_pipeline_name |
| `deal.stage_id` | integer | piperun_stage_id |
| `deal.stage.name` | string | piperun_stage_name |
| `deal.owner_id` | integer | piperun_owner_id |
| `deal.owner.name` | string | piperun_owner_name |
| `deal.value` | decimal | piperun_value |
| `deal.created_at` | datetime | piperun_created_at |
| `deal.updated_at` | datetime | piperun_updated_at |
| `deal.won_at` | datetime | piperun_won_at |
| `deal.lost_at` | datetime | piperun_lost_at |
| `deal.lost_reason` | string | piperun_lost_reason |
| `deal.tags` | string[] | piperun_tags |
| `person.name` | string | pessoa_nome |
| `person.email` | string | pessoa_email / email |
| `person.phone` | string | pessoa_telefone |
| `person.cpf_cnpj` | string | pessoa_cpf |
| `person.city` | string | pessoa_cidade |
| `person.state` | string | pessoa_uf |
| `person.custom_fields.cro` | string | pessoa_cro |
| `person.custom_fields.especialidade` | string | pessoa_especialidade |
| `company.name` | string | empresa_nome |
| `company.cnpj` | string | empresa_cnpj |
| `company.city` | string | empresa_cidade |
| `company.state` | string | empresa_uf |
| `company.segment` | string | empresa_segmento |
| `company.size` | string | empresa_porte |
| `proposals[].items` | array | proposals_data, deal_items |
| `proposals[].total` | decimal | proposals_total_value |

**Volume:** ~40 colunas escritas no CDP. **Alto**.

### 8.2 SellFlux

| Atributo | Valor |
|---|---|
| **Protocolo** | REST API + Webhook receiver |
| **Autenticação** | API Key |
| **Secrets** | `SELLFLUX_API_KEY`, `SELLFLUX_WEBHOOK_CAMPANHAS` |
| **Direção** | Bidirecional (webhook inbound + campaign push outbound) |

**Campos de entrada:**

| Campo | Mapeamento CDP |
|---|---|
| `email` | email |
| `phone` | telefone_raw/normalized |
| `name` | nome |
| `tags` | tags_crm |
| `custom_fields` | sellflux_custom_fields (JSONB) |
| `custom_fields.atual-id-pipe` | piperun_id |
| `tracking.utm_source` | utm_source |
| `tracking.utm_medium` | utm_medium |
| `tracking.utm_campaign` | utm_campaign |
| `transaction.order_id` | lojaintegrada_ultimo_pedido_id |
| `automation_name` | form_name |

**Volume:** ~5 colunas diretas + UTMs + JSONB. **Médio**.

### 8.3 WaLeads

| Atributo | Valor |
|---|---|
| **Protocolo** | REST API |
| **Base URL** | `https://waleads.roote.com.br` |
| **Autenticação** | API Key por membro (team_members.waleads_api_key) |
| **Direção** | Outbound (envio) + Inbound (webhook recebimento) |

**Endpoints usados:**

| Método | Endpoint | Uso |
|---|---|---|
| POST | `/public/message/text` | Envio de texto |
| POST | `/public/message/image` | Envio de imagem |
| POST | `/public/message/audio` | Envio de áudio |
| POST | `/public/message/video` | Envio de vídeo |
| POST | `/public/message/document` | Envio de documento |

**Campos de saída (o que escrevemos):**

| Tabela | Campos |
|---|---|
| `message_logs` | lead_id, team_member_id, tipo, mensagem_preview, status, error_details |
| `whatsapp_inbox` | phone, phone_normalized, message_text, media_url, media_type, direction |

**Volume:** Registros em 2 tabelas por mensagem. **Médio**.

### 8.4 Astron Members (Academy)

| Atributo | Valor |
|---|---|
| **Protocolo** | Postback (webhook inbound) + REST (lookup) |
| **Secrets** | `ASTRON_API_KEY` (quando aplicável) |
| **Direção** | Inbound (postback) + Outbound (lookup) |

**Campos de entrada:**

| Campo Astron | Mapeamento CDP |
|---|---|
| `user_id` | astron_user_id |
| `status` | astron_status |
| `plans` | astron_plans (JSONB) |
| `courses` | astron_courses_access |
| `courses_total` | astron_courses_total |
| `courses_completed` | astron_courses_completed |
| `last_login` | astron_last_login |
| `login_url` | astron_login_url |
| `progress` | astron_progress (JSONB) |
| `certificates` | astron_certificate_count |
| `enrolled_at` | astron_enrolled_at |

**Volume:** ~12 colunas. **Médio**.

### 8.5 Loja Integrada (E-commerce)

| Atributo | Valor |
|---|---|
| **Protocolo** | Webhook + Polling REST |
| **Autenticação** | Query params: `chave_api` + `chave_aplicacao` (NÃO headers) |
| **Secrets** | `LOJA_INTEGRADA_API_KEY`, `LOJA_INTEGRADA_APP_KEY` |
| **Polling** | pg_cron a cada 30min |

**Campos de entrada:**

| Campo LI | Mapeamento CDP |
|---|---|
| `cliente.id` | lojaintegrada_cliente_id |
| `numero` | lojaintegrada_ultimo_pedido_id |
| `situacao.id` | lojaintegrada_ultimo_pedido_status |
| `valor_total` | lojaintegrada_ultimo_pedido_valor |
| `data_criacao` | lojaintegrada_ultimo_pedido_data |
| `itens[]` | lojaintegrada_historico_pedidos (JSONB) |
| `endereco_entrega` | lojaintegrada_endereco (JSONB) |
| `pagamentos` | lojaintegrada_payment_method |
| `objetos_rastreamento` | lojaintegrada_ultimo_tracking (JSONB) |

**Cálculos derivados:**

| Campo calculado | Lógica |
|---|---|
| `lojaintegrada_ltv` | SUM(orders.valor_total) |
| `lojaintegrada_total_pedidos` | COUNT(orders) |
| `lojaintegrada_dias_entre_pedidos` | AVG(days between orders) |
| `ec_cliente_recorrente` | total_pedidos >= 3 |
| `ec_cliente_inativo` | último pedido > 180 dias |

**Mapeamento de Status IDs:**

| ID | Status | Prefixo |
|---|---|---|
| 3 | Pago | pedido_pago |
| 5 | Entregue | pedido_entregue |
| 6 | Cancelado | pedido_cancelado |
| 13 | Em produção | pedido_producao |

**Volume:** ~25 colunas. **Alto**.

### 8.6 PandaVideo

| Atributo | Valor |
|---|---|
| **Protocolo** | REST API |
| **Secret** | `PANDAVIDEO_API_KEY` |
| **Direção** | Inbound (sync) |

**Campos de entrada:**

| Campo PandaVideo | Mapeamento |
|---|---|
| `id` | knowledge_videos.pandavideo_id |
| `external_id` | pandavideo_external_id |
| `title` | title |
| `description` | description |
| `embed_url` | embed_url |
| `hls_url` | hls_url |
| `thumbnail_url` | thumbnail_url |
| `duration` | video_duration_seconds |
| `folder_id` | folder_id |
| `tags` | panda_tags |
| `custom_fields` | panda_custom_fields (JSONB) |
| `config` | panda_config (JSONB) |
| `analytics.views` | analytics_views |
| `analytics.unique_views` | analytics_unique_views |
| `analytics.plays` | analytics_plays |
| `analytics.unique_plays` | analytics_unique_plays |
| `analytics.play_rate` | analytics_play_rate |
| `analytics.avg_retention` | analytics_avg_retention |

**Volume:** ~50 colunas na tabela knowledge_videos. **Alto**.

### 8.7 Google Drive

| Atributo | Valor |
|---|---|
| **Protocolo** | REST (Google Drive API v3) |
| **Secret** | `GOOGLE_DRIVE_API_KEY` ou Service Account |
| **Direção** | Inbound (sync) |

**Campos escritos:**

| Tabela | Campos |
|---|---|
| `company_kb_texts` | title, content, category, source_label, active |
| `drive_kb_sync_log` | drive_file_id, file_name, folder_name, status, mime_type, modified_time |

**Volume:** ~9 colunas em company_kb_texts. **Baixo**.

### 8.8 Google Reviews

| Atributo | Valor |
|---|---|
| **Protocolo** | REST (Google Places API) |
| **Secret** | `GOOGLE_REVIEWS_API_KEY` |
| **Direção** | Inbound (sync) |

**Campos escritos:**

| Tabela | Campo | Tipo |
|---|---|---|
| `system_a_catalog` | `extra_data.google_place_id` | text |
| `system_a_catalog` | `extra_data.reviews_reputation` | JSONB |

Conteúdo de `reviews_reputation`:
```json
{
  "rating": 4.8,
  "total_reviews": 127,
  "recent_reviews": [...],
  "last_sync": "2026-03-14T..."
}
```

**Volume:** 2 campos JSONB por produto. **Baixo**.

### 8.9 Meta Ads

| Atributo | Valor |
|---|---|
| **Protocolo** | Webhook (Lead Ads) + REST (Graph API v21.0) |
| **Secrets** | `META_LEAD_ADS_TOKEN`, `META_WEBHOOK_VERIFY_TOKEN`, `META_ADS_MANAGER_TOKEN`, `META_ADS_INSIGHTS_TOKEN` |
| **Ad Account** | `act_1946671865603544` |
| **Status** | ⚠️ 404 — pendente consolidação em gateway |

**Lead Ads — Campos de entrada:**

| Campo Graph API | Mapeamento |
|---|---|
| `leadgen_id` | meta_leadgen_id |
| `page_id` | meta_page_id |
| `form_id` | meta_form_id |
| `created_time` | meta_created_time |
| `field_data[email]` | email |
| `field_data[full_name]` | nome |
| `field_data[phone_number]` | telefone_raw |
| `field_data[especialidade]` | especialidade |
| `field_data[city]` | cidade |
| `field_data[state]` | uf |

**Ads Manager — Ações:**

| Action | Method | Endpoint |
|---|---|---|
| `list_campaigns` | GET | `/{ad_account_id}/campaigns` |
| `create_campaign` | POST | `/{ad_account_id}/campaigns` |
| `update_campaign` | POST | `/{campaign_id}` |
| `list_adsets` | GET | `/{campaign_id}/adsets` |
| `create_adset` | POST | `/{ad_account_id}/adsets` |
| `list_ads` | GET | `/{adset_id}/ads` |
| `update_ad_status` | POST | `/{ad_id}` |

**Ads Insights — Métricas:**

| Métrica | Tipo |
|---|---|
| `impressions` | integer |
| `reach` | integer |
| `clicks` | integer |
| `spend` | decimal |
| `cpc` | decimal |
| `cpm` | decimal |
| `ctr` | decimal |
| `actions[lead]` | integer |
| `cost_per_action_type[lead]` | decimal (CPL) |

**Permissões Graph API necessárias:**
- `ads_management`
- `ads_read`
- `read_insights`
- `leads_retrieval`
- `pages_manage_ads`
- `business_management`

**Volume:** ~6 colunas meta_* + forward para ingest. **Baixo**.

---

## Parte 9 — Qualidade Técnica do HTML Gerado

### 9.1 Estrutura Semântica

O HTML gerado pelo `ai-orchestrate-content` e `reformat-article-html` segue uma hierarquia semântica rigorosa:

```html
<article class="knowledge-article">
  <h2>Título da Seção Principal</h2>
  <p>Parágrafo introdutório com contexto.</p>
  
  <h3>Subtópico</h3>
  <p>Conteúdo detalhado.</p>
  
  <h4>Sub-subtópico (quando necessário)</h4>
  <ul>
    <li>Item de lista</li>
  </ul>
  
  <table>
    <thead><tr><th>Cabeçalho</th></tr></thead>
    <tbody><tr><td>Dado</td></tr></tbody>
  </table>
  
  <div class="content-card">
    <h4>Destaque</h4>
    <p>Conteúdo em card.</p>
  </div>
  
  <div class="cta-panel" data-entity-id="uuid-do-produto">
    <h4>Produto Recomendado</h4>
    <a href="/produto/slug">Ver detalhes</a>
  </div>
</article>
```

### 9.2 Classes CSS Customizadas

| Classe | Uso | Estilo |
|---|---|---|
| `.content-card` | Cards de conteúdo destacado | Border-left, background sutil |
| `.benefit-card` | Cards de benefícios | Ícone + título + texto |
| `.cta-panel` | Call-to-action de produto | Background accent, botão CTA |
| `.article-summary` | Resumo/abstract do artigo | Background muted, border |
| `.warning-box` | Avisos e precauções | Border-left vermelho |
| `.tip-box` | Dicas e sugestões | Border-left verde |
| `.comparison-table` | Tabelas comparativas | Zebra stripes, header sticky |

### 9.3 Regras Anti-Alucinação (ANTI_HALLUCINATION_RULES)

```typescript
// extraction-rules.ts
const ANTI_HALLUCINATION_RULES = [
  "NUNCA inventar especificações técnicas não presentes no PDF/fonte",
  "NUNCA citar normas ISO/ANVISA sem número exato do documento fonte",
  "NUNCA recomendar protocolos clínicos sem evidência na base de conhecimento",
  "NUNCA comparar com produtos concorrentes",
  "NUNCA dar conselhos médicos ou odontológicos diretos",
  "SEMPRE usar linguagem condicional quando a informação for inferida"
];
```

### 9.4 Validação Pós-Processamento

| Validação | Implementação |
|---|---|
| Strip code fences | Remove \`\`\`html e \`\`\` do output |
| URL safety | Negative lookbehind para não quebrar URLs válidas |
| Entity annotations | Injeta `data-entity-id` em menções de produtos |
| Heading hierarchy | Garante H2→H3→H4 (nunca pula nível) |
| Table structure | Garante thead+tbody em todas as tabelas |
| Link validation | Verifica que links internos usam slugs válidos |
| Image alt text | Garante alt text em todas as imagens |

### 9.5 AI Citation Box

Bloco injetado logo após o H1 em artigos técnicos:

```html
<div class="ai-citation-box" data-source="gemini-2.5-flash">
  <p class="citation-label">📋 Resumo IA</p>
  <p class="citation-text">
    Este artigo foi gerado com auxílio de IA a partir de documentação
    técnica oficial do fabricante. Todas as especificações foram
    verificadas contra as fontes originais.
  </p>
  <p class="citation-sources">
    Fontes: <span data-source-id="doc-uuid">Manual Técnico v2.3</span>
  </p>
</div>
```

### 9.6 GEO-Context Automático

Metadado `<meta name="ai-context">` injetado automaticamente com resumo do conteúdo para LLMs:

```html
<meta name="ai-context" content="Artigo técnico sobre impressora 3D
MiiCraft Prime 150 para odontologia. Cobre: especificações técnicas,
protocolos de impressão, resinas compatíveis, manutenção preventiva.
Publicado por Smart Dent, distribuidor oficial no Brasil.">
```

---

## Parte 10 — SEO E-E-A-T Compliance

### 10.1 Head Tags

| Tag | Implementação | Componente |
|---|---|---|
| `<title>` | Dinâmico, < 60 chars | SEOHead.tsx, KnowledgeSEOHead.tsx |
| `<meta description>` | < 160 chars | SEOHead.tsx |
| `<meta ai-context>` | Resumo para LLMs | KnowledgeSEOHead.tsx |
| `<link rel="canonical">` | URL canônica com i18n | SEOHead.tsx |
| `<link rel="alternate" hreflang>` | PT/EN/ES + x-default | SEOHead.tsx |
| `<meta property="og:*">` | Open Graph completo | SEOHead.tsx |
| `<meta name="twitter:*">` | Twitter Cards | SEOHead.tsx |
| `<meta name="robots">` | index,follow | SEOHead.tsx |

### 10.2 JSON-LD Schemas (17+ tipos)

| # | Schema | Componente | Trigger |
|---|---|---|---|
| 1 | `Article` (MedicalWebPage) | KnowledgeSEOHead | Artigos médicos/odonto |
| 2 | `Article` (TechArticle) | KnowledgeSEOHead | Artigos técnicos |
| 3 | `Organization` | OrganizationSchema | Todas as páginas |
| 4 | `Product` + `Offer` | SEOHead | Páginas de produto |
| 5 | `VideoObject` | VideoSchema | Páginas com vídeo |
| 6 | `FAQPage` | KnowledgeSEOHead | Auto-extração de FAQs |
| 7 | `HowTo` | KnowledgeSEOHead | Artigos procedimentais |
| 8 | `BreadcrumbList` | Breadcrumb | Todas as páginas |
| 9 | `WebSite` | SEOHead | Homepage |
| 10 | `WebPage` | SEOHead | Páginas genéricas |
| 11 | `Person` (author) | AuthorBio | Artigos com autor |
| 12 | `Review` | TestimonialSEOHead | Depoimentos |
| 13 | `AggregateRating` | GoogleReviewsWidget | Reviews Google |
| 14 | `LocalBusiness` | OrganizationSchema | Homepage |
| 15 | `ImageObject` | SEOHead | Imagens de produto |
| 16 | `ItemList` | CategoryPage | Listagens de categoria |
| 17 | `SoftwareApplication` | SEOHead | Software CAD |

### 10.3 Author E-E-A-T

```json
{
  "@type": "Person",
  "name": "Dr. João Silva",
  "jobTitle": "Cirurgião-Dentista",
  "description": "Especialista em Prótese Dentária com 15 anos...",
  "sameAs": [
    "https://lattes.cnpq.br/1234567890",
    "https://linkedin.com/in/drjoaosilva"
  ],
  "affiliation": {
    "@type": "Organization",
    "name": "Smart Dent"
  },
  "hasCredential": {
    "@type": "EducationalOccupationalCredential",
    "credentialCategory": "CRO",
    "recognizedBy": {
      "@type": "Organization",
      "name": "Conselho Regional de Odontologia"
    }
  }
}
```

### 10.4 Sitemaps & Discovery

| Sitemap | URL | Conteúdo |
|---|---|---|
| Principal | `/functions/v1/generate-sitemap` | Produtos, marcas, modelos, resinas |
| KB (PT) | `/functions/v1/generate-knowledge-sitemap` | Artigos em português |
| KB (EN) | `/functions/v1/generate-knowledge-sitemap-en` | Artigos em inglês |
| KB (ES) | `/functions/v1/generate-knowledge-sitemap-es` | Artigos em espanhol |
| Docs | `/functions/v1/generate-documents-sitemap` | Documentos técnicos |

### 10.5 Bot Detection (seo-proxy)

O `seo-proxy` detecta 15+ User-Agents de bots para servir HTML SSR otimizado:

```
Googlebot, Bingbot, Slurp, DuckDuckBot, Baiduspider,
YandexBot, Sogou, Exabot, facebot, ia_archiver,
GPTBot, ClaudeBot, PerplexityBot, ChatGPT-User,
Applebot, Twitterbot, LinkedInBot, WhatsApp,
TelegramBot, Discordbot
```

### 10.6 robots.txt & llms.txt

```
# robots.txt
User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: ChatGPT-User
Allow: /

Sitemap: https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/generate-sitemap
Sitemap: https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/generate-knowledge-sitemap
```

---

## Parte 11 — UX/UI Architecture

### 11.1 Rotas Públicas (15 rotas)

| Rota | Página | Componente |
|---|---|---|
| `/` | Homepage | Index.tsx |
| `/sobre` | Sobre | About.tsx |
| `/marca/:slug` | Página de marca | CategoryPage.tsx |
| `/modelo/:slug` | Página de modelo | ProductPage.tsx |
| `/resina/:slug` | Redirect resina | ResinRedirect.tsx |
| `/conhecimento` | Knowledge Base | KnowledgeBase.tsx |
| `/conhecimento/:slug` | Artigo KB | KnowledgeBase.tsx |
| `/en/knowledge/:slug` | Artigo EN | KnowledgeBase.tsx |
| `/es/conocimiento/:slug` | Artigo ES | KnowledgeBase.tsx |
| `/depoimento/:slug` | Depoimento | TestimonialPage.tsx |
| `/documento/:id` | Documento técnico | DocumentProxyRoute.tsx |
| `/parametro/:slug` | Página de parâmetro | ParameterPageExample.tsx |
| `/roi-calculator` | Calculadora ROI | ROICalculatorPage.tsx |
| `/formulario/:id` | Formulário público | PublicFormPage.tsx |
| `/agent-embed` | Embed Dra. L.I.A. | AgentEmbed.tsx |

### 11.2 Admin Panel (10 tabs)

| Tab | Componente | Funcionalidade |
|---|---|---|
| Catálogo | AdminCatalog | CRUD de produtos, modelos, marcas |
| Conteúdo | AdminKnowledge | Editor de artigos KB (TipTap) |
| Vídeos | AdminVideosList | Gerenciamento de vídeos |
| Documentos | AdminDocumentsList | Upload e gestão de PDFs |
| Autores | AdminAuthors | CRUD de autores E-E-A-T |
| Usuários | AdminUsers | Gerenciamento de usuários |
| Links | AdminExternalLinks | Links externos e keywords |
| SmartOps | SmartOpsTab | 15 sub-tabs operacionais |
| Suporte | AdminSupportCases | Casos de suporte técnico |
| Config | AdminSettings | Configurações do sistema |

### 11.3 SmartOps (15 sub-tabs)

| # | Sub-tab | Componente | Funcionalidade |
|---|---|---|---|
| 1 | Bowtie | SmartOpsBowtie | Funil bowtie visual |
| 2 | Kanban | SmartOpsKanban + AudienceBuilder | Kanban de leads + filtros |
| 3 | Leads | SmartOpsLeadsList | Listagem e busca de leads |
| 4 | Equipe | SmartOpsTeam | Gestão de team_members |
| 5 | Automações | SmartOpsSellerAutomations | Regras CS automation |
| 6 | Logs | SmartOpsLogs | message_logs viewer |
| 7 | Relatórios | SmartOpsReports | Dashboards e métricas |
| 8 | Conteúdo | SmartOpsContentProduction | Pipeline de conteúdo |
| 9 | Saúde | SmartOpsSystemHealth | Health check do sistema |
| 10 | WhatsApp | SmartOpsWhatsAppInbox | Inbox WhatsApp integrado |
| 11 | Formulários | SmartOpsFormBuilder + FormEditor | Builder de formulários |
| 12 | Tokens IA | SmartOpsAIUsageDashboard | Dashboard uso de tokens |
| 13 | Intelligence | SmartOpsIntelligenceDashboard | Dashboard intelligence score |
| 14 | SmartFlow | SmartOpsSmartFlowAnalytics | Analytics de automações |
| 15 | Copilot | SmartOpsCopilot | Copilot IA (Dual Brain) |

### 11.4 Componentes SEO (11 componentes)

| Componente | Função |
|---|---|
| SEOHead | Head tags genérico |
| KnowledgeSEOHead | Head tags Knowledge Base |
| TestimonialSEOHead | Head tags depoimentos |
| AboutSEOHead | Head tags página Sobre |
| OrganizationSchema | JSON-LD Organization |
| VideoSchema | JSON-LD VideoObject |
| AuthorBio | Bio do autor (E-E-A-T) |
| AuthorSignature | Assinatura HTML |
| Breadcrumb | BreadcrumbList |
| GoogleReviewsBadge | Badge de reviews |
| GoogleReviewsWidget | Widget de reviews |

### 11.5 Widget Dra. L.I.A.

- Componente: `DraLIA.tsx`
- Posição: Fixed, bottom-right
- Estado: Colapsado (ícone) → Expandido (chat)
- Disponível em: Todas as páginas públicas
- Props: `embedded?: boolean` (modo iframe)

---

## Parte 12 — Banco de Dados

### 12.1 Tabelas Principais (30+)

| Tabela | Colunas | RLS | Escritores | Leitores |
|---|---|---|---|---|
| `lia_attendances` | ~200 | ✅ | Edge Functions (service role) | Admin, Edge Functions |
| `people` | ~15 | ✅ | Edge Functions | Admin |
| `companies` | ~12 | ✅ | Edge Functions | Admin |
| `person_company_relationship` | ~5 | ✅ | Edge Functions | Admin |
| `knowledge_contents` | ~45 | ✅ | Admin (authenticated) | Público (read) |
| `knowledge_categories` | ~7 | ✅ | Admin | Público (read) |
| `knowledge_videos` | ~50 | ✅ | Edge Functions, Admin | Público (read) |
| `knowledge_video_metrics_log` | ~11 | ✅ | Edge Functions | Admin |
| `system_a_catalog` | ~40 | ✅ | Edge Functions | Público (read) |
| `catalog_documents` | ~20 | ✅ | Admin | Público (read) |
| `agent_embeddings` | ~10 | ✅ | Edge Functions | Edge Functions |
| `agent_interactions` | ~20 | ✅ | Edge Functions | Admin |
| `agent_sessions` | ~8 | ✅ | Edge Functions | Edge Functions |
| `agent_knowledge_gaps` | ~10 | ✅ | Edge Functions | Admin |
| `agent_internal_lookups` | ~12 | ✅ | Edge Functions | Edge Functions |
| `knowledge_gap_drafts` | ~15 | ✅ | Edge Functions | Admin |
| `company_kb_texts` | ~9 | ✅ | Edge Functions | Edge Functions |
| `drive_kb_sync_log` | ~12 | ✅ | Edge Functions | Admin |
| `authors` | ~20 | ✅ | Admin | Público (read) |
| `brands` | ~7 | ✅ | Admin | Público (read) |
| `external_links` | ~18 | ✅ | Admin, Edge Functions | Admin |
| `ai_token_usage` | ~12 | ✅ | Edge Functions | Admin |
| `cs_automation_rules` | ~15 | ✅ | Admin | Edge Functions |
| `deal_items` | ~25 | ✅ | Edge Functions | Admin |
| `team_members` | ~15 | ✅ | Admin | Edge Functions |
| `message_logs` | ~8 | ✅ | Edge Functions | Admin |
| `whatsapp_inbox` | ~10 | ✅ | Edge Functions | Admin |
| `support_cases` | ~10 | ✅ | Edge Functions | Admin |
| `content_requests` | ~12 | ✅ | Edge Functions | Admin |
| `intelligence_score_config` | ~6 | ✅ | Admin | Edge Functions (RPC) |
| `user_roles` | ~3 | ✅ | Admin (service role) | RPC (is_admin) |
| `backfill_log` | ~7 | ✅ | Edge Functions | Admin |
| `image_embedding_cache` | ~4 | ✅ | Edge Functions | Edge Functions |
| `image_query_logs` | ~11 | ✅ | Edge Functions | Admin |
| `products_catalog` | ~12 | ✅ | Edge Functions | Edge Functions |
| `lead_state_events` | ~8 | ✅ | Edge Functions | Admin |
| `lead_activity_log` | ~10 | ✅ | Edge Functions | RPC |

### 12.2 Views (5)

| View | Descrição | Tabelas fonte |
|---|---|---|
| `v_lead_commercial` | Visão comercial do lead | lia_attendances |
| `v_lead_cognitive` | Visão cognitiva (10 eixos) | lia_attendances |
| `v_lead_ecommerce` | Visão e-commerce | lia_attendances |
| `v_lead_academy` | Visão academy/cursos | lia_attendances |
| `v_leads_correto` | Visão consolidada correta | lia_attendances |
| `lead_model_routing` | Roteamento de modelo de lead | lia_attendances |

### 12.3 RPCs (Database Functions)

| RPC | Tipo | Descrição |
|---|---|---|
| `is_admin(user_id)` | SECURITY DEFINER | Verifica role admin |
| `is_author(user_id)` | SECURITY DEFINER | Verifica role author |
| `has_panel_access(user_id)` | SECURITY DEFINER | Verifica acesso ao painel |
| `calculate_lead_intelligence_score(lead_id)` | SECURITY DEFINER | Calcula intelligence score (4 eixos) |
| `match_agent_embeddings(embedding, threshold, count)` | STABLE | Busca vetorial v1 (1536d) |
| `match_agent_embeddings_v2(embedding, threshold, count)` | STABLE | Busca vetorial v2 (768d) |
| `fn_calc_workflow_score(lead_id)` | — | Calcula workflow score (0-10) |
| `fn_recalc_ltv_from_deals()` | TRIGGER | Recalcula LTV de deals_history |
| `fn_map_lead_source(...)` | — | Mapeia fonte do lead |
| `fn_get_lead_context(lead_id)` | — | Contexto completo do lead |
| `fn_record_lead_event(...)` | — | Registra evento do lead |
| `search_knowledge_base(query, lang)` | STABLE | Busca full-text + similarity |
| `fn_normalize_phone()` | TRIGGER | Normaliza telefone (+55...) |
| `fn_deduplicate_proposal_csv(rows)` | — | Deduplica propostas CSV |
| `get_rag_stats()` | SECURITY DEFINER | Estatísticas RAG por source_type |
| `get_brand_distribution()` | SECURITY DEFINER | Distribuição por marca |
| `increment_lookup_hit(id)` | — | Incrementa hit count de lookup |
| `update_extra_data_reviews(...)` | SECURITY DEFINER | Atualiza reviews no catálogo |
| `normalize_text(input)` | IMMUTABLE | Normaliza texto (remove acentos) |

### 12.4 Triggers

| Trigger | Tabela | Função | Descrição |
|---|---|---|---|
| `trigger_evaluate_interaction` | `agent_interactions` | `trigger_evaluate_interaction()` | Dispara judge evaluator (DeepSeek) quando resposta é inserida |
| `normalize_phone_trigger` | `lia_attendances` | `fn_normalize_phone()` | Normaliza telefone no INSERT/UPDATE |
| `trigger_workflow_score` | `lia_attendances` | `fn_trigger_workflow_score()` | Recalcula workflow score |
| `recalc_ltv_trigger` | `lia_attendances` | `fn_recalc_ltv_from_deals()` | Recalcula LTV quando deals_history muda |
| `update_search_vector` | `knowledge_videos` | `update_knowledge_videos_search_vector()` | Atualiza tsvector de busca |
| `validate_support_case` | `support_cases` | `validate_support_case_status()` | Valida status (pending/approved/rejected) |

---

## Parte 13 — Shared Modules (`_shared/`)

| # | Módulo | Arquivo | Descrição | Usado por |
|---|---|---|---|---|
| 1 | System Prompt | `system-prompt.ts` | Persona Dra. L.I.A., guardrails, SPIN | dra-lia |
| 2 | Testimonial Prompt | `testimonial-prompt.ts` | Template para depoimentos | ai-orchestrate-content |
| 3 | Document Prompts | `document-prompts.ts` | Templates para documentos técnicos | ai-orchestrate-content, extract-* |
| 4 | Extraction Rules | `extraction-rules.ts` | Regras anti-alucinação, validação | ai-orchestrate-content |
| 5 | Log AI Usage | `log-ai-usage.ts` | Logger de tokens IA → ai_token_usage | Todas as funções com IA |
| 6 | PipeRun Field Map | `piperun-field-map.ts` | Mapeamento campos PipeRun → CDP | piperun-*, smart-ops-sync-piperun |
| 7 | PipeRun Hierarchy | `piperun-hierarchy.ts` | Hierarquia de funis e etapas | smart-ops-kanban-move |
| 8 | SellFlux Field Map | `sellflux-field-map.ts` | Mapeamento SellFlux + formatação | sellflux-webhook, send-waleads |
| 9 | OG Visual Dictionary | `og-visual-dictionary.ts` | Templates visuais para OG images | ai-generate-og-image |
| 10 | Entity Dictionary | `entity-dictionary.ts` | Dicionário de entidades (produtos) | dra-lia, seo-proxy |
| 11 | Citation Builder | `citation-builder.ts` | Construtor de citações e fontes | dra-lia, ai-orchestrate-content |
| 12 | L.I.A. Guards | `lia-guards.ts` | Guardrails conversacionais | dra-lia |
| 13 | L.I.A. Lead Extraction | `lia-lead-extraction.ts` | Extração de entidades de conversas | dra-lia |
| 14 | Rate Limiter | `rate-limiter.ts` | Rate limiting por IP/session | dra-lia |
| 15 | Resilient Fetch | `resilient-fetch.ts` | Fetch com retry e timeout | Múltiplas funções |
| 16 | WaLeads Messaging | `waleads-messaging.ts` | Helpers de mensageria WaLeads | send-waleads, wa-inbox |
| 17 | Generate Embedding | `generate-embedding.ts` | Geração de embeddings (OpenAI/Google) | dra-lia, index-embeddings |

---

## Parte 14 — Secrets & Segurança

### 14.1 Secrets Necessários (15+)

| Secret | Uso | Funções |
|---|---|---|
| `SUPABASE_URL` | Auto-populated | Todas |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-populated | Todas |
| `SUPABASE_ANON_KEY` | Auto-populated | Todas |
| `GEMINI_API_KEY` | Google AI (conteúdo) | ai-orchestrate-*, dra-lia, ai-generate-*, extract-* |
| `DEEPSEEK_API_KEY` | DeepSeek (cognitivo) | cognitive-lead-analysis, evaluate-interaction, heal-knowledge-gaps |
| `OPENAI_API_KEY` | Embeddings + GPT-4.1 Mini | index-embeddings, ai-model-compare |
| `PIPERUN_API_TOKEN` | PipeRun CRM | piperun-*, smart-ops-sync-piperun |
| `SELLFLUX_API_KEY` | SellFlux API | sellflux-sync |
| `SELLFLUX_WEBHOOK_CAMPANHAS` | SellFlux webhook URL | send-waleads |
| `LOJA_INTEGRADA_API_KEY` | Loja Integrada | poll-loja-*, ecommerce-webhook |
| `LOJA_INTEGRADA_APP_KEY` | Loja Integrada (app) | poll-loja-*, ecommerce-webhook |
| `PANDAVIDEO_API_KEY` | PandaVideo | sync-pandavideo, sync-video-analytics |
| `META_LEAD_ADS_TOKEN` | Meta Graph API (leads) | meta-lead-webhook |
| `META_WEBHOOK_VERIFY_TOKEN` | Meta webhook verification | meta-lead-webhook |
| `META_ADS_MANAGER_TOKEN` | Meta Ads Manager | meta-ads-manager |
| `META_ADS_INSIGHTS_TOKEN` | Meta Ads Insights | meta-ads-insights |
| `GOOGLE_DRIVE_API_KEY` | Google Drive | sync-google-drive-kb |
| `GOOGLE_REVIEWS_API_KEY` | Google Places | sync-google-reviews |
| `ASTRON_API_KEY` | Astron Members | sync-astron-members |

### 14.2 JWT Configuration

| Tipo | Quantidade | Funções |
|---|---|---|
| `verify_jwt = true` | 4 | create-user, ai-metadata-generator, create-test-articles, heal-knowledge-gaps |
| `verify_jwt = false` | 86+ | Todas as demais |

> **Nota:** A maioria das funções usa `verify_jwt = false` porque são chamadas por webhooks externos, pg_cron, ou outras Edge Functions via service_role_key.

### 14.3 Padrões RLS

| Padrão | Descrição | Tabelas |
|---|---|---|
| **admin_only** | Apenas admins (via is_admin RPC) | user_roles, admin configs |
| **public_read + admin_CUD** | Leitura pública, CRUD admin | knowledge_contents, system_a_catalog, authors |
| **service_insert + admin_read** | Insert via service role, read admin | agent_interactions, message_logs, ai_token_usage |
| **authenticated_read** | Leitura para authenticated | lia_attendances (com filtros) |
| **public_read** | Leitura sem auth | brands, knowledge_categories |

### 14.4 Segurança de Roles

```sql
-- Tabela separada de roles (NUNCA na tabela de perfil)
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    UNIQUE (user_id, role)
);

-- SECURITY DEFINER para evitar recursão RLS
CREATE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = $1 AND role = 'admin'
  );
$$;
```

---

## Parte 15 — Métricas do Sistema

| Métrica | Valor |
|---|---|
| **Tabelas PostgreSQL** | 30+ |
| **Views** | 5+ |
| **Edge Functions (config.toml)** | 90 |
| **Componentes React** | 120+ |
| **Shared Modules (_shared/)** | 17 |
| **Linhas de código Edge Functions** | ~60,000 |
| **Colunas no CDP (lia_attendances)** | ~200 |
| **Idiomas suportados** | 3 (PT, EN, ES) |
| **Entry points de leads** | 5 |
| **Eixos cognitivos (DeepSeek)** | 10 |
| **Eixos Intelligence Score** | 4 |
| **Sitemaps XML** | 5 |
| **JSON-LD schemas** | 17+ |
| **Integrações externas** | 9 |
| **Sub-tabs SmartOps** | 15 |
| **Fontes vetoriais RAG** | 8 |
| **Modelos de IA** | 4 (Gemini, DeepSeek, GPT-4.1 Mini, text-embedding) |
| **Funis PipeRun mapeados** | 11 |
| **Regras anti-alucinação** | 6 |
| **Triggers de banco** | 6 |
| **RPCs/Functions** | 19+ |
| **User-Agents de bots detectados** | 20+ |
| **Secrets configurados** | 15+ |
| **Rotas públicas** | 15 |
| **LOC dra-lia (maior função)** | 5,092 |
| **LOC seo-proxy** | 2,004 |

---

## Parte 16 — Findings e Recomendações

### 16.1 Findings Críticos

| # | Finding | Severidade | Impacto |
|---|---|---|---|
| 1 | **Meta Ads 404** — 3 funções retornam 404 por exceder limite de Edge Functions | 🔴 Crítico | Lead Ads não são processados |
| 2 | **dra-lia com 5092 LOC** — função monolítica difícil de manter | 🟡 Médio | Manutenibilidade reduzida |
| 3 | **products_catalog órfã** — tabela sem FK para system_a_catalog | 🟡 Médio | Dados potencialmente inconsistentes |
| 4 | **86+ funções sem JWT** — maioria das funções sem verificação JWT | 🟡 Médio | Depende de obscuridade da URL |
| 5 | **Rate limiting parcial** — apenas dra-lia tem rate limiter | 🟡 Médio | Funções de sync vulneráveis a abuse |

### 16.2 Recomendações

| # | Recomendação | Prioridade | Esforço |
|---|---|---|---|
| 1 | **Consolidar Meta em gateway** — Merge 3 funções em `smart-ops-meta-gateway` | 🔴 Alta | 2h |
| 2 | **Refatorar dra-lia** — Separar em módulos: session, rag, response, lead-extraction | 🟡 Média | 8h |
| 3 | **Person-centric Sprint 2** — Migrar de lia_attendances para people + leads separados | 🟡 Média | 16h |
| 4 | **Rate limiting em sync functions** — Adicionar rate-limiter.ts a funções de webhook | 🟢 Baixa | 4h |
| 5 | **Consolidar Edge Functions** — Agrupar funções relacionadas para reduzir count total | 🟡 Média | 8h |
| 6 | **Long-lived Meta Token** — Converter token Graph API Explorer para permanente | 🔴 Alta | 1h |
| 7 | **Monitoring dashboard** — Dashboard de saúde unificado (edge functions, sync status, token usage) | 🟢 Baixa | 8h |
| 8 | **Test coverage** — Adicionar testes automatizados para Edge Functions críticas | 🟢 Baixa | 16h |

### 16.3 Person-Centric Model (Sprint 1 — Em Andamento)

```
┌─────────────┐       ┌───────────────────────────┐       ┌──────────────┐
│   people    │ ◄──── │ person_company_relationship│ ────► │  companies   │
│ (identidade │       │ (M:N)                     │       │ (CNPJ, etc.) │
│  primária)  │       │ role, is_primary           │       └──────────────┘
└──────┬──────┘       └───────────────────────────┘
       │
       │ person_id (FK)
       │
┌──────▼──────────┐
│ lia_attendances │
│ (CDP ~200 cols) │
│ buyer_type:     │
│ GENERATED ALWAYS│
│ AS (CASE...)    │
└─────────────────┘
```

### 16.4 Copilot Dual Brain

O SmartOpsCopilot implementa arquitetura "Dual Brain":
- **Brain 1 (Fast):** Gemini 2.5 Flash para respostas rápidas e consultas de dados
- **Brain 2 (Deep):** DeepSeek v3 para análises profundas e recomendações estratégicas
- O copilot detecta automaticamente qual brain usar baseado na complexidade da query

---

*Documento gerado automaticamente em 2026-03-14. Revenue Intelligence OS v4.0.*
*Projeto Supabase: okeogjgqijbfkudfjadz*
