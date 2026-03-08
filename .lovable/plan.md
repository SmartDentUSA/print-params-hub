

# Criar arquivo `docs/SYSTEM_DESCRIPTION.md` — Descrição Completa do Sistema B

## Objetivo

Criar um documento MD abrangente que descreva o sistema completo (Sistema B / Revenue Intelligence OS), cobrindo: identidade, arquitetura, pipelines de dados, integrações, APIs expostas, frontend, banco de dados, IA, SEO e fluxo inter-sistemas.

## Arquivo

`docs/SYSTEM_DESCRIPTION.md`

## Estrutura do Documento

1. **Identidade do Sistema** — Nome, domínios, projeto Supabase, stack
2. **Resumo Executivo** — O que o sistema faz em 2 parágrafos
3. **Arquitetura Dual** — Lead Lifecycle + Content Intelligence (diagrama ASCII)
4. **CDP Unificado (lia_attendances)** — ~200 colunas, 8 domínios, views, LIS
5. **Pipeline de Leads** — 5 entry points, Smart Merge, Cognitive Engine, Stagnation
6. **Pipeline de Conteúdo** — 14 etapas (extração → orquestração → pós-processamento → publicação)
7. **Agente Dra. L.I.A.** — RAG, embeddings, WhatsApp, embed
8. **Integrações Externas** — PipeRun, SellFlux, WaLeads, Astron, Loja Integrada, PandaVideo, Google
9. **Fluxo Inter-Sistemas (A ↔ B)** — Inbound (3 pipelines) + Outbound (7 APIs)
10. **APIs Expostas** — data-export, get-product-data, export-parametros-ia, knowledge-feed, seo-proxy, sitemaps
11. **Knowledge Graph** — Seção knowledge_graph no ai_ready (nodes + relations + meta)
12. **Frontend** — Rotas públicas, admin, SmartOps (12 sub-tabs)
13. **SEO & IA** — 17+ elementos semânticos, seo-proxy (8 geradores), JSON-LD, E-E-A-T
14. **Banco de Dados** — 30+ tabelas, views, RPCs, triggers
15. **Edge Functions** — Inventário completo das 85+ funções com status
16. **Shared Modules** — system-prompt, entity-dictionary, field-maps
17. **Segurança** — RLS, JWT, secrets
18. **Métricas do Sistema** — Contadores (tabelas, funções, componentes, etc.)

## Fonte de dados

Compilação de: `docs/REVENUE_INTELLIGENCE_OS_TECHNICAL_DOC.md`, código-fonte do seo-proxy, data-export, App.tsx, hooks, shared modules, e auditorias anteriores.

## Resultado

Documento de ~800-1000 linhas cobrindo 100% do sistema, servindo como referência para novos desenvolvedores, auditorias e integração com sistemas externos.

