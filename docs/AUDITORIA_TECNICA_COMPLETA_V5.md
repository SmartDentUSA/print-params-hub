# 📋 AUDITORIA TÉCNICA COMPLETA v5.0

## Revenue Intelligence OS — Smart Dent / BLZ Dental

**Versão:** 5.0  
**Data:** 2026-03-17  
**Escopo:** Auditoria de engenharia completa — Edge Functions, IA, CDP, Fluxos, SEO, UX  
**Autor:** Lovable AI Auditor  
**Baseline:** v4.0 (2026-03-14) → Delta documentado

---

## ÍNDICE

| # | Parte | Linhas |
|---|---|---|
| 1 | Identidade, Stack e Modelos de IA | 40-140 |
| 2 | Arquitetura Dual (Diagramas) | 141-230 |
| 3 | CDP Unificado (~200 colunas, 9 domínios) | 231-400 |
| 4 | Person-Centric Identity Graph (Sprint 1) | 401-490 |
| 5 | Inventário Completo de Edge Functions (95+) | 491-800 |
| 6 | Fluxos de Leads (8 fluxos) | 801-1050 |
| 7 | Fluxos de Conteúdo (7 fluxos) | 1051-1250 |
| 8 | Fluxos de Atendimento Dra. L.I.A. | 1251-1500 |
| 9 | Motor Cognitivo e Intelligence Score | 1501-1700 |
| 10 | Copilot IA (Dual Brain, 19+ tools) | 1701-1900 |
| 11 | Lead Intelligence Card v2 (6 abas) | 1901-2050 |
| 12 | Workflow Portfolio (7 estágios) | 2051-2150 |
| 13 | Integrações Externas (9 sistemas) | 2151-2400 |
| 14 | Qualidade HTML & Regras Anti-Alucinação | 2401-2500 |
| 15 | SEO E-E-A-T / GEO / IA-Ready | 2501-2700 |
| 16 | UX/UI Architecture | 2701-2850 |
| 17 | Banco de Dados (tabelas, views, RPCs, triggers) | 2851-3050 |
| 18 | Secrets, Segurança e Métricas | 3051-3150 |

---

# PARTE 1 — IDENTIDADE, STACK E MODELOS DE IA

## 1.1 Identidade do Sistema

| Campo | Valor |
|---|---|
| **Nome** | Revenue Intelligence OS (Sistema B) |
| **Empresa** | Smart Dent / BLZ Dental |
| **Indústria** | Impressão 3D Odontológica |
| **Domínio público** | `parametros.smartdent.com.br` |
| **Loja** | `loja.smartdent.com.br` (Loja Integrada) |
| **Academy** | `smartdentacademy.astronmembers.com` |
| **Supabase Project ID** | `okeogjgqijbfkudfjadz` |
| **Preview URL** | `print-params-hub.lovable.app` |

## 1.2 Stack Tecnológico

### Frontend
| Tecnologia | Versão/Detalhe |
|---|---|
| React | 18.x + TypeScript |
| Vite | Build tool |
| Tailwind CSS | Utility-first + semantic tokens |
| shadcn/ui | Component library (50+ componentes) |
| Framer Motion | Animações |
| Lucide React | Iconografia |
| React Router | Roteamento SPA (15+ rotas) |
| Recharts | Gráficos/dashboards |

### Backend
| Tecnologia | Detalhe |
|---|---|
| Supabase | PostgreSQL + Auth + Storage + Realtime + Edge Functions |
| Deno | Runtime para Edge Functions |
| pgvector | Busca vetorial (embeddings 768/1536d) |
| pg_trgm | Busca por similaridade trigram |
| pg_cron | Agendamento de tarefas (sync, batch) |
| pg_net | HTTP calls assíncronos de triggers |

### Deployment
| Aspecto | Detalhe |
|---|---|
| Frontend | Vercel (vercel.json com rewrites) |
| Edge Functions | Supabase (auto-deploy via Lovable) |
| SSR | `seo-proxy` Edge Function (2004 LOC) |
| CDN | Supabase Storage + Vercel Edge |

## 1.3 Modelos de IA em Uso

| Modelo | Provider | Gateway | Uso Principal | Custo |
|---|---|---|---|---|
| `google/gemini-3-flash-preview` | Lovable AI Gateway | `ai.gateway.lovable.dev` | Dra. LIA (conversacional), Copilot (Gemini mode) | Médio |
| `deepseek-chat` | DeepSeek API direta | `api.deepseek.com` | Copilot (DeepSeek mode), Stagnant Processor | Baixo |
| `deepseek-reasoner` | DeepSeek API direta | `api.deepseek.com` | Leads quentes (score > 70) via `lead_model_routing` | Médio |
| `gemini-2.5-flash-lite` | Lovable AI Gateway | `ai.gateway.lovable.dev` | Leads frios (score < 40) via routing | Muito baixo |
| `text-embedding-004` | Google AI | `generativelanguage.googleapis.com` | Geração de embeddings 768d | Baixo |

### Roteamento Inteligente de Modelos

A view `lead_model_routing` governa a seleção dinâmica:

```
Score < 40  → gemini-flash-lite (barato, rápido)
Score 40-70 → deepseek-chat (balanceado)
Score > 70  → deepseek-reasoner (raciocínio profundo)
```

### Dual Brain Architecture (Copilot)

```
┌─────────────────────────────────────────────┐
│              SmartOpsCopilot.tsx             │
│  ToggleGroup: [DeepSeek ⚡] [Gemini 🧠]     │
└────────────┬──────────────┬─────────────────┘
             │              │
     ┌───────▼──────┐  ┌───▼─────────────────┐
     │ DeepSeek API │  │ Lovable AI Gateway   │
     │ deepseek-chat│  │ gemini-3-flash-prev  │
     └──────────────┘  └──────────────────────┘
```

---

# PARTE 2 — ARQUITETURA DUAL (DIAGRAMAS)

## 2.1 Visão Geral do Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                    SISTEMA B — Revenue Intelligence OS          │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │ Frontend │  │ Edge Fns │  │ Database │  │ Integrations │   │
│  │ React/TS │  │ Deno 95+ │  │ Postgres │  │ 9 sistemas   │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘   │
│       │              │              │               │           │
│  15 rotas         95+ funções   82 tabelas    PipeRun          │
│  14 tabs SmartOps  20 secrets   14 views      SellFlux         │
│  50+ components   10 shared     19+ RPCs      Loja Integrada   │
│                    modules      6 triggers     Meta Ads         │
│                                               Astron Members   │
│                                               WaLeads          │
│                                               PandaVideo       │
│                                               Google Drive     │
│                                               Google Reviews   │
└─────────────────────────────────────────────────────────────────┘
```

## 2.2 Fluxo de Dados Principal

```
                          FONTES DE DADOS
    ┌─────────┬──────────┬──────────┬──────────┬──────────┐
    │ Meta    │ SellFlux │ PipeRun  │ Loja     │ Astron   │
    │ Lead Ads│ Webhooks │ API      │ Integrada│ Members  │
    └────┬────┴────┬─────┴────┬─────┴────┬─────┴────┬─────┘
         │         │          │          │          │
         ▼         ▼          ▼          ▼          ▼
    ┌─────────────────────────────────────────────────────┐
    │            EDGE FUNCTIONS (Ingestão)                │
    │  meta-lead-webhook → sellflux-webhook →             │
    │  sync-piperun → ecommerce-webhook →                 │
    │  astron-postback                                    │
    └──────────────────────┬──────────────────────────────┘
                           ▼
    ┌─────────────────────────────────────────────────────┐
    │              CDP UNIFICADO                          │
    │         lia_attendances (~200 colunas)              │
    │         + people + companies + identity_keys        │
    └───────┬───────────┬───────────┬─────────────────────┘
            │           │           │
            ▼           ▼           ▼
    ┌───────────┐ ┌──────────┐ ┌──────────────┐
    │ Cognitive │ │ Content  │ │ Commercial   │
    │ Analysis  │ │ Pipeline │ │ Automation   │
    │ DeepSeek  │ │ Gemini   │ │ SellFlux+    │
    │ v3        │ │ 2.5 Flash│ │ WaLeads      │
    └───────────┘ └──────────┘ └──────────────┘
