

# Fix: Oscilação na "Distribuição por Tipo de Fonte"

## Causa raiz

A query na linha 288 de `AdminDraLIAStats.tsx` busca **todos os registros** da tabela `agent_embeddings`:

```typescript
supabase.from("agent_embeddings")
  .select("source_type, embedding_updated_at")
  .order("embedding_updated_at", { ascending: false })
```

A tabela tem **1.851 registros**, mas o Supabase retorna no maximo **1.000 por request** (limite padrao). A cada reload, um subset diferente de 1.000 registros e retornado, causando contagens diferentes e a oscilacao visual.

**Dados reais no banco:**

| Fonte | Chunks reais |
|---|---|
| Videos | 733 |
| Empresa e Parcerias | 397 |
| Artigos | 353 |
| Parametros | 260 |
| Produtos Catalogo | 94 |
| Resinas | 14 |
| **Total** | **1.851** |

## Solucao

Substituir a query que baixa todos os registros por uma **RPC SQL** que faz o `COUNT` + `GROUP BY` diretamente no banco, retornando apenas 6 linhas em vez de 1.851.

### Passo 1 -- Criar funcao SQL no Supabase

```sql
CREATE OR REPLACE FUNCTION get_rag_stats()
RETURNS TABLE (
  source_type text,
  chunk_count bigint,
  last_indexed_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    ae.source_type,
    count(*)::bigint AS chunk_count,
    max(ae.embedding_updated_at) AS last_indexed_at
  FROM agent_embeddings ae
  GROUP BY ae.source_type
  ORDER BY chunk_count DESC;
$$;
```

### Passo 2 -- Atualizar `fetchRAGStats` no componente

Substituir a query atual (linhas 285-317) por uma chamada RPC:

```typescript
const fetchRAGStats = useCallback(async () => {
  try {
    const [rpcResult, artResult] = await Promise.all([
      supabase.rpc("get_rag_stats"),
      supabase.from("knowledge_contents")
        .select("id", { count: "exact" })
        .eq("active", true),
    ]);

    const rows = rpcResult.data ?? [];
    const totalChunks = rows.reduce((sum, r) => sum + Number(r.chunk_count), 0);
    const bySourceType = rows.map(r => ({
      source_type: r.source_type,
      count: Number(r.chunk_count),
    }));
    const lastIndexedAt = rows.length > 0
      ? rows.reduce((max, r) =>
          r.last_indexed_at && r.last_indexed_at > max ? r.last_indexed_at : max,
          rows[0].last_indexed_at ?? ""
        )
      : null;

    const articleEntry = rows.find(r => r.source_type === "article");
    const indexedArticleChunks = articleEntry
      ? Number(articleEntry.chunk_count) : 0;

    setRagStats({
      totalChunks,
      bySourceType,
      lastIndexedAt,
      totalArticles: artResult.count ?? 0,
      indexedArticles: indexedArticleChunks,
    });
  } catch (err) {
    console.error("Error fetching RAG stats:", err);
  }
}, []);
```

### Resultado

| Antes | Depois |
|---|---|
| Baixa 1.000 de 1.851 registros (oscila) | Retorna 6 linhas agregadas (estavel) |
| ~200KB por request | ~0.5KB por request |
| Contagens mudam a cada reload | Numeros exatos e consistentes |

### Arquivos modificados

| Arquivo | Tipo |
|---|---|
| Migration SQL (nova) | Criar funcao `get_rag_stats()` |
| `src/components/AdminDraLIAStats.tsx` | Substituir query por RPC |

