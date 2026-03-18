

# Fix: Oportunidades nunca carregam — filtro de status errado

## Problema

A tabela `lead_opportunities` tem **233 registros** com `status = 'aberta'`. Mas a API (`smart-ops-leads-api/index.ts`, linha 128) filtra com `.eq("status", "open")`. Como nenhum registro tem `status = 'open'`, o resultado é sempre **array vazio**.

Isso causa:
- Upsell cards mostram "Motor processando..." (porque `sortedOpps[i]` é undefined)
- Aba "Ações Recomendadas" mostra "Motor de oportunidades processando..."
- Pipeline aberto = R$0
- Oportunidades = 0

## Correção

**1 arquivo**: `supabase/functions/smart-ops-leads-api/index.ts`

Linha 128: trocar `.eq("status", "open")` por `.eq("status", "aberta")`

```ts
// ANTES:
.eq("status", "open")

// DEPOIS:
.eq("status", "aberta")
```

Correção de 1 linha. Sem necessidade de migration ou mudança no frontend.

