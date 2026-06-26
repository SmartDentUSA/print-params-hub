## Objetivo

Expandir a aba **Saúde do Sistema → Check** com:
1. Inventário completo das **192 Edge Functions** + resumo do que cada uma faz.
2. Painel de **Entrada de dados** (o que chega de fora) consolidado.
3. Corrigir bugs visíveis na tela atual (`[object Object]` no `error_message`, tokens revogados, modelo DeepSeek inválido).

---

## Parte 1 — Corrigir bugs visíveis na tela atual

Na tela aparecem `[object Object]` em várias linhas (PipeRun webhook, Astron, Meta CAPI, Involve.me, smart-ops-piperun-webhook, wa-group-blast). Causa: `error_message` está sendo gravado como objeto JSON serializado em vez de string.

- **`smart-ops-integration-check/index.ts`**: garantir que toda gravação em `error_message` passe por `String(err?.message ?? JSON.stringify(err))`.
- **`SystemHealthCheck.tsx`**: defensive render — se `error_message` começar com `{` ou `[`, formatar como `<pre>` truncado.

Tokens/modelos quebrados detectados — ações corretivas:
- **Lovable AI Gateway DeepSeek** (`Down 400 invalid model`): atualizar para `deepseek/deepseek-v3.2` ou trocar pelo modelo permitido `google/gemini-2.5-flash` no ping.
- **EvolutionGo Danilo-Henrique :8081** (`Down 390ms`): logar o `http_status` real (hoje está `—`) e expor a mensagem do servidor.
- **Google OAuth / Meta Graph API / tldv / Zernio**: já estão sinalizando corretamente; apenas garantir que a UI mostre o CTA "Reconectar" para os 4.

---

## Parte 2 — Catálogo de Edge Functions (nova sub-aba "Funções")

Adicionar `<TabsTrigger value="functions">Funções</TabsTrigger>` dentro de `SmartOpsSystemHealth.tsx`. Novo componente `EdgeFunctionsCatalog.tsx`.

### Fonte dos dados
Criar tabela `edge_function_catalog` (manual + auto-sync):

```
id, function_name, category, summary, trigger_type (http|cron|webhook|internal),
is_critical, last_invocation_at, invocations_24h, errors_24h, avg_latency_ms,
docs_url, source_path, deprecated
```

Popular via migração `INSERT` com as 192 funções organizadas em categorias:

