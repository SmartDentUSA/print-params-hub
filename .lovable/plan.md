

## Documentacao Tecnica Completa — Revenue Intelligence OS

Vou criar um arquivo `docs/REVENUE_INTELLIGENCE_OS_TECHNICAL_DOC.md` com documentacao completa cobrindo:

1. **Arquitetura Geral** — CDP unificado (`lia_attendances` ~200 colunas), stack tecnologica, diagrama de fluxo
2. **Modulos do Sistema** — 85+ Edge Functions organizadas por dominio:
   - **Lead Ingestion** (5 entry points): ingest-lead, meta-lead-webhook, sellflux-webhook, ecommerce-webhook, piperun-webhook
   - **CRM Sync** (4 funcoes): lia-assign, sync-piperun, kanban-move, piperun-full-sync
   - **AI/Cognitive** (3 funcoes): cognitive-lead-analysis, dra-lia (5092 linhas), dra-lia-whatsapp
   - **Stagnation & CS** (4 funcoes): stagnant-processor, cs-processor, proactive-outreach, send-waleads
   - **Integracoes** (6 funcoes): astron-member-lookup, astron-postback, poll-loja-integrada-orders, sellflux-sync, sync-astron-members, wa-inbox-webhook
   - **Intelligence** (3 funcoes): backfill-intelligence-score, system-watchdog-deepseek, backfill-lia-leads
   - **Content/KB** (20+ funcoes): knowledge, sitemap, PDF extraction, video sync
3. **Shared Modules** — piperun-field-map.ts (721 linhas), sellflux-field-map.ts (514 linhas)
4. **Fluxos Completos** — 8 fluxos documentados com entrada, processamento, saida
5. **Tabelas & RPCs** — schema completo, views de dominio, triggers
6. **Frontend** — Kanban (11 funis), Lead Detail, Dashboards
7. **Governanca** — Golden Rule, protectedFields, idempotencia, circuit breaker, tags taxonomy
8. **Secrets & Config** — todas as chaves API necessarias
9. **Bugs Conhecidos & Recomendacoes**

### Arquivo unico

| Arquivo | Conteudo |
|---|---|
| `docs/REVENUE_INTELLIGENCE_OS_TECHNICAL_DOC.md` | Documentacao completa ~3000 linhas cobrindo todos os 85+ modulos, fluxos, integrações, tabelas, RPCs, governança e recomendações |

A documentacao sera organizada com indice navegavel, tabelas de referencia rapida, e descricao tecnica profunda de cada funcao incluindo inputs, outputs, dependencias e edge cases.

