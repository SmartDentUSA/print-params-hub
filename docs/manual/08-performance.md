# 08 — Performance

## 8.1 Queries mais custosas (dados reais de `pg_stat_statements`)

| # | Query (normalizada) | Chamadas | Média | Máx | Total |
|---|---|---|---|---|---|
| 1 | `SELECT lia_attendances.* WHERE piperun_id = $1 AND merged_into IS NULL LIMIT 1` | 61.036 | 6,17 ms | 2.380 ms | **376 s** |
| 2 | `UPDATE lia_attendances SET next_upsell_*, recompra_*, workflow_timeline… WHERE id=$1` | 12.399 | 19,96 ms | 808 ms | 247 s |
| 3 | `UPDATE lia_attendances SET piperun_activities, piperun_raw_payload, piperun_deals_history…` | 19.579 | 9,53 ms | 411 ms | 187 s |
| 4 | `UPDATE lia_attendances SET piperun_* (variante)` | 11.018 | 15,42 ms | 1.170 ms | 170 s |
| 5 | `SELECT 68 colunas … WHERE workflow_timeline_updated_at IS NULL OR < $1 ORDER BY ltv_total DESC` | 124 | **1.328 ms** | 7.763 ms | 165 s |
| 6 | `SELECT lia_attendances.* WHERE email = $1 AND merged_into IS NULL` | 4.716 | 23,63 ms | 2.094 ms | 111 s |
| 7 | `SELECT … WHERE platform_lead_id=$1 OR raw_payload->$2 @> $3` | 65 | **1.708 ms** | 7.913 ms | 111 s |
| 8 | `SELECT v_lead_timeline.*` | 338 | **256 ms** | 1.347 ms | 87 s |
| 9 | `SELECT … WHERE total_messages >= $1 AND cognitive_analyzed_at IS NULL ORDER BY intelligence_score_total DESC` | 66 | **1.243 ms** | 6.488 ms | 82 s |
| 10 | `SELECT lia_attendances.* WHERE pessoa_hash = $1 AND merged_into IS NULL` | 10.592 | 6,92 ms | 616 ms | 73 s |

**Diagnóstico**: 9 das 10 queries mais caras batem em `lia_attendances`. O padrão dominante é `SELECT *` numa tabela de **610 colunas / 1 GB** — cada linha lida transporta ~30 kB desnecessários. Os `UPDATE` de alto volume reescrevem tuplas grandes, gerando bloat e I/O de WAL.

### Correções recomendadas (por impacto)

| Ação | Ganho esperado | Esforço | Risco |
|---|---|---|---|
| Trocar `select('*')` por listas de colunas nos lookups por `piperun_id`/`email`/`pessoa_hash` (itens 1, 6, 10) | 60–80% do tempo total dessas queries | Médio (muitos call sites) | Baixo |
| Índices parciais `(piperun_id) WHERE merged_into IS NULL`, `(email) …`, `(pessoa_hash) …` | remove scans residuais; máx de 2 s cai | Baixo | Baixo |
| Índice `(workflow_timeline_updated_at, ltv_total DESC) WHERE merged_into IS NULL` (item 5) | 1,3 s → dezenas de ms | Baixo | Baixo |
| Índice GIN em `raw_payload` + índice em `platform_lead_id` (item 7) | 1,7 s → <100 ms | Baixo | Médio (tamanho do GIN) |
| Índice `(cognitive_analyzed_at, total_messages) WHERE cognitive_analyzed_at IS NULL` (item 9) | 1,2 s → <100 ms | Baixo | Baixo |
| Materializar `v_lead_timeline` por lead (ou paginar por `lead_id` obrigatório) (item 8) | 256 ms → <30 ms | Médio | Médio |
| **Vertical split** de `lia_attendances`: mover `*_raw_payload`, `piperun_activities`, `piperun_deals_history`, `workflow_timeline` para tabela satélite 1:1 | reduz tabela quente em ~70%; melhora todos os itens acima | Alto | Alto (refatorar muitos consumidores) |

## 8.2 Gargalos de backend

| Gargalo | Evidência | Mitigação |
|---|---|---|
| `system_health_logs` 1,7 GB sem retenção | tamanho | expurgo 90 dias + índice por `(created_at, resolved)` |
| Janela de cron 02:00–04:30 com ~12 jobs pesados | `cron.job` | reescalonar indexação/backup |
| `meta-lead-ads-pull` e `flow-executor` a cada minuto | `cron.job` | ok, mas exigem idempotência estrita (já implementada) |
| Export completo com polling de até 12 min | `AdminViewSecure.tsx:118-131` | notificar por e-mail/WhatsApp ao concluir em vez de manter a aba aberta |
| Chromium na Vercel (`render-template`) | `api/render-template.ts` | cachear artefatos gerados |

## 8.3 Frontend

| Item | Situação | Recomendação |
|---|---|---|
| Code splitting | `React.lazy` usado em partes das rotas | garantir lazy em todas as seções `so-*` (componentes de 1.000–2.800 linhas) |
| Bundle | 81 deps, incluindo `exceljs`, `docx`, `jspdf`, `xlsx`, `@xyflow/react`, `recharts` | importar dinamicamente as libs de export/editor só quando o botão é usado |
| Cache de dados | TanStack Query presente, mas várias telas usam `useEffect` + `fetch` manual | padronizar em Query com `staleTime` e invalidação por chave |
| Remount por `refreshKey` | `AdminViewSecure.tsx:408-415` | substituir por `queryClient.invalidateQueries` (evita descartar todo o estado da tela) |
| Realtime | desligado por kill-switch | reavaliar reativação seletiva (fila de WhatsApp, saúde do sistema) |
| Tabelas grandes | render de listas longas sem virtualização | adotar virtualização nas telas de leads/logs |

## 8.4 Estratégia de cache existente

| Cache | Atualização |
|---|---|
| `painel_comercial_cache` | cron 15 min (painel de TV lê só isso) |
| `omie_snapshot_mensal` | cron diário 10:30 |
| `text_embedding_cache`, `image_embedding_cache` | on-demand, evita recomputar embedding |
| `voice_message_cache` | limpo diariamente 06:00 |
| `system_a_catalog` (espelho) | `smart-ops-refresh-system-a-cache` |

## 8.5 Escalabilidade

- Edge Functions escalam horizontalmente; o limite real é **Postgres** (uma instância) e as **quotas dos provedores** (Gmail ~499/dia, rate limit PipeRun, Evolution por instância).
- Filas em tabela já desacoplam picos de ingestão; o risco é o worker em cron de 1 min não vazar o backlog em pico de campanha — monitorar `wa_message_queue` e `email_sequence_dispatches`.
- Próximo teto previsível: `lia_attendances` passando de ~2 GB e `v_lead_timeline` sem materialização.