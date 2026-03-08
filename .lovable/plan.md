

# Adicionar `knowledge_graph` ao `formatAiReady()`

## Resumo

Três alterações no arquivo `supabase/functions/data-export/index.ts`:

1. **Expandir `fetchKnowledgeVideos()`** (linha 657) — adicionar `product_id`, `resin_id`, `analytics_views`, `analytics_plays`, `video_duration_seconds` ao select
2. **Criar função `buildKnowledgeGraph(data)`** (após linha 1457) — gera `nodes` + `relations` + `meta` a partir dos dados já carregados
3. **Integrar no `formatAiReady()`** (linha 1457) — adicionar `knowledge_graph: buildKnowledgeGraph(data)` ao retorno
4. **Atualizar `formatCompact()`** (após linha 961) — adicionar `knowledge_videos` ao formato compact

## Detalhes técnicos

### 1. `fetchKnowledgeVideos()` — expandir select

Adicionar ao select existente (linha 660-667):
- `product_id, resin_id, analytics_views, analytics_plays, preview_url, folder_id, product_match_status, content_type`

### 2. `buildKnowledgeGraph(data)` — nova função

**nodes.documents** — merge `resin_documents` + `catalog_documents`:
- IDs prefixados: `doc_${id}`
- Campos: `entity_type, title, file_url, file_size, mime_type, description, language, date_published, related_resin_id, related_product_id`
- Para resin_documents: `related_resin_id = resin_id`, `related_product_id = null`
- Para catalog_documents: `related_product_id = product_id`, `related_resin_id = null`

**nodes.videos** — merge `product_videos` + `resin_videos` + `knowledge_videos`, deduplicados por `id`:
- IDs prefixados: `video_${id}`
- Campos: `entity_type, title, embed_url, thumbnail, transcription, tags, duration_seconds, source_platform, upload_date, related_product_id, related_resin_id`
- `source_platform`: derivar de `video_type` (pandavideo/youtube)

**nodes.authors** — flatten do array `authors`:
- IDs prefixados: `author_${id}`
- Campos flat: `name, specialty, bio (full_bio), photo_url, instagram (instagram_url), youtube (youtube_url), lattes (lattes_url)`

**nodes.articles** — do array `knowledge_contents`:
- IDs prefixados: `article_${id}`
- Campos: `title, slug, excerpt, category (category_letter), public_url, author_id, keywords`

**relations** — inferidas automaticamente:
- Cada video com `product_id` → `{ source_type: "video", source_id: "video_X", target_type: "product", target_id: product_id, relation: "demonstrates" }`
- Cada video com `resin_id` → `relation: "demonstrates"`
- Cada video com `content_id` → `target_type: "article", relation: "explains"`
- Cada document com `resin_id` → `relation: "technical_documentation"`
- Cada document com `product_id` → `relation: "technical_documentation"`
- Cada article com `author_id` → `relation: "authored_by"`
- Cada article com `recommended_resins[]` → `relation: "recommends"` (uma relação por resina)

**meta**:
```
{ node_count, relation_count, generated_at }
```

### 3. Integrar no retorno de `formatAiReady()`

Adicionar como última propriedade do objeto retornado (linha ~1457):
```
knowledge_graph: buildKnowledgeGraph(data)
```

### 4. Adicionar `knowledge_videos` ao `formatCompact()`

Após `resin_videos` (linha 941), adicionar bloco `knowledge_videos` com formato simplificado:
```
{ id, pandavideo_id, content_id, content_title, title, embed_url, thumbnail_url, video_duration_seconds, panda_tags }
```

### Performance

Zero queries adicionais — usa exclusivamente os dados já carregados no pipeline. Apenas transformação em memória com deduplicação por Set.

