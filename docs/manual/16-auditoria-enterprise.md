# Auditoria Enterprise — Sistema SmartDent (Sistema B)
**Data:** 03/08/2026 · **Escopo:** engenharia fullstack, banco, integrações, IA/RAG, UX
**Ambiente:** Supabase `okeogjgqijbfkudfjadz` + SPA React/Vite (Vercel) · domínios `admin.smartdent.com.br`, `parametros.smartdent.com.br`

---

## 0. Sumário executivo

| Dimensão | Estado | Nota |
|---|---|---|
| Arquitetura | React 18 + Vite + Supabase (Postgres + 238 Edge Functions) | 8/10 |
| Banco de dados | 365 tabelas, 401 funções SQL, 435 policies RLS | 6/10 |
| Integrações | 16 webhooks, 91 cron jobs, 10+ provedores externos | 7/10 |
| Segurança | maioria das EFs pública com service role; 6 com `verify_jwt=true`; 4 webhooks com assinatura | 4/10 |
| IA / RAG / Copilot | ativo e em uso diário (8.068 interações, 10.523 embeddings) | 8/10 |
| Atendimento (LIA/WA) | dual-provider ativo; inbox operante | 7/10 |
| Treinamento / NPS | fluxo completo, mas volume mínimo (99 matrículas, 2 NPS) | 5/10 |
| UX / rotas | 65 rotas, 29 páginas, 144 componentes; ~30 EFs órfãs | 6/10 |

**Top 5 riscos:**
1. **Superfície pública ampla** — ~189 EFs sem JWT usando `SUPABASE_SERVICE_ROLE_KEY`; 12 dos 16 webhooks sem validação de assinatura.
2. **`lia_attendances` com 610 colunas** — tabela monolítica, custo de leitura alto, risco de `42703` recorrente e limite de colunas do Postgres.
3. **Consolidação de identidade** — merges indevidos históricos (317 casos, 549 deals afetados) por `auto_dedup_by_phone` + e-mails placeholder.
4. **Catálogo/SKU incompleto** — ~28% dos itens de proposta com SKU oficial; resto depende de match textual.
5. **Backlog morto acumulado** — ~31 funções sem gatilho e ~35 one-offs de backfill misturadas à produção, sem tag/versionamento.

---

## 1. Engenharia fullstack

### 1.1 Frontend
- **Stack:** React 18, Vite 5, TypeScript, Tailwind v3, shadcn/ui, ReactFlow (editor de fluxos), Recharts.
- **Rotas:** 65 (`src/App.tsx`) — 3 idiomas na Base de Conhecimento (`/base-conhecimento`, `/en/knowledge-base`, `/es/base-conocimiento`), públicas (`/nps/:token`, `/inscricao/:slug`, `/f/:slug`, `/lp/:slug`, `/bio/:slug`, `/painel-comercial`) e admin (`/admin`, `/social/*`, `/smartops/*`).
- **Peso:** 144 componentes; `AdminCatalog.tsx`, `LeadDetailPanel.tsx`, `SmartOpsTeam.tsx` e `AdminKnowledge.tsx` concentram lógica demais (God components) — candidatos a split.
- **Gap:** admin é SPA monolítica sem code-splitting por seção → bundle inicial pesado para telas de TV/painel.

### 1.2 Backend (Edge Functions)
- **238 diretórios** em `supabase/functions` (incl. `_shared` com 50+ módulos de regra compartilhada).
- Módulos críticos compartilhados: `golden-rule-guard.ts`, `commercial-intent.ts`, `wa-provider-router.ts`, `meta-form-resolver.ts`, `catalog-sku-resolver.ts`, `identity-funnel-resolver.ts`, `lia-rag.ts`, `product-rag.ts`, `seller-note-lock.ts`.
- **Gap de governança:** apenas 163 blocos declarados em `supabase/config.toml` para 238 funções → ~75 funções sem configuração explícita (herdam default).
- **Testes:** existem só 2 (`identity-funnel-resolver_test.ts`, `lia-rag_test.ts`). Cobertura efetiva < 1%.

