# 05 — Integrações, APIs e Edge Functions

Inventário completo em [`edge-functions-inventario.csv`](edge-functions-inventario.csv) (237 funções × 11 colunas: domínio, propósito, trigger, `verify_jwt`, chamadores, tabelas, env vars, APIs externas, suspeita de morta, desativada).

## 5.1 Provedores externos

| Provedor | Papel | Funções principais | Auth | Falha típica |
|---|---|---|---|---|
| **PipeRun** (CRM) | fonte de verdade comercial | `smart-ops-sync-piperun`, `piperun-*` (~25), `smart-ops-piperun-webhook` | `PIPERUN_TOKEN`; webhook com `PIPERUN_WEBHOOK_SECRET` | `owner_id` inválido; rate limit; deal arquivado localmente "aberto" |
| **Omie** (ERP) | faturamento, NF, parcelas | `omie-sync-*`, `omie-recalc-snapshot` | app key/secret | janela de sincronização e NFs de meses antigos ausentes |
| **Meta / Facebook** | Lead Ads + audiências | `meta-lead-ads-pull` (cron 1 min), `meta-lead-webhook`, `meta-audience-sync` | token de página + `META_WEBHOOK_VERIFY_TOKEN` | lookback curto → perda silenciosa (corrigido: `since_minutes` adaptativo ≥30) |
| **Zernio** | redundância de Lead Ads + publicação social + IG DM | `smart-ops-zernio-lead-webhook`, `zernio-*` (~12) | `ZERNIO_*` | timeout no primeiro POST (resolvido com `EdgeRuntime.waitUntil`) |
| **Evolution API** | WhatsApp **individual** | `smart-ops-send-*`, `wa-dispatcher`, `wa-provider-selftest` | chave por instância em `team_members` | `connectionState != open` → não envia e loga |
| **EvolutionGO** | WhatsApp **grupos** | `wa-group-blast`, `wa-sync-groups` | `EVOGO_*` | 404 de instância; permissão de grupo |
| **Stripe** | pagamentos/licenças | `stripe-webhook`, `stripe-*` | webhook secret | evento não conciliado (retry a cada 20 min) |
| **Loja Integrada** | e-commerce | `sync-loja-integrada-*` (cron 3 h) | `LI_IMPORT_SHARED_SECRET` | pedido sem produto de interesse mapeado |
| **Gmail / Google** | e-mail, Drive, GSC, Places | `smart-ops-send-gmail`, `sync-google-drive-kb`, `submit-google-indexing`, `sync-google-reviews` | OAuth service account | quota de envio (~499/dia) |
| **Disparo Pro** | SMS | `smart-ops-sms-disparopro`, `smart-ops-sms-balance` | HTTPS MT API | saldo insuficiente |
| **Astron** | LMS de cursos | `sync-astron-members` (3 h) | token | membro sem match de lead |
| **PandaVideo / tl;dv / Firecrawl** | vídeo, gravação de reunião, crawl | `sync-pandavideo`, `sync-video-analytics` | tokens | — |
| **IA**: Lovable AI, DeepSeek, Gemini, Anthropic, OpenRouter, POE | agentes, embeddings, conteúdo | `dra-lia-*`, `smart-ops-copilot`, `system-watchdog-deepseek`, `_shared/ai-router.ts` | chaves por provedor | 429/timeout → fallback de modelo |
| **ManyChat / Sellflux** | legado | funções marcadas 410 | — | desativadas |

## 5.2 Webhooks de entrada

| Endpoint | Origem | Segurança | Comportamento |
|---|---|---|---|
| `/functions/v1/meta-lead-webhook` | Meta | `hub.verify_token` | grava em `meta_lead_event_buffer`, processa async |
| `/functions/v1/smart-ops-zernio-lead-webhook` | Zernio | `ZERNIO_WEBHOOK_SECRET` + dedupe `zernio_leadgen_dedup` | **claim atômico → 200 imediato → `EdgeRuntime.waitUntil` processa** |
| `/functions/v1/smart-ops-piperun-webhook` | PipeRun | `PIPERUN_WEBHOOK_SECRET` | atualiza `deals`, `deal_stage_history`, atividades com **data real do CRM** |
| `/functions/v1/stripe-webhook` | Stripe | assinatura Stripe | `stripe_webhook_events` + conciliação |
| `/functions/v1/smart-ops-ingest-lead` | formulários, LP, e-commerce, integrações | rate limit + validação | ponto único de entrada de lead |
| `/api/v1/*` (Vercel → `smart-dent-api`) | Sistema A / parceiros | chave de API | catálogo público |

**Nota de segurança**: quase todas as funções usam `verify_jwt = false` e validam por segredo próprio ou nada. Ver cap. 07.

## 5.3 Módulos compartilhados (`supabase/functions/_shared/`)