| Categoria | Exemplos | Qtd aprox |
|---|---|---|
| **Ingest & Webhooks** | smart-ops-ingest-lead, smart-ops-meta-lead-webhook, smart-ops-sellflux-webhook, smart-ops-ecommerce-webhook, smart-ops-tldv-webhook, smart-ops-wa-inbox-webhook, astron-postback, zernio-webhook, sentinela-webhook-receiver, register-loja-webhooks, poll-loja-integrada-orders | ~12 |
| **Roteamento CRM / Dra. LIA** | smart-ops-lia-assign, dra-lia, dra-lia-whatsapp, dra-lia-export, automacoes-lia, cognitive-lead-analysis, batch-cognitive-analysis, manychat-lia-bridge | ~8 |
| **PipeRun (sync/repair)** | smart-ops-sync-piperun, smart-ops-piperun-webhook, smart-ops-piperun-funnel-reconciler, smart-ops-piperun-retry-failed-leads, smart-ops-piperun-detach-wrong-person, smart-ops-piperun-preflight, smart-ops-piperun-backfill-customfields, piperun-full-sync, piperun-offline-enrich, piperun-person-contact-backfill, piperun-person-empty-sweeper, piperun-deal-diag, piperun-api-test, fix-piperun-links, smart-ops-deal-form-note, smart-ops-preview-seller-note | ~16 |
| **Omie ERP** | omie-api-explorer, omie-lead-enricher | 2 |
| **Astron Academy** | astron-member-lookup, astron-postback, sync-astron-members, import-astron-csv | 4 |
| **E-commerce (Loja Integrada)** | import-loja-integrada, poll-loja-integrada-orders, register-loja-webhooks, sync-loja-integrada-clients, smart-ops-ecommerce-webhook | 5 |
| **Sellflux** | smart-ops-sellflux-sync, smart-ops-sellflux-webhook | 2 |
| **WhatsApp (Evolution + EvoGo)** | wa-dispatcher, wa-group-blast, wa-sync-groups, wa-broadcast-dispatch, wa-campaign-builder, wa-contact-sync-cron, wa-delivery-reconciler, wa-verify-lead, wa-ai-preview, smart-ops-send-waleads, smart-ops-wa-inbox-webhook | ~11 |
| **SMS** | smart-ops-sms-disparopro | 1 |
| **Social (Zernio/IG/FB)** | zernio-accounts-sync, zernio-broadcast-dispatch, zernio-contacts-sync, zernio-metrics-sync, zernio-webhook, social-caption-generator, social-generate-image, social-knowledge-fetch, social-publish-worker | ~9 |
| **Google (Reviews/Indexing/Drive/Sitemap)** | sync-google-reviews, google-reviews-pull, google-reviews-respond, google-oauth-callback, sync-google-drive-kb, resubmit-sitemap-to-gsc, generate-sitemap, generate-knowledge-sitemap*, generate-documents-sitemap, video-sitemap | ~11 |
| **SEO / LLMs** | seo-proxy, seo-llms-txt, llms-txt, llms-full-txt, rss-feed, knowledge-feed | 6 |
| **Conteúdo / IA generativa** | ai-content-formatter, ai-enrich-pdf-content, ai-generate-og-image, ai-metadata-generator, ai-orchestrate-content, enrich-article-seo, reformat-article-html, auto-inject-product-cards, training-factory-*, social-generate-image, generate-veredict-data, ingest-knowledge-text, heal-knowledge-gaps, index-embeddings, index-spin-entries, link-videos-to-articles | ~20 |
| **PDF / Documentos** | extract-pdf-raw/specialized/text, extract-and-cache-pdf, extract-commercial-expertise, extract-video-content, export-apostila-docx, export-parametros-ia, export-processing-instructions, smartops-gerar-doc-turma, smartops-gerar-crachas-turma, smartops-gerar-comprovante-imersao, generate-certificate, ApostilaExport | ~12 |
| **PandaVideo** | sync-pandavideo, sync-video-analytics, pandavideo-test | 3 |
| **Imports / Backfills** | backfill-* (12 funções), smart-ops-backfill-*, smart-ops-csv-audit-backfill, smart-ops-meta-csv-backfill, smart-ops-restore-vendas-snapshot, smart-ops-revert-auto-trigger, smart-ops-reassign-danilo-vendas, import-*-csv, fix-* | ~25 |
| **Cursos / Turmas** | smartops-public-enrollment, smartops-public-nps, smartops-send-course-reminder, training-create-drive-folder | 4 |
| **Distribuidores** | public-distributor-register, setup-distributor-bucket, verify-distributor-backlink | 3 |
| **Copilot / MCP** | smart-ops-copilot, copilot-draft-knowledge-article, copilot-ingest-method-doc, copilot-publish-knowledge-article, mcp-server, test-api-viewer | 6 |
| **Saúde / Watchdog** | system-watchdog-deepseek, smart-ops-integration-check, audit-vitality-protocol, enrichment-safety-net-cron, smart-ops-stagnant-processor, smart-ops-cs-processor, smart-ops-proactive-outreach | 7 |
| **Outros utilitários** | create-user, data-export, document-proxy, archive-daily-chats, evaluate-interaction, translate-content, translate-card-row, get-product-data, sync-knowledge-base, sync-sistema-a, sync-content-from-a, smart-ops-refresh-system-a-cache, smart-ops-ingest-asset-from-a, smart-ops-generate-card-descriptions, sentinela-*, tldv-*, flow-executor, sequence-runner, pipeline-funnel-data, smart-ops-leads-api, smart-ops-kanban-move, smart-ops-meta-ads-* | ~25 |