### 1.3 Orquestração
- **91 cron jobs** ativos. Cadência mais agressiva: `meta-lead-ads-pull` (1 min), `flow-executor` (1 min), `smartops-email-tick` (1 min), `social-publish-worker` (2 min), `batch-cognitive-analysis` (10 min), `painel-comercial-refresh` (15 min).
- **Inconsistência detectada:** dois jobs de e-mail apontando para nomes diferentes (`smart-ops-email-scheduler-tick` a cada minuto e `smartops-email-tick` ao meio-dia) → risco de disparo duplicado.
- **Inconsistência 2:** `resubmit-sitemap-to-gsc-every-10m` roda de fato a cada 30 min (nome mente sobre o schedule).

---

## 2. Banco de dados

| Métrica | Valor |
|---|---|
| Tabelas em `public` | 365 |
| Funções SQL | 401 |
| Policies RLS | 435 |
| Leads canônicos (`merged_into IS NULL`) | 32.903 |
| Deals | 42.956 |
| `lead_activity_log` | 507.586 linhas |
| `meta_lead_ingestion_log` | 492.938 linhas |
| Colunas em `lia_attendances` | **610** |

### Inconsistências estruturais
1. **Monolito `lia_attendances` (610 colunas):** mistura identidade, CRM, ERP, e-commerce, equipamentos, workflow 7×3 e flags de automação. Recomendação: split vertical em `lead_identity`, `lead_crm_state`, `lead_equipment`, `lead_workflow`.
2. **Colunas sem `created_at`:** `piperun_webhook_events`, `products_catalog` (confirmado em consulta) → impossibilita auditoria temporal e detecção de última utilização.
3. **Tabelas de staging na produção:** `_ab_enrich_staging`, `_check_leads_0710`, `_csv_leads_check`, `_gate0_runtime_audit`, `piperun_*_staging`, `dh_leads_staging` — sem TTL nem owner.
4. **RLS desligada** em: `boas_vindas_locks`, `campaign_content_posts`, `campaign_produto_map`, `copa_comentarios`, `ddd_referencia`, `leads_queue_meta_reprocess`, `smart_form_rate_limit`, `smartops_golden_rule_deal_locks`, `image_embedding_cache`, `agent_internal_lookups`. Aceitável para locks/caches, mas `campaign_content_posts` e `campaign_produto_map` carregam dado de negócio.
5. **Duplicidade de verdade:** `deals` + `piperun_staging` + `piperun_companies_mirror` + `piperun_persons_mirror` + `lia_attendances.*_crm` guardam o mesmo estado do CRM em 5 lugares.
6. **Backups como tabela:** `lia_attendances_backup_20260314` ainda em `public` com policies próprias.

---

## 3. Última utilização (sinais de vida por subsistema)

| Tabela / subsistema | Linhas | Último evento | Leitura |
|---|---|---|---|
| `lead_activity_log` | 507.586 | 03/08 19:46 | ✅ vivo (core) |
| `agent_actions_log` (Copilot) | 4.473 | 03/08 19:45 | ✅ vivo |
| `deals` | 42.956 | 03/08 19:35 | ✅ vivo |
| `lia_attendances` | 33.928 | 03/08 19:37 | ✅ vivo |
| `agent_interactions` (LIA/Copilot) | 8.068 | 03/08 19:30 | ✅ vivo |
| `ai_token_usage` | 26.703 | 03/08 04:00 | ✅ vivo (cron noturno) |
| `agent_embeddings` | 10.523 | 03/08 04:00 | ✅ vivo (index nightly) |
| `knowledge_videos` | 602 | 31/07 | ⚠️ 3 dias |
| `smartops_course_enrollments` | 99 | 31/07 | ⚠️ baixo volume |
| `smartops_nps_responses` | 2 | 31/07 | 🔴 fluxo novo, sem adoção |
| `campaign_send_log` | 501 | 22/07 | 🔴 12 dias parado |
| `knowledge_contents` | 813 | 15/07 | 🔴 19 dias sem publicação |
| `meta_lead_ingestion_log` | 492.938 | 10/07 | 🔴 log parou; ingestão migrou p/ Zernio sem manter o log |
| `agent_knowledge_gaps` | 79 | 09/07 | 🔴 loop de aprendizado interrompido |
| `interactions` | 147 | 16/03 | ☠️ tabela morta (substituída por `lead_activity_log`) |

