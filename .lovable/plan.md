
## Substituição de Modelo: `text-embedding-004` → `gemini-embedding-001`

### Estado atual confirmado via leitura dos arquivos

**`index-embeddings/index.ts` (linha 18):**
```typescript
{ model: "models/text-embedding-004", version: "v1beta" }
```

**`dra-lia/index.ts` (linhas 588 e 593):**
```typescript
// Linha 588 — URL
`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=...`

// Linha 593 — Body
model: "models/text-embedding-004"
```

O `taskType` já está correto nos dois arquivos (`RETRIEVAL_DOCUMENT` e `RETRIEVAL_QUERY`). Apenas o identificador do modelo precisa ser trocado.

---

### Alterações precisas

**Arquivo 1: `supabase/functions/index-embeddings/index.ts`**

Linha 18 — trocar modelo no array:
```typescript
// ANTES
{ model: "models/text-embedding-004", version: "v1beta" }

// DEPOIS
{ model: "models/gemini-embedding-001", version: "v1beta" }
```

A URL é construída dinamicamente na linha 24 via `model.replace("models/", "")`, então ela se atualiza automaticamente para:
```
https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent
```

---

**Arquivo 2: `supabase/functions/dra-lia/index.ts`**

Linha 588 — trocar URL:
```typescript
// ANTES
`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=...`

// DEPOIS
`https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=...`
```

Linha 593 — trocar body:
```typescript
// ANTES
model: "models/text-embedding-004"

// DEPOIS
model: "models/gemini-embedding-001"
```

---

### Resumo das alterações

| Arquivo | Linha | Mudança |
|---|---|---|
| `index-embeddings/index.ts` | 18 | `text-embedding-004` → `gemini-embedding-001` |
| `dra-lia/index.ts` | 588 | URL: `text-embedding-004` → `gemini-embedding-001` |
| `dra-lia/index.ts` | 593 | Body: `text-embedding-004` → `gemini-embedding-001` |

3 linhas modificadas. Sem migrações. Sem alteração de schema. Deploy automático após a aprovação.

### Sequência após o deploy

1. Deploy automático das duas funções
2. Disparar indexação completa via painel Admin (Indexação RAG > Reindexar Tudo) ou curl `mode=full`
3. Confirmar que `agent_embeddings` passa de 0 para ~1.025 registros
4. Testar a Dra. L.I.A. com uma pergunta sobre resinas para validar a busca vetorial com o novo modelo
