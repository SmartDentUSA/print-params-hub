

# Plano: Otimizações do Gemini para o Cache de Inteligência

A tabela `agent_internal_lookups` e a `searchContentDirect` já existem e funcionam. O Gemini sugeriu 3 melhorias concretas sobre a implementação atual:

## Mudanças

### 1. Migration SQL — 3 ajustes no banco

| Ajuste | Atual | Proposto |
|--------|-------|----------|
| UNIQUE constraint | Sem unique em `query_normalized` | Adicionar `UNIQUE` para prevenir race conditions e permitir `upsert` com `ON CONFLICT` |
| Dicionário FTS | `'portuguese'` (aplica stemming/stop words) | `'simple'` — a string já vem normalizada pelo JS, stemming duplo pode causar mismatches |
| RPC `increment_lookup_hit` | Update inline no JS (hit_count + 1) | Função atômica no banco — mais segura em concorrência |

### 2. `dra-lia/index.ts` — Refatorar `searchContentDirect`

- **Cache check**: Trocar FTS por busca exata (`eq('query_normalized', ...)`) como primeiro filtro, com FTS como fallback para variações. Mais rápido com o UNIQUE index.
- **TTL dinâmico**: 30 dias para cache com resultados, 24 horas para negative cache (resultados = 0). Atualmente negative cache é ignorado (`.gt("results_count", 0)`).
- **Upsert**: Trocar `.insert()` por `.upsert({}, { onConflict: 'query_normalized' })` para atualizar resultados se a query já existir.
- **`increment_lookup_hit`**: Usar a RPC em vez do update inline.

### 3. `smart-ops-copilot/index.ts` — Mesma mudança de upsert

Trocar os `.insert()` do cache no Copilot por `.upsert({}, { onConflict: 'query_normalized' })`.

## Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| Nova migration SQL | ADD UNIQUE, DROP/CREATE index com 'simple', CREATE FUNCTION `increment_lookup_hit` |
| `supabase/functions/dra-lia/index.ts` | Refatorar `searchContentDirect` com exact match, TTL dinâmico, upsert, RPC |
| `supabase/functions/smart-ops-copilot/index.ts` | Trocar insert por upsert nos caches |

