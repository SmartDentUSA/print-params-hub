
## Diagnóstico Exato

O erro nos logs é cristalino:

```
models/embedding-001 is not found for API version v1beta, or is not supported for embedContent.
Call ListModels to see the list of available models and their supported methods.
```

**A chave `GOOGLE_AI_KEY` está correta e funcionando.** O problema é que a Google migrou os modelos de embedding para a API estável `/v1`, e o código ainda chama `/v1beta`. Ambos os modelos (`text-embedding-004` e `embedding-001`) retornam 404 em `/v1beta`.

## Solução: Corrigir as URLs da API na Edge Function

Arquivo: `supabase/functions/index-embeddings/index.ts`

### Mudança necessária

Atualizar as 2 URLs na função `generateEmbedding`:

**Antes (errado):**
```
https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent
https://generativelanguage.googleapis.com/v1beta/models/embedding-001:embedContent
```

**Depois (correto):**
```
https://generativelanguage.googleapis.com/v1/models/text-embedding-004:embedContent
https://generativelanguage.googleapis.com/v1/models/text-embedding-004:embedContent
```

O fallback para `embedding-001` também será removido, pois `text-embedding-004` via `/v1` já é estável. Se ainda falhar, o fallback usará `gemini-embedding-exp-03-07` (o mais recente disponível via v1).

### Sequência após o fix

1. Corrigir `index.ts` (trocar `/v1beta` por `/v1`)
2. Fazer redeploy automático da edge function
3. Disparar a indexação completa (`mode=full`) via curl
4. Verificar que `agent_embeddings` passa de 0 para ~1025 registros

### Impacto

Sem nenhuma alteração no banco de dados, sem migrações. Apenas 2 linhas de URL corrigidas na edge function. Após a indexação, a Dra. L.I.A. passará a usar busca vetorial semântica em vez de apenas ILIKE/FTS.
