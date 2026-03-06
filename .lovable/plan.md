

# FIX #2 — ORDER BY inteligente no batch-cognitive-analysis

## Diagnostico

**Arquivo:** `supabase/functions/batch-cognitive-analysis/index.ts`
**Linha 29** — ORDER BY atual: `.order("total_messages", { ascending: false })`

Apenas um criterio: leads com mais mensagens primeiro, independente de score ou recencia.

## Mudanca

Substituir a linha 29 por tres `.order()` encadeados:

```typescript
.order("intelligence_score_total", { ascending: false, nullsFirst: false })
.order("total_messages", { ascending: false })
.order("updated_at", { ascending: false })
```

**Antes:** 1 criterio (total_messages DESC)
**Depois:** 3 criterios (score DESC → messages DESC → updated_at DESC)

Isso garante que leads com score alto e atividade recente sejam processados primeiro. `nullsFirst: false` empurra leads sem score calculado para o final.

Total: 1 linha removida, 3 inseridas. Nenhuma outra alteracao.

