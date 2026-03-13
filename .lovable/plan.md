

# Plano: ETL para Calcular ltv_total, total_deals e anchor_product dos 3.716 Leads

## Diagnostico Confirmado

| Dado | Valor |
|---|---|
| Leads com `piperun_deals_history` preenchido | 3.716 |
| Desses, com `value > 0` em pelo menos 1 deal | 897 |
| Com `ltv_total` calculado | 134 (todos de hoje, backfill manual) |
| Leads com multiplos deals | 59 |
| Codigo que popula `ltv_total` | **nenhum** — nao existe em nenhum arquivo |

As colunas `ltv_total`, `total_deals` e `anchor_product` existem na tabela mas nenhuma Edge Function as popula. O JSONB `piperun_deals_history` tem os dados (`value`, `product`, `status`), mas nunca houve ETL para destilar.

## Solucao: 2 partes

### Parte 1 — Backfill imediato (Edge Function `backfill-ltv`)

Nova Edge Function que executa 3 operacoes SQL via Supabase client:

1. **`ltv_total`** — soma de `value` de todos os deals no array JSONB
2. **`total_deals`** — `jsonb_array_length(piperun_deals_history)`
3. **`anchor_product`** — produto mais frequente no historico (moda do campo `product`)

A funcao itera sobre os 3.716 leads com historico, calcula os 3 campos e atualiza cada registro. Retorna contagem de atualizados.

Logica de calculo:
```
ltv_total = SUM(deal.value) para todos os deals do array
total_deals = LENGTH do array
anchor_product = product que aparece mais vezes (moda)
```

### Parte 2 — Fix no sync (auto-calculo)

Modificar `smart-ops-piperun-webhook` e `smart-ops-sync-piperun` para que, sempre que `piperun_deals_history` for atualizado, recalcular `ltv_total`, `total_deals` e `anchor_product` no mesmo payload de update.

Alternativa mais robusta: criar um trigger PostgreSQL em `lia_attendances` que recalcula automaticamente quando `piperun_deals_history` muda. Isso garante que qualquer caminho de escrita (webhook, sync, full-sync, manual) sempre mantem as colunas derivadas atualizadas.

### Arquivos

1. **`supabase/functions/backfill-ltv/index.ts`** — nova Edge Function para backfill one-shot
2. **`supabase/config.toml`** — adicionar entry
3. **Migration SQL** — trigger `fn_recalc_ltv_from_deals()` em `lia_attendances` que dispara em UPDATE de `piperun_deals_history`

### Trigger SQL (Parte 2)

```sql
CREATE OR REPLACE FUNCTION fn_recalc_ltv_from_deals()
RETURNS trigger AS $$
DECLARE
  v_ltv numeric := 0;
  v_count integer := 0;
  v_anchor text := null;
BEGIN
  IF NEW.piperun_deals_history IS NOT NULL 
     AND jsonb_typeof(NEW.piperun_deals_history) = 'array'
     AND jsonb_array_length(NEW.piperun_deals_history) > 0 THEN
    
    SELECT COALESCE(SUM((d->>'value')::numeric), 0),
           COUNT(*)
    INTO v_ltv, v_count
    FROM jsonb_array_elements(NEW.piperun_deals_history) d;
    
    SELECT d->>'product' INTO v_anchor
    FROM jsonb_array_elements(NEW.piperun_deals_history) d
    WHERE d->>'product' IS NOT NULL
    GROUP BY d->>'product'
    ORDER BY COUNT(*) DESC, MAX((d->>'value')::numeric) DESC
    LIMIT 1;
  END IF;
  
  NEW.ltv_total := v_ltv;
  NEW.total_deals := v_count;
  NEW.anchor_product := v_anchor;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Ordem de execucao

1. Migration: criar trigger (garante que qualquer escrita futura auto-calcula)
2. Edge Function `backfill-ltv`: backfill dos 3.716 existentes (o trigger vai disparar automaticamente quando o UPDATE tocar em `piperun_deals_history`)
3. Validacao: query para confirmar que `ltv_total = 0 AND piperun_deals_history IS NOT NULL` retorna 0

