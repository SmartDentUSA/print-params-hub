

## Gerar Documento de Auditoria Profunda Completa (.MD)

### O que sera feito

Criar um documento Markdown completo e detalhado (`AUDITORIA_PROFUNDA_SISTEMA_COMPLETO.md`) com auditoria exaustiva de cada subsistema, funcionalidade, integração, ferramenta, uso de IA e fluxo de dados do Revenue Intelligence OS.

### Estrutura do documento

O documento tera ~20 seções cobrindo:

1. **Identidade e Stack** — Nomenclatura, versoes, dependencias, domínios
2. **Arquitetura Dual** — Lead Lifecycle + Content Intelligence com diagramas ASCII
3. **CDP Unificado (lia_attendances)** — Todos os ~200 campos organizados por domínio (Core, SDR, PipeRun, Cognitive, LIS, Equipamentos, E-commerce, Astron, SellFlux, Automacao)
4. **Ingestao de Leads** — 5 entry points, Smart Merge (5 categorias), normalizacao, PQL detection, auto-forward dinamico, form_data JSONB
5. **CRM Sync (PipeRun)** — Hierarquia Person→Company→Deal, Golden Rule, Decision Tree, Round Robin, notas HTML
6. **Cognitive Engine** — DeepSeek v3, 10 eixos, pipeline cognitivo, batch processing
7. **Intelligence Score (LIS)** — 4 eixos, formula, RPC, calibracao (max 81)
8. **Workflow Portfolio 7x3** — 7 etapas, 25 subcategorias, 3 camadas, portfolio_json, triggers SQL
9. **Formularios Dinamicos** — smartops_forms, smartops_form_fields, smartops_form_field_responses, PublicFormPage, auto-forward
10. **Integracoes Externas (9 sistemas)** — PipeRun, SellFlux, WaLeads, Meta Ads, Loja Integrada, Astron, PandaVideo, Google Drive/Reviews, Omie ERP
11. **Dra. L.I.A.** — RAG (vetor + FTS + ILIKE), 3 canais, prioridade artigos sobre videos, depoimentos, links internos
12. **Copilot IA** — Dual Brain, tool calling, 10 iteracoes, ferramentas operacionais
13. **Content Intelligence Pipeline** — 14 etapas, orquestrador (1193 linhas), anti-alucinacao, pos-processamento
14. **SEO & IA Exposure** — 17+ JSON-LD, hreflang, sitemaps (5), RSS, SSR proxy (seo-proxy), llms.txt, AI readiness
15. **Edge Functions — Inventario Completo (100+)** — Tabela de todas as funcoes com status, categoria, descricao
16. **Shared Modules (_shared/)** — 22 modulos com descricao e dependencias
17. **Database Schema** — 30+ tabelas, views, RPCs, triggers, RLS policies
18. **Automacao & Watchdog** — Stagnation (6 etapas), Proactive Outreach, CS Rules, System Watchdog
19. **Seguranca** — RLS, JWT, secrets, rate limiting, input validation, concurrency locks
20. **Metricas e Recomendacoes** — KPIs do sistema, pontos de atencao, recomendacoes

### Fonte dos dados

O documento sera construido a partir de:
- Todos os docs existentes (`SYSTEM_DESCRIPTION.md`, `REVENUE_INTELLIGENCE_OS_TECHNICAL_DOC.md`, `SKILL_SMARTDENT_REVENUE_OS.md`, `AUDITORIA_WORKFLOW_FORMULARIOS_CRM.md`)
- Memories do sistema (22 memories de arquitetura, integracoes, features)
- Codigo fonte explorado (edge functions, shared modules, componentes)
- Inventario real de edge functions (100+ funcoes listadas)

### Saida

- Arquivo: `/mnt/documents/AUDITORIA_PROFUNDA_SISTEMA_COMPLETO.md`
- Tamanho estimado: ~3000-4000 linhas
- Formato: Markdown com tabelas, diagramas ASCII, blocos de codigo

