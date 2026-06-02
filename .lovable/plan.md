# Social Publisher — Fases 1C, 1D e 2 (sequencial)

Implementação encadeada das três próximas fases. Cada fase é independente, com validação antes de avançar.

---

## Fase 1C — Calendário com Drag & Drop

**Rota:** novo toggle `Lista | Calendário` em `/social` (header do `SocialDashboard`).

**Componentes novos:**
- `src/components/social/calendar/SocialCalendar.tsx` — grade mês/semana usando `date-fns` + grid Tailwind (sem libs novas).
- `src/components/social/calendar/CalendarDayCell.tsx` — célula com posts do dia, accept de drop.
- `src/components/social/calendar/CalendarPostChip.tsx` — chip arrastável (canal + horário + 1ª linha caption).
- `src/components/social/calendar/CalendarFilters.tsx` — filtros canal/status/produto.

**DnD:** HTML5 nativo (`draggable`, `onDragStart`, `onDrop`) — sem dependência externa. Drop em outro dia abre modal `RescheduleDialog` pedindo horário (mantém hora original por padrão).

**Hook novo:** `useReschedulePost.ts` — `UPDATE social_scheduled_posts SET scheduled_at=..., status='scheduled' WHERE id=...` (só permite quando `status IN ('scheduled','failed')`).

**View modes:**
- Mês (default): 7×6 grid.
- Semana: 7 colunas com slots de hora (06h-22h).

**Estado:** `useUpcomingPosts` já busca próximos posts; estendido para receber range `{from,to}` opcional.

---

## Fase 1D — Editar post existente

**Rota nova:** `/social/:id/editar` em `App.tsx`.

**Reaproveitamento:** `SocialPostEditor` recebe prop opcional `initialPost?: PostInput & {id, status}`. Quando preenchido:
- Carrega dados via novo hook `useScheduledPost(id)`.
- Bloqueia edição se `status NOT IN ('scheduled','failed','draft')` (exibe banner read-only).
- Substitui `useCreateScheduledPost` por `useUpdateScheduledPost` (`UPDATE` em vez de `INSERT`).

**Trigger de edição:** botão "Editar" em `SocialPostCard` (já existe na lista) → `navigate('/social/'+id+'/editar')`.

**Hooks novos:**
- `useScheduledPost.ts` — fetch single + parse `media_items`/`channels` de jsonb para o shape de `PostInput`.
- `useUpdateScheduledPost.ts` — `.update()` + invalidação de cache.

**Reagendamento de falha:** quando `status='failed'`, botão extra "Reenfileirar" volta para `status='publishing'`.

---

## Fase 2 — IG Flow Engine (publicação real)

Worker que consome `social_scheduled_posts` e publica no Instagram via Graph API.

### Secrets necessárias (pedidas via `add_secret` no início da fase)
- `META_GRAPH_ACCESS_TOKEN` — token de longa duração (Page/IG Business).
- `META_IG_BUSINESS_ACCOUNT_ID` — ID da conta IG Business.

Se faltar qualquer uma, paramos antes de criar edge function.

### Edge Function: `supabase/functions/social-publish-worker/index.ts`

Fluxo por execução:
1. `SELECT` posts onde:
   - `publish_now=true AND status='publishing'`, OU
   - `status='scheduled' AND scheduled_at <= now()`
   - `LIMIT 10`, lock via `UPDATE ... SET status='publishing' RETURNING *` (claim atômico).
2. Para cada post, iterar `channels`:
   - `instagram_feed` → criar container `POST /{ig_id}/media` (image_url ou video_url + caption) → `POST /{ig_id}/media_publish`.
   - `instagram_reels` → container com `media_type=REELS`.
   - `instagram_stories` → `media_type=STORIES`.
   - Outros canais ficam `status='not_implemented'` no `publish_errors` (fora do escopo desta fase).
3. Multi-mídia (carousel): criar 1 container por item com `is_carousel_item=true`, depois container `CAROUSEL` com `children=...`.
4. `first_comment` → após publish, `POST /{ig_media_id}/comments`.
5. Salvar `social_post_ids[]` (IG media ids) + `published_at=now()` + `status='published'`.
6. Erros: `publish_errors` jsonb com `{channel, code, message, at}` + `status='failed'` (mantém para retry manual).

### Cron (via `pg_cron` + `pg_net`)
- Job `social-publish-worker` a cada 1 min: `POST` para a edge function. SQL gravado via `supabase--read_query` insert-side (não migration — contém anon key).

### Hook frontend `useRetryPublish(id)`
- Botão "Republicar" em `SocialPostCard` quando `status='failed'`: marca `status='publishing'`, `publish_errors=null`.

### Observabilidade
- Logs estruturados (`console.log` JSON) no worker para `supabase--edge_function_logs`.
- Badge de status atualizado em tempo real via `supabase.channel('social-posts').on('postgres_changes',...)` em `useUpcomingPosts`.

### Fora do escopo desta fase
- Facebook, LinkedIn, TikTok, YouTube, Pinterest, Reddit, Threads (ficarão com `not_implemented`).
- Métricas pós-publicação (likes/reach) — fase futura.

---

## Ordem de execução e checkpoints

```text
Fase 1C  →  você valida no preview (DnD + filtros)
   ↓
Fase 1D  →  você valida edição/republicação
   ↓
Pedimos secrets META_*  →  Fase 2 worker + cron  →  publish real de teste
```

Após cada fase paro para você testar antes de seguir. Se preferir não pausar, avise e emendo direto.
