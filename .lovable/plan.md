## Objetivo
Estender a ordenação das abas **Artigos** e **Vídeos** da Base de Conhecimento para uma cascata de 4 níveis (hoje são 3).

## Nova regra de ordenação

Em ambas as abas, o resultado será concatenado nesta ordem, sem duplicatas:

1. **Novos**: até 10 itens com `created_at` nos últimos 30 dias (mais recentes primeiro).
2. **Atualizados**: até 10 itens com `updated_at` nos últimos 30 dias, **excluindo os já mostrados no tier 1** e cujo `created_at` seja **anterior** aos últimos 30 dias (senão contariam como "novos"). Ordenados por `updated_at desc`.
3. **Mais visualizados**: até 10 itens do restante ordenados por views desc (`view_count` em artigos, `analytics_views` em vídeos), com desempate por `created_at desc`.
4. **Restante**: por `created_at desc`.

Zero mock/hardcoded além do número 10 (intencional, já era assim).

## Arquivos tocados (APENAS estes dois)

### `src/components/knowledge/KbTabArtigos.tsx`
- Adicionar `updated_at` ao `.select(...)` (linha 53).
- Depois do bloco `recent` atual, inserir bloco `updatedRecent`:
  ```ts
  const byUpdatedDesc = (a, b) =>
    new Date(b.updated_at ?? b.created_at).getTime() -
    new Date(a.updated_at ?? a.created_at).getTime();
  const afterRecent = dateSorted.filter(r => !recentIds.has(r.id));
  const updatedRecent = afterRecent
    .filter(r => {
      const u = new Date(r.updated_at ?? r.created_at).getTime();
      const c = new Date(r.created_at).getTime();
      return now - u <= THIRTY_DAYS_MS && now - c > THIRTY_DAYS_MS;
    })
    .sort(byUpdatedDesc)
    .slice(0, RECENT_COUNT);
  const updatedIds = new Set(updatedRecent.map(r => r.id));
  const remaining = afterRecent.filter(r => !updatedIds.has(r.id));
  ```
- `topViewed` e `rest` seguem como hoje, mas partindo de `remaining` já sem os "atualizados".
- Concatenar: `[...recent, ...updatedRecent, ...topViewed, ...rest]`.

### `src/components/knowledge/KbTabVideos.tsx`
- Mesmíssima alteração: adicionar `updated_at` ao select da linha 47 e replicar o bloco `updatedRecent` acima do `topViewed` (mantendo o critério de views por `knowledge_videos[0].analytics_views`).

## O que NÃO muda
- Query Supabase continua `.order('created_at', { ascending: false })` — reordenação é 100% client-side pós-fetch.
- Nenhum outro arquivo é tocado.
- Nenhuma mudança em cards, chips, contadores ou busca.
- Comportamento em busca (`term`) permanece o mesmo (a mesma cascata roda sobre o resultado da busca).