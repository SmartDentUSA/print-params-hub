# Indicadores dos formulários vazios — causa e correção

## Diagnóstico

O console mostra que o carregamento das métricas está falhando com:

```
[fn_form_metrics] { "code": "57014", "message": "canceling statement due to statement timeout" }
```

Ou seja, o RPC `fn_form_metrics(30)` é chamado corretamente pelo `SmartOpsFormBuilder.tsx`, mas o PostgREST cancela a query por exceder o timeout (~8s) — então `metricsByForm` fica vazio e as colunas "Visitantes / Leads / Conversão" aparecem zeradas para todos os formulários.

Executando o mesmo RPC pelo cliente admin (sem timeout curto) ele retorna dados corretos, confirmando que o problema é performance, não RLS nem lógica.

A função hoje faz, para cada form (~centenas):
- Full scan em `lead_page_views` com filtro por string concatenada (`'/f/' || slug`)
- Join em `lia_attendances` filtrando por `form_name` (texto, sem índice)
- `EXISTS` que expande `piperun_deals_history` (jsonb) linha a linha
- Uma LATERAL adicional em `lead_page_views` para a série diária

Isso estoura o statement_timeout do PostgREST.

## Correção proposta

Migração única em `supabase/migrations`:

1. **Índices que faltam** para as junções quentes:
   - `lia_attendances (form_name) WHERE merged_into IS NULL`
   - `lead_page_views (page_path, viewed_at)`
   - `loja_integrada_orders (attendance_id, created_at)`

2. **Recriar `fn_form_metrics`** com duas mudanças chave:
   - `SET statement_timeout TO '30s'` no corpo da função (SECURITY DEFINER já a torna dona) para dar folga acima do limite padrão do PostgREST.
   - Reescrever a query para varrer `lead_page_views` e `lia_attendances` **uma vez só**, agrupando por form via um mapeamento `slug → form_id` e `name → form_id` calculado no início, em vez do LEFT JOIN por form com string concat.
   - Colapsar `wins` na mesma CTE de `leads` (mesmo scan de `lia_attendances`), avaliando o `EXISTS` jsonb apenas quando `piperun_deals_history` não é vazio, e usando o índice em `loja_integrada_orders`.
   - Manter o mesmo shape de retorno (`form_id, visitors, unique_visitors, leads, deals_won, daily_series`) para não mexer no frontend.

3. **Sem mudanças no frontend.** O `SmartOpsFormBuilder` continua chamando `supabase.rpc('fn_form_metrics', { p_period_days })`.

## Verificação

- Rodar `SELECT * FROM fn_form_metrics(30) LIMIT 5;` e conferir `< 3s`.
- Recarregar `/admin?sub=criar&tab=campanhas` e confirmar que as colunas "Visitantes / Leads / Conversão" aparecem preenchidas e que não há mais log `57014` no console.

## O que NÃO muda

- Nenhum componente React, nenhum shape de retorno.
- Regras de negócio (fonte de leads, filtros de `merged_into IS NULL`, exclusão de `loja_integrada`/`astron_postback`, definição de "ganha") permanecem idênticas.
