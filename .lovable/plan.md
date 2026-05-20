## Diagnóstico

O número atual está baixo porque a função `fn_form_metrics` conta leads pela tabela `smartops_form_field_responses`.

Essa tabela não representa uma submissão completa: ela grava apenas respostas de campos de mapeamento/portfolio. Por isso o formulário `# - Formulário exocad I.A.` aparece com 5 leads, mas a origem real no CDP mostra 25 leads gerados.

Validação feita no banco:

```text
# - Formulário exocad I.A.
- smartops_form_field_responses: 5 leads únicos
- smartops_forms.submissions_count: 16
- lia_attendances.form_name: 27 leads canônicos
- excluindo origens não geradas pelo formulário (loja_integrada e astron_postback): 25 leads canônicos
```

## Plano de correção

1. Atualizar a função `fn_form_metrics(p_period_days int)` para calcular `leads` a partir de `lia_attendances`, não mais de `smartops_form_field_responses`.
   - Usar `lia_attendances.form_name = smartops_forms.name` como vínculo principal.
   - Aplicar sempre `merged_into IS NULL` para contar apenas leads canônicos.
   - Filtrar pelo período usando `lia_attendances.created_at`.
   - Excluir fontes que não foram geradas pelo formulário público, como `loja_integrada` e `astron_postback`, para bater com os 25 do Exocad I.A.

2. Ajustar `deals_won` para usar a mesma base de leads gerados pelo formulário.
   - A conversão será calculada sobre esses leads canônicos.
   - Oportunidade ganha continua vindo de `piperun_deals_history` com status `ganha`.

3. Manter visitantes como está.
   - `Visitantes` continuará vindo de `lead_page_views` em `/f/{slug}`.
   - `Visitantes únicos` continuará usando `session_id`.

4. Validar no banco depois da migração.
   - Em “Tudo”, `# - Formulário exocad I.A.` deve mostrar 25 leads.
   - Em 30 dias, ele deve mostrar apenas os leads gerados dentro dos últimos 30 dias.

## Observação importante

O card tem filtro de período. Então o número 25 só deve aparecer quando o filtro estiver em “Tudo”. Se o filtro estiver em 30 dias, o número correto será menor.