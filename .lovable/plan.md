

# Plano: Corrigir knowledge-feed para exportar TODOS os artigos

## Problemas Identificados

1. **Limite máximo de 500 trunca 104 artigos** — Existem 604 artigos ativos (A-F), mas o `Math.min(limit, 500)` corta em 500. O Supabase SDK também tem limite padrão de 1000 rows.
2. **FAQs duplicadas persistem** — A função `deduplicateFaqs` existe mas preciso verificar se está sendo chamada corretamente no output JSON.
3. **Categoria B vazia** — Não é bug, mas o endpoint deveria incluir `total_count` na metadata para o sistema consumidor saber quantos artigos existem.

## Correções

### Arquivo: `supabase/functions/knowledge-feed/index.ts`

1. **Aumentar limite máximo para 1000** (cobrir os 604 artigos atuais com margem):
   - `Math.min(parseInt(limit || '100'), 1000)` — default 100, max 1000
   
2. **Adicionar `total_count` na metadata do feed** para que o sistema consumidor saiba se está recebendo tudo:
   - Fazer um `count` query separado e incluir no objeto `feed`

3. **Verificar e garantir que `deduplicateFaqs` está sendo aplicada** nos campos `faqs`, `faqs_en`, `faqs_es` do output JSON

4. **Adicionar paginação** via `?offset=0` para permitir consumo em lotes se o total ultrapassar 1000

## Detalhes Técnicos

```typescript
// Aumentar limite
const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 1000);
const offset = parseInt(url.searchParams.get('offset') || '0');

// Count total
const { count } = await supabase
  .from('knowledge_contents')
  .select('id', { count: 'exact', head: true })
  .in('category_id', categoryIds)
  .eq('active', true);

// Query com range
.range(offset, offset + limit - 1)

// Feed metadata
feed: {
  ...existing,
  total_count: count,
  offset,
  limit,
  has_more: (offset + limit) < count
}
```

## Arquivo Afetado

- `supabase/functions/knowledge-feed/index.ts`