```

## 2.3 Arquitetura SmartOps (14 Sub-Tabs)

```
┌──────────────────────────────────────────────────────────────┐
│                    SmartOps Dashboard (/admin)                │
├──────┬──────┬──────┬──────┬──────┬──────┬──────┬─────────────┤
│Bowtie│Kanban│Equipe│Autom.│ Logs │Relat.│Conteu│ Saúde       │
├──────┼──────┼──────┼──────┼──────┼──────┼──────┼─────────────┤
│ WA   │Forms │Token │Intel │ ROI  │Copilo│      │             │
│Inbox │Build │  IA  │Score │Calcs │  IA  │      │             │
└──────┴──────┴──────┴──────┴──────┴──────┴──────┴─────────────┘
```

---

# PARTE 3 — CDP UNIFICADO (~200 COLUNAS, 9 DOMÍNIOS)

## 3.1 Tabela Principal: `lia_attendances`

A tabela central do sistema concentra ~200 colunas organizadas em 9 domínios funcionais.

### Domínio 1: Core (Identidade e Status)

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | Identificador único |
| `email` | TEXT | E-mail principal (CITEXT-like, lowercase) |
| `nome` | TEXT | Nome completo |
| `telefone_raw` | TEXT | Telefone como recebido |
| `telefone_normalized` | TEXT | Formato +55XXXXXXXXXXX (trigger `fn_normalize_phone`) |
| `lead_status` | TEXT | Status atual do lead no funil |
| `source` | TEXT | Origem primária (formulario, sellflux, meta, loja_integrada) |
| `original_source` | TEXT | Fonte original preservada |
| `entrada_sistema` | TIMESTAMPTZ | Data de entrada |
| `updated_at` | TIMESTAMPTZ | Última atualização |
| `merged_into` | UUID FK | Lead absorvido (merge) |
| `merge_history` | JSONB | Histórico de consolidações |
| `person_id` | UUID FK → people | Identidade person-centric |
| `buyer_type` | TEXT (gerado) | PF/PJ baseado em CNPJ |

### Domínio 2: Qualificação SDR

| Coluna | Tipo | Descrição |
|---|---|---|
| `especialidade` | TEXT | Especialidade odontológica |
| `area_atuacao` | TEXT | Área de atuação |
| `cidade` / `uf` | TEXT | Localização |
| `produto_interesse` | TEXT | Produto de interesse principal |
| `resina_interesse` | TEXT | Resina específica |
| `impressora_modelo` | TEXT | Modelo de impressora atual |
| `tem_impressora` | TEXT | sim/não/terceiriza |
| `tem_scanner` | TEXT | sim/não |
| `software_cad` | TEXT | Software CAD em uso |
| `como_digitaliza` | TEXT | Método de digitalização |
| `volume_mensal_pecas` | TEXT | Volume produtivo |
| `principal_aplicacao` | TEXT | Aplicação principal |
| `sdr_scanner_interesse` | TEXT | Interesse por scanner |
| `sdr_impressora_interesse` | TEXT | Interesse por impressora |
| `sdr_software_cad_interesse` | TEXT | Interesse por CAD |
| `sdr_pos_impressao_interesse` | TEXT | Interesse em pós-processamento |
| `sdr_cursos_interesse` | TEXT | Interesse em cursos |
| `sdr_dentistica_interesse` | TEXT | Interesse em dentística digital |

### Domínio 3: PipeRun CRM

| Coluna | Tipo | Descrição |
|---|---|---|
| `piperun_id` | TEXT | ID do deal no PipeRun |
| `pessoa_piperun_id` | INTEGER | ID da pessoa no PipeRun |
| `piperun_pipeline_name` | TEXT | Nome do funil |
| `piperun_stage_name` | TEXT | Nome da etapa CRM |
| `etapa_crm` | TEXT | Etapa mapeada local |
| `proprietario_lead_crm` | TEXT | Vendedor responsável |
| `funil_entrada_crm` | TEXT | Funil de entrada original |
| `piperun_created_at` | TIMESTAMPTZ | Data de criação no CRM |
| `valor_oportunidade` | NUMERIC | Valor da oportunidade |
| `ltv_total` | NUMERIC | Lifetime Value calculado |
| `total_deals` | INTEGER | Total de negócios |
| `anchor_product` | TEXT | Produto âncora (mais recorrente) |
| `piperun_deals_history` | JSONB[] | Array de snapshots de todos os deals |
| `proposals_total_value` | NUMERIC | Valor total de propostas |
| `ultima_etapa_comercial` | TEXT | Última etapa registrada |
| `tags_crm` | TEXT[] | Tags CRM (array) |

### Domínio 4: Cognitive AI

| Coluna | Tipo | Descrição |
|---|---|---|
| `cognitive_analysis` | JSONB | Análise cognitiva completa |
| `cognitive_analyzed_at` | TIMESTAMPTZ | Data da análise |
| `previous_stage` | TEXT | Estágio anterior (regressão detection) |
| `cognitive_narrative` | TEXT | Narrativa de 3 parágrafos |
| `cognitive_stage` | TEXT | MQL/PQL/SAL/SQL/CLIENTE |
| `cognitive_urgency` | TEXT | alta/media/baixa |
| `cognitive_timeline` | TEXT | imediato/3_6_meses/6_12_meses/indefinido |
| `cognitive_key_points` | JSONB | Pontos-chave extraídos |
| `cognitive_recommended_actions` | JSONB | Ações recomendadas |

### Domínio 5: Intelligence Score

| Coluna | Tipo | Descrição |
|---|---|---|
| `intelligence_score` | JSONB | Breakdown completo dos 4 eixos |
| `intelligence_score_total` | NUMERIC | Score consolidado (0-100) |
| `intelligence_heat` | NUMERIC | Eixo: Calor (engajamento recente) |
| `intelligence_power` | NUMERIC | Eixo: Poder (valor financeiro) |
| `intelligence_fit` | NUMERIC | Eixo: Fit (adequação ao ICP) |
| `intelligence_momentum` | NUMERIC | Eixo: Momentum (velocidade de progressão) |
| `score` | NUMERIC | Score legado |
| `temperatura_lead` | TEXT | frio/morno/quente |

### Domínio 6: Equipamentos (Ativos)

| Coluna | Tipo | Descrição |
|---|---|---|
| `ativo_scan` | TEXT | Scanner ativo |
| `ativo_cad` | TEXT | CAD ativo |
| `ativo_print` | TEXT | Impressora ativa |
| `ativo_cura` | TEXT | Equipamento pós-cura |
| `equip_scanner` | TEXT | Equipamento scanner específico |
| `equip_pos_impressao` | TEXT | Equipamento pós-impressão |
| `status_scanner` | TEXT | Status do workflow scanner |
| `status_cad` | TEXT | Status do workflow CAD |
| `status_impressora` | TEXT | Status do workflow impressora |
| `status_pos_impressao` | TEXT | Status do workflow pós |
| `status_insumos` | TEXT | Status do workflow insumos |
| `workflow_score` | NUMERIC | Score calculado (0-10) |

### Domínio 7: E-commerce (Loja Integrada)

| Coluna | Tipo | Descrição |
|---|---|---|
| `loja_cliente_id` | TEXT | ID do cliente na Loja Integrada |
| `lojaintegrada_total_pedidos_pagos` | INTEGER | Total de pedidos pagos |
| `lojaintegrada_total_gasto` | NUMERIC | Valor total gasto |
| `lojaintegrada_historico_pedidos` | JSONB | Array de pedidos |
| `lojaintegrada_itens_json` | JSONB | Itens detalhados |
| `lojaintegrada_ultimo_pedido_status` | TEXT | Status do último pedido |
| `lojaintegrada_ultimo_pedido_valor` | NUMERIC | Valor do último pedido |
| `lojaintegrada_ultimo_pedido_data` | TIMESTAMPTZ | Data do último pedido |

### Domínio 8: Astron Academy

| Coluna | Tipo | Descrição |
|---|---|---|
| `astron_member_id` | TEXT | ID do membro na Astron |
| `astron_status` | TEXT | Status da conta |
| `astron_created_at` | TIMESTAMPTZ | Data de inscrição |
| `astron_courses_access` | JSONB[] | Array de cursos com progresso |
| `astron_courses_completed` | INTEGER | Cursos 100% concluídos |
| `astron_fbc` | TEXT | Facebook Click ID |
| `astron_fbp` | TEXT | Facebook Pixel ID |

### Domínio 9: Automação e Proatividade

| Coluna | Tipo | Descrição |
|---|---|---|
| `sellflux_synced_at` | TIMESTAMPTZ | Última sync SellFlux |
| `sellflux_custom_fields` | JSONB | Campos customizados SellFlux |
| `proactive_sent_at` | TIMESTAMPTZ | Última mensagem proativa |
| `proactive_count` | INTEGER | Total de mensagens proativas |
| `cooldown_until` | TIMESTAMPTZ | Cooldown de mensagens |
| `total_messages` | INTEGER | Total de mensagens LIA |
| `ultima_sessao_at` | TIMESTAMPTZ | Última sessão ativa |
| `historico_resumos` | JSONB | Array de resumos de sessão |
| `resumo_historico_ia` | TEXT | Resumo IA consolidado |

---

# PARTE 4 — PERSON-CENTRIC IDENTITY GRAPH (SPRINT 1)

## 4.1 Modelo de Dados

```
┌──────────────┐    M:N    ┌─────────────┐
│   people     │◄─────────►│  companies  │
│   (UUID PK)  │           │  (UUID PK)  │
│              │           │             │
│ nome         │    via    │ nome        │
│ email        │ person_   │ cnpj        │
│ telefone     │ company_  │ razao_social│
│ cpf          │ relation  │ segmento    │
│ is_primary   │ ship      │ porte       │
└──────┬───────┘           └─────────────┘
       │ 1:N
       ▼
┌──────────────────┐
│ identity_keys    │
│ (type, value,    │
│  confidence,     │
│  verified_at)    │
└──────────────────┘
       │ 1:N
       ▼
┌──────────────────┐
│ lia_attendances  │
│ (person_id FK)   │
│ (~200 colunas)   │
└──────────────────┘
```

## 4.2 Tabelas

### `people` (82 colunas)
- **Identidade**: id, nome, email, telefone, cpf
- **Enriquecimento**: area_atuacao, especialidade, cro_estado, cro_numero
- **Agregados**: ltv_total_leads (calculado via trigger `sync_lia_to_people_graph`)

### `companies`
- **CNPJ, razão social, nome fantasia**
- **Porte, segmento, CNAE**
- **Endereço (JSONB), website, redes sociais**
- **Touch model** (high_touch, low_touch, tech_touch)
- **Merge tracking**: `merged_into` com cascading

### `person_company_relationship`
- **Relação M:N** com `role` (proprietario, socio, funcionario, consultor)
- **Permite**: Dentista que atende em múltiplas clínicas
- **`is_primary`**: Marca relação principal

### `identity_keys`
- **Tipo**: email, phone, cpf, cnpj, piperun_person_id, astron_member_id
- **Confidence**: high, medium, low
- **Source**: piperun, sellflux, formulario, astron, manual
- **Usado para**: Resolução de identidade cross-source

## 4.3 Coluna Gerada: `buyer_type`

```sql
-- Coluna gerada que classifica automaticamente o tipo de comprador
buyer_type GENERATED ALWAYS AS (
  CASE WHEN cnpj IS NOT NULL AND length(cnpj) > 0 THEN 'PJ' ELSE 'PF' END
) STORED
```

## 4.4 Trigger de Normalização de Telefone

```sql
CREATE FUNCTION fn_normalize_phone() RETURNS trigger AS $$
BEGIN
  IF NEW.telefone_normalized NOT LIKE '+%' THEN
    NEW.telefone_normalized := '+' || regexp_replace(NEW.telefone_normalized, '\D', '', 'g');
  END IF;
  RETURN NEW;
