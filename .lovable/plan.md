## Causa raiz (confirmada)

O erro ocorre no **Passo 1 (Buscar)**, dentro da RPC `fn_search_deals_for_training`. As linhas:

```sql
NULLIF(dh->>'closed_at','')::timestamptz
NULLIF(dh->>'updated_at','')::timestamptz
```

fazem cast direto de strings vindas do JSON `piperun_deals_history`. Quando o histórico de **qualquer um dos leads que contém o deal pesquisado** tem outra entrada com data em formato BR (`"24/08/2022"`), o cast estoura com `date/time field value out of range`. Para o deal `59620258` (3 leads canônicos com esse deal no histórico), basta uma entrada ruim em qualquer um deles para abortar a busca inteira.

A correção no frontend (Passo anterior) só resolveu o writeback de `equip_*_ativacao`. O Passo 1 nem chega a executar.

## Mudança

### Migration: criar `public.safe_to_timestamptz(text)` e usar nas RPCs

```sql
CREATE OR REPLACE FUNCTION public.safe_to_timestamptz(p text)
RETURNS timestamptz
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE r timestamptz;
BEGIN
  IF p IS NULL OR length(trim(p)) = 0 THEN RETURN NULL; END IF;
  BEGIN
    RETURN p::timestamptz;                              -- ISO normal
  EXCEPTION WHEN others THEN
    BEGIN
      RETURN to_timestamp(p, 'DD/MM/YYYY HH24:MI:SS');  -- BR completo
    EXCEPTION WHEN others THEN
      BEGIN
        RETURN to_timestamp(p, 'DD/MM/YYYY');           -- BR só data
      EXCEPTION WHEN others THEN
        RETURN NULL;                                    -- inválido → ignora
      END;
    END;
  END;
END $$;
```

Recriar `fn_search_deals_for_training` substituindo os 4 casts (`closed_at`, `updated_at` em ambos ramos email e id) por `public.safe_to_timestamptz(dh->>'closed_at')` e `public.safe_to_timestamptz(dh->>'updated_at')`. Nenhuma outra mudança de comportamento.

## Fora de escopo
- `deals` (tabela) já é `timestamptz`, não precisa.
- `fn_search_deal_for_training` e `fn_get_deal_from_history` não fazem cast de data — intocadas.
- Não tocar nos dados existentes em `piperun_deals_history` (apenas leitura tolerante).

## Validação
1. Após a migration, executar no SQL Editor: `SELECT public.fn_search_deals_for_training('59620258');` → deve retornar `found: true` com a lista de deals.
2. No app, fluxo de Agendar → buscar `59620258` → não deve mais aparecer o erro.
