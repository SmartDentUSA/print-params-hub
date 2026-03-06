# Revenue Intelligence OS — Documentação Técnica Completa

> **Versão:** 3.0 | **Última atualização:** 2026-03-06  
> **Classificação:** Confidencial — Engenharia  
> **Projeto Supabase:** `okeogjgqijbfkudfjadz`  
> **Domínio público:** `parametros.smartdent.com.br`  
> **Domínio publicado:** `print-params-hub.lovable.app`

---

## Índice

1. [Resumo Executivo](#1-resumo-executivo)
2. [Stack Tecnológico](#2-stack-tecnológico)
3. [Arquitetura Geral](#3-arquitetura-geral)
4. [CDP Unificado — lia_attendances](#4-cdp-unificado)
5. [Lead Lifecycle — 85+ Edge Functions](#5-lead-lifecycle)
6. [Content Generation Pipeline](#6-content-generation-pipeline)
7. [Qualidade do HTML Gerado & Exposição SEO/IA](#7-qualidade-html-seo-ia)
8. [Frontend Completo](#8-frontend-completo)
9. [Shared Modules (_shared/)](#9-shared-modules)
10. [Database — Tabelas, Views, RPCs & Triggers](#10-database)
11. [Secrets & Configuração](#11-secrets-configuração)
12. [Checklist de Funcionalidades](#12-checklist-funcionalidades)
13. [Bugs Conhecidos & Correções Aplicadas](#13-bugs-conhecidos)
14. [Recomendações Futuras](#14-recomendações-futuras)

---

## 1. Resumo Executivo

O **Revenue Intelligence OS** é uma plataforma proprietária de **Autonomia de Receita** construída sobre Supabase Edge Functions + React/Vite. Ela orquestra dois domínios críticos:

1. **Lead Lifecycle Management** — Captura, qualificação cognitiva, CRM bidirecional, automação de CS e inteligência preditiva, tudo centralizado em um CDP de ~200 colunas (`lia_attendances`).
2. **Content Intelligence Platform** — Pipeline de geração, formatação, tradução e publicação de conteúdo técnico odontológico otimizado para SEO e IA, com regras anti-alucinação e exposição semântica completa.

### Capacidades Principais

| Domínio | Capacidade | Descrição |
|---|---|---|
| **Leads** | Lead Ingestion | 5 entry points (formulário, Meta Ads, SellFlux, e-commerce, PipeRun) com Smart Merge |
| **Leads** | CRM Bidirectional Sync | PipeRun ↔ lia_attendances com hierarquia Person → Company → Deal |
| **Leads** | Cognitive AI Engine | DeepSeek classifica leads em 5 estágios + 10 eixos comportamentais |
| **Leads** | Intelligence Score (LIS) | Score multidimensional (4 eixos, 0-100) calculado via RPC PostgreSQL |
| **Leads** | Stagnation Automation | Funil Estagnados com 6 etapas + IA para decisão de reativação |
| **Leads** | E-commerce Integration | Loja Integrada webhooks → LTV → tags → cross-sell |
| **Leads** | Academy Integration | Astron Members postback → cursos/planos → segmentação |
| **Leads** | WhatsApp Inbox | Intent classification rule-based (14+ secondary patterns) + seller alerts |
| **Leads** | Proactive Outreach | 4 tipos de mensagens proativas com regras de elegibilidade |
| **Leads** | System Watchdog | Auto-remediação de leads órfãos + análise DeepSeek de anomalias |
| **Conteúdo** | Content Orchestration | Pipeline AI: PDF/Vídeo → Extração → HTML formatado → SEO → Tradução |
| **Conteúdo** | Anti-Hallucination | 6 regras absolutas no SYSTEM_SUPER_PROMPT (220 linhas) |
| **Conteúdo** | SEO/IA Exposure | 17+ elementos semânticos (JSON-LD, hreflang, sitemaps, RSS, SSR proxy) |
| **Conteúdo** | Multi-Language | PT/EN/ES com tradução AI preservando semântica técnica |
| **Agente** | Dra. L.I.A. | Agente conversacional embeddável com RAG + embeddings vetoriais |

### Correções Recentes (v3.0)

| Fix | Arquivo | Descrição |
|---|---|---|
| FIX #1 | `dra-lia-whatsapp` | Removido ANON_KEY, migrado para SERVICE_ROLE_KEY |
| FIX #2 | `batch-cognitive-analysis` | Implementado ORDER BY 3-tier (intelligence_score → messages → updated_at) |
| FIX #3 | `smart-ops-wa-inbox-webhook` | Adicionados 14 SECONDARY_PATTERNS para intents coloquiais BR |

---

## 2. Stack Tecnológico

### Frontend
| Tecnologia | Versão | Uso |
|---|---|---|
| React | 18.3.1 | UI principal |
| Vite | - | Build tool |
| TypeScript | - | Tipagem |
| Tailwind CSS | - | Estilização via tokens semânticos |
| shadcn/ui | - | Componentes base (dialog, tabs, cards, etc.) |
| React Router | 6.30.1 | Routing com suporte i18n |
| TanStack Query | 5.83.0 | Cache & data fetching |
| React Helmet Async | 2.0.5 | SEO meta tags dinâmicas |
| Recharts | 2.15.4 | Gráficos no painel admin |
| Lucide React | 0.462.0 | Ícones |
| Framer Motion | - | Animações (via Tailwind Animate) |
| TipTap | 3.7.2 | Editor rich text no admin |

### Backend (Supabase)
| Tecnologia | Uso |
|---|---|
| Supabase Edge Functions (Deno) | 85+ funções serverless |
| PostgreSQL | Banco relacional com RLS |
| Supabase Auth | Autenticação admin |
| Supabase Storage | Upload de imagens e PDFs |
| Supabase Realtime | Updates em tempo real (leads, conteúdo) |

### IA / LLMs
| Provider | Modelo | Uso |
|---|---|---|
| Lovable AI Gateway | `google/gemini-2.5-flash` | Geração de conteúdo, tradução, reformatação HTML |
| Lovable AI Gateway | `deepseek/deepseek-chat-v3-0324` | Análise cognitiva de leads, watchdog |
| Lovable AI Gateway | `openai/gpt-4.1-mini` | Comparação de modelos |

### Integrações Externas
| Sistema | Protocolo | Funções |
|---|---|---|
| PipeRun CRM | REST API + Webhook | Sync bidirecional de deals/pessoas/empresas |
| SellFlux | REST API + Webhook | Push de leads e campanhas |
| WaLeads (WhatsApp) | REST API | Envio de mensagens (texto, mídia) |
| Astron Members | Postback + REST | Sync de cursos e planos |
| Loja Integrada | Webhook + REST + Polling | E-commerce (pedidos, clientes, LTV) |
| PandaVideo | REST API | Sync de vídeos e analytics |
| Google Drive | REST API | Sync KB texts |
| Google Reviews | REST API | Avaliações e widget |
| Meta Ads | Webhook | Lead ads capture |

---

## 3. Arquitetura Geral

```
┌──────────────────────────────────────────────────────────────────────┐
│                        ENTRY POINTS (LEADS)                          │
├──────────┬──────────┬──────────┬──────────────┬─────────────────────┤
│ Formulário│ Meta Ads │ SellFlux │ Loja Integrada│ PipeRun Webhook    │
│ (ingest)  │ (meta-wh)│ (sf-wh)  │ (ecom-wh)    │ (piperun-wh)       │
└─────┬─────┴─────┬────┴─────┬───┴──────┬────────┴──────────┬─────────┘
      │           │          │          │                   │
      ▼           ▼          ▼          ▼                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│              smart-ops-ingest-lead (Gateway Unificado)               │
│  - Smart Merge (protectedFields)                                     │
│  - Normalização de telefone/email                                    │
│  - Detecção PQL (recompra)                                          │
│  - Form submission history (JSONB)                                   │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
  ┌───────────────┐ ┌───────────────┐ ┌────────────────┐
  │ lia-assign    │ │ cognitive-    │ │ SellFlux Sync  │
  │ (CRM Sync)   │ │ lead-analysis │ │ (V1+V2)        │
  │ Person→Deal   │ │ (DeepSeek)    │ │ Campaign Push  │
  │ Round Robin   │ │ 10 eixos      │ │ Lead Update    │
  │ WaLeads msg   │ │ PQL override  │ │                │
  └───────┬───────┘ └───────┬───────┘ └────────────────┘
          │                 │
          ▼                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                   lia_attendances (~200 colunas)                     │
│                         CDP UNIFICADO                                │
│  Core │ PipeRun │ Cognitive │ E-commerce │ Astron │ SellFlux │ Tags  │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
  ┌───────────────┐ ┌───────────────┐ ┌────────────────┐
  │ stagnant-     │ │ proactive-    │ │ system-        │
  │ processor     │ │ outreach      │ │ watchdog       │
  │ 6 etapas      │ │ 4 tipos msg   │ │ Orphan detect  │
  │ DeepSeek AI   │ │ SellFlux/     │ │ Auto-remediate │
  │ CS Rules      │ │ WaLeads       │ │ DeepSeek diag  │
  └───────────────┘ └───────────────┘ └────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                   CONTENT GENERATION PIPELINE                        │
├──────────┬──────────┬──────────┬──────────────┬─────────────────────┤
│ PDF      │ Vídeo    │ Texto    │ Google Drive │ Apostila            │
│ extract  │ extract  │ ingest   │ sync-kb      │ import              │
└─────┬────┴─────┬────┴─────┬───┴──────┬───────┴──────────┬──────────┘
      │          │          │          │                  │
      ▼          ▼          ▼          ▼                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│            ai-orchestrate-content (1193 linhas)                      │
│  SYSTEM_SUPER_PROMPT (220 linhas) + ANTI_HALLUCINATION_RULES         │
│  → HTML semântico + FAQs + metadata + schemas                        │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
  ┌───────────────┐ ┌───────────────┐ ┌────────────────┐
  │ reformat-html │ │ enrich-seo    │ │ translate-     │
  │ (Gemini 2.5)  │ │ metadata-gen  │ │ content        │
  │ Multi-idioma  │ │ og-image-gen  │ │ PT→EN/ES       │
  └───────┬───────┘ └───────┬───────┘ └────────┬───────┘
          │                 │                   │
          ▼                 ▼                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│               knowledge_contents (Publicação)                        │
│  content_html │ content_html_en │ content_html_es │ faqs │ keywords  │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
  ┌───────────────┐ ┌───────────────┐ ┌────────────────┐
  │ seo-proxy     │ │ Sitemaps (5)  │ │ RSS/Atom Feed  │
  │ SSR (1854 ln) │ │ PT/EN/ES/docs │ │ knowledge-feed │
  │ Bot detection │ │ main sitemap  │ │                │
  └───────────────┘ └───────────────┘ └────────────────┘
```

---

## 4. CDP Unificado — lia_attendances

A tabela `lia_attendances` funciona como o **Customer Data Platform (CDP)** unificado do sistema, com ~200 colunas organizadas em domínios.

### 4.1 Domínios de Colunas

#### Core (identidade + status)
| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid (PK) | Identificador único |
| `nome` | text | Nome completo |
| `email` | text | Email (unique constraint lógico) |
| `telefone_raw` | text | Telefone original |
| `telefone_normalized` | text | Telefone normalizado (+55...) |
| `lead_status` | text | Status atual: novo, ativo, ganho, perdido |
| `source` | text | Origem: formulário, meta_ads, piperun, sellflux, ecommerce |
| `form_name` | text | Nome do formulário de entrada |
| `entrada_sistema` | timestamptz | Data de entrada no sistema |
| `score` | integer | Score manual/herdado |
| `reuniao_agendada` | boolean | Flag de reunião |

#### Qualificação SDR (campos de interesse)
| Prefixo | Exemplo | Descrição |
|---|---|---|
| `sdr_*_interesse` | `sdr_scanner_interesse` | 9 campos de interesse por categoria de produto |
| `sdr_*_param` | `sdr_marca_impressora_param` | 3 campos de parâmetros técnicos solicitados |
| `sdr_suporte_*` | `sdr_suporte_tipo` | 3 campos de suporte técnico |

#### PipeRun CRM (~40 colunas)
| Coluna | Tipo | Descrição |
|---|---|---|
| `piperun_id` | text | ID da oportunidade no PipeRun |
| `piperun_title` | text | Título da deal |
| `piperun_status` | smallint | Status (0=aberta, 1=ganha, 2=perdida) |
| `piperun_pipeline_id/name` | int/text | Pipeline + nome |
| `piperun_stage_id/name` | int/text | Etapa + nome |
| `piperun_owner_id` | int | Proprietário |
| `piperun_custom_fields` | jsonb | Campos customizados |
| `pessoa_piperun_id` | int | ID da pessoa |
| `pessoa_cpf/cargo/genero` | text | Dados pessoais |
| `empresa_piperun_id` | int | ID da empresa |
| `empresa_cnpj/razao_social/nome` | text | Dados empresariais |
| `empresa_segmento/porte/situacao` | text | Classificação empresarial |
| `proposals_data` | jsonb | Array de propostas com itens |
| `proposals_total_value/mrr` | numeric | Valores consolidados |

#### Cognitive AI (~15 colunas)
| Coluna | Tipo | Descrição |
|---|---|---|
| `cognitive_analysis` | jsonb | Análise completa (10 eixos + 5 estágios) |
| `cognitive_updated_at` | timestamptz | Última atualização |
| `cognitive_analyzed_at` | timestamptz | Data da análise |
| `cognitive_model_version` | text | Versão do modelo usado |
| `cognitive_prompt_hash` | text | Hash do prompt (evita re-análise) |
| `cognitive_context_hash` | text | Hash do contexto (evita re-análise) |
| `confidence_score_analysis` | int | Confiança da análise (0-100) |
| `lead_stage_detected` | text | Estágio detectado pela IA |
| `interest_timeline` | text | Timeline de interesse |
| `psychological_profile` | text | Perfil psicológico |
| `primary_motivation` | text | Motivação primária |
| `objection_risk` | text | Risco de objeção |
| `recommended_approach` | text | Abordagem recomendada |

**10 Eixos Cognitivos (DeepSeek):**
1. `lead_stage_detected` — Estágio no funil
2. `interest_timeline` — Curto/médio/longo prazo
3. `urgency_level` — Nível de urgência
4. `psychological_profile` — Perfil comportamental
5. `primary_motivation` — Motivação principal
6. `objection_risk` — Risco de objeção
7. `recommended_approach` — Abordagem sugerida
8. `produto_interesse_auto` — Produto detectado automaticamente
9. `confidence_score_analysis` — Score de confiança
10. `prediction_accuracy` — Acurácia preditiva

#### Intelligence Score (LIS)
| Coluna | Tipo | Descrição |
|---|---|---|
| `intelligence_score` | jsonb | Score detalhado por eixo |
| `intelligence_score_total` | int | Score total (0-100) |
| `intelligence_score_updated_at` | timestamptz | Última atualização |

**Fórmula LIS (4 eixos, calculados via RPC PostgreSQL):**

```
LIS = (engagement × W1) + (commercial × W2) + (cognitive × W3) + (ecommerce × W4)
```

| Eixo | Componentes | Peso Default |
|---|---|---|
| `engagement` | total_sessions, total_messages, última_sessão | 25% |
| `commercial` | piperun_status, proposals_value, pipeline_stage | 35% |
| `cognitive` | confidence_score, stage_detected, eixos preenchidos | 25% |
| `ecommerce` | LTV, total_pedidos, última_compra | 15% |

#### Equipamentos (~20 colunas)
| Prefixo | Exemplo | Descrição |
|---|---|---|
| `equip_*` | `equip_impressora` | 5 tipos de equipamento (scanner, impressora, CAD, pós-impressão, notebook) |
| `equip_*_serial` | `equip_impressora_serial` | Número de série |
| `equip_*_ativacao` | `equip_impressora_ativacao` | Data de ativação |

#### Assinaturas de Produto (~16 colunas)
| Prefixo | Descrição |
|---|---|
| `ativo_*` (8) | Flags booleanas: scan, notebook, cad, cad_ia, smart_slice, print, cura, insumos |
| `data_ultima_compra_*` (8) | Data da última compra por categoria |

#### Loja Integrada E-commerce (~20 colunas)
| Coluna | Tipo | Descrição |
|---|---|---|
| `lojaintegrada_cliente_id` | int | ID do cliente |
| `lojaintegrada_ltv` | numeric | Lifetime Value calculado |
| `lojaintegrada_total_pedidos_pagos` | int | Total de pedidos pagos |
| `lojaintegrada_primeira_compra` | timestamptz | Primeira compra |
| `lojaintegrada_historico_pedidos` | jsonb | Array de pedidos com detalhes |
| `lojaintegrada_itens_json` | jsonb | Itens do último pedido |
| `lojaintegrada_ultimo_pedido_*` | various | Dados do último pedido |
| `lojaintegrada_endereco/*` | text | Endereço completo |

#### Astron Members (~12 colunas)
| Coluna | Tipo | Descrição |
|---|---|---|
| `astron_user_id` | int | ID do aluno |
| `astron_status` | text | Status: active, inactive |
| `astron_plans_active` | text[] | Planos ativos |
| `astron_plans_data` | jsonb | Detalhes dos planos |
| `astron_courses_access` | jsonb | Acesso a cursos |
| `astron_courses_total/completed` | int | Progresso |
| `astron_last_login_at` | timestamptz | Último login |
| `astron_synced_at` | timestamptz | Última sincronização |

#### SellFlux (~2 colunas)
| Coluna | Tipo | Descrição |
|---|---|---|
| `sellflux_custom_fields` | jsonb | Campos customizados do SellFlux |
| `sellflux_synced_at` | timestamptz | Última sincronização |

#### Dra. L.I.A. (Agente)
| Coluna | Tipo | Descrição |
|---|---|---|
| `total_sessions` | int | Total de sessões com o agente |
| `total_messages` | int | Total de mensagens trocadas |
| `ultima_sessao_at` | timestamptz | Última interação |
| `historico_resumos` | jsonb | Resumos de conversas anteriores |
| `rota_inicial_lia` | text | Rota inicial do agente |
| `resumo_historico_ia` | text | Resumo consolidado |

#### Automação & Controle
| Coluna | Tipo | Descrição |
|---|---|---|
| `proactive_sent_at` | timestamptz | Último outreach |
| `proactive_count` | int | Total de outreaches |
| `last_automated_action_at` | timestamptz | Última automação |
| `automation_cooldown_until` | timestamptz | Cooldown de automação |
| `crm_lock_until` | timestamptz | Lock CRM |
| `crm_lock_source` | text | Fonte do lock |

### 4.2 Views de Domínio

| View | Colunas Expostas | Uso |
|---|---|---|
| `v_lead_commercial` | Core + PipeRun + proposals + equipment | Dashboard comercial |
| `v_lead_cognitive` | Core + cognitive_analysis + intelligence_score | Dashboard de inteligência |
| `v_lead_academy` | Core + Astron + cursos + planos | Dashboard educacional |
| `v_lead_ecommerce` | Core + Loja Integrada + LTV + pedidos | Dashboard e-commerce |
| `lead_model_routing` | id + telefone + intelligence_score + recommended_model | Roteamento de modelo IA |
| `lia_attendances` (materialized views embutidas no SmartOps) | Filtros via frontend | Kanban, Bowtie, Leads list |

### 4.3 RLS

```sql
-- Política única: apenas admins
Policy "admin_only" ON lia_attendances FOR ALL
  USING (is_admin(auth.uid()))
```

---

## 5. Lead Lifecycle — 85+ Edge Functions

### 5.1 Lead Ingestion (5 Entry Points)

| Função | Trigger | Ação |
|---|---|---|
| `smart-ops-ingest-lead` | POST (formulário, SDK) | Gateway unificado. Smart Merge via telefone/email. Detecção PQL. |
| `smart-ops-meta-lead-webhook` | POST (Meta Ads) | Recebe leads do Facebook/Instagram Ads, normaliza e encaminha ao ingest |
| `smart-ops-sellflux-webhook` | POST (SellFlux) | Webhook do SellFlux com field mapping dinâmico (`sellflux-field-map.ts`) |
| `smart-ops-ecommerce-webhook` | POST (Loja Integrada) | Webhook de pedidos/clientes. Calcula LTV. |
| `smart-ops-piperun-webhook` | POST (PipeRun) | Webhook bidirecional. Atualiza lia_attendances com dados da deal/pessoa/empresa |

**Smart Merge Logic:**
1. Busca por `telefone_normalized` (match exato)
2. Busca por `email` (match exato, case-insensitive)
3. Se não encontrou → INSERT novo
4. Se encontrou → UPSERT com `protectedFields` (não sobrescreve dados CRM se já preenchidos)

### 5.2 CRM Sync & Assignment

| Função | Descrição |
|---|---|
| `smart-ops-lia-assign` | Cria Pessoa → Empresa → Deal no PipeRun. Round Robin entre vendedores. Envia mensagem WaLeads ao vendedor. |
| `smart-ops-sync-piperun` | Sync PipeRun → lia_attendances (manual, acionado pelo admin) |
| `piperun-full-sync` | Full sync completo de todas as deals do PipeRun |
| `smart-ops-kanban-move` | Move deal entre etapas no PipeRun + atualiza lia_attendances |

**Hierarquia PipeRun:**
```
Person (pessoa_piperun_id)
  └── Company (empresa_piperun_id)
       └── Deal (piperun_id)
            └── Proposals (proposals_data JSONB)
```

### 5.3 Cognitive Engine

| Função | Modelo | Descrição |
|---|---|---|
| `cognitive-lead-analysis` | DeepSeek v3 | Análise individual de lead (10 eixos + estágio). Usa historico_resumos + equipamentos + CRM. |
| `batch-cognitive-analysis` | DeepSeek v3 | Processa batch de leads. ORDER BY: intelligence_score_total DESC → total_messages DESC → updated_at DESC. |
| `backfill-intelligence-score` | RPC PostgreSQL | Recalcula LIS para todos os leads (utilitária) |

**Pipeline Cognitivo:**
```
Lead data (lia_attendances) 
  → Context assembly (histórico + equipamentos + CRM + e-commerce)
  → DeepSeek v3 prompt (10 eixos)
  → JSON response parsing
  → Salva cognitive_analysis + campos individuais
  → Recalcula intelligence_score via RPC
```

### 5.4 Stagnation & CS Automation

| Função | Descrição |
|---|---|
| `smart-ops-stagnant-processor` | Detecta leads estagnados (6 etapas). Usa DeepSeek para decidir ação. Dispara WaLeads/SellFlux. |
| `smart-ops-cs-processor` | Executa regras de CS (`cs_automation_rules`). Dispara mensagens por trigger_event. |
| `smart-ops-proactive-outreach` | 4 tipos de outreach proativo com regras de elegibilidade e cooldown |

**6 Etapas de Estagnação:**
1. **Novo sem contato** — Lead sem resposta após X dias
2. **Em negociação parado** — Deal sem movimento
3. **Pós-proposta sem retorno** — Proposta enviada sem follow-up
4. **Recompra** — Cliente ativo sem nova compra
5. **Churn risk** — Sinais de abandono
6. **Reativação** — Lead frio com potencial

### 5.5 Integrações

| Função | Sistema | Descrição |
|---|---|---|
| `smart-ops-sellflux-sync` | SellFlux | Envia leads para SellFlux com field mapping (`sellflux-field-map.ts`) |
| `smart-ops-sellflux-webhook` | SellFlux | Recebe updates do SellFlux |
| `smart-ops-send-waleads` | WaLeads | Envia mensagens WhatsApp (texto, imagem, vídeo). Suporta variáveis dinâmicas. |
| `smart-ops-wa-inbox-webhook` | WhatsApp | Classifica mensagens recebidas por intent (14+ patterns). Alerta vendedores. |
| `sync-astron-members` | Astron | Sync completo de membros (planos, cursos, progresso) |
| `astron-member-lookup` | Astron | Busca individual de membro por email |
| `astron-postback` | Astron | Recebe postback de eventos (compra, conclusão) |
| `poll-loja-integrada-orders` | Loja Integrada | Polling de pedidos recentes |
| `register-loja-webhooks` | Loja Integrada | Registra webhooks no painel |
| `fix-piperun-links` | PipeRun | Corrige links legados (utilitária) |
| `piperun-api-test` | PipeRun | Teste de conectividade API (utilitária) |

### 5.6 Intelligence & Watchdog

| Função | Descrição |
|---|---|
| `system-watchdog-deepseek` | Detecta leads órfãos (sem owner). Auto-remedia. Análise DeepSeek de anomalias sistêmicas. |
| `evaluate-interaction` | Avalia qualidade de interações do agente (judge model) |
| `backfill-lia-leads` | Backfill de leads legados para lia_attendances (utilitária) |

### 5.7 WhatsApp Intent Classification

**Classificação em 2 camadas:**

**Camada 1 — Primary Patterns (regras existentes):**
- `interesse_compra` — Intenção clara de compra
- `duvida_tecnica` — Pergunta técnica
- `suporte` — Pedido de suporte
- `agradecimento` — Agradecimento/elogio
- `reclamacao` — Reclamação
- `spam` — Spam/irrelevante

**Camada 2 — Secondary Patterns (14 regras, FIX #3):**
- `pedido_info` — "quanto custa", "como funciona", "tem disponível"
- `interesse_imediato` — "me manda", "quero receber", "pode enviar"
- `interesse_futuro` — "vou pensar", "depois eu vejo", "semana que vem"
- `objecao` — "tá caro", "sem grana", "não tenho condição"

---

## 6. Content Generation Pipeline

### 6.1 Visão Geral do Pipeline

```
FONTES                    EXTRAÇÃO              ORQUESTRAÇÃO           PÓS-PROCESSAMENTO        PUBLICAÇÃO
─────                    ────────              ────────────           ──────────────────        ──────────
PDF ──────────→ extract-pdf-text ─────┐
PDF (raw) ────→ extract-pdf-raw ──────┤
PDF (espec.) ─→ extract-pdf-specialized┤
PDF (cache) ──→ extract-and-cache-pdf ─┤
Vídeo ────────→ extract-video-content ─┼──→ ai-orchestrate-content ──→ reformat-article-html ──→ knowledge_contents
Texto direto ─→ (input direto) ────────┤       (1193 linhas)          ai-content-formatter       (Supabase)
Google Drive ─→ sync-google-drive-kb ──┤       SYSTEM_SUPER_PROMPT    enrich-article-seo            │
Apostila ─────→ enrich-resins ─────────┘       Gemini 2.5 Flash      auto-inject-product-cards      │
                                                                      ai-metadata-generator          │
                                                                      ai-generate-og-image           │
                                                                      translate-content (EN/ES)      │
                                                                      backfill-keywords              │
                                                                                                     ▼
                                                                                           Sitemaps + RSS/Atom
                                                                                           seo-proxy (SSR)
                                                                                           KnowledgeSEOHead.tsx
```

### 6.2 Funções de Extração

| Função | Linhas | Input | Output | Descrição |
|---|---|---|---|---|
| `extract-pdf-text` | ~200 | PDF URL | Texto limpo | Extração básica de texto via API |
| `extract-pdf-raw` | ~150 | PDF URL | Texto bruto | Extração sem processamento |
| `extract-pdf-specialized` | ~300 | PDF URL + tipo | Texto estruturado | Extração especializada por tipo de documento (IFU, FDS, laudo) |
| `extract-and-cache-pdf` | ~250 | PDF URL | Texto cached | Extração com cache em `catalog_documents.extracted_text` |
| `extract-video-content` | ~200 | PandaVideo ID | Transcrição | Extração de transcrição de vídeo via PandaVideo API |
| `ai-enrich-pdf-content` | ~300 | PDF text + produto | HTML enriquecido | Enriquecimento de conteúdo PDF com contexto de produto |

### 6.3 Orquestrador Central — `ai-orchestrate-content`

**Arquivo:** `supabase/functions/ai-orchestrate-content/index.ts` (1193 linhas)

**Interface de entrada (`OrchestrationRequest`):**
```typescript
{
  title?: string;
  excerpt?: string;
  sources: {
    rawText?: string;
    pdfTranscription?: string;
    videoTranscription?: string;
    relatedPdfs?: Array<{ name: string; content: string }>;
    technicalSheet?: string;    // legacy
    transcript?: string;         // legacy
    manual?: string;             // legacy
    testimonials?: string;       // legacy
    customPrompt?: string;       // legacy
  };
  contentType?: 'tecnico' | 'educacional' | 'depoimentos' | 'passo_a_passo' | 'cases_sucesso';
  documentType?: 'perfil_tecnico' | 'fds' | 'ifu' | 'laudo' | 'catalogo' | 'guia' | 'certificado';
  selectedResinIds?: string[];
  selectedProductIds?: string[];
  language?: 'pt' | 'en' | 'es';
  aiPrompt?: string;
}
```

**Interface de saída (`OrchestratorResponse`):**
```typescript
{
  html: string;                    // HTML formatado com classes Tailwind
  faqs: Array<{ question: string; answer: string }>;
  metadata: {
    educationalLevel: string;
    learningResourceType: string;
    timeRequired: string;
    proficiencyLevel: string;
    teaches: string[];
    aiContext: string;             // Resumo semântico para LLMs
  };
  schemas: {
    howTo: boolean;                // Se o conteúdo tem passos
    faqPage: boolean;             // Se o conteúdo tem FAQs
  };
  veredictData?: {                // Veredicto técnico (quando aplicável)
    productName: string;
    veredict: 'approved' | 'approved_conditionally' | 'pending';
    summary: string;
    quickFacts: Array<{ label: string; value: string }>;
    testNorms?: string[];
  };
  success: boolean;
}
```

**Prompts especializados usados:**
| Prompt | Arquivo | Uso |
|---|---|---|
| `SYSTEM_SUPER_PROMPT` | `_shared/system-prompt.ts` (220 linhas) | Prompt base para todo conteúdo |
| `ANTI_HALLUCINATION_RULES` | `_shared/system-prompt.ts` (linhas 1-43) | 6 regras anti-alucinação |
| `TESTIMONIAL_PROMPT` | `_shared/testimonial-prompt.ts` | Depoimentos/cases de sucesso |
| `DOCUMENT_PROMPTS` | `_shared/document-prompts.ts` | 7 tipos de documento (IFU, FDS, etc.) |
| `EXTRACTION_RULES` | `_shared/extraction-rules.ts` | Regras de extração de PDF |

**Modelo:** `google/gemini-2.5-flash` via Lovable AI Gateway

### 6.4 Pós-Processamento

| Função | Linhas | Modelo | Descrição |
|---|---|---|---|
| `reformat-article-html` | 235 | Gemini 2.5 Flash | Reformata HTML mal estruturado. Multi-idioma (PT/EN/ES sequencial). Converte tabelas texto → `<table>`. Converte URLs texto plano → `<a>`. |
| `ai-content-formatter` | ~200 | Gemini 2.5 Flash | Formatação adicional de HTML com classes Tailwind |
| `enrich-article-seo` | ~300 | Gemini 2.5 Flash | Enriquece SEO (meta description, keywords, FAQs) |
| `auto-inject-product-cards` | ~400 | Gemini 2.5 Flash | Injeta cards de produto inline no HTML baseado em menções |
| `ai-metadata-generator` | ~250 | Gemini 2.5 Flash | Gera slug, meta description, keywords, ai_context |
| `ai-generate-og-image` | ~200 | Gemini 2.5 Flash | Gera prompt para OG image |
| `translate-content` | ~300 | Gemini 2.5 Flash | Traduz content_html + faqs + excerpt + ai_context para EN/ES |
| `backfill-keywords` | ~200 | Gemini 2.5 Flash | Backfill de keywords para artigos sem keywords |

### 6.5 Conteúdo de Suporte

| Função | Descrição |
|---|---|
| `ai-model-compare` | Compara 2+ modelos de impressoras 3D usando dados do catálogo. Modelo: `gpt-4.1-mini` |
| `generate-veredict-data` | Gera dados de veredicto técnico para produtos |
| `export-processing-instructions` | Exporta instruções de processamento de resinas |
| `format-processing-instructions` | Formata instruções de processamento em HTML |
| `export-apostila-docx` | Exporta apostila como DOCX |
| `export-parametros-ia` | Exporta parâmetros de impressão 3D em JSON estruturado (API pública) |

### 6.6 Knowledge Base Management

| Função | Descrição |
|---|---|
| `sync-knowledge-base` | Sync externo de knowledge base |
| `ingest-knowledge-text` | Ingesta texto para KB (company_kb_texts) |
| `sync-google-drive-kb` | Sync de documentos do Google Drive para KB |
| `heal-knowledge-gaps` | Identifica e gera rascunhos para lacunas na KB usando clusters de perguntas |
| `create-test-articles` | Cria artigos de teste (utilitária, verify_jwt=true) |
| `link-videos-to-articles` | Vincula vídeos a artigos baseado em matching de título/conteúdo |

### 6.7 Dra. L.I.A. (Agente Conversacional)

| Função | Descrição |
|---|---|
| `dra-lia` | Agente principal. RAG com embeddings vetoriais. Busca semântica em `agent_embeddings`. Suporta PT/EN/ES. |
| `dra-lia-whatsapp` | Adaptador WhatsApp. Usa SERVICE_ROLE_KEY (FIX #1). |
| `dra-lia-export` | Exporta histórico de conversas |
| `index-embeddings` | Indexa embeddings vetoriais para RAG |
| `index-spin-entries` | Indexa entradas SPIN para RAG |
| `archive-daily-chats` | Arquiva conversas diárias |
| `extract-commercial-expertise` | Extrai expertise comercial de conversas |

### 6.8 Sitemaps, Feeds & Discovery

| Função | Output | URL |
|---|---|---|
| `generate-sitemap` | XML Sitemap principal | `/sitemap.xml` |
| `generate-knowledge-sitemap` | XML Sitemap KB (PT) | Via robots.txt |
| `generate-knowledge-sitemap-en` | XML Sitemap KB (EN) | Via robots.txt |
| `generate-knowledge-sitemap-es` | XML Sitemap KB (ES) | Via robots.txt |
| `generate-documents-sitemap` | XML Sitemap documentos | Via robots.txt |
| `knowledge-feed` | RSS/Atom feed | `?format=rss` ou `?format=atom` |
| `seo-proxy` (1854 linhas) | HTML SSR completo | Intercepta bots via User-Agent |

### 6.9 Sync de Vídeos & Analytics

| Função | Descrição |
|---|---|
| `sync-pandavideo` | Sincroniza catálogo de vídeos do PandaVideo |
| `sync-video-analytics` | Sincroniza métricas (views, plays, retention) |
| `pandavideo-test` | Testa conectividade com PandaVideo API (utilitária) |
| `sync-google-reviews` | Sincroniza avaliações do Google |

---

## 7. Qualidade do HTML Gerado & Exposição SEO/IA

### 7.1 Padrão de HTML Gerado pelo Orquestrador

O HTML gerado pelo `ai-orchestrate-content` segue regras estritas definidas no `SYSTEM_SUPER_PROMPT`:

**Estrutura semântica:**
```html
<!-- Hierarquia lógica de headings -->
<h2 class="text-2xl font-bold mt-8 mb-4">Título da Seção</h2>
<h3 class="text-xl font-semibold mt-6 mb-3">Subtítulo</h3>
<h4 class="text-lg font-medium mt-4 mb-2">Sub-subtítulo</h4>

<!-- Parágrafos com espaçamento -->
<p class="mb-4">Texto do parágrafo...</p>

<!-- Tabelas semânticas (convertidas de texto corrido pelo reformat) -->
<table class="w-full border-collapse my-6">
  <thead>
    <tr>
      <th class="border border-border p-3 bg-muted text-left font-semibold">Coluna</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td class="border border-border p-3">Valor</td>
    </tr>
  </tbody>
</table>

<!-- Listas -->
<ul class="list-disc pl-6 my-4">
  <li>Item</li>
</ul>

<!-- Links (convertidos de URLs texto plano) -->
<a href="https://..." target="_blank" rel="noopener noreferrer" class="text-primary underline">URL</a>
```

**Classes CSS customizadas (definidas em `src/styles/blog-content.css`):**
- `.content-card` — Card de conteúdo destacado
- `.benefit-card` — Card de benefício
- `.cta-panel` — Painel de call-to-action
- `.article-summary` — Resumo técnico (ArticleSummary.tsx)
- `.article-summary-title` — Título do resumo
- `.article-summary-content` — Conteúdo do resumo

### 7.2 Regras Anti-Alucinação

O `ANTI_HALLUCINATION_RULES` (43 linhas) define 6 regras absolutas:

| # | Regra | Implementação |
|---|---|---|
| 1 | **Fonte da Verdade** | O conteúdo fornecido é a ÚNICA fonte. Não busca externo. |
| 2 | **Transcrição Literal** | "147 MPa" nunca vira "~150 MPa". Valores exatos preservados. |
| 3 | **Proibido Inventar** | Não adiciona produtos, marcas, estudos, CTAs não mencionados |
| 4 | **Ilegibilidade** | Marca `[ilegível]` ou `[incompleto no original]` em vez de adivinhar |
| 5 | **Dados Técnicos** | Mantém valores exatos (59% wt, não "cerca de 60%") |
| 6 | **Links e CTAs** | Usa APENAS links de `external_links` aprovados |

**Validação no `reformat-article-html`:**
- Regras de pós-processamento convertem URLs texto plano em `<a>` tags
- Negative lookbehind previne double-linking: `(?<!href="|src="|itemtype="|content="|action="|">)`
- Strip de code fences Markdown (```` ```html ... ``` ````)

### 7.3 O que Fica Exposto para SEO

| Elemento | Arquivo | Implementação |
|---|---|---|
| `<title>` | `KnowledgeSEOHead.tsx` | Dinâmico: `{título} \| Smart Dent` (< 60 chars) |
| `<meta name="description">` | `KnowledgeSEOHead.tsx` | `meta_description` ou `excerpt` (< 160 chars) |
| `<meta name="keywords">` | `KnowledgeSEOHead.tsx` | Extraídas de headings + termos técnicos encontrados |
| `<link rel="canonical">` | `KnowledgeSEOHead.tsx` | URL canônica com i18n path |
| `hreflang` (PT/EN/ES) | `KnowledgeSEOHead.tsx` | 3 alternate links + x-default |
| `og:title/description/image` | `KnowledgeSEOHead.tsx` | Open Graph para redes sociais |
| `twitter:card` | `KnowledgeSEOHead.tsx` | Summary large image |
| `article:published_time` | `KnowledgeSEOHead.tsx` | Data de criação |
| `article:modified_time` | `KnowledgeSEOHead.tsx` | Data de atualização |

### 7.4 O que Fica Exposto para IA (Crawlers & LLMs)

| Elemento | Arquivo | Descrição |
|---|---|---|
| **JSON-LD Article Schema** | `KnowledgeSEOHead.tsx` | `MedicalWebPage` / `TechArticle` / `ScholarlyArticle` com `@type` dinâmico |
| **JSON-LD Organization** | `SEOHead.tsx` | Dados da empresa via `useCompanyData` com logo, contato, redes sociais |
| **JSON-LD Product + Offer** | `SEOHead.tsx` | Multi-CTA com `priceValidUntil`, `availability`, `priceCurrency` |
| **JSON-LD VideoObject** | `VideoSchema.tsx` | `transcript`, `duration`, `thumbnailUrl`, `embedUrl` |
| **JSON-LD FAQPage** | `KnowledgeSEOHead.tsx` | Auto-extraído de headings com "?" + palavras interrogativas (como, qual, quando...) |
| **JSON-LD HowTo** | `KnowledgeSEOHead.tsx` | 4 métodos de extração (OL → headings numerados → tabelas → markdown) |
| **JSON-LD BreadcrumbList** | `SEOHead.tsx` | Hierarquia de navegação dinâmica |
| **`<meta name="ai-context">`** | `SEOHead.tsx` | Contexto semântico direto para LLMs |
| **`<article itemProp="abstract">`** | `ArticleSummary.tsx` | Resumo técnico do artigo (multilíngue) |
| **Author E-E-A-T** | `AuthorSignature.tsx` | Credenciais completas (CRO, especialidade, links sociais) |
| **`llms.txt`** | `public/llms.txt` | Instruções para crawlers IA (conteúdo, API, citação) |
| **`robots.txt`** | `public/robots.txt` | Allow explícito para GPTBot, ClaudeBot, PerplexityBot, Bingbot |
| **Sitemaps (5)** | Edge functions | PT, EN, ES, documentos, principal |
| **RSS/Atom Feed** | `knowledge-feed` | Feed estruturado para indexadores |
| **SSR via `seo-proxy`** | Edge function (1854 linhas) | Renderiza HTML completo para bots (detecta User-Agent) |

### 7.5 Extração Automática de Schemas

**FAQPage Schema** (`KnowledgeSEOHead.tsx` linhas 47-83):
```typescript
// Procura headings (h2, h3, h4) que:
// 1. Contêm "?"
// 2. Começam com palavras interrogativas (como, qual, quando, onde, por que, o que, quais, quanto)
// Coleta próximos <p>, <ul>, <ol> como resposta (até próximo heading)
// Limita resposta a 500 chars
```

**HowTo Schema** (`KnowledgeSEOHead.tsx` linhas 86-178):
```
Método 1: <ol><li> (listas ordenadas) — PREFERENCIAL
Método 2: Headings numerados (h2/h3/h4 começando com "Passo X" ou "1.")
Método 3: Tabelas HTML (primeira coluna com numeração)
Método 4: Tabelas Markdown convertidas (pipes "|")
Limite: 10 passos (boas práticas Google)
```

### 7.6 SSR para Bots — `seo-proxy`

**Arquivo:** `supabase/functions/seo-proxy/index.ts` (1854 linhas)

**Detecção de bots via User-Agent:**
- Googlebot, Bingbot, YandexBot
- GPTBot, ClaudeBot, PerplexityBot, ChatGPT-User
- Facebookbot, Twitterbot, LinkedInBot
- Slackbot, WhatsApp, Telegram

**O que o SSR renderiza:**
- HTML completo com todos os JSON-LD schemas
- Content HTML do artigo (conteúdo real)
- Meta tags (title, description, OG, Twitter)
- hreflang links
- Breadcrumbs
- Author signature
- FAQ markup

---

## 8. Frontend Completo

### 8.1 Rotas Públicas

| Rota | Componente | Descrição |
|---|---|---|
| `/` | `Index` | Hub de parâmetros de impressão 3D |
| `/:brandSlug` | `Index` | Filtro por marca |
| `/:brandSlug/:modelSlug` | `Index` | Filtro por modelo |
| `/:brandSlug/:modelSlug/:resinSlug` | `Index` | Parâmetros específicos resina+modelo |
| `/base-conhecimento` | `KnowledgeBase` (PT) | Knowledge Base em português |
| `/base-conhecimento/:categoryLetter` | `KnowledgeBase` (PT) | Categoria específica |
| `/base-conhecimento/:categoryLetter/:contentSlug` | `KnowledgeBase` (PT) | Artigo específico |
| `/en/knowledge-base/**` | `KnowledgeBase` (EN) | Versão inglês |
| `/es/base-conocimiento/**` | `KnowledgeBase` (ES) | Versão espanhol |
| `/produtos/:slug` | `ProductPage` | Página de produto com schema |
| `/depoimentos/:slug` | `TestimonialPage` | Página de depoimento |
| `/categorias/:slug` | `CategoryPage` | Página de categoria |
| `/sobre` | `About` | Sobre a empresa |
| `/docs/:filename` | `DocumentProxyRoute` | Proxy de documentos PDF |
| `/exemplo-parametros` | `ParameterPageExample` | Exemplo de página de parâmetros |
| `/resinas/:slug` | `ResinRedirect` | Redirect para resinas |
| `/embed/dra-lia` | `AgentEmbed` | Widget embeddável do agente |
| `/f/:slug` | `PublicFormPage` | Formulários públicos dinâmicos |

**Componente global:** `DraLIA` — Widget flutuante exibido em todas as páginas exceto `/admin` e `/embed`.

### 8.2 Painel Admin (`/admin`)

**Acesso:** `AdminViewSecure` → verifica autenticação + role admin → `AdminViewSupabase`

**Tabs principais:**

| Tab | Componente | Descrição |
|---|---|---|
| Stats | `AdminStats` | Dashboard com métricas do sistema |
| Usuários | `AdminUsers` | Gestão de usuários |
| KB | `AdminKnowledge` | Editor de artigos com TipTap, FAQs, tradução |
| Autores | `AdminAuthors` | Gestão de autores (E-E-A-T) |
| Catálogo | `AdminCatalog` | Produtos com documentos, CTAs, imagens |
| Vídeos | `AdminVideosList` | Gestão de vídeos PandaVideo |
| Parâmetros | `AdminParameterPages` | Páginas de parâmetros técnicos |
| SmartOps | `SmartOpsTab` | Centro de operações (12 sub-tabs) |
| Dra.LIA | `AdminDraLIAStats` | Estatísticas do agente conversacional |

### 8.3 SmartOps — 12 Sub-Tabs

| Sub-Tab | Componente | Descrição |
|---|---|---|
| Bowtie | `SmartOpsBowtie` | Funil Bowtie (aquisição + expansão) |
| Kanban | `SmartOpsKanban` | Board Kanban com drag & drop de leads |
| Leads | `SmartOpsLeadsList` | Lista completa de leads com filtros |
| Equipe | `SmartOpsTeam` | Gestão de time e round robin |
| Automações | `SmartOpsCSRules` | Regras de CS automation |
| Logs | `SmartOpsLogs` | Logs de operações e automações |
| Conteúdo | `SmartOpsContentProduction` | Produção de conteúdo (gaps + requests) |
| Saúde | `SmartOpsSystemHealth` | Health check do sistema |
| WhatsApp | `SmartOpsWhatsAppInbox` | Inbox de mensagens WhatsApp |
| Formulários | `SmartOpsFormBuilder` | Builder de formulários dinâmicos |
| Tokens IA | `SmartOpsAIUsageDashboard` | Dashboard de uso de tokens IA |
| Intelligence | `SmartOpsIntelligenceDashboard` | Dashboard de intelligence scores |

### 8.4 Componentes de SEO

| Componente | Uso |
|---|---|
| `SEOHead.tsx` (660 linhas) | Schema Organization + Product + BreadcrumbList + FAQ |
| `KnowledgeSEOHead.tsx` (1142 linhas) | Schema Article + FAQ + HowTo + VideoObject + hreflang |
| `TestimonialSEOHead.tsx` | Schema Review + testimonial |
| `AboutSEOHead.tsx` | Schema para página Sobre |
| `VideoSchema.tsx` | Schema VideoObject standalone |
| `OrganizationSchema.tsx` | Schema Organization standalone |
| `ArticleSummary.tsx` | Resumo técnico multilíngue com `itemProp="abstract"` |
| `ArticleMeta.tsx` | Metadados do artigo (data, autor, categoria) |
| `AuthorSignature.tsx` | Assinatura do autor com E-E-A-T completo |
| `AuthorBio.tsx` | Bio expandida do autor |
| `Breadcrumb.tsx` | Breadcrumbs visuais |

---

## 9. Shared Modules (`_shared/`)

| Módulo | Descrição |
|---|---|
| `system-prompt.ts` (220 linhas) | `SYSTEM_SUPER_PROMPT` + `ANTI_HALLUCINATION_RULES` — prompt base para todas as funções de IA |
| `testimonial-prompt.ts` | Prompt especializado para depoimentos/cases |
| `document-prompts.ts` | 7 prompts especializados por tipo de documento (IFU, FDS, laudo, etc.) |
| `extraction-rules.ts` | Regras de extração de PDF |
| `log-ai-usage.ts` | Logger de uso de tokens IA → `ai_token_usage` |
| `piperun-field-map.ts` | Mapeamento de campos PipeRun ↔ lia_attendances |
| `sellflux-field-map.ts` | Mapeamento de campos SellFlux ↔ lia_attendances |
| `og-visual-dictionary.ts` | Dicionário visual para geração de OG images |

---

## 10. Database — Tabelas, Views, RPCs & Triggers

### 10.1 Tabelas Principais

| Tabela | Colunas | RLS | Descrição |
|---|---|---|---|
| `lia_attendances` | ~200 | admin_only | CDP unificado de leads |
| `knowledge_contents` | ~40 | public read (active) + admin CUD | Artigos da KB |
| `knowledge_categories` | 7 | public read + admin update | Categorias da KB |
| `knowledge_videos` | ~50 | public read + admin CUD | Vídeos da KB |
| `knowledge_video_metrics_log` | 11 | public read + admin all | Métricas históricas de vídeo |
| `system_a_catalog` | ~80 | public read + admin CUD | Catálogo de produtos |
| `catalog_documents` | ~22 | public read (active) + admin all | Documentos técnicos (IFU, FDS, etc.) |
| `authors` | ~18 | public read (active) + admin CUD | Autores com E-E-A-T |
| `brands` | 7 | public read + admin CUD | Marcas de impressoras |
| `resins` | ~40 | public read + admin CUD | Resinas 3D |
| `agent_interactions` | ~20 | admin read + public insert | Histórico de chat Dra. L.I.A. |
| `agent_sessions` | 8 | admin read + public all | Sessões do agente |
| `agent_embeddings` | 8 | admin all + public read | Embeddings vetoriais (RAG) |
| `agent_knowledge_gaps` | 10 | admin only | Lacunas de conhecimento detectadas |
| `knowledge_gap_drafts` | ~16 | admin only | Rascunhos gerados para lacunas |
| `leads` | 12 | admin only | Leads legados (formulário site) |
| `lead_state_events` | 11 | admin all + service insert | Histórico de mudanças de estágio |
| `cs_automation_rules` | ~15 | admin only | Regras de automação CS |
| `team_members` | ~10 | admin only | Membros da equipe |
| `ai_token_usage` | 11 | admin read + service insert | Log de uso de tokens IA |
| `intelligence_score_config` | 6 | admin all + public read | Configuração LIS (weights + thresholds) |
| `external_links` | ~20 | admin all + public read (approved) | Links externos aprovados para SEO |
| `company_kb_texts` | 9 | admin only | Textos de KB da empresa |
| `drive_kb_sync_log` | 13 | admin only | Log de sync Google Drive |
| `content_requests` | ~14 | admin only | Solicitações de conteúdo |
| `backfill_log` | 7 | admin all + service insert | Log de backfills |

### 10.2 Views

| View | Tipo | Descrição |
|---|---|---|
| `v_lead_commercial` | View | Dados comerciais do lead |
| `v_lead_cognitive` | View | Dados cognitivos do lead |
| `v_lead_academy` | View | Dados acadêmicos (Astron) |
| `v_lead_ecommerce` | View | Dados e-commerce (Loja Integrada) |
| `lead_model_routing` | View | Roteamento de modelo IA por lead |

### 10.3 Funções RPC

| RPC | Descrição |
|---|---|
| `is_admin(user_id)` | Verifica se é admin |
| `is_author(user_id)` | Verifica se é autor |
| `has_panel_access(user_id)` | Verifica acesso ao painel |
| `calculate_intelligence_score(lead_id)` | Calcula LIS para um lead |
| `match_agent_embeddings(query, threshold, count)` | Busca semântica por similaridade |

---

## 11. Secrets & Configuração

### 11.1 Secrets Necessários (Supabase Edge Functions)

| Secret | Usado Por | Descrição |
|---|---|---|
| `SUPABASE_URL` | Todas | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Todas | Chave de serviço (bypassa RLS) |
| `LOVABLE_API_KEY` | Funções de IA | Chave do Lovable AI Gateway |
| `PIPERUN_API_TOKEN` | CRM Sync | Token da API PipeRun |
| `WALEADS_API_KEY` | WhatsApp | Chave da API WaLeads |
| `WALEADS_PHONE_ID` | WhatsApp | ID do número WaLeads |
| `SELLFLUX_API_KEY` | SellFlux | Chave da API SellFlux |
| `SELLFLUX_WEBHOOK_SECRET` | SellFlux | Secret de validação webhook |
| `PANDAVIDEO_API_KEY` | Vídeos | Chave da API PandaVideo |
| `ASTRON_API_KEY` | Academy | Chave da API Astron |
| `GOOGLE_DRIVE_API_KEY` | KB Sync | Chave da API Google Drive |
| `GOOGLE_PLACES_API_KEY` | Reviews | Chave da API Google Places |
| `META_WEBHOOK_VERIFY_TOKEN` | Meta Ads | Token de verificação webhook |

### 11.2 JWT Configuration

**`supabase/config.toml`:** 85+ funções configuradas com `verify_jwt = false` (acessíveis publicamente como webhooks ou APIs). Exceções com `verify_jwt = true`:
- `create-user` — Criação de usuários
- `ai-metadata-generator` — Geração de metadados
- `create-test-articles` — Criação de artigos teste
- `heal-knowledge-gaps` — Healing de gaps

---

## 12. Checklist de Funcionalidades

### Legenda
- ✅ **FUNCIONAL** — Implementado, montado e operacional
- 🔌 **ÓRFÃO** — Código existe mas NÃO é importado/montado no app
- 🔧 **UTILITÁRIA** — One-shot / manutenção / teste
- 🧪 **TESTE** — Função de teste de API

### 12.1 Edge Functions — Leads & CRM

| Função | Status | Notas |
|---|---|---|
| `smart-ops-ingest-lead` | ✅ FUNCIONAL | Gateway unificado |
| `smart-ops-meta-lead-webhook` | ✅ FUNCIONAL | Meta Ads |
| `smart-ops-sellflux-webhook` | ✅ FUNCIONAL | SellFlux |
| `smart-ops-ecommerce-webhook` | ✅ FUNCIONAL | Loja Integrada |
| `smart-ops-piperun-webhook` | ✅ FUNCIONAL | PipeRun |
| `smart-ops-lia-assign` | ✅ FUNCIONAL | CRM Assignment |
| `smart-ops-sync-piperun` | ✅ FUNCIONAL | Sync manual |
| `piperun-full-sync` | ✅ FUNCIONAL | Full sync |
| `smart-ops-kanban-move` | ✅ FUNCIONAL | Move etapas |
| `cognitive-lead-analysis` | ✅ FUNCIONAL | DeepSeek individual |
| `batch-cognitive-analysis` | ✅ FUNCIONAL | DeepSeek batch (FIX #2) |
| `smart-ops-stagnant-processor` | ✅ FUNCIONAL | Estagnação |
| `smart-ops-cs-processor` | ✅ FUNCIONAL | CS Automation |
| `smart-ops-proactive-outreach` | ✅ FUNCIONAL | Outreach proativo |
| `smart-ops-send-waleads` | ✅ FUNCIONAL | Envio WhatsApp |
| `smart-ops-wa-inbox-webhook` | ✅ FUNCIONAL | Inbox WhatsApp (FIX #3) |
| `smart-ops-sellflux-sync` | ✅ FUNCIONAL | Sync SellFlux |
| `system-watchdog-deepseek` | ✅ FUNCIONAL | Watchdog |
| `sync-astron-members` | ✅ FUNCIONAL | Sync Astron |
| `astron-member-lookup` | ✅ FUNCIONAL | Lookup Astron |
| `astron-postback` | ✅ FUNCIONAL | Postback Astron |
| `poll-loja-integrada-orders` | ✅ FUNCIONAL | Polling pedidos |
| `register-loja-webhooks` | ✅ FUNCIONAL | Registro webhooks |
| `evaluate-interaction` | ✅ FUNCIONAL | Judge model |
| `import-leads-csv` | ✅ FUNCIONAL | Import CSV |
| `backfill-intelligence-score` | 🔧 UTILITÁRIA | Recálculo batch |
| `backfill-lia-leads` | 🔧 UTILITÁRIA | Backfill legado |
| `fix-piperun-links` | 🔧 UTILITÁRIA | Correção links |
| `piperun-api-test` | 🧪 TESTE | Teste API |

### 12.2 Edge Functions — Content & Knowledge

| Função | Status | Notas |
|---|---|---|
| `ai-orchestrate-content` | ✅ FUNCIONAL | Orquestrador central (1193 linhas) |
| `ai-content-formatter` | ✅ FUNCIONAL | Formatação HTML |
| `reformat-article-html` | ✅ FUNCIONAL | Reformatação multi-idioma |
| `ai-metadata-generator` | ✅ FUNCIONAL | Metadados SEO |
| `ai-generate-og-image` | ✅ FUNCIONAL | OG images |
| `enrich-article-seo` | ✅ FUNCIONAL | Enriquecimento SEO |
| `auto-inject-product-cards` | ✅ FUNCIONAL | Cards de produto inline |
| `translate-content` | ✅ FUNCIONAL | Tradução PT→EN/ES |
| `extract-pdf-text` | ✅ FUNCIONAL | Extração PDF |
| `extract-pdf-raw` | ✅ FUNCIONAL | Extração PDF raw |
| `extract-pdf-specialized` | ✅ FUNCIONAL | Extração PDF especializada |
| `extract-and-cache-pdf` | ✅ FUNCIONAL | Extração com cache |
| `extract-video-content` | ✅ FUNCIONAL | Extração vídeo |
| `ai-enrich-pdf-content` | ✅ FUNCIONAL | Enriquecimento PDF |
| `ai-model-compare` | ✅ FUNCIONAL | Comparação modelos |
| `generate-veredict-data` | ✅ FUNCIONAL | Veredicto técnico |
| `sync-knowledge-base` | ✅ FUNCIONAL | Sync KB |
| `ingest-knowledge-text` | ✅ FUNCIONAL | Ingesta KB |
| `sync-google-drive-kb` | ✅ FUNCIONAL | Sync Drive |
| `heal-knowledge-gaps` | ✅ FUNCIONAL | Healing gaps |
| `link-videos-to-articles` | ✅ FUNCIONAL | Link vídeos↔artigos |
| `enrich-resins-from-apostila` | ✅ FUNCIONAL | Enriquecimento resinas |
| `export-processing-instructions` | ✅ FUNCIONAL | Export instruções |
| `format-processing-instructions` | ✅ FUNCIONAL | Formatação instruções |
| `export-apostila-docx` | ✅ FUNCIONAL | Export DOCX |
| `export-parametros-ia` | ✅ FUNCIONAL | API pública JSON |
| `backfill-keywords` | 🔧 UTILITÁRIA | Backfill keywords |
| `create-test-articles` | 🔧 UTILITÁRIA | Artigos teste |

### 12.3 Edge Functions — Sitemaps & Discovery

| Função | Status | Notas |
|---|---|---|
| `generate-sitemap` | ✅ FUNCIONAL | Sitemap principal |
| `generate-knowledge-sitemap` | ✅ FUNCIONAL | Sitemap KB (PT) |
| `generate-knowledge-sitemap-en` | ✅ FUNCIONAL | Sitemap KB (EN) |
| `generate-knowledge-sitemap-es` | ✅ FUNCIONAL | Sitemap KB (ES) |
| `generate-documents-sitemap` | ✅ FUNCIONAL | Sitemap docs |
| `knowledge-feed` | ✅ FUNCIONAL | RSS/Atom |
| `seo-proxy` | ✅ FUNCIONAL | SSR para bots (1854 linhas) |
| `document-proxy` | ✅ FUNCIONAL | Proxy de documentos |

### 12.4 Edge Functions — Agente Dra. L.I.A.

| Função | Status | Notas |
|---|---|---|
| `dra-lia` | ✅ FUNCIONAL | Agente principal |
| `dra-lia-whatsapp` | ✅ FUNCIONAL | Adaptador WhatsApp (FIX #1) |
| `dra-lia-export` | ✅ FUNCIONAL | Export histórico |
| `index-embeddings` | ✅ FUNCIONAL | Indexação RAG |
| `index-spin-entries` | ✅ FUNCIONAL | Indexação SPIN |
| `archive-daily-chats` | ✅ FUNCIONAL | Arquivamento diário |
| `extract-commercial-expertise` | ✅ FUNCIONAL | Extração expertise |

### 12.5 Edge Functions — Sync & Misc

| Função | Status | Notas |
|---|---|---|
| `sync-pandavideo` | ✅ FUNCIONAL | Sync vídeos |
| `sync-video-analytics` | ✅ FUNCIONAL | Sync métricas |
| `sync-google-reviews` | ✅ FUNCIONAL | Sync reviews |
| `sync-sistema-a` | ✅ FUNCIONAL | Sync Sistema A |
| `import-system-a-json` | ✅ FUNCIONAL | Import JSON |
| `import-loja-integrada` | ✅ FUNCIONAL | Import Loja |
| `create-user` | ✅ FUNCIONAL | Criação usuário |
| `data-export` | ✅ FUNCIONAL | Export dados |
| `get-product-data` | ✅ FUNCIONAL | API produto |
| `generate-parameter-pages` | ✅ FUNCIONAL | Geração páginas |
| `migrate-catalog-images` | 🔧 UTILITÁRIA | Migração única |
| `pandavideo-test` | 🧪 TESTE | Teste API |
| `test-api-viewer` | 🧪 TESTE | Viewer HTML |

### 12.6 Componentes Frontend — Órfãos

| Componente | Status | Razão |
|---|---|---|
| `SmartOpsReports.tsx` | 🔌 ÓRFÃO | Existe mas NÃO é importado em `SmartOpsTab.tsx`. Contém dashboard de relatórios de ativos (scan, notebook, cad, etc.) com queries reais ao Supabase. |
| `SmartOpsModelCompare.tsx` | 🔌 ÓRFÃO | Existe mas NÃO é importado em `SmartOpsTab.tsx`. Contém UI para comparação de modelos de impressoras via `ai-model-compare`. |
| `SmartOpsGoals.tsx` | ✅ Verificar | Existe no projeto, verificar se importado |
| `SmartOpsSellerAutomations.tsx` | ✅ Verificar | Existe no projeto, verificar se importado |

**Impacto:** Estes componentes têm código funcional mas não são renderizados. Para ativá-los, basta importar em `SmartOpsTab.tsx` e adicionar `<TabsTrigger>` + `<TabsContent>`.

### 12.7 Componentes Frontend — Funcionais

| Componente | Montado Em | Status |
|---|---|---|
| `SmartOpsBowtie` | SmartOpsTab | ✅ |
| `SmartOpsKanban` | SmartOpsTab | ✅ |
| `SmartOpsLeadsList` | SmartOpsTab | ✅ |
| `SmartOpsTeam` | SmartOpsTab | ✅ |
| `SmartOpsCSRules` | SmartOpsTab | ✅ |
| `SmartOpsLogs` | SmartOpsTab | ✅ |
| `SmartOpsContentProduction` | SmartOpsTab | ✅ |
| `SmartOpsSystemHealth` | SmartOpsTab | ✅ |
| `SmartOpsWhatsAppInbox` | SmartOpsTab | ✅ |
| `SmartOpsFormBuilder` | SmartOpsTab | ✅ |
| `SmartOpsAIUsageDashboard` | SmartOpsTab | ✅ |
| `SmartOpsIntelligenceDashboard` | SmartOpsTab | ✅ |
| `DraLIA` | App.tsx (global) | ✅ |
| `KnowledgeSEOHead` | KnowledgeBase | ✅ |
| `SEOHead` | Index | ✅ |
| `ArticleSummary` | KnowledgeBase | ✅ |
| `AuthorSignature` | KnowledgeBase | ✅ |
| `VideoSchema` | KnowledgeBase | ✅ |
| `GoogleReviewsWidget` | Index/About | ✅ |
| `InlineProductCard` | KB articles (injected) | ✅ |
| `VeredictBox` | KB articles | ✅ |

---

## 13. Bugs Conhecidos & Correções Aplicadas

### Correções v3.0 (2026-03-06)

| # | Fix | Arquivo | Problema | Solução |
|---|---|---|---|---|
| 1 | SERVICE_ROLE_KEY | `dra-lia-whatsapp` | Usava ANON_KEY para chamadas internas, falhava em RLS | Migrado para SERVICE_ROLE_KEY |
| 2 | ORDER BY 3-tier | `batch-cognitive-analysis` | Sem ordenação consistente no processamento batch | `intelligence_score_total DESC → total_messages DESC → updated_at DESC` |
| 3 | Secondary Patterns | `smart-ops-wa-inbox-webhook` | Intents coloquiais BR não reconhecidos | 14 regex patterns adicionados antes do return "indefinido" |

### Pontos de Atenção

1. **Rate limits Lovable AI Gateway** — Funções que processam múltiplos idiomas sequencialmente (ex: `reformat-article-html`) podem sofrer rate limiting (429). Implementado retry com delay.
2. **Tamanho de payloads** — `ai-orchestrate-content` pode receber PDFs grandes. Max tokens configurado em 8000-16000 dependendo da função.
3. **Componentes órfãos** — `SmartOpsReports` e `SmartOpsModelCompare` devem ser montados ou removidos para manter codebase limpo.

---

## 14. Recomendações Futuras

1. **Montar componentes órfãos** — Adicionar `SmartOpsReports` e `SmartOpsModelCompare` ao `SmartOpsTab.tsx`
2. **Centralizar field mappings** — Unificar `piperun-field-map.ts` e `sellflux-field-map.ts` em um schema validation layer
3. **Implementar retry pattern** — Adicionar retry com backoff exponencial em todas as chamadas IA
4. **Dashboard de SEO** — Criar dashboard no admin que mostra quais artigos têm FAQPage/HowTo schema detectados
5. **Monitoramento de tokens IA** — Alertas quando consumo ultrapassar threshold mensal
6. **Cache de SSR** — Implementar cache no `seo-proxy` para reduzir latência de renderização para bots
7. **Testes E2E** — Implementar testes automatizados para fluxos críticos (ingest → assign → cognitive)
8. **Audit log** — Centralizar logs de todas as ações admin em tabela dedicada

---

*Documento gerado em 2026-03-06. Última revisão: v3.0 pós-3 fixes.*