### UI da sub-aba "Funções"
- Filtro por categoria + busca por nome
- Cada linha: nome, categoria badge, resumo 1-linha, trigger (cron/http/webhook), invocações 24h, erros 24h, latência média, status (OK/Degradado/Down/Sem dados), `is_critical`
- Para invocações/erros: ler de `function_edge_logs` via `supabase.functions.invoke('smart-ops-function-stats')` (nova edge function que consulta o analytics).

---

## Parte 3 — Painel "Entrada de dados" (sub-aba "Entradas")

Visão consolidada do que chega em 24h por fonte:

| Fonte | Métrica | Origem do dado |
|---|---|---|
| Meta Lead Ads | leads recebidos | `meta_lead_ingestion_log` |
| Form submissions | submissões | `lead_form_submissions` |
| PipeRun webhook | eventos | `piperun_webhook_events` |
| Sellflux webhook | eventos | `wa_send_log`/sellflux logs |
| E-commerce (Loja Integrada) | pedidos | `loja_integrada_orders` |
| Astron postback | acessos | `astron_member_access` |
| Evolution WA inbox | mensagens | `whatsapp_inbox` |
| tldv meetings | reuniões | `tldv_meetings` |
| Google Reviews | reviews | `google_reviews` |
| Zernio | menções/contatos | `social_ig_mentions` |

Componente `IncomingDataPanel.tsx` mostrando gráfico de barras por fonte (últimas 24h vs 7d média) com indicador de queda anormal (>50% drop dispara alerta).

---

## Parte 4 — Cron & deploy

- Manter cron diário existente do `smart-ops-integration-check` (00:00 UTC).
- Adicionar cron horário `smart-ops-function-stats` (sincroniza invocações 24h).
- Deploy: `smart-ops-integration-check`, novo `smart-ops-function-stats`, migrations da tabela `edge_function_catalog` + seed.

---

## Detalhes técnicos

**Tabela nova:**
```sql
CREATE TABLE public.edge_function_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text UNIQUE NOT NULL,
  category text NOT NULL,
  summary text NOT NULL,
  trigger_type text NOT NULL DEFAULT 'http',
  is_critical boolean NOT NULL DEFAULT false,
  deprecated boolean NOT NULL DEFAULT false,
  docs_url text,
  invocations_24h integer DEFAULT 0,
  errors_24h integer DEFAULT 0,
  avg_latency_ms integer,
  last_invocation_at timestamptz,
  updated_at timestamptz DEFAULT now()
);
GRANT SELECT ON public.edge_function_catalog TO authenticated;
GRANT ALL ON public.edge_function_catalog TO service_role;
ALTER TABLE public.edge_function_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read" ON public.edge_function_catalog FOR SELECT TO authenticated USING (true);
```

**Arquivos novos/alterados:**
- `src/components/SmartOpsSystemHealth.tsx` — adicionar 2 tabs novas (Funções, Entradas)
- `src/components/smartops/EdgeFunctionsCatalog.tsx` (novo)
- `src/components/smartops/IncomingDataPanel.tsx` (novo)
- `src/components/smartops/SystemHealthCheck.tsx` — defensive render do `error_message`
- `supabase/functions/smart-ops-function-stats/index.ts` (novo)
- `supabase/functions/smart-ops-integration-check/index.ts` — corrigir serialização de erros + atualizar modelo DeepSeek
- Migration: criar tabela + seed de 192 funções com summary/category

---

## Confirmações antes de implementar

1. **Quer que eu popule o catálogo com TODAS as 192 funções** ou só as ~80 que são realmente operacionais (excluindo `backfill-*`, `fix-*`, `migrate-*`, `create-test-articles` etc. marcadas como deprecated)?
2. **A sub-aba "Entradas"** deve mostrar só a contagem 24h ou também gráfico histórico 7d?
3. **Alertas automáticos**: quando uma fonte cair >50% vs média, abrir um `system_health_logs` crítico automaticamente?