END;
$$
```

---

# PARTE 5 — INVENTÁRIO COMPLETO DE EDGE FUNCTIONS

## 5.1 Resumo Quantitativo

| Métrica | Valor |
|---|---|
| **Total de Edge Functions** | 95+ |
| **Linhas de código (backend)** | ~25.000 LOC |
| **Shared Modules** | 16 arquivos em `_shared/` |
| **Funções com IA** | 18 |
| **Funções verify_jwt=true** | 4 |
| **Funções verify_jwt=false** | 91+ |
| **Secrets configurados** | 20 |

## 5.2 Inventário por Categoria

### 🤖 Dra. L.I.A. (Conversacional)

| Função | LOC | IA | JWT | Secrets | Tabelas Principais |
|---|---|---|---|---|---|
| `dra-lia` | 4043 | Gemini 3 Flash Preview | false | LOVABLE_API_KEY, GOOGLE_AI_KEY | agent_interactions, agent_sessions, lia_attendances, agent_embeddings |
| `dra-lia-whatsapp` | ~350 | Gemini 3 Flash | false | LOVABLE_API_KEY | agent_interactions, lia_attendances |
| `dra-lia-export` | ~200 | — | false | — | agent_interactions |
| `evaluate-interaction` | ~300 | DeepSeek + Gemini | false | DEEPSEEK_API_KEY, LOVABLE_API_KEY | agent_interactions |
| `archive-daily-chats` | ~150 | — | false | — | agent_interactions, lia_attendances |

### 🧠 Cognitive Intelligence

| Função | LOC | IA | JWT | Secrets | Tabelas |
|---|---|---|---|---|---|
| `cognitive-lead-analysis` | 481 | DeepSeek v3 | false | DEEPSEEK_API_KEY, PIPERUN_API_KEY | lia_attendances, deals |
| `batch-cognitive-analysis` | 131 | (via cognitive) | false | — | lia_attendances |
| `backfill-intelligence-score` | 94 | — | false | — | lia_attendances |

### 💼 SmartOps (Gestão de Leads)

| Função | LOC | IA | JWT | Secrets | Tabelas |
|---|---|---|---|---|---|
| `smart-ops-copilot` | 1523 | DeepSeek + Gemini | false | DEEPSEEK_API_KEY, LOVABLE_API_KEY | lia_attendances, team_members, knowledge_contents, knowledge_videos, message_logs |
| `smart-ops-ingest-lead` | 430 | — | false | SELLFLUX_WEBHOOK_LEADS | lia_attendances |
| `smart-ops-sync-piperun` | 291 | — | false | PIPERUN_API_KEY | lia_attendances, piperun_staging |
| `smart-ops-piperun-webhook` | ~250 | — | false | PIPERUN_API_KEY | lia_attendances |
| `smart-ops-sellflux-webhook` | 300 | — | false | — | lia_attendances |
| `smart-ops-sellflux-sync` | ~200 | — | false | SELLFLUX_WEBHOOK_LEADS | lia_attendances |
| `smart-ops-meta-lead-webhook` | 206 | — | false | META_LEAD_ADS_TOKEN, META_WEBHOOK_VERIFY_TOKEN | lia_attendances |
| `smart-ops-ecommerce-webhook` | 905 | — | false | LOJA_INTEGRADA_API_KEY, LOJA_INTEGRADA_APP_KEY | lia_attendances, lead_product_history, lead_cart_history |
| `smart-ops-stagnant-processor` | 345 | DeepSeek/Gemini | false | DEEPSEEK_API_KEY, LOVABLE_API_KEY, MANYCHAT_API_KEY, SELLFLUX_WEBHOOK_CAMPANHAS, PIPERUN_API_KEY | lia_attendances, cs_automation_rules |
| `smart-ops-proactive-outreach` | 280 | — | false | SELLFLUX_WEBHOOK_CAMPANHAS | lia_attendances, message_logs |
| `smart-ops-kanban-move` | ~200 | — | false | PIPERUN_API_KEY | lia_attendances, deals |
| `smart-ops-lia-assign` | ~400 | Gemini 3 Flash | false | LOVABLE_API_KEY, PIPERUN_API_KEY | lia_attendances, team_members |
| `smart-ops-send-waleads` | ~200 | — | false | — | team_members, message_logs |
| `smart-ops-wa-inbox-webhook` | ~300 | — | false | — | whatsapp_inbox, lia_attendances |
| `smart-ops-cs-processor` | ~250 | — | false | — | lia_attendances, cs_automation_rules |
| `smart-ops-meta-ads-manager` | ~300 | — | false | META_ADS_MANAGER_TOKEN | (API Meta externa) |
| `smart-ops-meta-ads-insights` | ~250 | — | false | META_ADS_INSIGHTS_TOKEN | (API Meta externa) |
| `smart-ops-copilot` | 1523 | Dual Brain | false | DEEPSEEK_API_KEY, LOVABLE_API_KEY | (19+ tools across all tables) |
| `import-leads-csv` | ~300 | — | false | — | lia_attendances |
| `import-proposals-csv` | 808 | — | false | — | lia_attendances, deal_items |
| `backfill-lia-leads` | ~200 | — | false | — | lia_attendances |
| `backfill-ltv` | 108 | — | false | — | lia_attendances |
| `piperun-full-sync` | ~150 | — | false | PIPERUN_API_KEY | lia_attendances |
| `piperun-api-test` | ~100 | — | false | PIPERUN_API_KEY | — |
| `fix-piperun-links` | ~150 | — | false | PIPERUN_API_KEY | lia_attendances |
| `create-technical-ticket` | ~200 | — | false | — | technical_tickets |

### 📝 Conteúdo & Knowledge Base

| Função | LOC | IA | JWT | Secrets | Tabelas |
|---|---|---|---|---|---|
| `ai-orchestrate-content` | 1238 | Gemini 2.5 Flash | false | LOVABLE_API_KEY | knowledge_contents, external_links |
| `ai-metadata-generator` | ~400 | Gemini 2.5 Flash | true | LOVABLE_API_KEY | knowledge_contents |
| `ai-content-formatter` | ~300 | Gemini 2.5 Flash | false | LOVABLE_API_KEY | knowledge_contents |
| `ai-generate-og-image` | ~350 | Gemini 2.5 Flash | false | LOVABLE_API_KEY | knowledge_contents |
| `ai-enrich-pdf-content` | ~400 | Gemini 2.5 Flash | false | LOVABLE_API_KEY | catalog_documents |
| `reformat-article-html` | ~300 | Gemini | false | LOVABLE_API_KEY | knowledge_contents |
| `auto-inject-product-cards` | ~250 | Gemini | false | LOVABLE_API_KEY | knowledge_contents, system_a_catalog |
| `enrich-article-seo` | ~300 | Gemini | false | LOVABLE_API_KEY | knowledge_contents, external_links |
| `translate-content` | ~400 | Gemini | false | LOVABLE_API_KEY | knowledge_contents |
| `backfill-keywords` | ~200 | Gemini | false | LOVABLE_API_KEY | knowledge_contents |
| `create-test-articles` | ~200 | Gemini | true | LOVABLE_API_KEY | knowledge_contents |
| `heal-knowledge-gaps` | ~300 | Gemini + DeepSeek | true | LOVABLE_API_KEY, DEEPSEEK_API_KEY | agent_knowledge_gaps, content_requests |
| `link-videos-to-articles` | ~200 | — | false | — | knowledge_contents, knowledge_videos |
| `generate-veredict-data` | ~200 | Gemini | false | LOVABLE_API_KEY | knowledge_contents |
| `ingest-knowledge-text` | ~150 | — | false | — | company_kb_texts |

### 📄 Extração & Processamento

| Função | LOC | IA | JWT | Secrets | Tabelas |
|---|---|---|---|---|---|
| `extract-pdf-text` | ~200 | — | false | — | catalog_documents |
| `extract-pdf-raw` | ~150 | — | false | — | catalog_documents |
| `extract-pdf-specialized` | ~300 | Gemini | false | LOVABLE_API_KEY | catalog_documents |
| `extract-and-cache-pdf` | ~250 | — | false | — | catalog_documents |
| `extract-video-content` | ~200 | — | false | PANDAVIDEO_API_KEY | knowledge_videos |
| `extract-commercial-expertise` | ~200 | Gemini | false | LOVABLE_API_KEY | company_kb_texts |
| `enrich-resins-from-apostila` | ~250 | Gemini | false | LOVABLE_API_KEY | resins |
| `export-processing-instructions` | ~200 | — | false | — | resins, parameter_sets |
| `format-processing-instructions` | ~200 | Gemini | false | LOVABLE_API_KEY | — |
| `export-apostila-docx` | ~300 | — | false | — | resins, parameter_sets |

### 📡 Embeddings & RAG

| Função | LOC | IA | JWT | Secrets | Tabelas |
|---|---|---|---|---|---|
| `index-embeddings` | ~300 | text-embedding-004 | false | GOOGLE_AI_KEY | agent_embeddings |
| `index-spin-entries` | ~200 | text-embedding-004 | false | GOOGLE_AI_KEY | agent_embeddings |
| `generate-embedding` (shared) | ~80 | text-embedding-004 | — | GOOGLE_AI_KEY | — |

### 🌐 SEO & Sitemaps

| Função | LOC | JWT | Descrição |
|---|---|---|---|
| `seo-proxy` | 2004 | false | SSR para bots (40+ User-Agents) com 8 geradores |
| `generate-sitemap` | ~300 | false | Sitemap principal (produtos/resinas) |
| `generate-knowledge-sitemap` | ~200 | false | Sitemap Knowledge Hub (PT) |
| `generate-knowledge-sitemap-en` | ~200 | false | Sitemap Knowledge Hub (EN) |
| `generate-knowledge-sitemap-es` | ~200 | false | Sitemap Knowledge Hub (ES) |
| `generate-documents-sitemap` | ~200 | false | Sitemap de documentos |
| `generate-parameter-pages` | ~200 | false | Gerador de páginas de parâmetros |
| `knowledge-feed` | ~300 | false | RSS/Atom/JSON feed |
| `document-proxy` | ~150 | false | Proxy de documentos com metadata |

### 🔗 Sync & Integração

| Função | LOC | JWT | Secrets | Descrição |
|---|---|---|---|---|
| `sync-pandavideo` | ~300 | false | PANDAVIDEO_API_KEY | Sync folders/vídeos PandaVideo |
| `sync-video-analytics` | ~200 | false | PANDAVIDEO_API_KEY | Métricas de visualização |
| `sync-google-reviews` | ~200 | false | GOOGLE_PLACES_API_KEY | Reviews do Google |
| `sync-google-drive-kb` | ~250 | false | GOOGLE_DRIVE_API_KEY | Sync Google Drive → KB |
| `sync-knowledge-base` | ~400 | false | — | Sync Sistema A → B |
| `sync-sistema-a` | ~300 | false | — | Sync catálogo |
| `sync-astron-members` | ~200 | false | ASTRON_AM_KEY, ASTRON_AM_SECRET | Sync membros Astron |
| `astron-postback` | ~300 | false | ASTRON_POSTBACK_TOKEN | Webhook Astron |
| `astron-member-lookup` | ~150 | false | ASTRON_AM_KEY | Lookup de membros |
| `import-loja-integrada` | ~300 | false | LOJA_INTEGRADA_API_KEY, LOJA_INTEGRADA_APP_KEY | Import manual |
| `import-system-a-json` | ~400 | false | — | Import bulk JSON |
| `poll-loja-integrada-orders` | ~350 | false | LOJA_INTEGRADA_API_KEY, LOJA_INTEGRADA_APP_KEY | Polling de pedidos |
| `register-loja-webhooks` | ~100 | false | LOJA_INTEGRADA_API_KEY | Registro de webhooks |
| `migrate-catalog-images` | ~200 | false | — | Migração de imagens |

### 🛠️ Utilidades

| Função | LOC | JWT | Descrição |
|---|---|---|---|
| `data-export` | ~500 | false | API de exportação (14 datasets) |
| `get-product-data` | ~200 | false | Lookup de produto (4-step fuzzy) |
| `export-parametros-ia` | ~300 | false | Parâmetros para IA |
| `create-user` | ~100 | true | Criação de usuário (admin) |
| `test-api-viewer` | ~100 | false | API viewer para debug |
| `pandavideo-test` | ~100 | false | Teste PandaVideo |
| `system-watchdog-deepseek` | ~200 | false | Health check DeepSeek |

## 5.3 Shared Modules (`_shared/`)

| Módulo | LOC | Descrição |
|---|---|---|
| `lia-rag.ts` | 519 | Pipeline RAG: busca vetorial, FTS, ILIKE, cache, topic weights |
| `lia-sdr.ts` | 236 | SDR Consultivo: SPIN Selling, arquétipos, maturidade MQL→CLIENTE |
| `lia-escalation.ts` | 218 | Detecção de intenção (vendedor/cs_suporte/especialista) + handoff |
| `lia-guards.ts` | 209 | Guardrails: saudações, suporte, protocolo, problema, price intent |
| `lia-printer-dialog.ts` | 341 | Fluxo guiado marca→modelo→resina para parâmetros |
| `lia-lead-extraction.ts` | 165 | Extração implícita de dados (UF, equipamento, CAD, volume, aplicação) |
| `piperun-field-map.ts` | 760 | Mapeamento completo PipeRun: 11 pipelines, 60+ stages, custom fields |
| `piperun-hierarchy.ts` | 283 | Person→Company→Deal management no PipeRun |
| `sellflux-field-map.ts` | 514 | Tags (85+), journey mapping, webhook sender, product detection |
| `waleads-messaging.ts` | 388 | Envio WaLeads, saudações IA, notificações de seller |
| `system-prompt.ts` | 251 | Super prompt anti-alucinação + identidade editorial |
| `rate-limiter.ts` | 95 | Rate limiting por IP/session via system_health_logs |
| `resilient-fetch.ts` | 85 | Retry exponencial + dead letter logging |
| `log-ai-usage.ts` | ~80 | Logging de tokens IA em ai_token_usage |
| `generate-embedding.ts` | ~80 | Wrapper Google AI text-embedding-004 |
| `entity-dictionary.ts` | ~150 | Dicionário de entidades com Wikidata IDs |
| `citation-builder.ts` | ~200 | Construtor de blocos de citação e JSON-LD |
| `og-visual-dictionary.ts` | ~100 | Regras visuais para OG images |
| `testimonial-prompt.ts` | ~80 | Prompt para depoimentos |
| `document-prompts.ts` | ~150 | Prompts especializados por tipo de documento |
| `extraction-rules.ts` | ~100 | Regras de extração PDF |

---

# PARTE 6 — FLUXOS DE LEADS (8 FLUXOS)

## 6.1 Fluxo 1: Formulário → CDP

```
[Formulário Web/Landing Page]
         │
         ▼
