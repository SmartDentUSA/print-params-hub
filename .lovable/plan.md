## Objetivo

Corrigir `fn_form_metrics` para que a contagem de **Deals Ganhos** considere apenas oportunidades **criadas a partir deste formulário específico**, ignorando o histórico anterior do lead.

## Diagnóstico

Hoje, em `wins`, a função conta o lead como "ganha" se **qualquer entrada** em `piperun_deals_history` tiver `status='ganha'` — mesmo deals antigos de outro funil (ex.: LOJA INTEGRADA, Reativação 2021). Foi por isso que o caso *Thiago Nicoletti* apareceu na conversão do formulário exocad: ele tem um deal `LOJA INTEGRADA` ganho não relacionado ao formulário.

Cada entrada em `piperun_deals_history` já carrega:
- `origem` → string igual ao `form_name` quando o deal foi criado pela submissão daquele formulário (memory: *Piperun Deal Metadata Rules* — "Deal Origin = exact form_name");
- `created_at` → timestamp de criação do deal no PipeRun.

## Correção

Atualizar a CTE `wins` em `fn_form_metrics` (nova migration) para exigir, dentro do `jsonb_array_elements`:

```sql
WHERE lower(coalesce(d->>'status','')) = 'ganha'
  AND d->>'origem' = f.name
  AND coalesce((d->>'created_at')::timestamptz, '1900-01-01') >= la.created_at - interval '1 day'
```

Justificativa:
- `origem = f.name`: vincula o deal à origem do formulário (consistente com a regra "Deal Origin = exact form_name").
- `created_at >= la.created_at - 1d`: garante que o deal foi criado a partir desta submissão (margem de 1 dia para tolerar diferenças de fuso/sync), descartando deals históricos.

Nenhuma alteração no frontend — o card `FormMetricsCard` continua lendo `deals_won` e calculando `conversion = deals_won / leads`.

## Detalhes técnicos

- Nova migration `*_form_metrics_attributable_wins.sql` reescrevendo `public.fn_form_metrics(int)` com a cláusula acima.
- Demais CTEs (`pv`, `ld`, `series`) permanecem iguais.
- `GRANT EXECUTE` mantido para `anon, authenticated`.

## Validação

Após aplicar, rodar `SELECT * FROM fn_form_metrics(30)` filtrando pelo form id do exocad e confirmar `deals_won = 0` (o deal do Thiago tem `origem='LOJA INTEGRADA'`, será excluído).

## Fora de escopo

- Não mexer em `pv` (visitantes) nem `ld` (leads).
- Não alterar a lógica de `fn_form_attribution` ou outros relatórios.
