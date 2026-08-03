# Auditoria Técnica — Edge Functions (Sistema B · okeogjgqijbfkudfjadz)

237 funções analisadas + 1 diretório compartilhado `_shared`. Fonte: código-fonte do repositório, `supabase/config.toml`, `cron.job` (83 jobs), `vercel.json`.

## 1. Classificação por uso

| Classificação | Qtd |
|---|---|
| ativa | 165 |
| SUSPEITA MORTA | 37 |
| operacional-pontual (one-off/backfill) | 35 |

Gatilhos detectados: `cron` (64 funções agendadas), `vercel-rewrite` (15 rotas públicas), `ui` (chamadas do painel), `fn-chain` (uma função chama outra), `webhook-externo` (Meta, Zernio, Stripe, Sellflux, ManyChat, Loja Integrada, EvolutionGO).

## 2. Distribuição por domínio

| Domínio | Funções |
|---|---|
| Outros | 120 |
| CRM PipeRun | 20 |
| WhatsApp | 19 |
| Conteúdo/SEO | 18 |
| Social | 13 |
| Treinamentos | 10 |
| Meta Ads | 8 |
| IA / Dra. LIA | 7 |
| Campanhas | 5 |
| Academy | 4 |
| E-commerce | 4 |
| Catálogo | 3 |
| Distribuição | 3 |
| ERP Omie | 2 |
| Pagamentos | 1 |

## 3. Funções sem gatilho detectado (candidatas a remoção)

`astron-member-lookup`, `email-track-open`, `enrichment-safety-net-cron`, `export-parametros-ia`, `export-processing-instructions`, `link-videos-to-articles`, `llms-txt`, `mcp`, `mcp-server`, `piperun-offline-enrich`, `poll-loja-integrada-orders`, `seo-proxy`, `smart-ops-ingest-asset-from-a`, `smart-ops-kanban-move`, `smart-ops-lead-welcome`, `smart-ops-leads-api`, `smart-ops-meta-ads-insights`, `smart-ops-meta-ads-manager`, `smart-ops-piperun-detach-wrong-person`, `smart-ops-preview-seller-note`, `smart-ops-proactive-outreach`, `smart-ops-sellflux-sync`, `smart-ops-sequence-email-tick`, `smart-ops-stagnant-processor`, `smart-ops-tldv-sync`, `sync-sistema-a`, `test-api-viewer`, `training-factory-carousel`, `training-factory-generate-image`, `training-factory-render`, `training-factory-trigger`, `video-sitemap`, `wa-instance-health`, `wa-provider-selftest`, `wa-verify-lead`, `zernio-accounts-sync`, `zernio-provision-flow`

> Antes de excluir: confirmar 30 dias sem invocação nos logs da função. Recomendo desativar (retornar 410 Gone) por 1 sprint e só então deletar.

## 4. Funções operacionais pontuais (backfill / diagnóstico / one-off)

35 funções: `audit-vitality-protocol`, `backfill-crm-activities`, `backfill-deals-append`, `backfill-hits-granular`, `backfill-ltv`, `backfill-primary-deal`, `backfill-stranded-won-deals`, `fix-category-e-cleanup`, `fix-corrupted-links`, `fix-piperun-links`, `gate0-runtime-audit`, `meta-sem-crm-seed`, `omie-api-explorer`, `piperun-api-test`, `piperun-deal-diag`, `piperun-equipment-backfill`, `piperun-mirror-import`, `piperun-person-empty-sweeper`, `piperun-vendas-open-recon`, `piperun-vendas-status-hydrate`, `rayshape-fix-placeholder-leads`, `setup-distributor-bucket`, `smart-ops-activity-identity-backfill`, `smart-ops-backfill-equipment-from-deals`, `smart-ops-backfill-person-origin`, `smart-ops-backfill-pessoa-piperun-id`, `smart-ops-csv-audit-backfill`, `smart-ops-csv-vendas-backfill`, `smart-ops-identity-dryrun`, `smart-ops-li-import-runner`, `smart-ops-meta-csv-backfill`, `smart-ops-piperun-backfill-customfields`, `smart-ops-reassign-danilo-vendas`, `smart-ops-restore-vendas-snapshot`, `smart-ops-revert-auto-trigger`

> Débito técnico: scripts de correção histórica seguem publicados e acessíveis. Devem ser movidos para um único `admin-maintenance` com verificação de papel `admin`, ou removidos após uso.

## 5. Segurança

