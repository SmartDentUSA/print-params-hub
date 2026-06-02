# Fix — Analytics Social vazia

## Causa raiz
- Os 4 posts publicados estão com `social_posts.published_at = NULL`.
- O hook `useSocialAnalytics` filtra `.gte('published_at', since)` → todos descartados → cards zerados, gráficos vazios, top posts vazio.
- A `zernio-metrics-sync` também filtra por `published_at`, então roda mas ignora os posts atuais (até resolvermos no sync de origem).
- Bonus: warning de `key` no `Heatmap` (Fragment sem key dentro de `.map`).

## Plano de correção (apenas 3 arquivos)

### 1. `src/hooks/social/useSocialAnalytics.ts`
- Remover filtro server-side `gte('published_at', since)`.
- Selecionar também `created_at` e `scheduled_at`.
- Filtrar no client por `effective_at = published_at ?? scheduled_at ?? created_at >= since`, e expor esse campo derivado.
- Mantém `.order('published_at', { ascending: false, nullsFirst: false })` + segunda ordem por `created_at`.

### 2. `src/components/social/SocialAnalytics.tsx`
- Trocar todos os usos de `x.published_at` por `x.effective_at` (cards, série temporal, heatmap, top posts, export CSV mantém a coluna original `published_at` mas adiciona coluna `effective_at`).
- Corrigir Heatmap: substituir `<>` por `<React.Fragment key={\`row-${di}\`}>` para eliminar warning.
- Empty state melhor quando `posts.length===0` (mensagem "Sem posts no período" no topo).

### 3. `supabase/functions/zernio-metrics-sync/index.ts`
- Trocar o filtro de elegibilidade: usar `coalesce(published_at, created_at) >= since30d` via duas queries OR ou simplesmente `created_at >= since30d`. Mantém limite de 50.
- Quando o insights da Zernio devolver `published_at` (campos comuns: `published_at`, `created_time`, `timestamp`), preencher `published_at` se atualmente NULL — backfill incremental e idempotente.

## Não muda
- Schema de banco intacto.
- Crons, secrets, edge functions de flows/broadcasts/sequences intactos.
- `useResyncMetrics` intacto.

## Validação
1. Após deploy, abrir `/social/analytics` → cards devem mostrar os 4 posts com reach/views/likes existentes.
2. Clicar "Sync" → ver toast com contagem de atualizados.
3. Conferir `social_posts.published_at` populado nas próximas execuções do cron (`*/30 * * * *`).
4. Confirmar console limpo (sem warning de key).