[smart-ops-ingest-lead] (430 LOC)
  │ 1. extractField() — mapeamento flexível
  │ 2. detectProductFromFormName() — detecção automática
  │ 3. normalizePhone() — +55XXXXXXXXXXX
  │ 4. smartMerge() — nunca sobrescrever dados existentes
  │ 5. Upsert em lia_attendances (onConflict: email)
  │ 6. sendLeadToSellFlux() — push V2
  └──► lia_attendances (1 registro criado/atualizado)
```

**Campos protegidos** (nunca sobrescritos): `nome, email, telefone_raw, source, entrada_sistema`
**Campos sempre atualizados**: `utm_source, utm_medium, utm_campaign, utm_term`

## 6.2 Fluxo 2: Meta Lead Ads → CDP

```
[Meta Lead Ads Form Submit]
         │
         ▼
[smart-ops-meta-lead-webhook] (206 LOC)
  │ 1. GET verification (hub.verify_token)
  │ 2. Parse entries[].changes[].value.leadgen_id
  │ 3. Fetch lead data via Meta Graph API
  │    GET /v21.0/{leadgen_id}?access_token=META_LEAD_ADS_TOKEN
  │ 4. Map field_data[] → nome, email, phone, city
  │ 5. Forward to smart-ops-ingest-lead
  └──► lia_attendances (source: "meta")
```

**Secret**: `META_LEAD_ADS_TOKEN`, `META_WEBHOOK_VERIFY_TOKEN`

## 6.3 Fluxo 3: SellFlux → CDP

```
[SellFlux Automação/Formulário]
         │
         ▼
[smart-ops-sellflux-webhook] (300 LOC)
  │ 1. Detect empty body (health check ping) → ignore
  │ 2. detectRealSource() — detecção dinâmica:
  │    - payload.tracking/transaction → "loja_integrada"
  │    - ecommerce tags → "loja_integrada"
  │    - automation_name → nome da automação
  │    - fallback → "sellflux_webhook"
  │ 3. Extract: email, nome, phone, cidade, uf
  │ 4. Extract custom fields: atual-id-pipe → piperun_id
  │ 5. Extract tracking/transaction (e-commerce via SellFlux)
  │ 6. migrateLegacyTags() — normaliza tags antigas
  │ 7. Upsert lia_attendances + sellflux_custom_fields
  └──► lia_attendances (source: dinâmico)
```

## 6.4 Fluxo 4: E-commerce (Loja Integrada) → CDP

```
[Loja Integrada Webhook / Polling]
         │
         ▼
[smart-ops-ecommerce-webhook] (905 LOC)
  │ 1. Auth: ?chave_api=X&chave_aplicacao=Y (query params, NOT headers)
  │ 2. Parse pedido: resource_uri → fetch client data
  │ 3. Map situação código → event type:
  │    pago → order_paid
  │    enviado → order_invoiced
  │    entregue → order_delivered
  │    boleto_impresso → boleto_generated
  │ 4. Resolve lead: loja_cliente_id → email → phone
  │ 5. Apply tags (EVENT_MAP → EC_PAGAMENTO_APROVADO, J04_COMPRA)
  │ 6. detectProductTags() → EC_PROD_RESINA, EC_PROD_INSUMO
  │ 7. Calculate recurrence: EC_CLIENTE_RECORRENTE / EC_CLIENTE_INATIVO
  │ 8. Log to lead_product_history + lead_cart_history
  │ 9. Idempotency via message_logs (1h window)
  └──► lia_attendances + lead_product_history + lead_cart_history
```

**Polling complementar**: `poll-loja-integrada-orders` (pg_cron every 30min)

## 6.5 Fluxo 5: PipeRun Bidirecional

```
               ┌─────────────────────────────────┐
               │        PipeRun CRM               │
               └────────┬──────────┬──────────────┘
                        │          ▲
        Pull (sync)     │          │  Push (assign/move)
                        ▼          │
┌───────────────────────────────────────────────────┐
│                smart-ops-sync-piperun (291 LOC)    │
│  1. Fetch deals por pipeline (11 funis)            │
│  2. Resolução person-centric:                      │
│     pessoa_piperun_id → email → phone → company   │
│  3. mapDealToAttendance() — field mapping          │
│  4. Append deal snapshot to piperun_deals_history  │
│  5. Dedup por proposal_id (previne somas infladas) │
│  6. Trigger fn_recalc_ltv_from_deals()             │
│  7. Trigger sync_ltv_from_oportunidade()           │
└─────────────────────────┬─────────────────────────┘
                          │
            ┌─────────────▼──────────────┐
            │ smart-ops-kanban-move       │
            │ 1. Update etapa_crm local  │
            │ 2. moveDealToStage()       │
            │    → PipeRun PUT deal      │
            └────────────────────────────┘
```

**11 Pipelines sincronizados**:
1. Vendas (18784) — 7 etapas
2. Estagnados (72938) — 10 etapas
3. CS Onboarding (83896)
4. Insumos (100412)
5. E-commerce (102702)
6. Atos (73999)
7. Exportação (39047)
8. Distribuidor Leads (70898)
9. Interesse Cursos (93303)
10. E-book (82128)
11. Tulip-Teste (83813)

## 6.6 Fluxo 6: Stagnation Processor

```
[pg_cron every 6h]
         │
         ▼
[smart-ops-stagnant-processor] (345 LOC)
  │ 1. Fetch leads where lead_status LIKE 'est%'
  │ 2. Para cada lead:
  │    a. Check PROGRESSION (est_etapa1 → est_etapa2 → ... → estagnado_final)
  │    b. Check elapsed time (> 5 days → advance)
  │    c. Load cs_automation_rules for matching
  │    d. If rule has waleads: send via WaLeads
  │    e. If rule has SellFlux: send via campaign webhook
  │    f. Apply stagnation tags (A_ESTAGNADO_3D, 7D, 15D)
  │    g. AI decision (DeepSeek/Gemini) for personalization
  │ 3. Sync stage in PipeRun (moveDealToStage)
  └──► lia_attendances (lead_status updated) + message_logs
```

## 6.7 Fluxo 7: Proactive Outreach

```
[pg_cron every 12h]
         │
         ▼
[smart-ops-proactive-outreach] (280 LOC)
  │ 4 regras de outreach:
  │ 1. Acompanhamento: proposta enviada > 7d → mensagem follow-up
  │ 2. Reengajamento: lead quente sem atividade > 5d → reengajar
  │ 3. Primeira dúvida: lead novo com 1-2 msgs e inativo > 3d
  │ 4. Recuperação: lead com proposta perdida < 30d → tentativa
  │
  │ Cooldown: proactive_count < 3 e proactive_sent_at > 5 days
  │ Delivery: SellFlux campaign webhook + WaLeads fallback
  └──► lia_attendances (proactive_sent_at, proactive_count++)
```

## 6.8 Fluxo 8: WhatsApp Intent Classification

```
[wa-inbox-webhook receives message]
         │
         ▼
[smart-ops-wa-inbox-webhook]
  │ 1. Parse incoming WhatsApp message
  │ 2. Match to lead via phone number
  │ 3. Store in whatsapp_inbox table
  │ 4. Update lia_attendances.ultima_sessao_at
  └──► whatsapp_inbox + lia_attendances
```

---

# PARTE 7 — FLUXOS DE CONTEÚDO (7 FLUXOS)

## 7.1 Extração (PDF/Vídeo/Drive)

### PDF Pipeline
```
[Upload PDF] → extract-pdf-text (raw) → extract-pdf-specialized (Gemini)
                                       → ai-enrich-pdf-content (Gemini)
                                       → catalog_documents.extracted_text
```

### Video Pipeline
```
[PandaVideo] → sync-pandavideo (folders + videos)
             → extract-video-content (transcript)
             → knowledge_videos.video_transcript
```

### Google Drive Pipeline
```
[Google Drive Folder] → sync-google-drive-kb
                      → Parse docs/sheets
                      → company_kb_texts
                      → index-embeddings
```

## 7.2 Orquestração (Gemini 2.5 Flash)

```
[ai-orchestrate-content] (1238 LOC)
  │
  │ Inputs:
  │  - rawText, pdfTranscription, videoTranscription
  │  - relatedPdfs[], selectedResinIds[], selectedProductIds[]
  │  - contentType: depoimentos/tecnico/educacional/passo_a_passo/cases
  │  - documentType: perfil_tecnico/fds/ifu/laudo/catalogo
  │
  │ Processing:
  │  1. Load SYSTEM_SUPER_PROMPT (anti-hallucination rules)
  │  2. Load specialized prompt (DOCUMENT_PROMPTS / TESTIMONIAL_PROMPT)
  │  3. Enrich with external_links (approved keywords/CTAs)
  │  4. Generate via Gemini: HTML + FAQs + metadata
  │  5. matchEntities() → inject entity graph (Wikidata-linked)
  │  6. buildCitationBlock() + buildGeoContextBlock()
  │
  │ Output:
  │  - html: Semantic HTML com H2/H3 structure
  │  - faqs: Array<{question, answer}>
  │  - metadata: educationalLevel, learningResourceType, aiContext
  │  - schemas: {howTo: bool, faqPage: bool}
  │  - veredictData: Smart Dent product verdict
  └──► knowledge_contents (HTML + metadata)
```

## 7.3 Pós-processamento (6 etapas)

```
Step 1: ai-content-formatter → Limpeza HTML, formatação semântica
Step 2: auto-inject-product-cards → Inline product cards em menções
Step 3: enrich-article-seo → Keywords, meta description, ai_context
Step 4: ai-generate-og-image → Banner Open Graph via IA
Step 5: link-videos-to-articles → Associar vídeos PandaVideo
Step 6: ai-metadata-generator → JSON-LD, Schema.org, educationalLevel
```

## 7.4 Tradução (PT → EN/ES)

```
[translate-content] (~400 LOC)
  │ 1. Fetch article (title, excerpt, content_html, faqs, keywords)
  │ 2. Translate via Gemini (batch: title + excerpt + content)
  │ 3. Translate FAQs individually
  │ 4. Save to: title_en/title_es, excerpt_en/es, content_html_en/es
  │ 5. Generate translated slug (slug_en, slug_es)
  └──► knowledge_contents (multi-language fields)
