## Problema

`fn_search_deals_for_training` usa `row_to_jsonb(x)` — função inexistente no Postgres. O builtin correto é `to_jsonb(x)`.

## Correção

Nova migração `CREATE OR REPLACE FUNCTION public.fn_search_deals_for_training(text)` idêntica à atual, trocando as 2 ocorrências de `row_to_jsonb(x)` por `to_jsonb(x)` (linhas 62 e 137). Nenhuma outra lógica muda; GRANT preservado.

Sem alterações de frontend.