# Roadmap completo — Fases 3 → 6 do Social Publisher

Todas as 14 tabelas já existem (criadas na Fase 0). Falta motor de execução, edge functions, workers, UI builders e polish.

---

## Fase 3 — IG DM Flow Engine (`/social/flows`)

**Objetivo**: capturar comentários e DMs do Instagram (via Zernio webhooks) e disparar flows visuais que enviam DM, coletam respostas, atribuem tags e convertem em lead no CRM.

### 3.1 Webhook receiver
- Edge function `zernio-webhook` (public, sem JWT): recebe `comment.created`, `dm.received`, `dm.delivered` da Zernio. Valida assinatura HMAC (`ZERNIO_WEBHOOK_SECRET`, novo).
- Upsert em `social_contacts` (chave `ig_user_id`) + append em `social_sessions` (uma por contato+flow ativo).
- Cria `social_triggers.event_log` (novo jsonb append-only) com o payload bruto.

### 3.2 Trigger matcher
- `social_triggers` (já existe) tem `type` (`comment_keyword`|`dm_keyword`|`story_reply`|`mention`), `match_rules` (jsonb com keywords/regex), `flow_id`.
- Função `match-trigger` (chamada inline pelo webhook): percorre triggers ativos do canal, faz match em `text` normalizado, enfileira execução do flow.

### 3.3 Flow engine
- Edge function `flow-executor` (cron a cada 30s + invocação direta pós-trigger).
- Estado em `social_sessions` (`current_node_id`, `context jsonb`, `status`, `next_run_at`).
- Tipos de nó implementados em `nodes` (jsonb React Flow): `send_dm`, `send_comment_reply`, `wait` (delay), `condition` (if/else baseado em `context`), `collect_input` (aguarda próxima mensagem), `set_tag`, `set_field`, `create_lead` (chama `smart-ops-ingest-lead`), `goto_flow`, `end`.
- Cada execução: roda nós síncronos em loop até bater em `wait` ou `collect_input`, persiste estado, agenda próximo run.
- Envio de DM via `POST zernio.com/api/v1/dm` (ou endpoint equivalente — confirmar no painel; fallback graph IG se Zernio não tiver).

### 3.4 UI Flow Builder (`/social/flows`)
- Lista de flows (tabela com nome, canal, trigger, execuções, conversões, toggle ativo).
- `/social/flows/novo` e `/social/flows/:id`: canvas React Flow (`reactflow` já instalado? senão `bun add reactflow`) com node palette à esquerda, propriedades à direita.
- Preview de DM (mock do device IG).
- Página `/social/flows/:id/sessions`: lista sessões ativas/completas com replay do contexto.

### 3.5 Hooks/components
- `useFlows`, `useFlow(id)`, `useSaveFlow`, `useToggleFlow`, `useFlowSessions(id)`, `useTriggers`.
- Componentes: `FlowCanvas`, `FlowNodePalette`, `FlowNodeInspector`, nodes (`SendDmNode`, `WaitNode`, `ConditionNode`, …), `TriggerEditor`.

---

## Fase 4 — Broadcasts & Sequences WhatsApp (`/social/broadcasts`)

**Objetivo**: disparos em massa segmentados e sequências automáticas via Evolution API (já em uso no projeto), com fila confiável.

### 4.1 Worker
- Edge function `wa-message-worker` (cron 30s): claim atômico (`FOR UPDATE SKIP LOCKED`) de até 25 mensagens de `wa_message_queue` com `status='pending' AND send_after<=now()`.
- Para cada msg: lê `team_member.evolution_instance_name`, monta payload `/message/sendText` ou `/message/sendMedia`, respeita rate-limit por instância (Redis-less: contador em `wa_send_counters` por minuto/hora).
- Sucesso → `status='sent'`, `wa_message_id` salvo. Erro → retry exponencial (max 3), depois `failed` com `error_code`.

### 4.2 Broadcast engine
- Edge function `wa-broadcast-dispatch`: dado um `broadcast_id`, resolve `segment` (jsonb com filtros: `tags`, `last_seen`, `lead_status`, `funnel_stage`, `has_won`, …) para lista de `social_contacts`+`lia_attendances`, gera N linhas em `wa_message_queue` com `send_after` espalhado (anti-ban, jitter).
- Cron de "agendados": `wa-broadcast-cron` a cada 1 min escala `social_broadcasts` com `status='scheduled' AND scheduled_at<=now()`.

### 4.3 Sequences
- `social_sequences` (steps em jsonb: array de `{delay_minutes, channel, message, condition?}`) + `social_sequence_enrollments` (lead_id, step_index, next_run_at, status).
- Edge function `sequence-runner` (cron 1min): avança enrollments, gera mensagens em `wa_message_queue`. Pausar/cancelar via UI.
- Triggers de enrollment: manual (UI), tag aplicada via flow, evento de funil (já temos `lead_activity_log`).

### 4.4 Grupos WA
- `wa_groups` espelha grupos da Evolution. Sync via `wa-groups-sync` (botão + cron diário).
- `wa_campaign_groups`: many-to-many entre `wa_campaigns` e `wa_groups` para envio em grupos selecionados (suporte a "mensagem para grupos VIP").

### 4.5 UI (`/social/broadcasts`, `/social/sequences`, `/social/contatos`)
- **Broadcasts**: wizard 3 passos (segmento → mensagem → agendamento + preview), tabela de execuções, métricas (enviadas/entregues/respondidas).
- **Sequences**: timeline editor vertical (passos sequenciais), modal de inscrição manual, lista de enrollments.
- **Contatos WA**: tabela com filtros, tags inline, ação "Adicionar à sequência".

