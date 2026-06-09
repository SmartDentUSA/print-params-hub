## Problema

Buscando `raquelrangelodontologia@gmail.com` em "Agendar Treinamento → Passo 1" retorna "Nenhum deal encontrado", mesmo com o lead existindo (`piperun_id=59620258`, deal `59620258`).

Causa: `fn_search_deals_for_training` só compara o e-mail digitado contra `lia_attendances.email`. No lead da Raquel esse campo é placeholder (`deal-59620258@import.placeholder`); o e-mail real está em `empresa_email`. Outros leads B2B/PJ guardam contato em `astron_email` e `empresa_email_nf`.

## Solução

Atualizar a CTE `leads` do ramo `v_is_email` em `fn_search_deals_for_training` para casar o termo (case-insensitive, trim) contra:

- `email`
- `empresa_email`
- `astron_email`
- `empresa_email_nf`

Mantém `LIMIT 50`, ordenação e o restante da função (incluindo `safe_to_timestamptz` e o ramo não-email) intactos.

## Migração

```sql
CREATE OR REPLACE FUNCTION public.fn_search_deals_for_training(p_query text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
... -- mesma função, trocando apenas o WHERE da CTE leads do ramo email:
WHERE merged_into IS NULL
  AND lower(trim(v_query)) IN (
    lower(email), lower(empresa_email),
    lower(astron_email), lower(empresa_email_nf)
  )
...
$$;
```

## Validação

- `SELECT fn_search_deals_for_training('raquelrangelodontologia@gmail.com')` deve retornar `found=true` com o deal `59620258`.
- Busca por e-mail principal (campo `email`) de outros leads continua funcionando.
- Busca por `piperun_id` / `deal_id` (ramo não-email) inalterada.

## Fora de escopo

- Sincronizar/normalizar e-mails entre `email` e `empresa_email` (job separado).
- Fallback online via Piperun API (não necessário — dado já está no CDP).