- `verify_jwt = true` em config: 6 função(ões) → `ai-metadata-generator`, `create-test-articles`, `create-user`, `heal-knowledge-gaps`, `piperun-api-test`, `smart-ops-identity-dryrun`.
- Padrão do projeto: `verify_jwt = false` + validação no código. Funções que validam identidade no código (getClaims/getUser): 4.
- Funções que validam assinatura de webhook: 7.
- **Risco alto — endpoint público sem autenticação nem assinatura, usando SERVICE_ROLE_KEY: 189 funções.** Qualquer pessoa com a URL pode acionar escrita no banco com privilégio total.
- Sem cabeçalhos CORS: 7 → `evaluate-interaction`, `mcp`, `mcp-server`, `setup-distributor-bucket`, `short-link-redirect`, `short-link-resolve`, `stripe-webhook`.

### Ações de segurança prioritárias
1. Definir um segredo compartilhado (`INTERNAL_FN_TOKEN`) exigido em todas as funções de cron/backfill; cron passa o header, humanos não conseguem acionar.
2. Validar assinatura em todos os webhooks externos (Meta `X-Hub-Signature-256`, Stripe `stripe-signature`, Zernio/Sellflux token no header).
3. Funções que só o painel usa: exigir JWT + checar papel via `has_role`, nunca confiar em campo enviado pelo cliente.
4. Reduzir uso de SERVICE_ROLE: quando a função age em nome do usuário, repassar o JWT e deixar a RLS trabalhar.

## 6. Integrações externas (por número de funções)

| Host externo | Funções |
|---|---|
| ai.gateway.lovable.dev | 27 |
| parametros.smartdent.com.br | 21 |
| api.deepseek.com | 10 |
| zernio.com | 9 |
| loja.smartdent.com.br | 6 |
| api.awsli.com.br | 6 |
| graph.facebook.com | 6 |
| smartdentacademy.astronmembers.com | 5 |
| www.youtube.com | 5 |
| wa.me | 5 |
| schema.org | 4 |
| admin.smartdent.com.br | 4 |
| api.pipe.run | 4 |
| api-v2.pandavideo.com.br | 4 |
| www.smartdent.com.br | 3 |
| app.pipe.run | 3 |
| connector-gateway.lovable.dev | 3 |
| api.manychat.com | 3 |
| pasta.tldv.io | 3 |
| api.astronmembers.com.br | 2 |
| www.instagram.com | 2 |
| oauth2.googleapis.com | 2 |
| mybusiness.googleapis.com | 2 |
| smartdent.com.br | 2 |
| www.wikidata.org | 2 |

## 7. Variáveis de ambiente mais usadas

| Variável | Funções |
|---|---|
| SUPABASE_URL | 213 |
| SUPABASE_SERVICE_ROLE_KEY | 204 |
| LOVABLE_API_KEY | 34 |
| PIPERUN_API_KEY | 30 |
| SUPABASE_ANON_KEY | 19 |
| DEEPSEEK_API_KEY | 10 |
| ZERNIO_API_KEY | 10 |
| GOOGLE_AI_KEY | 7 |
| LOJA_INTEGRADA_API_KEY | 6 |
| LOJA_INTEGRADA_APP_KEY | 6 |
| META_LEAD_ADS_TOKEN | 6 |
| EVOLUTION_API_KEY | 5 |
| PANDAVIDEO_API_KEY | 5 |
| PIPERUN_API_TOKEN | 5 |
| SELLFLUX_WEBHOOK_CAMPANHAS | 5 |
| EVOLUTION_API_URL | 3 |
| MANYCHAT_API_KEY | 3 |
| TLDV_API_KEY | 3 |
| POE_API_KEY | 2 |
| ASTRON_AM_KEY | 2 |
| ASTRON_AM_SECRET | 2 |
| ASTRON_CLUB_ID | 2 |
| SELLFLUX_WEBHOOK_LEADS | 2 |
| GOOGLE_CLIENT_ID | 2 |
| GOOGLE_CLIENT_SECRET | 2 |

> Verificar se todas seguem cadastradas; segredo ausente causa falha silenciosa em função de cron (sem usuário para ver o erro).

## 8. Banco de dados — tabelas mais acopladas

| Tabela | Funções que escrevem/leem |
|---|---|
| lia_attendances | 83 |
| system_health_logs | 42 |
| team_members | 34 |
| knowledge_contents | 29 |
| system_a_catalog | 27 |
| resins | 20 |
| lead_activity_log | 16 |
| deals | 13 |
| knowledge_videos | 12 |
| knowledge_categories | 10 |
| smartops_course_enrollments | 10 |
| message_logs | 10 |
| parameter_sets | 9 |
| agent_interactions | 9 |
| smartops_course_turmas | 9 |
| wa_groups | 9 |
| external_links | 7 |
| campaign_send_log | 7 |
| resin_documents | 6 |
| brands | 6 |
| models | 6 |
| whatsapp_inbox | 6 |
| authors | 5 |
| leads | 5 |
| distributors | 5 |