**Achado crítico:** `meta_lead_ingestion_log` sem escrita desde 10/07 enquanto `meta-lead-ads-pull` roda a cada minuto → a observabilidade da ingestão Meta está cega. Verificar se o pull passou a gravar só em `meta_lead_event_buffer`.

---

## 4. APIs, Webhooks e Payloads

### 4.1 Webhooks de entrada (16)
| Endpoint | Origem | Assinatura | Payload |
|---|---|---|---|
| `stripe-webhook` | Stripe | ✅ `stripe-signature` | eventos de pagamento/assinatura |
| `smart-ops-piperun-webhook` | PipeRun | ✅ segredo | deal/person/company/activity + `HYDRATE_INCLUDES` |
| `smart-ops-zernio-lead-webhook` | Zernio (Meta Lead Ads) | ✅ segredo | `leadgen` com `form_id` + `field_data`; claim atômico + `EdgeRuntime.waitUntil` |
| `zernio-webhook` | Zernio (social/DM) | ✅ | comentário → DM |
| `smart-ops-meta-lead-webhook` | Meta direto | ❌ | leadgen |
| `smart-ops-ecommerce-webhook` | Loja Integrada | ❌ | pedido + itens |
| `smart-ops-sellflux-webhook` | Sellflux | ❌ | contato/venda + `custom_fields` |
| `smart-ops-wa-inbox-webhook` | Evolution API | ❌ | mensagem 1:1 |
| `smart-ops-evogo-groups-webhook` | EvolutionGO | ❌ | mensagem de grupo |
| `evolution-webhook-fanout` | Evolution | ❌ | roteia p/ consumidores |
| `sentinela-webhook-receiver` | Sentinela grupos | ❌ | mensagens monitoradas |
| `smart-ops-tldv-webhook` | tl;dv | ❌ | transcrição de reunião |
| `astron-postback` | Astron Academy | ❌ | acesso/matrícula |
| demais (`register-*`, `*-info`) | utilitários | n/a | — |

**Gap:** 12/16 sem validação de origem. Qualquer ator com a URL pode injetar lead, pedido ou mensagem. Mitigação recomendada: header `x-internal-token` obrigatório + HMAC onde o provedor suportar.

### 4.2 APIs de saída (System B → externo)
PipeRun (deals/persons/companies/activities/proposals), Omie (NF, NFS-e, parcelas, clientes), Meta Graph (CAPI + audiences), Evolution API (1:1) / EvolutionGO (grupos), Zernio (publicação social + unpublish), Sellflux (tags/contatos), Gmail API (envio, limite 499/dia, janela 07:30–19:00), DisparoPro MT (SMS), Stripe, Google Drive/Search Console/Indexing, PandaVideo, Loja Integrada.

### 4.3 API pública própria
`vercel.json` → `/api/v1/:path*` → `smart-dent-api` e `/ai-search` → `ai-search`. Sem rate limit declarado no edge (só `rate-limiter.ts` interno) e sem API key por consumidor.

---

## 5. Segurança

- **`verify_jwt = true` em apenas 6 funções:** `create-user`, `ai-metadata-generator`, `create-test-articles`, `heal-knowledge-gaps`, `piperun-api-test`, `smart-ops-identity-dryrun`. Todas as demais são anônimas e validam (ou não) o token em código.
- **Service role onipresente:** a maioria das EFs usa `SUPABASE_SERVICE_ROLE_KEY`, bypassando RLS. Uma falha de autorização em código = acesso total.
- **RLS:** 435 policies para 365 tabelas — cobertura desigual; 10 tabelas com RLS off.
- **LGPD:** dados de saúde/profissionais (CRO, CPF, CNPJ, telefone) em texto claro; sem política de retenção nos logs de 500k+ linhas; sem trilha de acesso por usuário nas leituras administrativas.
- **Segredos:** corretos (Supabase Secrets), mas `EVO_KEY` global ainda usado como fallback — contraria a regra de credencial por instância.