```

## 7.5 SEO Exposure (SSR + Sitemaps)

```
[seo-proxy] (2004 LOC)
  │ 8 geradores SSR:
  │  1. Homepage
  │  2. Brand page (/rayshape, /elegoo, etc.)
  │  3. Model page (/rayshape/d200)
  │  4. Resin page (/rayshape/d200/smart-print-bio)
  │  5. Catalog/Product page (/produtos/smart-print-bio)
  │  6. Knowledge Hub listing
  │  7. Category listing (/base-conhecimento/c)
  │  8. Article detail (/base-conhecimento/c/artigo-slug)
  │
  │ For each:
  │  - Full <head> with meta, OG, Twitter, hreflang, canonical
  │  - Semantic <body> with H1, hero image, AI summary
  │  - JSON-LD @graph (17+ schema types)
  │  - Entity index (Wikidata-linked terms)
  │  - llm-knowledge-layer class for AI crawlers
  └──► HTML response to bots

[5 Sitemaps]:
  1. generate-sitemap (produtos, resinas, parâmetros)
  2. generate-knowledge-sitemap (PT)
  3. generate-knowledge-sitemap-en (EN)
  4. generate-knowledge-sitemap-es (ES)
  5. generate-documents-sitemap (PDFs, IFUs)

[Feeds]:
  - knowledge-feed?format=rss
  - knowledge-feed?format=atom
  - knowledge-feed?format=json
```

## 7.6 Knowledge Gap Healing

```
[heal-knowledge-gaps] (Gemini + DeepSeek consensus)
  │ 1. Scan agent_knowledge_gaps (status: pending)
  │ 2. Group by tema/frequency
  │ 3. Dual-model evaluation:
  │    - Gemini: score + priority
  │    - DeepSeek: score + priority
  │    - Consensus by average
  │ 4. High-priority gaps → content_requests (auto-create)
  │ 5. Medium → queue for human review
  └──► agent_knowledge_gaps (status updated) + content_requests
```

---

# PARTE 8 — FLUXOS DE ATENDIMENTO DRA. L.I.A.

## 8.1 Arquitetura Modular

```
┌───────────────────────────────────────────────────────────────┐
│                  dra-lia/index.ts (4043 LOC)                  │
│                      ORQUESTRADOR                             │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  1. Rate Limiter (rate-limiter.ts)                           │
│  2. Session Management (agent_sessions)                       │
│  3. Guards Pipeline:                                         │
│     ├─ isGreeting() → saudação contextual                    │
│     ├─ isSupportQuestion() → SUPPORT_FALLBACK + handoff      │
│     ├─ isProblemReport() → technical support routing          │
│     ├─ isProtocolQuestion() → processing protocol search     │
│     └─ isMetaArticleQuery() → article search                │
│  4. Escalation Detection (lia-escalation.ts):                │
│     ├─ vendedor → WhatsApp comercial                         │
│     ├─ cs_suporte → WhatsApp suporte técnico                 │
│     └─ especialista → 3+ unanswered → human handoff          │
│  5. Printer Dialog (lia-printer-dialog.ts):                  │
│     ├─ needs_brand → list brands                             │
│     ├─ needs_model → list models for brand                   │
│     ├─ needs_resin → list resins for model                   │
│     └─ has_resin → show parameters                           │
│  6. RAG Pipeline (lia-rag.ts):                               │
│     ├─ Vector search (match_agent_embeddings_v2)             │
│     ├─ FTS (plainto_tsquery)                                 │
│     ├─ ILIKE search (knowledge_contents)                     │
│     ├─ Company KB search (company_kb_texts)                  │
│     ├─ Catalog search (system_a_catalog)                     │
│     ├─ Parameter search (parameter_sets)                     │
│     ├─ Processing instructions (resins)                      │
│     └─ Topic weight re-ranking (4 contexts)                  │
│  7. SDR Commercial (lia-sdr.ts):                             │
│     ├─ Lead Archetype Detection                              │
│     ├─ SPIN Selling Stages (etapa_1 → etapa_5)              │
│     ├─ Maturity Classification (MQL→CLIENTE)                 │
│     └─ Anti-repetition guards                                │
│  8. Lead Extraction (lia-lead-extraction.ts):                │
│     ├─ UF detection (27 estados)                             │
│     ├─ Equipment detection (impressora/scanner)              │
│     ├─ Model detection (13 marcas)                           │
│     ├─ CAD software (9 softwares)                            │
│     ├─ Volume mensal                                         │
│     ├─ Aplicação principal (11 categorias)                   │
│     └─ Competitor mentions                                   │
│  9. Image Recognition Pipeline:                              │
│     ├─ Base64 extraction from multimodal messages            │
│     ├─ Image embedding via Gemini                            │
│     ├─ Cache in image_embedding_cache                        │
│     └─ Vector similarity search                              │
│ 10. Response Generation:                                     │
│     ├─ Gemini 3 Flash Preview (via Lovable AI Gateway)       │
│     ├─ Context injection (RAG results + company context)     │
│     ├─ History management (last 20 messages)                 │
│     └─ Session entity extraction + lead update               │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

## 8.2 Canais de Atendimento

| Canal | Endpoint | Autenticação | Particularidades |
|---|---|---|---|
| **Web Widget** | `dra-lia` | Session-based | Multimodal (imagens), floating widget |
| **WhatsApp** | `dra-lia-whatsapp` | Webhook token | Texto only, integra com WaLeads |
| **Embed** | `/embed/dra-lia` | None | iFrame para sites externos |

## 8.3 Topic Weight Re-Ranking

```typescript
TOPIC_WEIGHTS = {
  parameters: { parameter_set: 1.5, resin: 1.3, catalog_product: 0.5 },
  products:   { catalog_product: 1.4, article: 1.3, resin: 1.4 },
  commercial: { catalog_product: 1.8, company_kb: 1.5, article: 1.2 },
  support:    { article: 1.3, video: 1.2, faq_autoheal: 1.2 },
}
```

## 8.4 Anti-Alucinação (System Prompt)

O `SYSTEM_SUPER_PROMPT` (251 LOC) define 6 regras absolutas:
1. **FONTE DA VERDADE**: Conteúdo fornecido é a ÚNICA fonte
2. **TRANSCRIÇÃO LITERAL**: "147 MPa" NÃO pode virar "~150 MPa"
3. **PROIBIDO INVENTAR**: Produtos, marcas, especificações, estudos, CTAs
4. **ILEGIBILIDADE**: Marcar como `[ilegível]` ou `[incompleto no original]`
5. **DADOS TÉCNICOS**: Valores EXATOS sempre
6. **LINKS E CTAs**: APENAS links fornecidos explicitamente

---

# PARTE 9 — MOTOR COGNITIVO E INTELLIGENCE SCORE

## 9.1 Análise Cognitiva Individual

```
[cognitive-lead-analysis] (481 LOC)
  │
  │ Input: lead_id (UUID)
  │
  │ 1. Fetch lead data (lia_attendances) — full row
  │ 2. Build longitudinal context:
  │    ├─ historico_resumos (last 10 sessions)
  │    ├─ PipeRun context (pipeline, stage, proposals)
  │    ├─ PipeRun deal notes (via API)
  │    ├─ Astron courses (access + completion)
  │    ├─ E-commerce (pedidos, LTV)
  │    └─ Stage evolution tracking
  │ 3. Hash dedup: SHA-256(context) → skip if unchanged
  │ 4. DeepSeek v3 analysis:
  │    ├─ Narrative (3 paragraphs — WHO, BEHAVIOR, RECOMMENDATION)
  │    ├─ Stage classification: MQL/PQL/SAL/SQL/CLIENTE
  │    ├─ Urgency: alta/media/baixa
  │    ├─ Timeline: imediato/3_6_meses/6_12_meses/indefinido
  │    ├─ Key points (5 items)
  │    └─ Recommended actions (3-5 items with priority)
  │ 5. Regression guard: cannot regress from SQL→MQL
  │ 6. Insert note in PipeRun deal (addDealNote)
  │ 7. Update lia_attendances.cognitive_analysis
  │ 8. Log to ai_token_usage
  └──► lia_attendances (cognitive_* fields updated)
```

## 9.2 Batch Processing

```
[batch-cognitive-analysis] (131 LOC)
  │
  │ 1. Query eligible leads:
  │    ├─ total_messages >= 5
  │    ├─ cognitive_analyzed_at IS NULL (never analyzed)
  │    └─ OR ultima_sessao_at > cognitive_analyzed_at (stale)
  │ 2. Sort by intelligence_score_total DESC
  │ 3. For each lead: call cognitive-lead-analysis
  │ 4. Sequential (not parallel) to avoid rate limits
  │ 5. Batch size: configurable (default 20, max 50)
  └──► Processed count + error count
```

## 9.3 Intelligence Score (4 Eixos)

### Fórmula

```
Intelligence Score = (Heat × 0.35) + (Power × 0.25) + (Fit × 0.25) + (Momentum × 0.15)
```

### Eixo 1: Heat (Calor — Engajamento Recente) — 35%

| Fator | Pontuação |
|---|---|
| Mensagens nos últimos 7 dias | 0-25 |
| Sessões ativas nos últimos 30 dias | 0-25 |
| Formulários submetidos | 0-15 |
| Interações SDR | 0-15 |
| Abertura de e-mails (SellFlux) | 0-20 |

### Eixo 2: Power (Poder Financeiro) — 25%

| Fator | Pontuação |
|---|---|
| LTV total | 0-30 |
| Valor da oportunidade aberta | 0-25 |
| Total de deals | 0-15 |
| Pedidos e-commerce | 0-15 |
| Ticket médio | 0-15 |

### Eixo 3: Fit (Adequação ao ICP) — 25%

| Fator | Pontuação |
|---|---|
| Equipamentos ativos | 0-20 |
| Workflow score (0-10) | 0-20 |
| Especialidade dental | 0-15 |
| Volume mensal | 0-15 |
| Cursos Academy completados | 0-15 |
| Área de atuação | 0-15 |

### Eixo 4: Momentum (Velocidade de Progressão) — 15%

| Fator | Pontuação |
|---|---|
| Progressão de etapa CRM | 0-30 |
| Cognitive stage advancement | 0-25 |
| Redução de days_in_stage | 0-25 |
| Proactive response rate | 0-20 |

### Triggers

```sql
-- RPC chamada pelo trigger e pelo backfill
FUNCTION calculate_lead_intelligence_score(p_lead_id UUID)

-- Backfill de scores NULL
[backfill-intelligence-score] → batch 500, loops until none left
```

---

# PARTE 10 — COPILOT IA (DUAL BRAIN, 19+ TOOLS)

## 10.1 Arquitetura

```
[SmartOpsCopilot.tsx] (453 LOC — Frontend)
  │ - Toggle DeepSeek / Gemini
  │ - Voice input (SpeechRecognition)
  │ - CSV upload
  │ - Realtime: Supabase channel "copilot-new-leads"
  │ - SSE streaming
  │ - Chat history in localStorage
  │
  ▼
[smart-ops-copilot] (1523 LOC — Backend)
  │
  │ Model Config:
  │ - deepseek: api.deepseek.com/chat/completions (deepseek-chat)
  │ - gemini: ai.gateway.lovable.dev (google/gemini-3-flash-preview)
  │
  │ System Prompt: "Regra Absoluta: Nunca Pergunte, Sempre Execute"
  │ - Execução autônoma sem confirmações
  │ - Limite de 10 iterações por consulta
  │ - Fallback de resumo automático
  │
  │ 19+ Tool Calling Functions:
  └──► (vide tabela abaixo)
```

