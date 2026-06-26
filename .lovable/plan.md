## Objetivo

Criar uma visão única dentro de **Smart Ops → Saúde do Sistema** que mostre em lista TODAS as integrações do sistema (APIs externas, webhooks de entrada, endpoints/edge functions, arquivos de SEO) com badge de status, volume das últimas 24h e timestamp do último evento. Um cron roda diariamente às 00:00 e atualiza os status.

## Estrutura visual

Transformar `SmartOpsSystemHealth.tsx` em um container com `Tabs`:

- **Logs** (conteúdo atual de erros/watchdog) — mantido
- **Check** (NOVO) — inventário consolidado

A aba "Check" terá:

1. **Header com 4 KPIs**: Total integrações, OK, Degradadas, Down, + botão "Rodar Check Agora".
2. **Seções (cards agrupados)**:
   - **Webhooks de entrada** — Meta Leads, PipeRun, Sellflux, Loja Integrada, Astron, Manychat, Evolution WhatsApp, tldv
   - **APIs externas (saída)** — PipeRun, Omie, Sellflux, Loja Integrada, Evolution (por instância), Google Business Profile, Meta CAPI, OpenAI/Lovable AI Gateway, PandaVideo, Canva
   - **Edge Functions críticas** — smart-ops-ingest-lead, smart-ops-lia-assign, smart-ops-piperun-webhook, wa-dispatcher, wa-group-blast, smart-ops-cron-watchdog, etc.
   - **SEO / Bots** — `/robots.txt`, `/llms.txt`, `/llms-full.txt`, `/sitemap.xml`, `/sitemap-index.xml`, video sitemap, bot middleware
3. **Cada linha mostra**:
   - Nome + tipo (webhook/api/edge/seo)
   - Badge de status: 🟢 OK / 🟡 Degradado (>1h sem evento esperado, latência alta, ou erro pontual) / 🔴 Down (sem resposta no último check) / ⚪ Inativo
   - Volume últimas 24h (n eventos / n requests)
   - Último recebimento OU último envio (timestamp relativo: "há 3 min")
   - Latência média (quando aplicável)
   - HTTP status do último check

## Backend

### Tabela `system_integration_registry`
Catálogo declarativo de integrações (seed inicial via migration). Colunas: `id`, `key`, `label`, `category` (webhook_in|api_out|edge_function|seo_asset), `check_type` (http_get|edge_invoke|log_count|file_exists), `target_url`, `expected_status`, `volume_source_table`, `volume_source_column`, `enabled`.

### Tabela `system_integration_checks`
Resultado de cada execução do check. Colunas: `id`, `integration_key`, `checked_at`, `status` (ok|degraded|down|inactive), `http_status`, `latency_ms`, `volume_24h`, `last_event_at`, `error_message`.

Indexada por `(integration_key, checked_at desc)` para a UI buscar sempre o mais recente.

### Edge function `smart-ops-integration-check`
- Itera registry, para cada item executa o check correspondente:
  - **http_get**: HEAD/GET no `target_url`, mede latência e status
  - **edge_invoke**: invoca a edge function com payload `{ healthcheck: true }`
  - **log_count**: conta linhas em `volume_source_table` nas últimas 24h e pega `max(created_at)`
  - **file_exists**: GET no asset SEO público
- Insere uma linha em `system_integration_checks`.
- Calcula status com regras simples:
  - down: http ≥ 500 ou timeout
  - degraded: http 4xx, latência > 3s, ou `last_event_at` > threshold da integração
  - ok: 2xx + dentro do threshold
  - inactive: `enabled=false`

### Cron diário
`pg_cron` às 00:00 UTC chamando `smart-ops-integration-check` via `net.http_post`. Botão "Rodar agora" na UI invoca a mesma função on-demand.

## Frontend

- `SmartOpsSystemHealth.tsx` vira wrapper com `<Tabs>`: "Check" (default) e "Logs" (componente atual extraído para `SmartOpsSystemHealthLogs.tsx`).
- Novo `src/components/smartops/SystemHealthCheck.tsx`:
  - Hook que faz join: `system_integration_registry LEFT JOIN LATERAL system_integration_checks` (último por key)
  - Realtime na tabela `system_integration_checks`
  - Renderiza por categoria com `Card` + `Table`, badges padrão shadcn, ícones lucide
  - Botão "Rodar Check Agora" → `supabase.functions.invoke('smart-ops-integration-check')`

## Detalhes técnicos

- **Sem novos secrets**: usa `SUPABASE_SERVICE_ROLE_KEY` interno e URLs públicas para SEO assets.
- **GRANTs**: `registry` SELECT para `authenticated`; `checks` SELECT para `authenticated`, ALL para `service_role`.
- **RLS**: habilitar e dar SELECT só a `authenticated` (admin já protege a rota).
- **Seed inicial**: ~25-30 integrações catalogadas conforme as 4 seções acima.
- **Sem mexer em `system_health_logs`** nem na aba Logs existente — apenas refatoração de arquivo.
- **Sem alterar regras de negócio** (Golden Rule, lia-assign, etc.) — esta entrega é puramente observability.

## Entregáveis

1. Migration: 2 tabelas + GRANTs/RLS + seed + cron job
2. Edge function `smart-ops-integration-check`
3. `SmartOpsSystemHealthLogs.tsx` (extração do código atual)
4. `SmartOpsSystemHealth.tsx` reescrito como Tabs wrapper
5. `SystemHealthCheck.tsx` (novo componente da aba Check)