**Ações prioritárias**
1. Token interno obrigatório (`x-internal-token`) para todas as EFs de cron/backfill.
2. HMAC nos 12 webhooks descobertos.
3. Substituir service role por anon+RLS nas EFs que só leem dados do próprio lead.
4. Política de retenção: 90 dias em `lead_activity_log`/`meta_lead_ingestion_log` com arquivamento.

---

## 6. UIs órfãs e funções órfãs

### 6.1 Edge Functions sem referência no código nem em `config.toml` (~60 candidatas)
- **One-offs de backfill (manter arquivadas, fora de `functions/`):** `backfill-crm-activities`, `backfill-deals-append`, `backfill-hits-granular`, `backfill-ltv`, `backfill-stranded-won-deals`, `smart-ops-csv-audit-backfill`, `smart-ops-csv-vendas-backfill`, `smart-ops-activity-identity-backfill`, `smart-ops-backfill-person-origin`, `smart-ops-backfill-pessoa-piperun-id`, `piperun-equipment-backfill`, `rayshape-fix-placeholder-leads`, `fix-category-e-cleanup`, `fix-corrupted-links`, `fix-piperun-links`, `meta-sem-crm-seed`, `piperun-vendas-open-recon`.
- **Diagnóstico/exploração (remover ou proteger):** `omie-api-explorer`, `piperun-api-test`, `piperun-deal-diag`, `gate0-runtime-audit`, `audit-vitality-protocol`, `smart-ops-identity-dryrun`, `smart-ops-evolution-webhook-info`.
- **Mortas confirmadas:** `smart-ops-kanban-move` (desligada por decisão), `manychat-lia-bridge` (ManyChat fora), `register-loja-webhooks`, `setup-distributor-bucket`, `mcp-server` (sem consumidor no app).
- **Falsos positivos (invocadas por cron ou infra, não pelo `src`):** `cs-enviar-nps`, `sequence-runner`, `smart-ops-email-scheduler-tick`, `google-reviews-pull`, `resubmit-sitemap-to-gsc`, `sentinela-daily-report`, `meta-sem-crm-reprocess-worker`, `omie-lead-enricher`, `poll-loja-integrada-orders`, `seo-proxy`, `llms-full-txt`, `rss-feed`, `generate-*-sitemap`, `short-link-resolve`, `smart-ops-evogo-groups-webhook`, `astron-*`.

### 6.2 UI órfã / incompleta
- `AdminPandaVideoTest`, `AdminLinkBuildingValidator`, `PublicAPIProductImporter`, `LojaIntegradaImporter`, `AdminApostilaImporter` — ferramentas de uso único ainda expostas no menu.
- `AdminSupportCases` e `AdminDraLIAStats` com dados parciais (dependem de tabelas de baixo volume).
- `SmartOpsAudienceBuilder` acoplado a `campaign_segments`, cujo pipeline de envio está parado desde 22/07.
- `/exemplo-parametros`, `/embed/*` e `/docs/:filename` sem link de navegação — acessíveis apenas por URL direta.

---

## 7. IA: RAG, Copilot, Atendimento e Treinamento

### 7.1 RAG (Base de Conhecimento + Produtos)
- 10.523 embeddings, reindexados por 4 crons noturnos (`index-all-knowledge-nightly`, `index-catalog-products-nightly`, `index-videos-nightly`, `index-resins-authors-weekly`).
- Threshold 0.56 com fallback FTS/ILIKE (`lia-rag.ts`, `product-rag.ts`); dedupe por título; política de coleção completa.
- **Gaps:** `knowledge_contents` sem publicação nova desde 15/07 → RAG envelhecendo; `agent_knowledge_gaps` parado em 09/07 → o ciclo "detectar lacuna → gerar conteúdo" não fecha mais; `image_embedding_cache` sem `created_at` (sem controle de invalidação).