## 10.2 Inventário de 19+ Tools

| # | Tool | Descrição | Tabelas Afetadas |
|---|---|---|---|
| 1 | `query_leads` | Busca leads por filtro | lia_attendances |
| 2 | `update_lead` | Atualiza campos (safeFields) | lia_attendances |
| 3 | `add_tags` | Adiciona tags_crm (append) | lia_attendances |
| 4 | `create_audience` | Cria público/segmento | lia_attendances |
| 5 | `send_whatsapp` | Envia msg via WaLeads | team_members, message_logs |
| 6 | `notify_seller` | Notifica vendedor | team_members |
| 7 | `search_videos` | Busca vídeos (FTS) | knowledge_videos |
| 8 | `search_content` | Busca artigos | knowledge_contents |
| 9 | `query_table` | Consulta genérica | (qualquer tabela) |
| 10 | `describe_table` | Schema da tabela | information_schema |
| 11 | `query_stats` | Métricas agregadas | lia_attendances |
| 12 | `check_missing_fields` | Auditoria de campos | lia_attendances |
| 13 | `send_to_sellflux` | Push para SellFlux | lia_attendances |
| 14 | `call_loja_integrada` | Query API Loja | (API externa) |
| 15 | `unify_leads` | Merge duplicatas | lia_attendances |
| 16 | `ingest_knowledge` | Inject no RAG | company_kb_texts |
| 17 | `create_article` | Cria artigo via IA | knowledge_contents |
| 18 | `import_csv` | Importa leads CSV | lia_attendances |
| 19 | `calculate` | Cálculos (ROI, LTV, churn) | — |
| 20 | `query_leads_advanced` | Busca avançada (JSONB, arrays) | lia_attendances |
| 21 | `bulk_campaign` | Campanha em lote | lia_attendances, message_logs |
| 22 | `move_crm_stage` | Move etapa CRM | lia_attendances, PipeRun API |
| 23 | `query_ecommerce_orders` | Consulta e-commerce | lia_attendances |
| 24 | `verify_consolidation` | Auditoria de dados | lia_attendances |

## 10.3 Campos Protegidos (update_lead)

```typescript
const safeFields = [
  "etapa_crm", "notas_sdr", "tags_crm", "urgency_level", "interest_timeline",
  "como_digitaliza", "especialidade", "cidade", "area_atuacao",
  "tem_impressora", "tem_scanner", "software_cad", "volume_mensal_pecas",
  "informacao_desejada", "comentario_perda", "cs_treinamento",
  "proprietario_lead_crm", "funil_entrada_crm"
];
```

---

# PARTE 11 — LEAD INTELLIGENCE CARD v2 (6 ABAS)

## 11.1 Componente: `LeadDetailPanel.tsx` (~1022 LOC)

### Design System
- **Theme**: Dark mode (`.intel-dark`)
- **Fonts**: Syne (títulos), DM Sans (corpo), DM Mono (dados)
- **Cards**: `bg-[#1a1a2e]` com bordas `border-[#2a2a4a]`

### Fetch Unificado
```typescript
fetch(`${SUPABASE_URL}/functions/v1/smart-ops-leads-api?action=detail&id=${leadId}`)
```

### 6 Abas

| # | Aba | Conteúdo |
|---|---|---|
| 1 | **Histórico Completo** | Timeline unificada (10 fontes), tabela de deals expandida com propostas/itens, seção Academy com cursos, seção E-commerce com pedidos |
| 2 | **Análise Cognitiva IA** | Narrativa live (3 parágrafos), grid de perfil (estágio, urgência, timeline), key points, ações recomendadas |
| 3 | **Upsell & Previsão** | Cards preditivos de cross-sell baseados em ativos vs gaps |
| 4 | **Fluxo Digital** | WorkflowPortfolio (7 estágios visuais) |
| 5 | **LIS Breakdown** | Intelligence Score ring SVG, 4 eixos detalhados |
| 6 | **Ações Recomendadas** | Scripts de abordagem personalizados |

### Timeline Unificada (10 fontes)

```
1. lead_activity_log (eventos genéricos)
2. lead_form_submissions (formulários com keyword detection)
3. lead_course_progress (Astron Academy)
4. lead_product_history (e-commerce)
5. lead_cart_history (carrinhos abandonados)
6. lead_sdr_interactions (SDR contacts)
7. lead_state_events (transições CRM)
8. message_logs (SellFlux messages)
9. agent_interactions (Dra. LIA)
10. whatsapp_inbox (WA messages)
```

---

# PARTE 12 — WORKFLOW PORTFOLIO (7 ESTÁGIOS)

## 12.1 Modelo de Estágios

| # | Estágio | Campo Interesse (SDR) | Campo Ativo | Status Field |
|---|---|---|---|---|
| 1 | Captura Digital | `sdr_scanner_interesse` | `ativo_scan` / `equip_scanner` | `status_scanner` |
| 2 | Planejamento CAD | `sdr_software_cad_interesse` | `ativo_cad` | `status_cad` |
| 3 | Impressão 3D | `sdr_impressora_interesse` | `ativo_print` | `status_impressora` |
| 4 | Pós-Impressão | `sdr_pos_impressao_interesse` | `ativo_cura` / `equip_pos_impressao` | `status_pos_impressao` |
| 5 | Insumos | — | — | `status_insumos` |
| 6 | Educação | `sdr_cursos_interesse` | `astron_courses_completed` | — |
| 7 | Dentística Digital | `sdr_dentistica_interesse` | — | — |

## 12.2 Workflow Score (0-10)

```sql
fn_calc_workflow_score(p_lead_id UUID):
  E1: scanner (0-2) — tem_smartdent=2, bancada/concorrente=1, else=0
  E2: CAD (0-2) — completo=2, tem_exocad=1
  E3: impressão (0-2) — completo=2, tem_com_resina_sd/concorrente/terceiriza=1
  E4: pós-impressão (0-2) — completo=2, tem_cura=1
  E5: insumos (0-2) — ativo=2, interesse=1
```

## 12.3 Gap Analysis

O componente `WorkflowPortfolio.tsx` identifica:
- **Interesse sem ativo**: Oportunidade de venda
- **Ativo sem interesse complementar**: Oportunidade de cross-sell
- **Score < 6**: Fluxo incompleto → nurturing

---

# PARTE 13 — INTEGRAÇÕES EXTERNAS (9 SISTEMAS)

## 13.1 Mapa de Integrações

| # | Sistema | Tipo | Secrets | Edge Functions | Direção |
|---|---|---|---|---|---|
| 1 | **PipeRun CRM** | REST API | PIPERUN_API_KEY | sync-piperun, kanban-move, piperun-webhook, full-sync | Bidirecional |
| 2 | **SellFlux** | Webhooks | SELLFLUX_WEBHOOK_LEADS, SELLFLUX_WEBHOOK_CAMPANHAS | sellflux-webhook, sellflux-sync | Bidirecional |
| 3 | **Loja Integrada** | REST + Webhooks | LOJA_INTEGRADA_API_KEY, LOJA_INTEGRADA_APP_KEY | ecommerce-webhook, poll-loja-integrada-orders, import-loja-integrada | Pull + Push |
| 4 | **Meta Ads** | Graph API + Webhooks | META_LEAD_ADS_TOKEN, META_ADS_MANAGER_TOKEN, META_ADS_INSIGHTS_TOKEN, META_WEBHOOK_VERIFY_TOKEN | meta-lead-webhook, meta-ads-manager, meta-ads-insights | Pull |
| 5 | **Astron Members** | REST + Webhooks | ASTRON_AM_KEY, ASTRON_AM_SECRET, ASTRON_CLUB_ID, ASTRON_POSTBACK_TOKEN | astron-postback, sync-astron-members, astron-member-lookup | Bidirecional |
| 6 | **WaLeads** | REST API | (via team_members.waleads_api_key) | smart-ops-send-waleads, wa-inbox-webhook | Push |
| 7 | **PandaVideo** | REST API | PANDAVIDEO_API_KEY | sync-pandavideo, sync-video-analytics, pandavideo-test | Pull |
| 8 | **Google APIs** | REST APIs | GOOGLE_PLACES_API_KEY, GOOGLE_DRIVE_API_KEY, GOOGLE_AI_KEY | sync-google-reviews, sync-google-drive-kb | Pull |
| 9 | **DeepSeek AI** | REST API | DEEPSEEK_API_KEY | cognitive-lead-analysis, stagnant-processor, copilot, evaluate-interaction | Push |

## 13.2 PipeRun Field Mapping Detalhado

### 11 Pipelines

```typescript
PIPELINES = {
  VENDAS: 18784,       ATOS: 73999,         EXPORTACAO: 39047,
  DISTRIBUIDOR: 70898,  ESTAGNADOS: 72938,   EBOOK: 82128,
  TULIP_TESTE: 83813,  CS_ONBOARDING: 83896, INTERESSE_CURSOS: 93303,
  INSUMOS: 100412,     ECOMMERCE: 102702,
}
```

### Stages Vendas (7)
```
Sem Contato → Contato Feito → Em Contato → Apresentação/Visita
→ Proposta Enviada → Negociação → Fechamento
```

### Stages Estagnados (10)
```
Etapa 00 Novos → Etapa 01 → Etapa 02 → Etapa 03 → Etapa 04
→ Apresentação/Visita → Proposta → Fechamento → Auxiliar → Get New Owner
```

## 13.3 SellFlux Tag System (85+ tags)

```typescript
TAG_PREFIXES = {
  JOURNEY: "J",          // J01_CONSCIENCIA → J06_APOIO
  ECOMMERCE: "EC_",      // EC_VISITOU_LOJA, EC_PAGAMENTO_APROVADO
  QUALIFICATION: "Q_",   // Q_TEM_IMPRESSORA, Q_TEM_SCANNER
  COMMERCIAL: "C_",      // C_PROPOSTA_ENVIADA, C_NEGOCIACAO_ATIVA
  CS: "CS_",             // CS_ONBOARDING, CS_TREINAMENTO
  LIA: "LIA_",           // LIA_LEAD_NOVO, LIA_ATENDEU
  ALERT: "A_",           // A_ESTAGNADO_3D, A_RISCO_CHURN
}
```

### Journey → Stage Mapping

```
novo/sem_contato   → J01_CONSCIENCIA
contato_feito      → J02_CONSIDERACAO + C_PRIMEIRO_CONTATO
proposta_enviada   → J03_NEGOCIACAO + C_PROPOSTA_ENVIADA
ganho              → J04_COMPRA + C_VENDA_REALIZADA
cs_onboarding      → J05_RETENCAO + CS_ONBOARDING
```

## 13.4 Loja Integrada Specifics

- **Auth**: Query params ONLY (`?chave_api=X&chave_aplicacao=Y`)
- **Client resolution**: `resource_uri` → fetch → email → match lead
- **Status mapping**: `codigo` string (not numeric ID) for reliability
- **Idempotency**: `message_logs` table, 1-hour window per order number
- **Historical enrichment**: Full order history fetch for LTV calculation
- **Product tagging**: Auto-detect EC_PROD_RESINA, EC_PROD_INSUMO, EC_PROD_KIT_CARAC

