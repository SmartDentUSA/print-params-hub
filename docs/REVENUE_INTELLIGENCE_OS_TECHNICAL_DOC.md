# Revenue Intelligence OS — Documentação Técnica Completa

> **Versão:** 2.0 | **Última atualização:** 2026-03-05  
> **Classificação:** Confidencial — Engenharia  
> **Projeto Supabase:** `okeogjgqijbfkudfjadz`

---

## Índice

1. [Resumo Executivo](#1-resumo-executivo)
2. [Arquitetura Geral](#2-arquitetura-geral)
3. [Stack Tecnológico](#3-stack-tecnológico)
4. [Tabela Central: lia_attendances (CDP Unificado)](#4-tabela-central-lia_attendances)
5. [Shared Modules (_shared/)](#5-shared-modules)
6. [Edge Functions — Lead Ingestion (5 entry points)](#6-lead-ingestion)
7. [Edge Functions — CRM Sync & Assignment](#7-crm-sync--assignment)
8. [Edge Functions — AI / Cognitive Engine](#8-ai--cognitive-engine)
9. [Edge Functions — Stagnation & CS Automation](#9-stagnation--cs-automation)
10. [Edge Functions — Integrations](#10-integrations)
11. [Edge Functions — Intelligence & Watchdog](#11-intelligence--watchdog)
12. [Edge Functions — Content & Knowledge Base](#12-content--knowledge-base)
13. [Fluxos Completos (End-to-End)](#13-fluxos-completos)
14. [Database: Tabelas, Views, RPCs & Triggers](#14-database)
15. [Frontend: SmartOps Dashboard](#15-frontend)
16. [Tag Taxonomy (Governança de Tags)](#16-tag-taxonomy)
17. [Golden Rule & Data Governance](#17-golden-rule--data-governance)
18. [Secrets & Configuration](#18-secrets--configuration)
19. [Bugs Conhecidos & Correções Aplicadas](#19-bugs-conhecidos)
20. [Recomendações Futuras](#20-recomendações-futuras)

---

## 1. Resumo Executivo

O **Revenue Intelligence OS** é uma plataforma proprietária de **Autonomia de Receita** construída sobre Supabase Edge Functions. Ela orquestra o ciclo de vida completo de um lead — desde a captura até a recompra — integrando 6 sistemas externos em um CDP unificado de ~200 colunas (`lia_attendances`).

### Capacidades Principais

| Capacidade | Descrição |
|---|---|
| **Lead Ingestion** | 5 entry points (formulário, Meta Ads, SellFlux, e-commerce, PipeRun) com Smart Merge |
| **CRM Bidirectional Sync** | PipeRun ↔ lia_attendances com hierarquia Person → Company → Deal |
| **Cognitive AI Engine** | DeepSeek classifica leads em 5 estágios + 10 eixos comportamentais |
| **Stagnation Automation** | Funil Estagnados com 6 etapas + IA para decisão de reativação |
| **E-commerce Integration** | Loja Integrada webhooks → LTV calculation → tags → cross-sell |
| **Academy Integration** | Astron Members postback → cursos/planos → segmentação |
| **WhatsApp Inbox** | Intent classification rule-based → seller alerts em tempo real |
| **Proactive Outreach** | 4 tipos de mensagens proativas com regras de elegibilidade |
| **System Watchdog** | Auto-remediação de leads órfãos + análise DeepSeek de anomalias |
| **Intelligence Score (LIS)** | Score multidimensional (4 eixos, 0-100) calculado via RPC PostgreSQL |

---

## 2. Arquitetura Geral

```
┌──────────────────────────────────────────────────────────────────────┐
│                        ENTRY POINTS                                  │
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
  │               │ │ (DeepSeek)    │ │                │
  │ Person→Deal   │ │ 10 eixos      │ │ Campaign Push  │
  │ Round Robin   │ │ PQL override  │ │ Lead Update    │
  │ WaLeads msg   │ │ Longitudinal  │ │                │
  └───────┬───────┘ └───────┬───────┘ └────────────────┘
          │                 │
          ▼                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                   lia_attendances (~200 colunas)                     │
│                         CDP UNIFICADO                                │
│                                                                      │
│  Core │ PipeRun │ Cognitive │ E-commerce │ Astron │ SellFlux │ Tags  │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
  ┌───────────────┐ ┌───────────────┐ ┌────────────────┐
  │ stagnant-     │ │ proactive-    │ │ system-        │
  │ processor     │ │ outreach      │ │ watchdog       │
  │               │ │               │ │                │
  │ 6 etapas      │ │ 4 tipos msg   │ │ Orphan detect  │
  │ DeepSeek AI   │ │ SellFlux/     │ │ Auto-remediate │
  │ PipeRun sync  │ │ WaLeads       │ │ DeepSeek       │
  └───────────────┘ └───────────────┘ └────────────────┘
```

---

## 3. Stack Tecnológico

| Camada | Tecnologia |
|---|---|
| **Frontend** | React 18 + Vite + TypeScript + Tailwind CSS |
| **UI Components** | shadcn/ui + Radix Primitives |
| **Backend** | Supabase Edge Functions (Deno runtime) |
| **Database** | PostgreSQL 15 (Supabase) |
| **AI Provider** | DeepSeek Chat API (cognitivo, watchdog, stagnation) |
| **AI Provider 2** | Google Gemini 2.5 Flash Lite via Lovable Gateway (greetings, reactivation) |
| **CRM** | PipeRun API v1 (REST) |
| **Marketing Automation** | SellFlux (V1 GET + V2 POST webhooks) |
| **E-commerce** | Loja Integrada API v1 (REST) |
| **Academy/LMS** | Astron Members API v1 (Basic Auth) |
| **WhatsApp** | WaLeads API (via team_members config) |
| **Messaging Fallback** | ManyChat API |
| **Embeddings** | pgvector (1536d) para RAG |
| **Search** | pg_trgm + tsvector (full-text search) |

---

## 4. Tabela Central: lia_attendances (CDP Unificado)

A tabela `lia_attendances` é o **hub central de dados** com ~200 colunas organizadas em domínios lógicos. Cada lead tem **uma única linha** identificada por `email` (UNIQUE constraint).

### 4.1 Domínios de Campos

#### Core & Identificação
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | Identificador único |
| `nome` | TEXT | Nome completo do lead |
| `email` | TEXT UNIQUE | Email normalizado (lowercase) |
| `telefone_raw` | TEXT | Telefone original |
| `telefone_normalized` | TEXT | Formato `+5516999999999` |
| `lead_status` | TEXT | Status atual no funil (ver seção Tags) |
| `source` | TEXT | Origem do primeiro contato |
| `form_name` | TEXT | Nome do formulário de entrada |
| `created_at` | TIMESTAMPTZ | Data de criação |
| `updated_at` | TIMESTAMPTZ | Última atualização |
| `entrada_sistema` | TEXT | Timestamp de entrada |

#### Qualificação & Interesses
| Campo | Tipo | Descrição |
|---|---|---|
| `area_atuacao` | TEXT | Clínica, Laboratório, Professor, Outras |
| `especialidade` | TEXT | Ortodontia, Implantodontia, etc. |
| `como_digitaliza` | TEXT | Método de digitalização atual |
| `tem_impressora` | TEXT | "sim", "não", modelo |
| `impressora_modelo` | TEXT | Modelo específico |
| `tem_scanner` | TEXT | "sim", "não", modelo |
| `software_cad` | TEXT | Ex: exocad, 3Shape |
| `volume_mensal_pecas` | TEXT | Volume de produção |
| `principal_aplicacao` | TEXT | Aplicação principal |
| `resina_interesse` | TEXT | Resina de interesse |
| `produto_interesse` | TEXT | Produto de interesse principal |
| `produto_interesse_auto` | TEXT | Detecção automática de produto |
| `informacao_desejada` | TEXT | O que o lead quer saber |

#### PipeRun CRM
| Campo | Tipo | Descrição |
|---|---|---|
| `piperun_id` | TEXT | Deal ID no PipeRun |
| `piperun_link` | TEXT | URL `https://app.pipe.run/#/deals/{id}` |
| `piperun_pipeline_id` | INT | Pipeline ID numérico |
| `piperun_pipeline_name` | TEXT | Nome do pipeline |
| `piperun_stage_id` | INT | Stage ID numérico |
| `piperun_stage_name` | TEXT | Nome da etapa |
| `piperun_status` | INT | 0=aberta, 1=ganha, 2=perdida |
| `piperun_origin_id` | INT | ID da origem |
| `piperun_origin_name` | TEXT | Nome da origem |
| `piperun_title` | TEXT | Título do deal |
| `piperun_created_at` | TIMESTAMPTZ | Criação do deal |
| `proprietario_lead_crm` | TEXT | Nome do vendedor owner |
| `funil_entrada_crm` | TEXT | Pipeline name legível |
| `ultima_etapa_comercial` | TEXT | Etapa mapeada |
| `status_oportunidade` | TEXT | "aberta", "ganha", "perdida", "perdida_renutrir" |
| `valor_oportunidade` | NUMERIC | Valor do deal |
| `status_atual_lead_crm` | TEXT | Stage name do PipeRun |
| `data_primeiro_contato` | TIMESTAMPTZ | Primeiro contato |
| `data_fechamento_crm` | TIMESTAMPTZ | Fechamento do deal |
| `motivo_perda` | TEXT | Razão de perda |
| `comentario_perda` | TEXT | Comentário de perda |
| `temperatura_lead` | TEXT | quente/morno/frio |
| `lead_timing_dias` | INT | Dias no pipeline |
| `itens_proposta_crm` | TEXT | Itens da proposta raw |
| `itens_proposta_parsed` | JSONB | Itens parseados (ver `parseProposalItems`) |

#### PipeRun Empresa
| Campo | Tipo | Descrição |
|---|---|---|
| `empresa_piperun_id` | INT | ID da empresa no PipeRun |
| `empresa_nome` | TEXT | Nome fantasia |
| `empresa_razao_social` | TEXT | Razão social |
| `empresa_cnpj` | TEXT | CNPJ |
| `empresa_segmento` | TEXT | Segmento |
| `empresa_porte` | TEXT | Porte |
| `empresa_website` | TEXT | Website |
| `empresa_ie` | TEXT | Inscrição estadual |
| `empresa_cnae` | TEXT | CNAE |
| `empresa_situacao` | TEXT | Situação cadastral |
| `empresa_custom_fields` | JSONB | Custom fields da empresa |

#### PipeRun Propostas
| Campo | Tipo | Descrição |
|---|---|---|
| `proposals_data` | JSONB | Array de propostas [{id, value, status, items}] |
| `proposals_total_value` | NUMERIC | Soma dos valores |
| `proposals_last_synced_at` | TIMESTAMPTZ | Último sync |

#### Cognitive / AI
| Campo | Tipo | Descrição |
|---|---|---|
| `cognitive_analysis` | JSONB | Resultado completo da análise (10 eixos) |
| `cognitive_updated_at` | TIMESTAMPTZ | Última análise |
| `cognitive_analyzed_at` | TIMESTAMPTZ | Timestamp da análise |
| `cognitive_model_version` | TEXT | Modelo usado |
| `cognitive_prompt_hash` | TEXT | Hash do prompt (auditoria) |
| `cognitive_context_hash` | TEXT | Hash do contexto |
| `lead_stage_detected` | TEXT | MQL/PQL/SAL/SQL/CLIENTE |
| `interest_timeline` | TEXT | imediato/3_6_meses/6_12_meses/indefinido |
| `urgency_level` | TEXT | alta/media/baixa |
| `psychological_profile` | TEXT | Perfil psicológico (ex: "Analítico cauteloso") |
| `primary_motivation` | TEXT | Motivação principal |
| `objection_risk` | TEXT | Risco de objeção |
| `recommended_approach` | TEXT | Abordagem recomendada |
| `confidence_score_analysis` | NUMERIC | 0-100 confiança |

#### Intelligence Score (LIS)
| Campo | Tipo | Descrição |
|---|---|---|
| `intelligence_score` | JSONB | Score detalhado com 4 eixos |
| `intelligence_score_total` | INT | Score total 0-100 |
| `intelligence_score_updated_at` | TIMESTAMPTZ | Última atualização |

**Estrutura do JSONB `intelligence_score`:**
```json
{
  "version": 1,
  "calculated_at": "2026-03-05T...",
  "axes": {
    "sales_heat": { "value": 85, "weight": 0.35, "confidence": "high" },
    "technical_maturity": { "value": 60, "weight": 0.20, "confidence": "medium" },
    "behavioral_engagement": { "value": 70, "weight": 0.25, "confidence": "high" },
    "purchase_power": { "value": 45, "weight": 0.20, "confidence": "high" }
  },
  "score_total": 68
}
```

#### Astron / Academy
| Campo | Tipo | Descrição |
|---|---|---|
| `astron_user_id` | INT | ID do usuário no Astron |
| `astron_status` | TEXT | active/not_found |
| `astron_nome` | TEXT | Nome no Astron |
| `astron_email` | TEXT | Email no Astron |
| `astron_phone` | TEXT | Telefone no Astron |
| `astron_plans_active` | TEXT[] | Planos ativos |
| `astron_plans_data` | JSONB | Dados completos dos planos |
| `astron_courses_access` | JSONB | Array de cursos com progresso |
| `astron_courses_total` | INT | Total de cursos |
| `astron_courses_completed` | INT | Cursos concluídos |
| `astron_login_url` | TEXT | URL de login auto-gerada |
| `astron_created_at` | TIMESTAMPTZ | Criação no Astron |
| `astron_last_login_at` | TIMESTAMPTZ | Último login |
| `astron_synced_at` | TIMESTAMPTZ | Último sync |

#### Loja Integrada / E-commerce
| Campo | Tipo | Descrição |
|---|---|---|
| `lojaintegrada_cliente_id` | INT | ID do cliente na LI |
| `lojaintegrada_ltv` | NUMERIC | Lifetime Value calculado |
| `lojaintegrada_total_pedidos_pagos` | INT | Total de pedidos pagos |
| `lojaintegrada_historico_pedidos` | JSONB | Últimos 10 pedidos |
| `lojaintegrada_primeira_compra` | TIMESTAMPTZ | Data primeira compra |
| `lojaintegrada_ultimo_pedido_data` | TEXT | Data último pedido |
| `lojaintegrada_ultimo_pedido_valor` | NUMERIC | Valor último pedido |
| `lojaintegrada_ultimo_pedido_status` | TEXT | Status último pedido |
| `lojaintegrada_forma_pagamento` | TEXT | Forma de pagamento |
| `lojaintegrada_forma_envio` | TEXT | Forma de envio |
| `lojaintegrada_updated_at` | TIMESTAMPTZ | Último update |

#### SellFlux
| Campo | Tipo | Descrição |
|---|---|---|
| `sellflux_custom_fields` | JSONB | Campos customizados do SellFlux |
| `sellflux_synced_at` | TIMESTAMPTZ | Último sync |

#### Tags & Governança
| Campo | Tipo | Descrição |
|---|---|---|
| `tags_crm` | TEXT[] | Array de tags padronizadas (ver seção 16) |
| `crm_lock_source` | TEXT | Quem travou o lead |
| `crm_lock_until` | TIMESTAMPTZ | Até quando está travado |
| `automation_cooldown_until` | TIMESTAMPTZ | Cooldown de automação |
| `last_automated_action_at` | TIMESTAMPTZ | Última ação automática |

#### Equipamentos (Pós-Venda)
| Campo | Tipo | Descrição |
|---|---|---|
| `equip_scanner` | TEXT | Scanner adquirido |
| `equip_scanner_serial` | TEXT | Serial do scanner |
| `equip_scanner_ativacao` | TEXT | Data ativação |
| `equip_impressora` | TEXT | Impressora adquirida |
| `equip_impressora_serial` | TEXT | Serial |
| `equip_cad` | TEXT | Software CAD |
| `equip_notebook` | TEXT | Notebook |
| `equip_pos_impressao` | TEXT | Pós-impressão |
| `insumos_adquiridos` | TEXT | Insumos |

#### L.I.A. Sessions
| Campo | Tipo | Descrição |
|---|---|---|
| `total_sessions` | INT | Total de sessões com Dra. L.I.A. |
| `total_messages` | INT | Total de mensagens |
| `ultima_sessao_at` | TIMESTAMPTZ | Última sessão |
| `resumo_historico_ia` | TEXT | Resumo gerado pela IA |
| `historico_resumos` | JSONB | Array de resumos por sessão |
| `rota_inicial_lia` | TEXT | Rota de entrada na L.I.A. |

#### UTM & Rastreamento
| Campo | Tipo | Descrição |
|---|---|---|
| `utm_source` | TEXT | Fonte UTM |
| `utm_medium` | TEXT | Meio UTM |
| `utm_campaign` | TEXT | Campanha UTM |
| `utm_term` | TEXT | Termo UTM |
| `origem_campanha` | TEXT | Campanha de origem |
| `ip_origem` | TEXT | IP de origem |

#### Proactive Outreach
| Campo | Tipo | Descrição |
|---|---|---|
| `proactive_sent_at` | TIMESTAMPTZ | Última mensagem proativa |
| `proactive_count` | INT | Total de proativas (max 3) |

#### Raw Payload
| Campo | Tipo | Descrição |
|---|---|---|
| `raw_payload` | JSONB | Payload original do webhook/formulário com form_submissions[] |

---

## 5. Shared Modules

### 5.1 piperun-field-map.ts (721 linhas)

Centraliza TODA a integração com PipeRun.

#### Constantes Exportadas

| Constante | Descrição |
|---|---|
| `PIPERUN_API_BASE` | `https://api.pipe.run/v1` |
| `PIPELINES` | IDs de 11 pipelines: VENDAS(18784), ATOS(73999), EXPORTACAO(39047), DISTRIBUIDOR_LEADS(70898), ESTAGNADOS(72938), EBOOK(82128), TULIP_TESTE(83813), CS_ONBOARDING(83896), INTERESSE_CURSOS(93303), INSUMOS(100412), ECOMMERCE(102702) |
| `STAGES_VENDAS` | 7 stages: SEM_CONTATO→CONTATO_FEITO→EM_CONTATO→APRESENTACAO→PROPOSTA_ENVIADA→NEGOCIACAO→FECHAMENTO |
| `STAGES_ESTAGNADOS` | 10 stages: ETAPA_00 a ETAPA_04 + APRESENTACAO + PROPOSTA + FECHAMENTO + AUXILIAR + GET_NEW_OWNER |
| `STAGES_CS_ONBOARDING` | 15 stages cobrindo todo o fluxo CS |
| `STAGES_INSUMOS` | 5 stages |
| `STAGES_ECOMMERCE` | 8 stages |
| `STAGE_TO_ETAPA` | Mapeia stage_id → string legível para `lia_attendances.ultima_etapa_comercial` |
| `ETAPA_TO_STAGE` | Reverse: string → { pipeline_id, stage_id } |
| `DEAL_CUSTOM_FIELDS` | 12 custom fields: ESPECIALIDADE, PRODUTO_INTERESSE, WHATSAPP, AREA_ATUACAO, TEM_SCANNER, TEM_IMPRESSORA, etc. |
| `DEAL_CUSTOM_FIELD_HASHES` | Hash keys para PUT operations (PipeRun requirement) |
| `PESSOA_CUSTOM_FIELDS` | 2 campos: AREA_ATUACAO(674001), ESPECIALIDADE(674002) |
| `PIPERUN_USERS` | 12 vendedores com ID, nome, email, role, cellphone |

#### Funções Exportadas

| Função | Input | Output | Descrição |
|---|---|---|---|
| `getCustomFieldValue(cf, fieldId)` | Array + ID | string\|null | Extrai valor de custom field |
| `cleanDealName(title)` | string | string\|null | Remove sufixos de timestamp |
| `cleanPersonName(name)` | string | string\|null | Remove timestamps de nomes |
| `mapDealToAttendance(deal)` | PipeRunDealData | Record | Mapeia deal → campos lia_attendances |
| `parseProposalItems(raw)` | string | {parsed, equipments} | Classifica itens em 6 categorias |
| `mapAttendanceToDealCustomFields(att)` | Record | [{id, value}] | Reverso: lia → PipeRun custom fields |
| `customFieldsToHashMap(fields)` | [{id, value}] | Record | Converte para formato PUT |
| `piperunGet(token, path, params)` | — | {success, data, status} | GET genérico |
| `piperunPost(token, path, body)` | — | {success, data, status} | POST genérico |
| `piperunPut(token, path, body)` | — | {success, data, status} | PUT genérico |
| `addDealNote(token, dealId, text)` | — | {success, data} | Adiciona nota ao deal |
| `fetchDealNotes(token, dealId, limit)` | — | [{text, created_at}] | Busca notas do deal |
| `moveDealToStage(token, dealId, stageId)` | — | {success, data} | Move deal de stage |

#### PUT vs POST: Regra Crítica

```
POST /deals → custom_fields: [{ custom_field_id: 549059, value: "Ortodontia" }]
PUT  /deals → { "ebe365a77c419c61857ceabb23d0bb54": "Ortodontia" }  ← usa HASH
```

Se usar array no PUT, PipeRun retorna **422 Unprocessable Entity**.

### 5.2 sellflux-field-map.ts (514 linhas)

Centraliza tags, SellFlux sync e utilitários de mensageria.

#### Tag Constants

| Prefixo | Domínio | Exemplos |
|---|---|---|
| `J0x_` | Journey (6 tags) | J01_CONSCIENCIA → J06_APOIO |
| `EC_` | E-commerce (14 tags) | EC_PAGAMENTO_APROVADO, EC_PROD_RESINA |
| `Q_` | Qualification | Q_TEM_SCANNER |
| `C_` | Commercial | C_PRIMEIRO_CONTATO, C_PROPOSTA_ENVIADA |
| `CS_` | Customer Success | CS_ONBOARDING_INICIO, CS_TREINAMENTO_OK |
| `LIA_` | L.I.A. Agent | LIA_LEAD_NOVO, LIA_ATENDEU |
| `A_` | Alert/Stagnation | A_ESTAGNADO_3D, A_SEM_RESPOSTA, A_RISCO_CHURN |

#### Legacy Tag Migration

O sistema inclui 23 mapeamentos diretos + 13 padrões regex para migrar tags orgânicas do SellFlux para o novo padrão:
- `"compra-realizada"` → `["EC_PAGAMENTO_APROVADO", "J04_COMPRA"]`
- `"sem-imp"` → `{ tem_impressora: "não" }` (field extraction)
- `/^estagnados?-/i` → `["A_ESTAGNADO_7D"]`

#### Funções Exportadas

| Função | Descrição |
|---|---|
| `mergeTagsCrm(current, add, remove)` | Merge imutável de tags com sort |
| `computeTagsFromStage(status, current)` | Computa tags de jornada por etapa |
| `computeStagnationTag(stage)` | Retorna tag de estagnação |
| `migrateLegacyTags(tags)` | Migra tags legadas → padronizadas + extrai campos |
| `replaceVariables(text, lead)` | Substitui `{{campo}}` em templates |
| `formatPhoneForWaLeads(raw)` | Formata telefone (digits only, +55) |
| `buildSellFluxLeadParams(lead)` | Params para GET V1 webhook |
| `buildSellFluxCampaignPayload(lead)` | Payload para POST V2 webhook |
| `sendLeadToSellFlux(url, lead)` | Envia via GET (V1) |
| `sendCampaignViaSellFlux(url, lead, template)` | Envia via POST (V2) |
| `fetchLeadFromSellFlux(email)` | Busca lead no SellFlux (GET) |
| `detectProductTags(productName)` | Detecta tags de produto por nome |

### 5.3 Outros Shared Modules

| Módulo | Descrição |
|---|---|
| `log-ai-usage.ts` | Registra uso de tokens AI na tabela `ai_token_usage` |
| `system-prompt.ts` | Prompt base da Dra. L.I.A. |
| `testimonial-prompt.ts` | Prompt para geração de depoimentos |
| `document-prompts.ts` | Prompts para enriquecimento de documentos |
| `extraction-rules.ts` | Regras de extração de PDFs |
| `og-visual-dictionary.ts` | Dicionário visual para OG images |

---

## 6. Lead Ingestion

### 6.1 smart-ops-ingest-lead (Gateway Unificado)

**Arquivo:** `supabase/functions/smart-ops-ingest-lead/index.ts` (327 linhas)  
**JWT:** `verify_jwt = false`  
**Endpoint:** `POST /functions/v1/smart-ops-ingest-lead`

#### Fluxo

1. **Extract fields** com `extractField()` (busca flexível por chave parcial)
2. **Filter test emails** (`@test.com`, `@example.com`, `/^teste[\-_@]/`)
3. **Normalize phone** (`+55DDDNUMERO`, 12-13 dígitos)
4. **Detect product** from form name (Vitality, EdgeMini, IoConnect, Ebook/Placa)
5. **Check existing lead** by email
6. **PQL detection**: Se `status_oportunidade === "ganha"` e source ≠ `vendedor_direto`
7. **Smart Merge** (existing) ou **INSERT** (new)
8. **Fire-and-forget**: `lia-assign` + `cognitive-lead-analysis` + SellFlux sync

#### Smart Merge Rules

```typescript
protectedFields = [
  "nome", "email", "telefone_normalized", "piperun_id",
  "proprietario_lead_crm", "status_oportunidade", "lead_stage_detected",
  "entrada_sistema"
];
```

- **Protected fields**: NUNCA sobrescreve se já tem valor
- **Non-protected**: Só preenche se atualmente null/vazio
- **UTMs**: SEMPRE atualiza (última campanha ganha)

#### Form Submission History

Cada novo contato é armazenado em `raw_payload.form_submissions[]`:
```json
{
  "form_name": "Meta Lead Form 12345",
  "source": "meta_lead_ads",
  "submitted_at": "2026-03-05T...",
  "fields_updated": ["area_atuacao", "produto_interesse"]
}
```

### 6.2 smart-ops-meta-lead-webhook

**Arquivo:** `supabase/functions/smart-ops-meta-lead-webhook/index.ts` (167 linhas)

#### Fluxo

1. **GET** → Meta webhook verification (`hub.mode=subscribe`)
2. **POST** → Processa `entry[].changes[].value.leadgen_id`
3. Busca lead data via Graph API v21.0 (`https://graph.facebook.com/v21.0/{leadgen_id}`)
4. Parseia `field_data[]` para campos normalizados
5. Detecta plataforma (facebook/instagram)
6. Encaminha para `ingest-lead` com `source: "meta_lead_ads"`

**Secrets necessários:** `META_WEBHOOK_VERIFY_TOKEN`, `META_LEAD_ADS_TOKEN`

### 6.3 smart-ops-sellflux-webhook

**Arquivo:** `supabase/functions/smart-ops-sellflux-webhook/index.ts` (224 linhas)

#### Detecção Dinâmica de Origem

```typescript
function detectRealSource(payload, tags):
  - Se tem tracking/transaction OU tags de e-commerce → "loja_integrada"
  - Se tem automation_name/form_name → usa o nome
  - Default → "sellflux_webhook"
```

#### Processamento

1. Extrai campos padrão (email, nome, phone, cidade, uf)
2. Extrai custom fields SellFlux (`atual-id-pipe` → `piperun_id`, `platform_mail` → `astron_email`)
3. Extrai tracking/transaction objects (Loja Integrada via SellFlux)
4. Extrai payment codes (PIX, boleto)
5. Processa tags com `migrateLegacyTags()` → tags padronizadas + campos extraídos
6. Monta `sellflux_custom_fields` JSONB
7. Encaminha para `ingest-lead`

### 6.4 smart-ops-ecommerce-webhook

**Arquivo:** `supabase/functions/smart-ops-ecommerce-webhook/index.ts` (720 linhas)

#### Eventos Suportados

| Evento | Tags Aplicadas |
|---|---|
| `order_created` | EC_INICIOU_CHECKOUT |
| `order_paid` | EC_PAGAMENTO_APROVADO, J04_COMPRA |
| `order_cancelled` | EC_PEDIDO_CANCELADO |
| `order_invoiced` | EC_PEDIDO_ENVIADO |
| `order_delivered` | EC_PEDIDO_ENTREGUE |
| `boleto_generated` | EC_GEROU_BOLETO |
| `boleto_expired` | EC_BOLETO_VENCIDO |

#### Resolução de Situação

A Loja Integrada envia situação em 3 formatos:
1. **Código string**: `"pago"`, `"enviado"` → mapeado por `SITUACAO_CODIGO_MAP`
2. **Código com prefixo**: `"pedido_pago"`, `"pedido_enviado"` → normalizado removendo prefixo
3. **ID numérico**: `5` → mapeado por `SITUACAO_ID_MAP`
4. **URI string**: `"/api/v1/situacao/5/"` → extraído via regex

#### LTV Calculation

```typescript
PAID_SITUACAO_CODIGOS = Set([
  "pago", "pagamento_confirmado", "pagamento_aprovado",
  "em_producao", "pronto_envio", "enviado", "entregue",
  "pedido_pago", "pedido_enviado", "pedido_entregue",
  "pedido_em_producao", "pedido_em_separacao", "pronto_para_envio"
]);

LTV = SUM(valor_total) WHERE situacao IN PAID_SITUACAO_CODIGOS
```

#### Client Resolution

Se `cliente` é uma URI string (`/api/v1/cliente/12345/`), busca dados completos via API.

### 6.5 smart-ops-piperun-webhook

**Arquivo:** `supabase/functions/smart-ops-piperun-webhook/index.ts` (486 linhas)

#### Processamento

1. Extrai IDs do deal (stage, pipeline, owner) — suporta objetos nested
2. Extrai custom fields (ID-based + name-based fallback)
3. Se lead não existe → auto-cria via upsert (`onConflict: "email"`)
4. Mapeia stage → lead_status via `STAGE_TO_ETAPA`
5. Computa tags de jornada via `computeTagsFromStage()`

#### Lógica de Estagnação/Recuperação

- **Entrando em Estagnados**: Preserva `ultima_etapa_comercial` (etapa anterior)
- **Saindo de Estagnados**: Aplica tag `C_RECUPERADO`, remove tags `A_ESTAGNADO_*`

#### Oportunidade Encerrada (Won/Lost)

Ambos os casos disparam **reentrada em nutrição cross-sell**:
- **Won**: Tags `C_OPP_ENCERRADA_COMPRA`, `C_PQL_RECOMPRA`, `COMPROU_{PRODUTO}`
- **Lost**: Tags `C_OPP_ENCERRADA_NAO_COMPROU`, `NAO_COMPROU_{PRODUTO}`
- `status_oportunidade` = "ganha" ou "perdida_renutrir" (NÃO "perdida")
- Parseia `itens_proposta_crm` e auto-popula campos de equipamento

#### Prediction Accuracy Feedback Loop

Quando deal é ganho:
```typescript
accuracy = predicted === "SQL_decisor" ? 1.0
         : predicted === "SAL_comparador" ? 0.6
         : predicted === "PQL_recompra" ? 0.8
         : predicted === "MQL_pesquisador" ? 0.3
         : 0.5;
```

---

## 7. CRM Sync & Assignment

### 7.1 smart-ops-lia-assign (1196 linhas)

**O módulo mais complexo do sistema.** Responsável pela hierarquia PipeRun completa e notificação de vendedores.

#### Fluxo Principal

```
1. Fetch lead from lia_attendances
2. Idempotency check (skip if assigned <5min ago)
3. Select owner (Round Robin, prioritize WaLeads-enabled)
4. PipeRun Hierarchy:
   a. findPersonByEmail() → pessoa existente?
   b. createPerson() OU updatePersonFields()
   c. findOrCreateCompany() + fetchCompanyData()
   d. findPersonDeals() → scan all non-deleted deals
5. Deal Routing:
   - vendaDeal (open in Vendas) → UPDATE (preserve owner!)
   - estDeal (open in Estagnados) → MOVE to Vendas
   - No deal → CREATE new in Vendas
6. Update lia_attendances with all CRM data
7. Trigger outbound messages
8. Sync to SellFlux (V1+V2)
9. Trigger Astron lookup
```

#### Golden Rule: Preserve Vendas

```
Se lead tem deal ABERTO no Funil de Vendas:
  → NÃO muda owner
  → NÃO muda pipeline
  → APENAS enriches custom fields + adds note
```

#### Outbound Message Bifurcation

| Source | Lead Message | Seller Message |
|---|---|---|
| `dra-lia`, `whatsapp_lia`, `handoff_lia` | AI Greeting (Gemini Flash) | Structured Briefing (DeepSeek) |
| Formulário, Meta, SellFlux | Template message (cs_automation_rules) | Structured Briefing (DeepSeek) |

#### Seller Notification Template

```
🤖 *Novo Lead atribuído - Dra. L.I.A.*

👤 Lead: {nome}
📧 Email: {email}
📱 Tel: {telefone}
🦷 Área de atuação: {area_atuacao}
🎯 Interesse: {produto_interesse}
🔗 PipeRun: {link}

*HISTÓRICO:* {AI-generated}
*OPORTUNIDADE:* {AI-generated tactical briefing}

🧠 *Análise Cognitiva:*
Estágio: {SQL_decisor}
Urgência: 🔴 {alta}
Perfil: {Analítico cauteloso}
Abordagem: {Use tom educativo, mostre ROI}
```

### 7.2 smart-ops-kanban-move (68 linhas)

Sincroniza mudanças de Kanban do frontend → PipeRun.

**Input:** `{ piperun_id, new_status }`  
**Action:** `ETAPA_TO_STAGE[new_status]` → `PUT /deals/{id}` com `stage_id` + `pipeline_id`

### 7.3 smart-ops-sync-piperun

Full sync bidirecional PipeRun → lia_attendances. Busca deals com `with[]=person&with[]=origin` e aplica `mapDealToAttendance()`.

### 7.4 piperun-full-sync

Sync completo de todos os deals de um pipeline específico. Usa paginação (`show=50`) e processa batch.

---

## 8. AI / Cognitive Engine

### 8.1 cognitive-lead-analysis (481 linhas)

**Modelo:** DeepSeek Chat (`deepseek-chat`)  
**Timeout:** 20s  
**Guards:** Min 5 mensagens, não recalcula se já está atualizado

#### 10 Eixos de Classificação

| # | Eixo | Valores | Descrição |
|---|---|---|---|
| 1 | `lead_stage_detected` | MQL/PQL/SAL/SQL/CLIENTE | Estágio do funil cognitivo |
| 2 | `interest_timeline` | imediato/3_6_meses/6_12_meses/indefinido | Timeline de compra |
| 3 | `urgency_level` | alta/media/baixa | Nível de urgência |
| 4 | `psychological_profile` | Texto livre | Ex: "Analítico cauteloso" |
| 5 | `primary_motivation` | Texto livre | Ex: "Autonomia clínica" |
| 6 | `objection_risk` | Texto livre | Ex: "Preço alto" |
| 7 | `recommended_approach` | Texto livre | Instrução para vendedor |
| 8 | `confidence_score_analysis` | 0-100 | Confiança na classificação |
| 9 | `stage_trajectory` | Texto livre | Ex: "MQL→SAL→abandono→MQL" |
| 10 | `seasonal_pattern` | Texto livre | Ex: "Ciclo trimestral" |

#### PQL Override Determinístico

```typescript
if (status_oportunidade === "ganha" && source !== "vendedor_direto") {
  lead_stage_detected = "PQL_recompra";  // FORCE
}
```

#### Memória Longitudinal

O prompt inclui:
1. Últimas 10 sessões com L.I.A. (data, msgs, resumo)
2. Stage trajectory anterior
3. Dados PipeRun (pipeline, value, proposals)
4. Notas do vendedor (últimas 5 via `fetchDealNotes`)
5. Dados Astron (cursos, planos)
6. Dados E-commerce (LTV, último pedido)

#### Auditoria

Cada análise gera hashes para rastreabilidade:
```json
{
  "_audit": {
    "prompt_v": 2,
    "model": "deepseek-chat",
    "prompt_hash": "abc123...",
    "context_hash": "def456...",
    "calculated_at": "2026-03-05T..."
  }
}
```

#### State Events

Quando o stage muda, registra em `lead_state_events`:
```sql
INSERT INTO lead_state_events (
  lead_id, old_stage, new_stage, source, is_regression,
  regression_gap_days, intelligence_score, cognitive_stage
)
```

### 8.2 Dra. L.I.A. (dra-lia/index.ts, ~5000 linhas)

Assistente virtual RAG-powered para odontologia digital. Usa embeddings pgvector para busca semântica e system-prompt especializado.

### 8.3 dra-lia-whatsapp

Versão WhatsApp da Dra. L.I.A. para integração com SellFlux/WaLeads.

---

## 9. Stagnation & CS Automation

### 9.1 smart-ops-stagnant-processor (345 linhas)

**Scheduler:** Executado periodicamente (cron)  
**Lógica:** Avança leads estagnados a cada 5 dias

#### Progressão de Etapas

```
est_etapa1 → est_etapa2 → est_etapa3 → est_etapa4 → est_apresentacao → est_proposta → estagnado_final
```

#### AI Strategic Decision (DeepSeek)

Para cada lead (max 20/run), DeepSeek decide:
```json
{
  "motivo_provavel": "...",
  "angulo": "argumento principal",
  "tom": "urgente|empatico|informativo|desafiador",
  "cta": "ação específica",
  "vale_reativar": true|false
}
```

Se `vale_reativar === false`, pula o lead.

#### AI Reactivation Message (Gemini Flash)

Se DeepSeek aprova, Gemini gera mensagem personalizada de WhatsApp (máx 3 linhas).

#### Auto-Discard

Leads com `sem_interesse` no `whatsapp_inbox` (últimos 7 dias) e sem interações positivas → `lead_status = "descartado"` + tag `A_SEM_RESPOSTA`.

### 9.2 smart-ops-cs-processor (226 linhas)

Processa regras de automação CS (`cs_automation_rules`):
1. Busca regras ativas
2. Filtra leads por `trigger_event` + `delay_days` desde `data_contrato`
3. Verifica `message_logs` para deduplicação
4. Envia via: SellFlux (preferido) → ManyChat → WaLeads (fallback)
5. Aplica tag CS correspondente

### 9.3 smart-ops-proactive-outreach (280 linhas)

4 tipos de outreach proativo:

| Tipo | Filtro | Trigger |
|---|---|---|
| `acompanhamento` | Proposta enviada + >7 dias | Seguimento pós-proposta |
| `reengajamento` | Lead quente (score≥60) + 3-15 dias sem update | Reativar interesse |
| `primeira_duvida` | Lead novo/qualificado + 2-10 dias + 0 proativas | Primeira interação |
| `recuperacao` | Lead perdido + ≤30 dias + 0 proativas | Recuperação pós-perda |

**Limites:** max 3 proativas por lead, cooldown 5 dias entre envios, max 20 por run.

### 9.4 smart-ops-send-waleads

Wrapper para envio de mensagens via WaLeads API. Busca `waleads_api_key` do `team_members` e envia texto/media/image/document.

---

## 10. Integrations

### 10.1 Astron Members

#### astron-member-lookup (208 linhas)

1. Verifica cache em `lia_attendances` (TTL: 24h)
2. Se stale ou force_refresh: consulta Astron API (`listClubUsers`, `listClubUserPlans`, `generateClubUserLoginUrl`)
3. Atualiza campos `astron_*` em lia_attendances

**Auth:** Basic Auth (`ASTRON_AM_KEY:ASTRON_AM_SECRET`)

#### astron-postback (259 linhas)

Receiver para webhooks do Astron. Suporta:

| Evento | Ação |
|---|---|
| `useradd` | Cria/atualiza lead com dados Astron + UTMs |
| `usercourseprogresschange` | Merge incremental em `astron_courses_access[]` |
| `newcomment` | Registra última interação |
| `newsupportticket` | Registra ticket de suporte |

**Segurança:** Valida `ASTRON_POSTBACK_TOKEN`

#### sync-astron-members

Sync em batch de todos os membros do Astron.

### 10.2 Loja Integrada

#### poll-loja-integrada-orders (170 linhas)

Poller para buscar pedidos novos da API da Loja Integrada.

**Características:**
- Circuit breaker: abre após >50% falhas nas últimas 10 requisições
- Rate limiting: 800ms entre requests + exponential backoff (429)
- Max retries: 3
- Paginação: `batch_size=50` (1 página por execução)
- Incremento: Usa `since_atualizado` do último pedido processado

#### smart-ops-ecommerce-webhook

(Documentado na seção 6.4)

### 10.3 SellFlux

#### smart-ops-sellflux-webhook

(Documentado na seção 6.3)

#### smart-ops-sellflux-sync

Sync bidirecional com SellFlux. Puxa dados via `fetchLeadFromSellFlux()` e atualiza lia_attendances.

### 10.4 WhatsApp

#### smart-ops-wa-inbox-webhook (266 linhas)

Receiver para mensagens inbound de WhatsApp.

**Intent Classification (Rule-based v1):**

| Intent | Confiança | Padrões |
|---|---|---|
| `interesse_imediato` | 90% | "quero", "fechar", "proposta", "comprar" |
| `interesse_futuro` | 75% | "planejando", "ano que vem", "avaliando" |
| `pedido_info` | 80% | "catálogo", "preço", "como funciona" |
| `objecao` | 70% | "caro", "pensar", "sócio" |
| `sem_interesse` | 95% | "pare", "remover", "não quero" |
| `suporte` | 85% | "problema", "defeito", "garantia" |

**Post-processing:**
- `interesse_imediato/futuro` → Notifica seller via WaLeads (🚨 OPORTUNIDADE QUENTE)
- `sem_interesse` → Tag `A_SEM_RESPOSTA`
- Se ≥5 messages → Dispara `cognitive-lead-analysis`

---

## 11. Intelligence & Watchdog

### 11.1 calculate_lead_intelligence_score (RPC PostgreSQL)

**Função:** `public.calculate_lead_intelligence_score(p_lead_id UUID)`  
**Guard:** Não recalcula dentro de 60 segundos

#### 4 Eixos

| Eixo | Peso | Composição |
|---|---|---|
| **sales_heat** | 0.35 | urgency(45%) + timeline(40%) + recency_bonus(15 max) |
| **technical_maturity** | 0.20 | tem_impressora + tem_scanner + software_cad + volume_pecas (25% cada) |
| **behavioral_engagement** | 0.25 | messages(35%) + sessions(35%) + confidence(30%) |
| **purchase_power** | 0.20 | proposals(50%) + ecommerce(30%) + academy(20%) |

**Fórmulas:**
- `urgency_score`: alta=90, media=50, baixa=20, default=30
- `timeline_score`: imediato=100, 3_6_meses=60, 6_12_meses=30, indefinido=10
- `recency_bonus`: <3d=15, <7d=8, <15d=3, else=0
- `messages_score`: `LN(msgs) / LN(100) * 100` (logarithmic)
- `proposals_score`: `LN(value) / LN(100000) * 100`

### 11.2 system-watchdog-deepseek (263 linhas)

**Scheduler:** Periódico (cron)

#### Anomalias Detectadas

1. **Leads órfãos**: Na tabela `leads` mas não em `lia_attendances`
2. **Missing PipeRun**: Status avançado sem `piperun_id`
3. **Missing cognitive**: ≥5 mensagens sem `cognitive_analysis`
4. **Recent errors**: `system_health_logs` das últimas 24h

#### Auto-Remediação

- Re-ingere até 3 leads órfãos via `ingest-lead`
- Dispara `cognitive-lead-analysis` para até 5 leads sem análise
- Loga tudo em `system_health_logs`

#### DeepSeek Analysis

Gera análise de severidade (critical/warning/info) e ações sugeridas.

### 11.3 backfill-intelligence-score

Recalcula LIS para todos os leads em batch.

---

## 12. Content & Knowledge Base

### 12.1 Módulos de Conteúdo

| Função | Descrição |
|---|---|
| `ai-orchestrate-content` | Orquestrador de geração de conteúdo AI |
| `ai-metadata-generator` | Gera meta descriptions, keywords, OG |
| `ai-content-formatter` | Formata HTML de artigos |
| `ai-generate-og-image` | Gera OG images via AI |
| `ai-enrich-pdf-content` | Enriquece conteúdo de PDFs com AI |
| `ai-model-compare` | Compara modelos de impressoras |
| `reformat-article-html` | Reformata HTML de artigos |
| `auto-inject-product-cards` | Injeta cards de produtos em artigos |
| `enrich-article-seo` | Enriquece SEO de artigos |
| `translate-content` | Traduz conteúdo (PT→EN/ES) |
| `backfill-keywords` | Backfill de keywords em artigos |

### 12.2 Módulos de Extração

| Função | Descrição |
|---|---|
| `extract-pdf-text` | Extrai texto de PDFs |
| `extract-pdf-raw` | Extração raw de PDFs |
| `extract-pdf-specialized` | Extração especializada (apostilas) |
| `extract-and-cache-pdf` | Extração com cache |
| `extract-video-content` | Extrai conteúdo de vídeos |
| `extract-commercial-expertise` | Extrai expertise comercial |

### 12.3 Módulos de Sync

| Função | Descrição |
|---|---|
| `sync-pandavideo` | Sincroniza vídeos PandaVideo |
| `sync-video-analytics` | Sincroniza métricas de vídeo |
| `link-videos-to-articles` | Linka vídeos a artigos |
| `sync-knowledge-base` | Sincroniza knowledge base |
| `sync-google-drive-kb` | Sincroniza KB do Google Drive |
| `sync-google-reviews` | Sincroniza reviews do Google |

### 12.4 Módulos de Geração

| Função | Descrição |
|---|---|
| `generate-sitemap` | Gera sitemap principal |
| `generate-knowledge-sitemap` | Sitemap da KB (PT) |
| `generate-knowledge-sitemap-en` | Sitemap da KB (EN) |
| `generate-knowledge-sitemap-es` | Sitemap da KB (ES) |
| `generate-documents-sitemap` | Sitemap de documentos |
| `generate-parameter-pages` | Gera páginas de parâmetros |
| `generate-veredict-data` | Gera dados de vereditos |

### 12.5 Embeddings & RAG

| Função | Descrição |
|---|---|
| `index-embeddings` | Indexa embeddings no pgvector |
| `index-spin-entries` | Indexa entradas SPIN |
| `ingest-knowledge-text` | Ingere texto na KB |
| `heal-knowledge-gaps` | Cura gaps no conhecimento |
| `knowledge-feed` | Feed da KB |

---

## 13. Fluxos Completos (End-to-End)

### Fluxo 1: Lead via Formulário Web

```
1. Formulário React → POST /smart-ops-ingest-lead
2. ingest-lead: normaliza, smart merge, detecta PQL
3. Fire-and-forget:
   a. lia-assign: Person→Company→Deal no PipeRun + seleciona vendedor
   b. cognitive-lead-analysis: 10 eixos via DeepSeek
   c. SellFlux V2: cria/atualiza contato + dispara automação
4. lia-assign: WaLeads msg para lead + briefing para vendedor
5. calculate_lead_intelligence_score: LIS recalculado
```

### Fluxo 2: Lead via Meta Ads

```
1. Meta Lead Ads → POST /smart-ops-meta-lead-webhook (hub.mode=subscribe para verificação)
2. meta-webhook: Graph API v21.0 → busca field_data
3. Normaliza payload → encaminha para ingest-lead
4. (mesmo fluxo do Formulário a partir daí)
```

### Fluxo 3: Pedido na Loja Integrada

```
1. Loja Integrada webhook → POST /smart-ops-ecommerce-webhook
2. ecommerce-webhook: unwrap payload, resolve situação
3. Se URI-only: fetch full order via LI API
4. Se cliente é URI: resolve via API
5. Extrai customer data, normaliza phone
6. Calcula LTV via order history
7. Aplica tags EC_* + detecta produtos
8. Upsert em lia_attendances com dados enriquecidos
9. Fire: lia-assign + cognitive-analysis
```

### Fluxo 4: Deal Atualizado no PipeRun

```
1. PipeRun webhook → POST /smart-ops-piperun-webhook
2. Extrai stage/pipeline/owner/custom_fields
3. Se lead não existe: auto-cria via upsert
4. Mapeia stage → lead_status
5. Lógica de estagnação/recuperação:
   - Entrando em Estagnados: preserva etapa anterior
   - Saindo: +C_RECUPERADO, -A_ESTAGNADO_*
6. Se deal encerrado (won/lost):
   - Won: +C_CONTRATO_FECHADO, +COMPROU_{PRODUTO}, parse proposta
   - Lost: +NAO_COMPROU_{PRODUTO}, status="perdida_renutrir"
   - Ambos: reentrada em nutrição cross-sell
   - Won: prediction accuracy feedback loop
7. SellFlux sync
```

### Fluxo 5: Lead Estagnado (Automação)

```
1. CRON → POST /smart-ops-stagnant-processor
2. Busca leads com lead_status LIKE "est%" e updated_at > 5 dias
3. Para cada lead:
   a. DeepSeek: vale reativar? Qual estratégia?
   b. Se não → skip
   c. Avança para próxima etapa
   d. PipeRun: move deal para stage correspondente
   e. Gemini: gera mensagem personalizada
   f. SellFlux/WaLeads: envia mensagem
4. Auto-discard: leads com sem_interesse
```

### Fluxo 6: Resposta no WhatsApp

```
1. WaLeads webhook → POST /smart-ops-wa-inbox-webhook
2. Normaliza phone, match lead por últimos 9 dígitos
3. Classifica intent (rule-based)
4. Insere em whatsapp_inbox
5. Se interesse_imediato/futuro:
   - Busca team_member do proprietário
   - Envia alerta 🚨 via WaLeads
6. Se sem_interesse: tag A_SEM_RESPOSTA
7. Se ≥5 msgs: dispara cognitive-lead-analysis
```

### Fluxo 7: Postback Astron (Academy)

```
1. Astron webhook → POST /astron-postback
2. Valida token
3. Extrai evento (useradd, usercourseprogresschange, etc.)
4. Build campos astron_*
5. Se usercourseprogresschange: merge incremental em courses_access[]
6. Upsert em lia_attendances
```

### Fluxo 8: System Watchdog

```
1. CRON → POST /system-watchdog-deepseek
2. Detecta anomalias:
   - Leads órfãos (leads sem lia_attendances)
   - Missing PipeRun IDs
   - Missing cognitive analysis
   - Erros recentes
3. DeepSeek: analisa severidade + sugere ações
4. Auto-remediação:
   - Re-ingere órfãos (max 3)
   - Dispara cognitive para leads faltantes (max 5)
5. Loga tudo em system_health_logs
```

---

## 14. Database

### 14.1 Tabelas Principais

| Tabela | Descrição | Linhas Estimadas |
|---|---|---|
| `lia_attendances` | CDP unificado (~200 cols) | ~10K+ |
| `leads` | Tabela legada de leads (bridge para agent_interactions) | ~5K |
| `agent_interactions` | Mensagens da Dra. L.I.A. | ~50K+ |
| `agent_sessions` | Sessões de chat | ~5K |
| `agent_embeddings` | Embeddings pgvector 1536d | ~20K+ |
| `agent_knowledge_gaps` | Gaps de conhecimento detectados | ~500 |
| `team_members` | Vendedores com config WaLeads | ~12 |
| `cs_automation_rules` | Regras de automação CS | ~20 |
| `message_logs` | Log de mensagens enviadas | ~10K+ |
| `whatsapp_inbox` | Mensagens WhatsApp inbound | ~5K+ |
| `system_health_logs` | Logs de saúde do sistema | ~5K+ |
| `ai_token_usage` | Uso de tokens AI | ~10K+ |
| `lead_state_events` | Eventos de mudança de stage | ~5K+ |
| `intelligence_score_config` | Configuração de pesos do LIS | ~1 |
| `knowledge_contents` | Artigos da KB | ~200 |
| `knowledge_categories` | Categorias da KB | ~10 |
| `knowledge_videos` | Vídeos com métricas PandaVideo | ~500 |
| `system_a_catalog` | Catálogo de produtos | ~100 |
| `catalog_documents` | Documentos de produtos (PDFs) | ~200 |
| `resins` | Catálogo de resinas | ~50 |
| `authors` | Autores de conteúdo | ~5 |
| `brands` | Marcas de impressoras | ~20 |
| `models` | Modelos de impressoras | ~50 |
| `parameter_sets` | Conjuntos de parâmetros | ~200 |
| `external_links` | Links externos com métricas SEO | ~200 |
| `content_requests` | Solicitações de conteúdo | ~100 |

### 14.2 Views de Domínio

| View | Descrição |
|---|---|
| `v_lead_commercial` | Campos comerciais do lead |
| `v_lead_cognitive` | Campos cognitivos/AI |
| `v_lead_academy` | Campos Astron/Academy |
| `v_lead_ecommerce` | Campos Loja Integrada |
| `lead_model_routing` | Roteamento por modelo de negócio |

### 14.3 RPCs (Database Functions)

| Função | Descrição |
|---|---|
| `calculate_lead_intelligence_score(uuid)` | Calcula LIS (4 eixos) |
| `match_agent_embeddings(vector, threshold, count)` | Busca semântica por similaridade |
| `search_knowledge_base(query, lang)` | Busca fulltext na KB |
| `get_rag_stats()` | Estatísticas do RAG |
| `is_admin(uuid)` | Verifica role admin |
| `is_author(uuid)` | Verifica role author |
| `has_panel_access(uuid)` | Verifica acesso ao painel |
| `get_user_role(uuid)` | Retorna role do usuário |
| `get_brand_distribution()` | Distribuição de marcas |

### 14.4 Triggers

| Trigger | Tabela | Descrição |
|---|---|---|
| `update_knowledge_videos_search_vector` | knowledge_videos | Atualiza tsvector para busca fulltext |
| `trigger_evaluate_interaction` | agent_interactions | Dispara avaliação de interação quando resposta é adicionada |

---

## 15. Frontend: SmartOps Dashboard

### 15.1 Kanban Board

O Kanban suporta **11 pipelines** mapeados diretamente de `PIPELINES`:

| Pipeline | Etapas |
|---|---|
| Funil de Vendas | 7 etapas |
| Funil Estagnados | 10 etapas |
| CS Onboarding | 15 etapas |
| Funil Insumos | 5 etapas |
| E-commerce | 8 etapas |
| + 6 outros | Variável |

**Componentes:**
- `SmartOpsKanban.tsx` → Board principal
- `KanbanColumn.tsx` → Coluna de etapa
- `KanbanLeadCard.tsx` → Card do lead com score, tags, owner
- `KanbanLeadDetail.tsx` → Detalhe expandido do lead

**Drag & Drop:** Move lead → `POST /smart-ops-kanban-move` → PipeRun stage change + `lia_attendances.lead_status` update

### 15.2 Dashboards

| Componente | Descrição |
|---|---|
| `SmartOpsIntelligenceDashboard.tsx` | Dashboard de inteligência com score distribution |
| `SmartOpsBowtie.tsx` | Funil bowtie (aquisição + retenção) |
| `AdminDraLIAStats.tsx` | Métricas da Dra. L.I.A. |
| `SmartOpsGoals.tsx` | Metas comerciais |
| `SmartOpsReports.tsx` | Relatórios |
| `SmartOpsSystemHealth.tsx` | Saúde do sistema (anomalias, erros) |
| `SmartOpsContentProduction.tsx` | Produção de conteúdo |
| `SmartOpsTeam.tsx` | Gestão de equipe |
| `SmartOpsLeadsList.tsx` | Lista de leads com filtros |
| `SmartOpsWhatsAppInbox.tsx` | Inbox WhatsApp |
| `SmartOpsLogs.tsx` | Logs do sistema |
| `SmartOpsCSRules.tsx` | Regras de automação CS |
| `SmartOpsSellerAutomations.tsx` | Automações de vendedor |
| `SmartOpsModelCompare.tsx` | Comparador de modelos |
| `SmartOpsFormBuilder.tsx` | Construtor de formulários |
| `SmartOpsLeadImporter.tsx` | Importador de leads CSV |
| `AdminVideoAnalyticsDashboard.tsx` | Analytics de vídeos |

---

## 16. Tag Taxonomy (Governança de Tags)

### Journey Tags (Ciclo de Vida)

```
J01_CONSCIENCIA → J02_CONSIDERACAO → J03_NEGOCIACAO → J04_COMPRA → J05_RETENCAO → J06_APOIO
```

### Commercial Tags

| Tag | Trigger |
|---|---|
| `C_PRIMEIRO_CONTATO` | Stage contato_feito |
| `C_PROPOSTA_ENVIADA` | Stage proposta_enviada |
| `C_NEGOCIACAO_ATIVA` | Stage negociacao |
| `C_CONTRATO_FECHADO` | Stage fechamento / deal won |
| `C_OPP_ENCERRADA_COMPRA` | Deal won |
| `C_OPP_ENCERRADA_NAO_COMPROU` | Deal lost |
| `C_PQL_RECOMPRA` | Deal won → reentrada |
| `C_REENTRADA_NUTRICAO` | Deal encerrado |
| `C_RECUPERADO` | Saiu de Estagnados |
| `COMPROU_{PRODUTO}` | Deal won com produto específico |
| `NAO_COMPROU_{PRODUTO}` | Deal lost com produto específico |

### E-commerce Tags

| Tag | Trigger |
|---|---|
| `EC_INICIOU_CHECKOUT` | order_created |
| `EC_GEROU_BOLETO` | boleto_generated |
| `EC_BOLETO_VENCIDO` | boleto_expired |
| `EC_PAGAMENTO_APROVADO` | order_paid |
| `EC_PEDIDO_CANCELADO` | order_cancelled |
| `EC_PEDIDO_ENVIADO` | order_invoiced |
| `EC_PEDIDO_ENTREGUE` | order_delivered |
| `EC_CLIENTE_RECORRENTE` | ≥1 pedido pago |
| `EC_CLIENTE_INATIVO` | Última compra >12 meses |
| `EC_PROD_RESINA` | Produto detectado |
| `EC_PROD_INSUMO` | Produto detectado |
| `EC_PROD_KIT_CARAC` | Produto detectado |
| `EC_PROD_SMARTMAKE` | Produto detectado |

### Stagnation Tags

| Tag | Trigger |
|---|---|
| `A_ESTAGNADO_3D` | est_etapa1/2 |
| `A_ESTAGNADO_7D` | est_etapa3/4 |
| `A_ESTAGNADO_15D` | est_apresentacao/proposta/final |
| `A_SEM_RESPOSTA` | sem_interesse no WhatsApp |
| `A_RISCO_CHURN` | Detecção de risco |

### L.I.A. Tags

| Tag | Trigger |
|---|---|
| `LIA_LEAD_NOVO` | Primeiro contato com L.I.A. |
| `LIA_LEAD_REATIVADO` | Lead reativado via L.I.A. |
| `LIA_LEAD_ATIVADO` | Lead ativado |
| `LIA_ATENDEU` | L.I.A. respondeu |
| `LIA_PROATIVO_1/2/3` | Mensagem proativa enviada |

### CS Tags

| Tag | Trigger |
|---|---|
| `CS_ONBOARDING_INICIO` | Regra CS onboarding |
| `CS_TREINAMENTO_PENDENTE` | Regra CS treinamento |
| `CS_TREINAMENTO_OK` | Treinamento concluído |
| `CS_NPS_ENVIADO` | NPS enviado |

---

## 17. Golden Rule & Data Governance

### The Golden Rule

> **Se um lead tem deal ABERTO no Funil de Vendas, NENHUMA automação pode alterar o proprietário, a pipeline ou fechar o deal.**

Implementação em `lia-assign`:
```typescript
if (vendaDeal) {
  // updateExistingDeal com ownerId=null → preserva owner
  // Apenas enriches custom fields + adds note
}
```

### Protected Fields (ingest-lead)

```typescript
const protectedFields = [
  "nome", "email", "telefone_normalized", "piperun_id",
  "proprietario_lead_crm", "status_oportunidade", "lead_stage_detected",
  "entrada_sistema"
];
```

### CRM Lock

Campos `crm_lock_source` e `crm_lock_until` previnem conflitos:
- Quando um vendedor está trabalhando ativamente um lead
- Expiração automática após período definido

### Automation Cooldown

`automation_cooldown_until` previne spam:
- Após ação automatizada, cooldown de X horas
- Verificado antes de qualquer envio

### Idempotency

- `lia-assign`: Skip se assigned nos últimos 5 minutos
- `cs-processor`: Verifica `message_logs` antes de enviar
- `proactive-outreach`: Cooldown de 5 dias entre envios + max 3
- `intelligence_score`: Não recalcula dentro de 60 segundos

---

## 18. Secrets & Configuration

### Supabase Secrets

| Secret | Serviço | Usado em |
|---|---|---|
| `SUPABASE_URL` | Supabase | Todas as functions |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Todas as functions |
| `SUPABASE_ANON_KEY` | Supabase | Triggers, webhooks |
| `PIPERUN_API_KEY` | PipeRun CRM | lia-assign, sync-piperun, kanban-move, piperun-webhook |
| `DEEPSEEK_API_KEY` | DeepSeek AI | cognitive-analysis, stagnant-processor, watchdog |
| `LOVABLE_API_KEY` | Lovable Gateway | lia-assign (greeting), stagnant-processor (reactivation) |
| `SELLFLUX_WEBHOOK_LEADS` | SellFlux V1 | ingest-lead, sellflux-sync |
| `SELLFLUX_WEBHOOK_CAMPANHAS` | SellFlux V2 | ingest-lead, stagnant-processor, proactive-outreach |
| `MANYCHAT_API_KEY` | ManyChat | cs-processor, stagnant-processor |
| `LOJA_INTEGRADA_API_KEY` | Loja Integrada | ecommerce-webhook, poll-orders |
| `LOJA_INTEGRADA_APP_KEY` | Loja Integrada | ecommerce-webhook, poll-orders |
| `ASTRON_AM_KEY` | Astron Members | astron-member-lookup |
| `ASTRON_AM_SECRET` | Astron Members | astron-member-lookup |
| `ASTRON_CLUB_ID` | Astron Members | astron-member-lookup |
| `ASTRON_POSTBACK_TOKEN` | Astron Webhook | astron-postback |
| `PANDAVIDEO_API_KEY` | PandaVideo | sync-pandavideo, sync-video-analytics |
| `GOOGLE_PLACES_API_KEY` | Google Places | sync-google-reviews |
| `GOOGLE_DRIVE_API_KEY` | Google Drive | sync-google-drive-kb |
| `GOOGLE_AI_KEY` | Google AI | Content generation |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare | Image optimization |
| `CLOUDFLARE_API_TOKEN` | Cloudflare | Image optimization |

### config.toml

Todas as 85+ Edge Functions estão configuradas com `verify_jwt`. Apenas 3 usam `verify_jwt = true`:
- `create-user`
- `ai-metadata-generator`
- `heal-knowledge-gaps`

---

## 19. Bugs Conhecidos & Correções Aplicadas

### ✅ Corrigido: `lia-assign` ReferenceError em `piperunFunil`

**Problema:** Variável referenciada fora do escopo no fluxo `preserve_vendas`.  
**Fix:** Substituído por `updateFields.funil_entrada_crm`.

### ✅ Corrigido: `ecommerce-webhook` LTV sempre = 0

**Problema:** Códigos com prefixo `pedido_` não faziam match em `PAID_SITUACAO_CODIGOS`.  
**Fix:** Adicionados códigos prefixados ao set.

### ✅ Corrigido: `piperun-webhook` usando ANON_KEY em fire-and-forget

**Problema:** Usava `SUPABASE_ANON_KEY` em vez de `SERVICE_ROLE_KEY`.  
**Fix:** Trocado para `SERVICE_ROLE_KEY`.

### ✅ Corrigido: `lia-assign` piperun_id não atualizado

**Problema:** Guard `!lead.piperun_id` impedia atualização com deal ativo.  
**Fix:** Removido guard, sempre atualiza com deal ativo.

### ⚠️ Conhecido: `poll-loja-integrada` sem paginação completa

**Descrição:** Processa apenas 1 página (50 pedidos). Se >50 novos desde último poll, excedentes aguardam próximo ciclo.

### ⚠️ Conhecido: `wa-inbox-webhook` usando ANON_KEY

**Descrição:** Linha 196 usa `SUPABASE_ANON_KEY` para send-waleads e cognitive-analysis (linhas 230-234). Funciona porque `verify_jwt=false`, mas deveria usar `SERVICE_ROLE_KEY`.

### ⚠️ Conhecido: `ecommerce-webhook` sem deduplicação

**Descrição:** Retries do webhook podem processar mesmo pedido múltiplas vezes, duplicando tags e recalculando LTV.

---

## 20. Recomendações Futuras

### Prioridade Alta

1. **Deduplicação de webhooks**: Adicionar `lojaintegrada_pedidos_processados TEXT[]` e verificar antes de processar.

2. **GIN Index em tags_crm**: `CREATE INDEX idx_lia_tags_gin ON lia_attendances USING GIN (tags_crm)` para acelerar queries de filtragem.

3. **Trigger SQL para LIS**: `AFTER UPDATE ON lia_attendances` quando campos relevantes mudam, eliminando chamadas RPC manuais.

4. **Fix ANON_KEY em wa-inbox-webhook**: Trocar para `SERVICE_ROLE_KEY`.

### Prioridade Média

5. **Circuit breaker centralizado**: Extrair de `poll-loja-integrada-orders` para `_shared/circuit-breaker.ts`.

6. **Timeout em cognitive-analysis PipeRun notes**: Adicionar `AbortSignal.timeout(5000)` em `fetchDealNotes`.

7. **Paginação completa em poll-loja-integrada**: Loop `while(has_more)` com controle de timeout.

8. **CORS unificado**: Padronizar headers expandidos em todas as functions.

### Prioridade Baixa

9. **TLDV Integration**: Secret `TLDV_API_KEY`, nova function `sync-tldv-recordings`, campos `tldv_*`.

10. **Prediction model v2**: Usar feedback loop (`prediction_accuracy`) para treinar modelo de classificação.

11. **Real-time Kanban**: Usar Supabase Realtime channels para atualizar Kanban sem polling.

12. **Multi-tenant architecture**: Preparar para múltiplas marcas/empresas via `brand_id` na lia_attendances.

---

## Apêndice A: Mapeamento de Vendedores PipeRun

| ID | Nome | Email | Role | Celular |
|---|---|---|---|---|
| 100600 | Marcela Brito | marcela.brito@smartdent.com.br | vendedora | — |
| 98054 | Gabriella Ferreira | gabriella.ferreira@smartdent.com.br | vendedora | — |
| 95097 | Paulo Sérgio | paulo.sergio@smartdent.com.br | vendedor | 5516993014067 |
| 92511 | Alexandre | alexandre@novapremier.com.br | distribuidor | — |
| 90409 | RH SmartDent | rh@smartdent.com.br | rh | — |
| 79280 | Daniele Oliveira | dani.oliveira@smartdent.com.br | vendedora | 5516996333053 |
| 77312 | Thiago Godoy | thiago.godoy@smartdent.com.br | vendedor | — |
| 64367 | Thiago Nicoletti | sdpp@smartdent.com.br | gestor | — |
| 51616 | Janaina Santos | janaina.santos@smartdent.com.br | vendedora | 5516994364731 |
| 47802 | Lucas Silva | lucas.silva@smartdent.com.br | vendedor | 5516999939130 |
| 47675 | Patricia Gastaldi | patricia.gastaldi@smartdent.com.br | vendedora | 5516981158403 |
| 33626 | Evandro Silva | evandro.silva@smartdent.com.br | vendedor | 5516993895371 |

**Fallback Owner:** 64367 (Thiago Nicoletti — gestor)

---

## Apêndice B: Custom Fields PipeRun

### Deal Custom Fields (belongs=1)

| ID | Hash | Campo | Tipo |
|---|---|---|---|
| 549059 | ebe365... | ESPECIALIDADE | Text |
| 549058 | 619a7f... | PRODUTO_INTERESSE | Text |
| 549148 | eb81ef... | PRODUTO_INTERESSE_AUTO | Text |
| 549150 | f7dc3e... | WHATSAPP | Text |
| 549241 | 304e7f... | AREA_ATUACAO | Text |
| 549242 | cd2c1c... | TEM_SCANNER | Text |
| 549243 | 0d3626... | TEM_IMPRESSORA | Text |
| 621083 | eac51b... | PAIS_ORIGEM | Text |
| 623602 | 9a93b1... | INFORMACAO_DESEJADA | Text |
| 650066 | 9adaf7... | BANCO_DADOS_ID | Text |
| 673917 | 35b82d... | CODIGO_CONTRATO | Text |
| 673925 | e7f176... | DATA_TREINAMENTO | Text |

### Pessoa Custom Fields (belongs=3)

| ID | Hash | Campo |
|---|---|---|
| 674001 | 397dd3... | AREA_ATUACAO |
| 674002 | 7a5764... | ESPECIALIDADE |

---

## Apêndice C: Pipeline Stages IDs

### Funil de Vendas (18784)

| Stage | ID | Label |
|---|---|---|
| Sem contato | 99293 | sem_contato |
| Contato feito | 99294 | contato_feito |
| Em contato | 379942 | em_contato |
| Apresentação/Visita | 99295 | apresentacao |
| Proposta enviada | 99296 | proposta_enviada |
| Negociação | 448526 | negociacao |
| Fechamento | 99818 | fechamento |

### Funil Estagnados (72938)

| Stage | ID | Label |
|---|---|---|
| Etapa 00 - Novos | 447250 | est_etapa1 |
| Etapa 01 - Reativação | 447251 | est_etapa1 |
| Etapa 02 | 542160 | est_etapa2 |
| Etapa 03 | 542161 | est_etapa3 |
| Etapa 04 | 447252 | est_etapa4 |
| Apresentação (Est) | 447253 | est_apresentacao |
| Proposta (Est) | 447254 | est_proposta |
| Fechamento (Est) | 447255 | estagnado_final |
| Auxiliar | 544565 | — |
| Get New Owner | 545087 | — |

### CS Onboarding (83896)

| Stage | ID | Label |
|---|---|---|
| Auxiliar Email | 535466 | cs_auxiliar_email |
| Em Espera | 535465 | cs_em_espera |
| Sem Data/Agendar | 523977 | cs_sem_data_agendar |
| Não quer imersão | 619883 | cs_nao_quer_imersao |
| Treinamento Agendado | 583087 | cs_treinamento_agendado |
| Treinamento Realizado | 583110 | cs_treinamento_realizado |
| Enviar Imp3D | 523978 | cs_enviar_imp3d |
| Equipamentos Entregues | 523980 | cs_equipamentos_entregues |
| Retirar Scan/Imp3D | 523979 | cs_retirar_scan |
| Acompanhamento 15d CS | 612326 | cs_acompanhamento_15d |
| Acomp 30d Comercial | 525468 | cs_acomp_30d_comercial |
| Acompanhamento Atenção | 612327 | cs_acompanhamento_atencao |
| Acomp Finalizado | 583337 | cs_finalizado |
| Não Use DKMNGR | 538897 | cs_nao_use_dkmngr |
| Não Use OMIE Fix | 568247 | cs_nao_use_omie_fix |

---

*Documento gerado para o departamento de engenharia. Para dúvidas, consultar os logs das Edge Functions no [Supabase Dashboard](https://supabase.com/dashboard/project/okeogjgqijbfkudfjadz/functions).*
