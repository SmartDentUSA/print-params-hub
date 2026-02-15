

# Ordenar "Últimas Publicações" por Visualizações (Mais Populares Primeiro)

## Situacao Atual

O feed de artigos no componente `KnowledgeFeed` ordena por `created_at DESC` (mais recentes primeiro). Os dados de visualizacao existem na tabela `knowledge_videos`, onde cada video tem `analytics_views` vinculado a um artigo via `content_id`.

## Estrategia

Criar uma view ou query que agrega o total de visualizacoes dos videos por artigo e usar esse total como criterio de ordenacao. Artigos sem videos ou sem views aparecerao por ultimo, ordenados por data.

## Implementacao

### 1. Criar View no Supabase (migracao)

Criar uma view `knowledge_content_popularity` que agrega views por `content_id`:

```sql
CREATE VIEW knowledge_content_popularity AS
SELECT 
  content_id,
  COALESCE(SUM(analytics_views), 0) AS total_views,
  COALESCE(SUM(analytics_unique_views), 0) AS total_unique_views,
  COALESCE(SUM(analytics_plays), 0) AS total_plays
FROM knowledge_videos
WHERE content_id IS NOT NULL
GROUP BY content_id;
```

### 2. Atualizar `useLatestKnowledgeArticles.ts`

Alterar a query para fazer um LEFT JOIN com a view de popularidade e ordenar por `total_views DESC`, com fallback para `created_at DESC` para artigos sem views:

- Buscar artigos normalmente da `knowledge_contents`
- Buscar a agregacao de views da view `knowledge_content_popularity`
- Fazer o merge no client-side e ordenar por views decrescente

**Alternativa mais simples (sem view):** Fazer duas queries paralelas:
1. Buscar artigos ativos
2. Buscar agregacao de views por content_id da `knowledge_videos`
3. Fazer merge e sort no client

Esta alternativa nao requer migracao e funciona imediatamente.

### 3. Arquivo alterado

- `src/hooks/useLatestKnowledgeArticles.ts` - Adicionar query secundaria para buscar views e ordenar pelo total

```typescript
// Query 1: artigos
const { data: articlesData } = await supabase
  .from('knowledge_contents')
  .select(`id, title, title_es, title_en, slug, excerpt, excerpt_es, excerpt_en,
           og_image_url, content_image_url, content_image_alt, created_at,
           knowledge_categories(name, letter)`)
  .eq('active', true);

// Query 2: views agregadas por content_id
const { data: viewsData } = await supabase
  .from('knowledge_videos')
  .select('content_id, analytics_views')
  .not('content_id', 'is', null);

// Agregar views por content_id
const viewsMap = new Map<string, number>();
viewsData?.forEach(v => {
  const current = viewsMap.get(v.content_id) || 0;
  viewsMap.set(v.content_id, current + (v.analytics_views || 0));
});

// Ordenar por views DESC, fallback created_at DESC
const sorted = (articlesData || [])
  .sort((a, b) => {
    const viewsA = viewsMap.get(a.id) || 0;
    const viewsB = viewsMap.get(b.id) || 0;
    if (viewsB !== viewsA) return viewsB - viewsA;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  })
  .slice(0, limit);
```

## Resultado

| Criterio | Antes | Depois |
|---|---|---|
| Ordenacao | Data de criacao | Views totais (desc) |
| Fallback | Nenhum | Data de criacao (desc) |
| Dados usados | Nenhuma metrica | analytics_views de knowledge_videos |
| Migracao necessaria | - | Nenhuma |

Os artigos mais assistidos pelos usuarios aparecerao primeiro no carrossel, incentivando engajamento com conteudo ja validado pela audiencia.