### 7.2 Copilot (Gerente Comercial Sênior)
- 4.473 ações registradas, última há minutos. Lê exclusivamente do schema `copilot_brain` (snapshots), com ferramentas de ação (WhatsApp, mover CRM, e-commerce) + 5 ferramentas RAG read-only.
- `check_copilot_brain_drift` monitora divergência de snapshot.
- **Gaps:** sem limite de custo por usuário/sessão (só `ai_token_usage` como log); ausência de trilha de aprovação humana para ações destrutivas (mover deal, enviar WhatsApp em massa).

### 7.3 Atendimento (Dra. LIA + WhatsApp)
- 8.068 interações; guardas anti-injeção (`lia-guards.ts`), qualificação progressiva, janela de histórico configurável (`DRA_LIA_HISTORY_WINDOW`, default 15).
- Roteador dual-provider: Evolution (1:1) / EvolutionGO (grupos), credencial por instância em `team_members`; guarda de `connectionState` antes de enviar.
- **Gaps:** `EVO_KEY` global ainda como fallback; instâncias sem `evolution_phone`/`evolution_api_key` falham silenciosamente no 1º sync; sem SLA/alerta quando o inbox fica sem resposta humana.

### 7.4 Treinamento e NPS
- Motor de turmas com recorrência, matrículas (99), acompanhantes, sincronismo PipeRun/Sellflux, lembrete a cada 15 min e NPS 24h após o treinamento (`cs-enviar-nps`, 08:00 diário).
- **Gap crítico:** apenas **2 respostas de NPS**. Causas prováváveis: volume real baixo de treinamentos concluídos, token expirando, ou o job de 08:00 não encontrando elegíveis. Requer verificação de elegibilidade + reenvio.
- Sem dashboard de NPS agregado (nota aparece no card do lead, mas não há série histórica).

---

## 8. Gaps consolidados e plano

### P0 (7 dias)
1. Token interno em todas as EFs de cron/backfill + HMAC nos 12 webhooks abertos.
2. Restaurar observabilidade da ingestão Meta (`meta_lead_ingestion_log` parado desde 10/07).
3. Investigar NPS com 2 respostas (elegibilidade do cron `send-nps-whatsapp-24h-after-training`).
4. Desduplicar os dois crons de e-mail (`smartops-email-tick` × `smart-ops-email-scheduler-tick`).
5. Religar o pipeline de campanhas (sem envio desde 22/07).

### P1 (30 dias)
6. Concluir Fase A de identidade: desativar `auto_dedup_by_phone` agressivo, merge determinístico só por documento válido, desfazer os 317 merges ruins.
7. Elevar cobertura de SKU oficial de 28% → 90% via `catalog-sku-resolver` + aba "Fora do Catálogo".
8. Mover 35 one-offs para `supabase/functions/_archive` (fora do deploy) e apagar as 5 mortas.
9. Retenção de logs (90 dias) + arquivamento das tabelas de 500k linhas.
10. Reativar o ciclo de knowledge gaps (RAG estagnado desde 15/07).

### P2 (90 dias)
11. Split vertical de `lia_attendances` (610 → 4 tabelas com views de compatibilidade).
12. Code-splitting do admin + quebra dos God components.
13. Fonte única de verdade do CRM (eliminar 3 dos 5 espelhos).
14. Testes: mínimo de 30 testes cobrindo Golden Rule, resolver de identidade, roteador WA e RAG.
15. Budget/guardrail de custo por sessão no Copilot e trilha de aprovação para ações destrutivas.

---

## 9. Cobertura desta auditoria
Arquitetura ✅ · Frontend/rotas/UI órfãs ✅ · Edge Functions e gatilhos ✅ · Banco (tabelas, funções, RLS, monolitos) ✅ · Última utilização por subsistema ✅ · APIs/Webhooks/payloads ✅ · Segurança/LGPD ✅ · RAG/Copilot/Atendimento/Treinamento ✅ · Plano P0–P2 ✅

Complementa: `01-arquitetura.md`, `04-banco-de-dados.md`, `05-integracoes-apis.md`, `07-seguranca.md`, `15-auditoria-edge-functions.md`.