---

## Fase 5 — Analytics & Métricas Zernio (`/social/analytics`)

### 5.1 Métricas backend
- Edge function `zernio-metrics-sync` (cron a cada 30 min): para cada `social_posts` com `published_at` < 7 dias e `analytics_synced_at IS NULL OR < now()-interval'1h'`, busca `GET zernio.com/api/v1/posts/:id/insights` por plataforma. Persiste `likes/comments/shares/saves/reach/impressions/views`.
- Botão "Sync agora" no card de cada post.

### 5.2 Página analytics
- Cards de topo: alcance total 7/30d, engajamento médio, top platform, melhor horário (derivado de `published_at` vs engajamento).
- Charts (recharts já no projeto):
  - Linha: engajamento ao longo do tempo (filtros: plataforma, período, conta).
  - Barra empilhada: posts por plataforma × status.
  - Heatmap: dia da semana × hora (melhores janelas).
- Tabela "Top posts" com thumb, métricas, link para edição.
- Export CSV.

### 5.3 Hooks/components
- `useSocialAnalytics(filters)`, `usePostMetrics(id)`, `useResyncMetrics()`.
- `AnalyticsHero`, `EngagementChart`, `PlatformBreakdown`, `BestTimeHeatmap`, `TopPostsTable`.

---

## Fase 6 — Carrosséis multi-mídia + customMedia por canal

### 6.1 Schema
- Migration: `social_scheduled_posts.media_items` (jsonb array `[{url,type,order}]`) e `per_channel_media` (jsonb `{instagram:[…], tiktok:[…]}`). Manter `media_url` legacy.

### 6.2 Worker (atualizar `social-publish-worker`)
- Para cada post: se `per_channel_media[channel]` existir, usa-o; senão usa `media_items`. Mapeia para `mediaItems` ou `customMedia` do payload Zernio conforme spec.
- Validação por plataforma: IG carrossel máx 10 itens, TikTok 1 vídeo, etc. Posts inválidos → `status='failed'` com `publish_errors.code='media_validation'`.

### 6.3 Editor (`SocialPostEditor`)
- Substituir uploader único por `MediaCarouselUploader`: drag-drop ordenável (`@dnd-kit/sortable`), preview, remoção, suporte a vídeo+imagem misturados.
- Toggle "Customizar por canal" → abre `PerChannelMediaTabs` (1 tab por plataforma selecionada, cada uma com seu próprio uploader).
- Validações inline (contagem/tipo/tamanho) por canal.

### 6.4 Preview
- `PostPreviewCarousel` no painel direito: simulador IG carrossel (swipe), TikTok vertical, Reels.

---

## Cron jobs novos (SQL insert, sem migration)

```text
zernio-webhook            → não tem cron (público)
flow-executor             → */30s (via 2 jobs a cada minuto deslocados, ou 1 min)
wa-message-worker         → */30s
wa-broadcast-cron         → '* * * * *' (1 min)
sequence-runner           → '* * * * *'
zernio-metrics-sync       → '*/30 * * * *'
wa-groups-sync            → '0 3 * * *' (diário)
```

---

## Polish global

- Realtime (`supabase.channel`) em: lista de flows (status sessões), broadcasts (progresso de envio), posts (status publicação).
- Empty states ilustrados em cada nova página.
- Toasts consistentes (sucesso/erro/loading) via `sonner`.
- Loading skeletons em todas tabelas.
- Dark-mode garantido (tokens HSL já existentes).
- Logs JSON estruturados em todas edge functions.
- Rate-limit anti-abuso em `zernio-webhook` (IP + assinatura).

---

## Detalhes técnicos / dependências

- Bibliotecas a instalar: `reactflow`, `@dnd-kit/core`, `@dnd-kit/sortable` (se ausentes).
- Secrets novos: `ZERNIO_WEBHOOK_SECRET` (Fase 3, pedido via `add_secret`).
- Confirmação necessária da Zernio: endpoint exato de DM out (`/dm/send`?) e payload de webhooks. Plano: detectar via tentativa + fallback para Instagram Graph se Zernio não suportar DM out (improvável; tem features de Inbox).
- Todas tabelas novas/alteradas seguem padrão GRANT + RLS (authenticated read; service_role write para queues internas).

---

## Ordem de execução (estimativa: 12-15 mensagens)

```text
A. Fase 6 (carrosséis)  ← menor risco, melhora editor já existente
   1. migration colunas mídia
   2. atualizar worker + editor + preview

B. Fase 5 (analytics)   ← read-only, valida antes de flows
   3. edge zernio-metrics-sync + cron
   4. UI /social/analytics

C. Fase 3 (flows)       ← core do IG DM
   5. add_secret ZERNIO_WEBHOOK_SECRET
   6. edges zernio-webhook + flow-executor
   7. UI flow builder (canvas + nodes)
   8. UI sessões + triggers

D. Fase 4 (WA broadcasts)
   9. edges wa-message-worker + wa-broadcast-dispatch + sequence-runner + wa-groups-sync
   10. crons
   11. UI broadcasts (wizard) + sequences + grupos + contatos

E. Polish final
   12. realtime + empty states + skeletons em todas páginas novas
```

Pronto pra rodar tudo na sequência após sua aprovação.