---

# PARTE 14 — QUALIDADE HTML & REGRAS ANTI-ALUCINAÇÃO

## 14.1 SYSTEM_SUPER_PROMPT (251 LOC)

### Pilares

1. **Identidade Editorial**: Tom profissional, didático, sem exageros
2. **E-E-A-T (Google)**: Experience, Expertise, Authority, Trustworthiness
3. **Coerência Cross-Function**: Consistência entre todas as funções IA
4. **Citação**: Apenas links de `external_links` aprovados
5. **Dados Técnicos**: Valores literais (147 MPa, não ~150 MPa)

### Aplicação

| Função | Usa SYSTEM_SUPER_PROMPT | Prompt Adicional |
|---|---|---|
| `ai-orchestrate-content` | ✅ | TESTIMONIAL_PROMPT, DOCUMENT_PROMPTS |
| `ai-content-formatter` | ✅ | — |
| `ai-metadata-generator` | ✅ | Schema.org rules |
| `enrich-article-seo` | ✅ | SEO guidelines |
| `dra-lia` | ✅ (via system_prompt.ts) | LIA persona + SDR |

## 14.2 Regras Anti-Alucinação

```
1. FONTE DA VERDADE: Conteúdo fornecido é a ÚNICA fonte
2. TRANSCRIÇÃO LITERAL: Preservar EXATAMENTE
3. PROIBIDO INVENTAR: Produtos, marcas, especificações, estudos, CTAs
4. ILEGIBILIDADE: [ilegível] ou [incompleto no original]
5. DADOS TÉCNICOS: Valores EXATOS (147 MPa, 59% wt, 23°C)
6. LINKS E CTAs: APENAS links fornecidos explicitamente
```

---

# PARTE 15 — SEO E-E-A-T / GEO / IA-READY COMPLIANCE

## 15.1 seo-proxy (2004 LOC)

### User-Agent Detection (40+)

```typescript
AI_BOTS = ['gptbot', 'chatgpt-user', 'perplexitybot', 'claudebot',
           'anthropic', 'bytespider', 'ccbot', 'cohere-ai', 'google-extended'];

SEARCH_BOTS = ['googlebot', 'bingbot', 'duckduckbot', 'slurp',
               'baiduspider', 'yandex', 'applebot', 'semrushbot', 'ahrefsbot'];

SOCIAL_BOTS = ['facebookexternalhit', 'twitterbot', 'linkedinbot',
               'whatsapp', 'telegrambot'];
```

### 8 SSR Generators

| Generator | Rota | Schema.org Types |
|---|---|---|
| Homepage | `/` | WebSite, Organization, ItemList |
| Brand | `/:brandSlug` | Brand, ItemList |
| Model | `/:brandSlug/:modelSlug` | Product, ItemList |
| Resin | `/:brandSlug/:modelSlug/:resinSlug` | Product, HowTo |
| Product | `/produtos/:slug` | Product, Offer, Review, DigitalDocument |
| Hub | `/base-conhecimento` | CollectionPage, ItemList |
| Category | `/base-conhecimento/:letter` | CollectionPage, BreadcrumbList |
| Article | `/base-conhecimento/:letter/:slug` | TechArticle, MedicalWebPage, FAQPage, VideoObject |

### AI-Ready Features

```html
<!-- Meta tag for AI crawlers -->
<meta name="ai-content-policy" content="allow-training, allow-indexing">

<!-- LLM Knowledge Layer -->
<section class="llm-knowledge-layer" aria-hidden="true">
  <p>AI Summary: [generated context]</p>
</section>

<!-- Entity Index (JSON-LD @graph) -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "DefinedTerm", "name": "Impressão 3D", "sameAs": "https://www.wikidata.org/wiki/Q229367" },
    ...
  ]
}
</script>
```

## 15.2 JSON-LD Schemas (17+)

| Schema | Onde |
|---|---|
| Organization | Homepage |
| WebSite + SearchAction | Homepage |
| BreadcrumbList | Todas as páginas |
| Product + Offer | Produtos, Resinas |
| Review + AggregateRating | Depoimentos |
| TechArticle | Artigos técnicos |
| MedicalWebPage | Artigos médicos |
| ScholarlyArticle | Artigos científicos |
| HowTo + HowToStep | Artigos passo-a-passo |
| FAQPage + Question/Answer | FAQs |
| VideoObject | Vídeos com transcrição |
| DigitalDocument | PDFs (IFU, SDS, TDS) |
| Person (Author) | E-E-A-T autores |
| ItemList | Listagens |
| CollectionPage | Categorias |
| DefinedTerm | Entity index (Wikidata) |
| Brand | Marcas |

## 15.3 Author E-E-A-T

```
Tabela: authors
├─ name, specialty, mini_bio, full_bio
├─ photo_url, photo_alt
├─ lattes_url (CNPq/Lattes academic CV)
├─ linkedin_url, instagram_url, youtube_url
├─ facebook_url, twitter_url, tiktok_url
└─ website_url

→ JSON-LD Person schema com:
  - @type: Person
  - jobTitle: specialty
  - sameAs: [lattes, linkedin, ...]
  - affiliation: Smart Dent
  - alumniOf: (from full_bio)
```

## 15.4 hreflang Implementation

```html
<link rel="alternate" hreflang="pt-BR" href="https://parametros.smartdent.com.br/base-conhecimento/c/slug" />
<link rel="alternate" hreflang="en" href="https://parametros.smartdent.com.br/en/knowledge-base/c/slug-en" />
<link rel="alternate" hreflang="es" href="https://parametros.smartdent.com.br/es/base-conocimiento/c/slug-es" />
<link rel="alternate" hreflang="x-default" href="https://parametros.smartdent.com.br/base-conhecimento/c/slug" />
```

## 15.5 llms.txt

```
public/llms.txt — 46 linhas
├─ Company identity
├─ Content types (5)
├─ Structured data description
├─ API endpoints (4)
├─ Key topics (5)
├─ Citation guidelines (4 rules)
└─ Contact info
```

## 15.6 robots.txt & Sitemaps

```
robots.txt:
├─ Allow: / (all bots)
├─ Sitemap: /api/generate-sitemap
├─ Sitemap: /api/generate-knowledge-sitemap
├─ Sitemap: /api/generate-knowledge-sitemap-en
├─ Sitemap: /api/generate-knowledge-sitemap-es
└─ Sitemap: /api/generate-documents-sitemap
```

---

# PARTE 16 — UX/UI ARCHITECTURE

## 16.1 Rotas Públicas (15+)

| Rota | Componente | Descrição |
|---|---|---|
| `/` | Index | Homepage com grid de parâmetros |
| `/:brand` | Index | Filtro por marca |
| `/:brand/:model` | Index | Filtro por modelo |
| `/:brand/:model/:resin` | Index | Parâmetros específicos |
| `/base-conhecimento` | KnowledgeBase | Hub de conhecimento (PT) |
| `/base-conhecimento/:cat` | KnowledgeBase | Categoria |
| `/base-conhecimento/:cat/:slug` | KnowledgeBase | Artigo |
| `/en/knowledge-base/**` | KnowledgeBase (en) | Versão inglês |
| `/es/base-conocimiento/**` | KnowledgeBase (es) | Versão espanhol |
| `/produtos/:slug` | ProductPage | Página de produto |
| `/depoimentos/:slug` | TestimonialPage | Depoimento |
| `/sobre` | About | Sobre a empresa |
| `/docs/:filename` | DocumentProxyRoute | Proxy de documentos |
| `/embed/dra-lia` | AgentEmbed | Widget embed |
| `/f/:slug` | PublicFormPage | Formulários públicos |
| `/base-conhecimento/calculadora-roi` | ROICalculatorPage | Calculadora ROI |
| `/admin` | AdminViewSecure | Painel admin (auth required) |

## 16.2 SmartOps Sub-Tabs (14)

| # | Tab | Componente | Descrição |
|---|---|---|---|
| 1 | Bowtie | SmartOpsBowtie | Funil bowtie visual |
| 2 | Kanban/Leads | SmartOpsKanban + SmartOpsLeadsList | Kanban CRM + lista |
| 3 | Equipe | SmartOpsTeam | Gestão de membros |
| 4 | Automações | SmartOpsSellerAutomations | Regras CS + WaLeads |
| 5 | Logs | SmartOpsLogs | Logs do sistema |
| 6 | Relatórios | SmartOpsReports | Dashboards |
| 7 | Conteúdo | SmartOpsContentProduction | Pipeline editorial |
| 8 | Saúde | SmartOpsSystemHealth | Health check |
| 9 | WhatsApp | SmartOpsWhatsAppInbox | Inbox WA |
| 10 | Formulários | SmartOpsFormBuilder + SmartOpsFormEditor | Form builder |
| 11 | Tokens IA | SmartOpsAIUsageDashboard | Dashboard de custos IA |
| 12 | Intelligence | SmartOpsIntelligenceDashboard | Dashboard de scores |
| 13 | ROI | SmartOpsROICalculators + SmartOpsROICardsManager | Calculadoras ROI |
| 14 | Copilot | SmartOpsCopilot | Copilot IA (Dual Brain) |

## 16.3 Componente DraLIA (Widget Global)

```
- Floating widget em todas as páginas (exceto /admin e /embed)
- Multimodal: texto + imagens
- Voice input
- Session persistence (localStorage)
- Realtime lead notification
```

---

# PARTE 17 — BANCO DE DADOS

## 17.1 Tabelas (82 total)

### Tabelas de Domínio Principal (15)
| Tabela | Colunas | Descrição |
|---|---|---|
| `lia_attendances` | ~200 | CDP principal |
| `people` | ~15 | Identidade person-centric |
| `companies` | ~25 | Identidade jurídica |
| `person_company_relationship` | ~6 | Relação M:N |
| `identity_keys` | ~10 | Chaves de identidade |
| `deals` | ~30 | Deals PipeRun sincronizados |
| `deal_items` | ~20 | Itens de proposta |
| `interactions` | ~15 | Interações genéricas |
| `team_members` | ~15 | Equipe de vendas |
| `cs_automation_rules` | ~15 | Regras de automação CS |
| `support_cases` | ~10 | Casos de suporte |
| `technical_tickets` | ~10 | Tickets técnicos |
| `technical_ticket_messages` | ~6 | Mensagens de ticket |
| `whatsapp_inbox` | ~10 | Inbox WhatsApp |
| `message_logs` | ~10 | Logs de mensagens |

### Tabelas Comportamentais (6)
| Tabela | Descrição |
|---|---|
| `lead_activity_log` | Log de atividades genérico |
| `lead_product_history` | Histórico de produtos comprados |
| `lead_cart_history` | Histórico de carrinhos abandonados |
| `lead_course_progress` | Progresso em cursos Astron |
| `lead_form_submissions` | Submissões de formulários |
| `lead_sdr_interactions` | Interações SDR |

### Tabelas de Conteúdo (12)
| Tabela | Descrição |
|---|---|
| `knowledge_contents` | Artigos da base de conhecimento |
| `knowledge_categories` | Categorias (A-F) |
| `knowledge_videos` | Vídeos PandaVideo |
| `knowledge_video_metrics_log` | Métricas de visualização |
| `knowledge_gap_drafts` | Rascunhos de gaps |
| `content_requests` | Requisições de conteúdo |
| `external_links` | Links externos aprovados |
| `authors` | Autores com E-E-A-T |
| `company_kb_texts` | Textos da KB interna |
| `drive_kb_sync_log` | Log de sync Google Drive |
| `resin_documents` | Documentos de resinas |
| `resin_presentations` | Apresentações de resinas |

