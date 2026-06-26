## Objetivo

Completar `system_integration_registry` com TODAS as conexões externas e implementar ping HTTP real para serviços sem tabela de log local.

## Novas entradas no registry

Inserir via `INSERT` (data, não schema) na `system_integration_registry`:

**Webhooks IN (já existem, manter):** Meta, PipeRun, Sellflux, Loja Integrada, Astron, Evolution, tldv.

**APIs OUT — adicionar:**
| key | label | category | check_type | endpoint |
|---|---|---|---|---|
| `api_evolution_agg` | Evolution WA (agregado todas instâncias) | api_out | http_ping | `GET {base}/instance/connectionState/{name}` por instância em `team_members` — agrega worst-status |
| `api_evolution_go` | EvolutionGo (Danilo-Henrique :8081) | api_out | http_ping | `GET {evo_go_base}/instance/fetchInstances` header `apikey` |
| `api_zernio` | Zernio (Instagram/Facebook) | api_out | http_ping | endpoint `/me` ou healthcheck Zernio + contagem `social_zernio_accounts` ativas |
| `api_google_business` | Google Business Profile (reviews) | api_out | http_ping | `GET mybusinessaccountmanagement.googleapis.com/v1/accounts` com refresh token; expõe "token revogado" |
| `api_google_indexing` | Google Indexing API | api_out | log_count | `google_indexing_log` |
| `api_meta_capi` | Meta Conversions API | api_out | log_count | `meta_capi_event_log` |
| `api_pandavideo` | Pandavideo | api_out | http_ping | `GET api-v2.pandavideo.com.br/videos?limit=1` |
| `api_canva` | Canva Connect | api_out | http_ping | `GET api.canva.com/rest/v1/users/me` |
| `api_involve_me` | Involve.me forms | api_out | log_count | `involve_me_sync_control` |
| `api_drive_kb` | Google Drive (KB sync) | api_out | log_count | `drive_kb_sync_log` |
| `api_tldv_out` | tldv API (fetch meetings) | api_out | log_count | `tldv_meetings` |
| `api_lovable_ai_deepseek` | Lovable AI Gateway — DeepSeek | api_out | http_ping | `POST /v1/chat/completions` ping mínimo modelo deepseek |
| `api_lovable_ai_gemini` | Lovable AI Gateway — Gemini | api_out | http_ping | mesmo gateway, modelo gemini-flash-lite |

**SEO assets (já existem ou adicionar):** robots.txt, sitemap.xml, llms.txt, llms-full.txt.

## Mudanças na edge `smart-ops-integration-check`

Adicionar handlers por `check_type`:
- `http_ping` (novo): faz fetch ao `target_url`/endpoint configurado com headers do secret; mede latência; grava `status` (ok < 800ms, degraded < 3s, down) + `latency_ms` + `http_status` em `system_integration_checks`.
- `evolution_aggregate` (novo): itera `team_members WHERE evolution_instance_name IS NOT NULL`, pinga cada uma, agrega worst-case; salva detail JSONB com lista por instância.
- `log_count` (existente): mantém.

Secrets já configurados serão reutilizados (EVO_KEY, EVOLUTION_GO_KEY, GOOGLE_OAUTH_*, PANDAVIDEO_API_KEY, CANVA_*, LOVABLE_API_KEY, etc.). Se faltar algum, função grava `status=inactive` + `error_message=secret_missing` (não quebra o cron).

## Mudanças no frontend

`SystemHealthCheck.tsx`:
- Adicionar coluna "Latência" (ms) quando `check_type=http_ping`.
- Para Evolution agregado: card expansível listando status por instância (vem do JSONB `detail`).
- Badge extra "Token revogado" quando `error_message` contém `invalid_grant` (Google).

Sem mudança de schema — `system_integration_registry` e `system_integration_checks` já têm `notes`/JSONB suficientes.

## Verificação

Após inserts: clicar "Rodar Check Agora", confirmar:
- Todas linhas novas aparecem agrupadas por categoria.
- EvolutionGo retorna ok (porta 8081 com apikey).
- Google Business retorna "Token expirado" (esperado conforme contexto anterior).
- Latências razoáveis.
