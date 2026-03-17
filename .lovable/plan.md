
# Plano: Auditoria Técnica Completa v5.0 — Revenue Intelligence OS

## Contexto

O sistema já possui 3 documentações técnicas que cobrem até a versão 4.0 (2026-03-14):
- `docs/REVENUE_INTELLIGENCE_OS_TECHNICAL_DOC.md` (1175 linhas, v3.0)
- `docs/SYSTEM_DESCRIPTION.md` (705 linhas, v1.0)
- `docs/AUDITORIA_TECNICA_COMPLETA_V4.md` (2064 linhas, v4.0)

Todas estão desatualizadas em relação a funcionalidades adicionadas nas últimas semanas.

## O que Mudou desde a V4 (Delta)

### Novas Edge Functions (não documentadas)
| Função | LOC | IA | Descrição |
|---|---|---|---|
| `smart-ops-copilot` | 1523 | DeepSeek + Gemini (Dual Brain) | Copilot IA com 19+ tools (query, update, send WhatsApp, bulk campaign, move CRM) |
| `smart-ops-cognitive-analysis` | ~300 | DeepSeek v3 | Motor dedicado de análise cognitiva (narrativa 3 parágrafos) |
| `smart-ops-leads-api` | ~400 | — | API unificada para Lead Detail Card (action=detail) |
| `smart-ops-merge-leads` | ~350 | — | Merge incremental de leads duplicados |
| `backfill-ltv` | 108 | — | Backfill de LTV a partir de piperun_deals_history |
| `import-proposals-csv` | 808 | — | Import de propostas CSV do PipeRun (enrich-only, 4-step match) |
| `create-technical-ticket` | ~200 | — | Criação de tickets de suporte técnico |
| `batch-cognitive-analysis` | ~400 | DeepSeek v3 | Processamento batch de análises cognitivas |

### Novos Componentes Frontend
| Componente | Descrição |
|---|---|
| `LeadDetailPanel.tsx` (v2, 1022 linhas) | Lead Intelligence Card v2 com 6 abas, design dark mode, Syne/DM Sans/DM Mono |
| `SmartOpsCopilot.tsx` | Interface do Copilot IA (Dual Brain) |
| `SmartOpsSmartFlowAnalytics.tsx` | Analytics de automações |
| `SmartOpsROICalculators.tsx` / `SmartOpsROICardsManager.tsx` | Calculadoras ROI |
| `ROICalculatorPage.tsx` | Página pública de ROI |
| `WorkflowPortfolio.tsx` | Portfolio de 7 estágios do workflow |
| `WaLeadsMediaPreview.tsx` / `WaLeadsVariableBar.tsx` | Componentes WhatsApp inbox |

### Novos Shared Modules
| Módulo | Descrição |
|---|---|
| `lia-sdr.ts` | Estratégia comercial SPIN Selling |
| `lia-printer-dialog.ts` | Fluxos de marca/modelo para impressoras |
| `lia-rag.ts` | Busca vetorial + FTS com cache |
| `lia-escalation.ts` | Detecção de intenção e handoff |
| `lia-guards.ts` | Guardrails conversacionais |
| `lia-lead-extraction.ts` | Extração de entidades de conversas |
| `rate-limiter.ts` | Rate limiting por IP/session |
| `resilient-fetch.ts` | Fetch com retry e fallback |
| `waleads-messaging.ts` | Helpers de mensageria WaLeads |
| `piperun-hierarchy.ts` | Hierarquia de funis PipeRun |

### Novas Tabelas / Mudanças de Schema
- Tabelas de log comportamental: `lead_product_history`, `lead_cart_history`, `lead_course_progress`, `lead_form_submissions`, `lead_sdr_interactions`
- `people`, `companies`, `person_company_relationship` (Person-centric Sprint 1)
- `lead_opportunities` (motor de oportunidades)
- `support_cases` expandida com campos de suporte técnico
- Coluna gerada `buyer_type` em `lia_attendances`

### SmartOps atualizado para 14 sub-tabs
Bowtie, Kanban/Leads, Equipe, Automações, Logs, Relatórios, Conteúdo, Saúde, WhatsApp, Formulários, Tokens IA, Intelligence, ROI, Copilot

## Deliverable

Criar arquivo `docs/AUDITORIA_TECNICA_COMPLETA_V5.md` (~3000 linhas) com 18 partes:

### Estrutura do Documento

```
Parte 1  — Identidade, Stack e Modelos de IA (atualizado com Gemini 3 Flash Preview)
Parte 2  — Arquitetura Dual (diagramas ASCII atualizados)
Parte 3  — CDP Unificado (~200 colunas, 9 domínios)
Parte 4  — Person-Centric Identity Graph (Sprint 1)
Parte 5  — Inventário Completo de Edge Functions (95+)
           - Cada função: nome, LOC, JWT, modelo IA, secrets, tabelas afetadas
Parte 6  — Fluxos de Leads (8 fluxos com diagramas)
           - Formulário → CDP
           - Meta Ads → CDP
           - SellFlux → CDP  
           - E-commerce → CDP
           - PipeRun bidirecional
           - Stagnation Processor
           - Proactive Outreach
           - WhatsApp Intent Classification
Parte 7  — Fluxos de Conteúdo (7 fluxos)
           - Extração (PDF/Vídeo/Drive)
           - Orquestração (Gemini 2.5 Flash)
           - Pós-processamento (6 etapas)
           - Tradução (PT→EN/ES)
           - SEO Exposure (SSR + Sitemaps)
           - Knowledge Gap Healing
Parte 8  — Fluxos de Atendimento Dra. L.I.A. (RAG + 3 canais + suporte técnico)
Parte 9  — Motor Cognitivo e Intelligence Score
           - cognitive-lead-analysis (individual)
           - batch-cognitive-analysis
           - smart-ops-cognitive-analysis (dedicado, DeepSeek v3)
           - Intelligence Score (4 eixos, fórmula, trigger)
Parte 10 — Copilot IA (Dual Brain, 19+ tools)
Parte 11 — Lead Intelligence Card v2 (6 abas, design system)
Parte 12 — Workflow Portfolio (7 estágios, 3 camadas)
Parte 13 — Integrações Externas (9 sistemas com field mapping completo)
Parte 14 — Qualidade HTML & Regras Anti-Alucinação
Parte 15 — SEO E-E-A-T / GEO / IA-Ready Compliance
           - 17+ JSON-LD schemas
           - hreflang, canonical, OG, Twitter
           - ai-context meta, llms.txt, robots.txt
           - 5 sitemaps XML + RSS/Atom
           - SSR seo-proxy (2004 LOC, 20+ User-Agents)
           - Author E-E-A-T (CRO, Lattes)
Parte 16 — UX/UI Architecture (15 rotas públicas, 14 sub-tabs SmartOps)
Parte 17 — Banco de Dados (35+ tabelas, 6 views, 19+ RPCs, 6 triggers)
Parte 18 — Secrets, Segurança e Métricas do Sistema

## Arquivo

- `docs/AUDITORIA_TECNICA_COMPLETA_V5.md` — Documento único, abrangente, ~3000 linhas

## Não Modificar
- Nenhum arquivo de código ou função será alterado
- Documentações anteriores (V3, V4) permanecem como referência histórica