Pontos de atenção:
- `lia_attendances` (610 colunas) é tocada por 83 funções — qualquer alteração de coluna tem raio de impacto enorme. Toda leitura precisa de `merged_into IS NULL`.
- `system_health_logs` recebe escrita de 42 funções e já passa de 2,6 M linhas sem política de retenção.
- `team_members` (34 funções) concentra credenciais por instância de WhatsApp — leitura obrigatória por instância, `EVO_KEY` global só como fallback.

## 9. Maiores funções (candidatas a refatoração)

| Função | Linhas | Domínio |
|---|---|---|
| `smart-ops-lia-assign` | 4563 | IA / Dra. LIA |
| `dra-lia` | 4542 | IA / Dra. LIA |
| `smart-ops-copilot` | 3604 | Outros |
| `seo-proxy` | 3199 | Conteúdo/SEO |
| `data-export` | 2092 | Outros |
| `smart-ops-ingest-lead` | 1974 | Outros |
| `smart-ops-piperun-webhook` | 1790 | CRM PipeRun |
| `omie-lead-enricher` | 1445 | ERP Omie |
| `ai-orchestrate-content` | 1243 | Outros |
| `export-apostila-docx` | 1239 | Outros |
| `smart-ops-ecommerce-webhook` | 1085 | Outros |
| `smart-ops-generate-email-ai` | 1082 | Campanhas |

## 10. Fluxo técnico típico

```
Origem (cron | webhook externo | painel | rewrite Vercel)
  → Edge Function (Deno) valida entrada
  → módulos `_shared` (commercial-intent, golden-rule-guard, wa-provider-router, dental-taxonomy, meta-form-resolver, catalog-sku-resolver)
  → Postgres via service role (upsert idempotente)
  → efeito externo (PipeRun, Omie, Evolution, Meta, Stripe)
  → log em `system_health_logs` / `lead_activity_log`
  → resposta JSON (webhooks respondem 200 antes de processar, via EdgeRuntime.waitUntil)
```

## 11. Relatório executivo

**Pontos fortes**
- Lógica crítica centralizada em `_shared` (Regra de Ouro, intenção comercial, roteador de WhatsApp, taxonomia) — evita divergência entre funções.
- Webhooks já respondem 200 imediatamente com processamento em background; deduplicação atômica em claim de linha.
- Idempotência por upsert e locks em banco (TTL) nas rotinas de risco de concorrência.
- Observabilidade própria: `system_health_logs`, watchdogs em cron e telas de Saúde do Sistema.

**Problemas encontrados**
- 189 endpoints públicos operando com service role sem autenticação ou assinatura.
- 37 funções sem gatilho detectável e 35 scripts pontuais ainda publicados.
- Ausência total de testes automatizados nas funções (nenhum `*_test.ts`).
- `system_health_logs` sem retenção; custo e lentidão crescentes.
- Funções muito grandes (acima de 1.000 linhas) concentrando regra de negócio e I/O no mesmo arquivo.

**Débitos técnicos**
1. Padronizar autenticação (token interno para cron, assinatura para webhook, JWT+papel para painel).
2. Consolidar backfills em uma função administrativa única.
3. Testes Deno para os módulos puros de `_shared` (maior impacto financeiro).
4. Retenção/particionamento de logs.
5. Quebrar as funções gigantes em handlers + serviços.

**Riscos críticos**
- Acionamento indevido de função de escrita pública → corrupção de dados de lead/CRM.
- Falta de teste na Regra de Ouro → duplicação ou perda de negócios no Funil de Vendas.
- Segredo de instância WhatsApp ausente → disparo silenciosamente perdido.
- Crescimento de logs → degradação de consultas do painel.

**Melhorias prioritárias (ordem)**
1. Token interno + assinatura de webhooks (segurança, 1 sprint).
2. Retenção de `system_health_logs` (performance, 1 dia).
3. Testes Deno em `_shared` (confiabilidade financeira).
4. Limpeza de funções mortas e one-offs (superfície de ataque).
5. Refatoração das 12 maiores funções.

Planilha detalhada função a função: `EF_Auditoria_Inventario.csv` (colunas: classificação, gatilhos, modelo de autenticação, service role, CORS, linhas, tabelas, RPCs, hosts externos, variáveis de ambiente, dependências).