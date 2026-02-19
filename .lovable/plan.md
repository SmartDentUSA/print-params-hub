
## Alterações Confirmadas — 2 arquivos, 2 correções cirúrgicas

### Diagnóstico do estado atual

**`index-embeddings/index.ts` (linhas 17-22 e 31):**
- O array `modelsToTry` ainda tem 4 entradas (`text-embedding-004` e `embedding-001` em `v1` e `v1beta`) — isso multiplica as requisições por 4 e causa erro 429
- A linha 31 **não tem `taskType`** — o `text-embedding-004` retorna 404 quando esse parâmetro está ausente

**`dra-lia/index.ts` (linhas 592-596):**
- A linha 595 tem `outputDimensionality: 768` — pode causar conflito de parâmetros com certas versões da API
- **Não tem `taskType`** — a pergunta do usuário é vetorizada sem contexto de busca, reduzindo a precisão da similaridade coseno

---

### Arquivo 1: `supabase/functions/index-embeddings/index.ts`

**Linhas 17-22** — Reduzir `modelsToTry` de 4 para 1 entrada:

```typescript
// ANTES (4 entradas = 4x mais requisições = erro 429)
const modelsToTry = [
  { model: "models/text-embedding-004", version: "v1beta" },
  { model: "models/text-embedding-004", version: "v1" },
  { model: "models/embedding-001", version: "v1beta" },
  { model: "models/embedding-001", version: "v1" },
];

// DEPOIS (1 entrada = endpoint confirmado pelo usuário via Python)
const modelsToTry = [
  { model: "models/text-embedding-004", version: "v1beta" },
];
```

**Linha 31** — Adicionar `taskType: "RETRIEVAL_DOCUMENT"`:

```typescript
// ANTES (sem taskType = 404)
body: JSON.stringify({ model, content: { parts: [{ text }] } })

// DEPOIS (com taskType = funciona)
body: JSON.stringify({
  model,
  content: { parts: [{ text }] },
  taskType: "RETRIEVAL_DOCUMENT",
})
```

---

### Arquivo 2: `supabase/functions/dra-lia/index.ts`

**Linhas 592-596** — Remover `outputDimensionality`, adicionar `taskType: "RETRIEVAL_QUERY"`:

```typescript
// ANTES (com outputDimensionality que pode causar conflito, sem taskType)
body: JSON.stringify({
  model: "models/text-embedding-004",
  content: { parts: [{ text }] },
  outputDimensionality: 768,
})

// DEPOIS (limpo, com taskType correto para busca)
body: JSON.stringify({
  model: "models/text-embedding-004",
  content: { parts: [{ text }] },
  taskType: "RETRIEVAL_QUERY",
})
```

---

### Impacto esperado

| Problema | Causa | Correção |
|---|---|---|
| Erro 404 | `taskType` ausente | `RETRIEVAL_DOCUMENT` e `RETRIEVAL_QUERY` adicionados |
| Erro 429 | Loop de 4 modelos × 450 chunks = 1.800 req | 1 modelo × 450 chunks = 450 req |
| Busca imprecisa | Vetores sem contexto de intenção | `RETRIEVAL_QUERY` otimiza similaridade coseno |

---

### Sequência após o deploy

1. Deploy automático de ambas as funções
2. Disparar indexação completa pelo painel Admin (Indexação RAG > Reindexar Tudo) ou via curl:
   ```
   POST https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/index-embeddings?mode=full
   ```
3. Confirmar que `agent_embeddings` passa de 0 para ~1.025 registros
4. Testar a Dra. L.I.A. com uma pergunta real sobre resinas para validar a busca vetorial

---

### Resumo das alterações

| Arquivo | Linhas | Mudança |
|---|---|---|
| `index-embeddings/index.ts` | 17-22 | `modelsToTry` reduzido de 4 para 1 entrada |
| `index-embeddings/index.ts` | 31 | `taskType: "RETRIEVAL_DOCUMENT"` adicionado |
| `dra-lia/index.ts` | 592-596 | `outputDimensionality` removido, `taskType: "RETRIEVAL_QUERY"` adicionado |

Sem migrações de banco. Sem alterações de schema. Apenas 3 linhas modificadas em 2 arquivos.