### Tabelas de Catálogo (8)
| Tabela | Descrição |
|---|---|
| `system_a_catalog` | Catálogo sincronizado do Sistema A |
| `products_catalog` | Catálogo de produtos local |
| `catalog_documents` | Documentos por produto (IFU, SDS, TDS) |
| `brands` | Marcas |
| `models` | Modelos de impressora |
| `parameter_sets` | Conjuntos de parâmetros |
| `resins` | Resinas |
| `product_taxonomy` | Taxonomia de produtos |

### Tabelas de IA (7)
| Tabela | Descrição |
|---|---|
| `agent_embeddings` | Embeddings vetoriais (768d/1536d) |
| `agent_interactions` | Interações Dra. LIA |
| `agent_sessions` | Sessões ativas |
| `agent_internal_lookups` | Cache de lookups |
| `agent_knowledge_gaps` | Lacunas de conhecimento |
| `ai_token_usage` | Uso de tokens IA |
| `intelligence_score_config` | Configuração de pesos do score |

### Tabelas de Oportunidade & Score (5)
| Tabela | Descrição |
|---|---|
| `lead_opportunities` | Motor de oportunidades |
| `lead_conversion_history` | Histórico de conversões |
| `lead_state_events` | Eventos de transição |
| `lead_model_routing` (view) | Roteamento de modelo IA |
| `upsell_predictions` | Previsões de upsell |

### Tabelas de Infraestrutura (10+)
| Tabela | Descrição |
|---|---|
| `system_health_logs` | Logs de saúde + rate limiting |
| `cron_state` | Estado de jobs cron |
| `backfill_log` | Log de backfills |
| `site_settings` | Configurações do site |
| `user_roles` | Roles (admin, author) |
| `piperun_staging` | Staging PipeRun |
| `piperun_pessoas_staging` | Staging pessoas PipeRun |
| `phone_dedup_log` | Log de dedup telefone |
| `image_embedding_cache` | Cache de embeddings de imagem |
| `text_embedding_cache` | Cache de embeddings de texto |
| `image_query_logs` | Logs de queries de imagem |

## 17.2 Views (14)

| View | Descrição |
|---|---|
| `lead_model_routing` | Roteamento de modelo IA por score |
| `v_leads_correto` | View corrigida de leads |
| `v_lead_commercial` | View comercial |
| `v_lead_ecommerce` | View e-commerce |
| `v_lead_cognitive` | View cognitiva |
| `v_lead_academy` | View Academy |
| `v_lead_timeline` | Timeline unificada |
| `v_customer_graph` | Grafo de clientes |
| `v_person_company_graph` | Grafo pessoa-empresa |
| `v_opportunity_engine` | Motor de oportunidades |
| `v_open_opportunities` | Oportunidades abertas |
| `v_timing_alerts` | Alertas de timing |
| `v_workflow_timeline` | Timeline de workflow |
| `v_behavioral_health` | Saúde comportamental |
| `v_phone_duplicates` | Duplicatas por telefone |

## 17.3 RPCs/Functions (19+ custom)

| Função | Descrição |
|---|---|
| `match_agent_embeddings` | Busca vetorial v1 (768d) |
| `match_agent_embeddings_v2` | Busca vetorial v2 (1536d) |
| `search_knowledge_base` | Busca full-text + similarity |
| `get_rag_stats` | Estatísticas do RAG |
| `increment_lookup_hit` | Incrementa cache hit |
| `fn_normalize_phone` | Normaliza telefone (trigger) |
| `fn_recalc_ltv_from_deals` | Recalcula LTV (trigger) |
| `fn_calc_workflow_score` | Calcula score workflow |
| `fn_trigger_workflow_score` | Trigger para workflow score |
| `fn_deduplicate_proposal_csv` | Dedup propostas CSV |
| `fn_search_leads_by_proposal_product` | Busca leads por produto |
| `fn_list_proposal_products` | Lista produtos de propostas |
| `fn_map_lead_source` | Mapeia fonte do lead |
| `fn_get_lead_context` | Contexto consolidado do lead |
| `fn_record_lead_event` | Registra evento do lead |
| `sync_ltv_from_oportunidade` | Sync LTV (trigger) |
| `sync_lia_to_people_graph` | Sync para people (trigger) |
| `normalize_name_for_compare` | Normaliza nome para comparação |
| `get_leads_for_opportunity_engine` | Leads para motor de oportunidades |
| `calculate_lead_intelligence_score` | Calcula Intelligence Score |

## 17.4 Triggers (6)

| Trigger | Tabela | Função |
|---|---|---|
| `normalize_phone_trigger` | lia_attendances | `fn_normalize_phone` |
| `recalc_ltv_trigger` | lia_attendances | `fn_recalc_ltv_from_deals` |
| `sync_ltv_trigger` | lia_attendances | `sync_ltv_from_oportunidade` |
| `workflow_score_trigger` | lia_attendances | `fn_trigger_workflow_score` |
| `evaluate_interaction_trigger` | agent_interactions | `trigger_evaluate_interaction` |
| `sync_people_graph_trigger` | lia_attendances | `sync_lia_to_people_graph` |
| `search_vector_trigger` | knowledge_videos | `update_knowledge_videos_search_vector` |
| `validate_support_case_trigger` | support_cases | `validate_support_case_status` |

---

# PARTE 18 — SECRETS, SEGURANÇA E MÉTRICAS

## 18.1 Secrets Configurados (20)

| Secret | Integração | Usado por |
|---|---|---|
| `DEEPSEEK_API_KEY` | DeepSeek AI | cognitive-lead-analysis, copilot, stagnant-processor, evaluate-interaction |
| `LOVABLE_API_KEY` | Lovable AI Gateway (Gemini) | dra-lia, copilot, orchestrate-content, metadata-generator, lia-assign, waleads-messaging, stagnant, heal-gaps |
| `GOOGLE_AI_KEY` | Google AI (Embeddings) | generate-embedding, index-embeddings, dra-lia (image) |
| `PIPERUN_API_KEY` | PipeRun CRM | sync-piperun, kanban-move, cognitive-analysis, full-sync, stagnant |
| `SELLFLUX_WEBHOOK_LEADS` | SellFlux | ingest-lead, sellflux-sync |
| `SELLFLUX_WEBHOOK_CAMPANHAS` | SellFlux Campanhas | stagnant-processor, proactive-outreach, copilot |
| `LOJA_INTEGRADA_API_KEY` | Loja Integrada | ecommerce-webhook, poll-orders, import |
| `LOJA_INTEGRADA_APP_KEY` | Loja Integrada | (idem) |
| `META_LEAD_ADS_TOKEN` | Meta Lead Ads | meta-lead-webhook |
| `META_ADS_MANAGER_TOKEN` | Meta Ads Manager | meta-ads-manager |
| `META_ADS_INSIGHTS_TOKEN` | Meta Ads Insights | meta-ads-insights |
| `META_WEBHOOK_VERIFY_TOKEN` | Meta Webhook Verify | meta-lead-webhook |
| `PANDAVIDEO_API_KEY` | PandaVideo | sync-pandavideo, sync-video-analytics |
| `GOOGLE_PLACES_API_KEY` | Google Places | sync-google-reviews |
| `GOOGLE_DRIVE_API_KEY` | Google Drive | sync-google-drive-kb |
| `ASTRON_AM_KEY` | Astron Members | sync-astron-members, member-lookup |
| `ASTRON_AM_SECRET` | Astron Members | (idem) |
| `ASTRON_CLUB_ID` | Astron Members | sync-astron-members |
| `ASTRON_POSTBACK_TOKEN` | Astron Webhooks | astron-postback |
| `MANYCHAT_API_KEY` | ManyChat | stagnant-processor |

## 18.2 Segurança

### RLS (Row Level Security)
- **user_roles**: RLS enabled com `has_panel_access()` e `is_author()` (SECURITY DEFINER)
- **Tabelas públicas**: RLS habilitado com policies para auth.uid()
- **Edge Functions**: 91+ com `verify_jwt=false` (autenticação interna via service_role)
- **4 funções** com `verify_jwt=true`: create-user, ai-metadata-generator, create-test-articles, heal-knowledge-gaps

### Input Validation
- **Rate Limiter**: `checkRateLimit()` em `rate-limiter.ts` (por IP/session, via system_health_logs)
- **Resilient Fetch**: `resilientFetch()` com retry exponencial + dead letter
- **Phone Normalization**: Trigger automático em lia_attendances
- **Email Normalization**: Lowercase/trim em todas as ingestões
- **Safe Fields**: Copilot só atualiza campos whitelisted

### Anti-Hallucination
- 6 regras absolutas no SYSTEM_SUPER_PROMPT
- Verificação de `external_links.approved = true` para CTAs
- Entity dictionary com Wikidata IDs para validação

## 18.3 Métricas do Sistema

### ai_token_usage
```
Campos: function_name, action_label, provider, model,
        prompt_tokens, completion_tokens, total_tokens,
        estimated_cost_usd, metadata
```

### system_health_logs
```
Campos: function_name, severity, error_type, details, created_at
Usado para: rate limiting, dead letter, health checks
```

### Dashboard: SmartOpsAIUsageDashboard
- Tokens por função
- Custo estimado por período
- Breakdown por provider (Gemini vs DeepSeek)

---

# APÊNDICE A — DELTA V4 → V5

| Aspecto | V4 (2026-03-14) | V5 (2026-03-17) |
|---|---|---|
| Edge Functions | 90+ | 95+ |
| Shared Modules | 10 | 16 |
| Tabelas | ~70 | 82 |
| Views | 8 | 14 |
| Copilot Tools | — | 24 |
| Modelos IA | 4 | 5 (+ gemini-3-flash-preview) |
| SmartOps Tabs | 12 | 14 |
| Lead Card Abas | 5 | 6 (+ Histórico expandido) |
| Secrets | 18 | 20 |
| LOC Backend | ~20k | ~25k |

---

# APÊNDICE B — GLOSSÁRIO

| Termo | Significado |
|---|---|
| CDP | Customer Data Platform |
| LIA | Lead Intelligence Agent (Dra. L.I.A.) |
| RAG | Retrieval-Augmented Generation |
| SDR | Sales Development Representative |
| SPIN | Situation, Problem, Implication, Need-Payoff |
| LIS | Lead Intelligence Score |
| MQL | Marketing Qualified Lead |
| PQL | Product Qualified Lead |
| SAL | Sales Accepted Lead |
| SQL | Sales Qualified Lead |
| E-E-A-T | Experience, Expertise, Authoritativeness, Trustworthiness |
| GEO | Generative Engine Optimization |
| SSR | Server-Side Rendering |
| FTS | Full-Text Search |
| ICP | Ideal Customer Profile |
| LTV | Lifetime Value |
| CRM | Customer Relationship Management |

---

**FIM DA AUDITORIA TÉCNICA COMPLETA v5.0**  
**Total: ~3100 linhas | 18 partes | 82 tabelas | 95+ Edge Functions | 24 Copilot tools**
