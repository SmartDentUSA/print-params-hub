

# Plano: Corrigir Timeout do data-export (CPU Time exceeded)

## Diagnóstico

O endpoint `data-export?format=ai_ready` falha com **CPU Time exceeded** porque `fetchKnowledgeContents` executa 3 queries individuais por artigo (604 artigos = ~1800 queries):

1. **Linha 634**: `knowledge_videos` por `content_id` — 604 queries
2. **Linha 649**: `resins` por `recommended_resins` IDs — ~200 queries  
3. **Linha 668**: `external_links` por `keyword_ids` — ~300 queries

**Os dados estão corretos** — campos traduzidos, veredict_data, answer_block, geo, ai_context todos presentes. O único problema é performance.

## Correção: Batch queries em vez de N+1

### Arquivo: `supabase/functions/data-export/index.ts`

Substituir os 3 loops N+1 por 3 batch queries pré-carregadas:

```typescript
// ANTES: 604 queries individuais
for (const content of contents) {
  const { data: videos } = await supabase
    .from('knowledge_videos').select('*').eq('content_id', content.id);
}

// DEPOIS: 1 query batch
const contentIds = contents.map(c => c.id);
const { data: allVideos } = await supabase
  .from('knowledge_videos').select('*').in('content_id', contentIds);
const videosByContent = groupBy(allVideos, 'content_id');
```

**3 otimizações específicas:**

1. **Videos**: Buscar todos os `knowledge_videos` com `.in('content_id', contentIds)` e agrupar em memória
2. **Resins**: Coletar todos os `recommended_resins` IDs únicos, fazer 1 query `.in('id', allResinIds)`, distribuir em memória
3. **Keywords**: Coletar todos os `keyword_ids` únicos, fazer 1 query `.in('id', allKeywordIds)`, distribuir em memória

Resultado: de ~1800 queries para **3 queries** + processamento em memória.

Também aplicar a mesma otimização nos loops N+1 de `fetchResins` (linhas 216-235) e `fetchBrands` (linhas 139-148).

## Impacto

- **Antes**: CPU timeout com 604 artigos
- **Depois**: 3 batch queries, resposta em <10s

## Arquivo afetado

- `supabase/functions/data-export/index.ts` — substituir N+1 por batch selects