| Arquivo | Responsabilidade |
|---|---|
| `golden-rule-guard.ts` | isola funis CS/Comercial; decide se pode abrir deal novo em Vendas |
| `commercial-intent.ts` | define o que conta como sinal comercial real |
| `assert-canonical-lead.ts` | garante lead canônico (shadow mode: loga, não bloqueia) |
| `wa-provider-router.ts` | roteamento obrigatório Evolution (1:1) × EvolutionGO (grupos) |
| `dental-taxonomy.ts` | taxonomia de área/especialidade/produto, prioridade de marca sobre "Outras" |
| `meta-form-resolver.ts` | resolve `form_id` → produto via `meta_form_mappings` (sem hardcode) |
| `catalog-sku-resolver.ts` | nome livre → SKU oficial |
| `workflow-diagnosis.ts` | diagnóstico 7×3 e briefing do vendedor (`RoteiroLookup`) |
| `ai-router.ts` / `log-ai-usage.ts` | escolha de modelo + telemetria de tokens |
| `piperun-client.ts` | cliente HTTP com retry/rate limit |
| `short-link.ts` | reuso de URL curta existente (nunca cria duplicata) |

## 5.4 Jobs `pg_cron` (83 ativos) — por frequência

| Frequência | Jobs |
|---|---|
| 1 min | `meta-lead-ads-pull`, `flow-executor`, `smartops-email-tick` |
| 2 min | `social-publish-worker` |
| 5 min | `extract-pdf-batch-cron`, `vitality-gen-incremental` |
| 10 min | `batch-cognitive-10min`, `social-post-auto-blast-10min` |
| 15 min | `painel-comercial-refresh`, `smart-ops-monitor-15min`, `smartops-autonomous-agent`, `smartops-course-reminder-1h`, `retry-failed-leads-15min`, `sync-method-docs-to-agent-embeddings-15min` |
| 20 min | `stripe-retry-unmatched-20min` |
| 30 min | `sync-piperun-incremental-30min`, `lia-guardian-30min`, `opportunity-engine-30min`, `system-health-30min`, `sequence-runner`, `meta-sem-crm-reprocess-worker`, `resubmit-sitemap-to-gsc` |
| 1 h | `sync-piperun-vendas-1h` (min 5), `sync-piperun-cs-1h` (15), `piperun-funnel-reconciler-hourly` (20), `sync-piperun-estagnados-1h` (25), `social-posts-sync-hourly`, `social-hashtag-monitor-1h` |
| 2–6 h | `sync-piperun-atos-2h`, `sync-piperun-distribuidor-2h`, `sync-piperun-cursos-3h`, `sync-piperun-exportacao-3h`, `sync-piperun-insumos-3h`, `sync-piperun-ebook-4h`, `sync-piperun-ecom-4h`, `sync-astron-members-3h`, `sync-loja-integrada-clients-every-3h`, `sync-google-drive-kb-12h`, `sentinela-analyzer-6h` |
| Diário | `omie-sync-morning` 12:00, `omie-sync-evening` 20:30, `omie-sync-nf-daily` 10:00, `omie-sync-nfse-daily` 10:15, `omie-recalc-snapshot` 10:30, `stripe-renewal-reminder-daily` 13:00, `send-nps-whatsapp-24h-after-training` 08:00, `submit-google-indexing` 06:00/18:00, índices de conhecimento 02:00–04:00, `daily-backup-drive` 03:00, `system-watchdog-daily` 00:10, `smart-ops-integration-check-daily` 00:00, `archive-daily-chats` 02:55, `learn-from-conversations-daily` 04:30, `sentinela-daily-report` 10:00, `meta-lead-daily-safety-sweep` 04:30, `auto-update-enrollment-status` 03:00, `build-products-catalog-nightly` 02:30, `build-social-proof-nightly` 04:00, `cleanup-voice-cache` 06:00 |
| Semanal/Mensal | `index-resins-authors-weekly`, `publish-distributors-weekly`, `google-reviews-pull-3days`, `verify-distributor-backlinks-monthly` |

Observações: a janela 02:00–04:30 concentra ~12 jobs pesados (indexação + backup + snapshots) — risco de contenção. Os 15 crons `sync-piperun-*` estão escalonados por minuto para não colidir (boa prática já aplicada).

## 5.5 Camada Vercel

| Rewrite | Destino | Uso |
|---|---|---|
| `/api/v1/:path*` | EF `smart-dent-api` | API pública de catálogo |
| `/ai-search` | EF `ai-search` | busca semântica para LLMs |
| `/api/seo-proxy` | EF `seo-proxy` | SSR para bots (lista de UAs em `api/middleware-bot.ts`) |
| `/(.*)` | `/index.html` | catch-all da SPA (deve ficar **por último**) |

`api/render-template.ts` roda Chromium (`@sparticuz/chromium` + `puppeteer-core`) para gerar imagens/PDF server-side — é a função Vercel mais caras em memória/tempo.

## 5.6 Resiliência das integrações

| Mecanismo | Onde |
|---|---|
| Retry com backoff | `_shared/piperun-client.ts`, `retry-failed-leads-15min` |
| Dedupe idempotente | `zernio_leadgen_dedup`, `meta_lead_ingestion_log`, `stripe_webhook_events` |
| Ack rápido + background | webhook Zernio/Meta (`EdgeRuntime.waitUntil`) |
| Guarda de conexão | `smart-ops-lead-welcome` checa `connectionState` antes de enviar |
| Reconciliação | `piperun-funnel-reconciler-hourly`, `piperun-vendas-open-recon`, `piperun-vendas-status-hydrate` |
| Log estruturado de falha | `system_health_logs` (todas as funções críticas com try/catch) |

Lacunas: sem circuit breaker por provedor, sem DLQ formal (falhas ficam em log, não em fila de retentativa), sem alerta externo (PagerDuty/Slack) — apenas painel interno.