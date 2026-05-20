# Corrigir contagem de Leads na RPC `fn_form_metrics`

## Diagnóstico

A RPC atual conta leads a partir de `lead_form_submissions`, mas essa tabela está **vazia** (0 linhas). As submissões reais vivem em `smartops_form_field_responses`:

```
form fbe205b0  →  37 rows, 5 leads distintos (UI mostrava 0)
form 63ecb106  →  10 rows, 1 lead distinto
```

Cada submissão gera N linhas (1 por campo). Para contar "leads gerados" corretamente precisamos de `count(DISTINCT lead_id)` por `form_id`.

## Mudança

Reescrever `fn_form_metrics` trocando as CTEs `ld` (leads) e `wins` (deals_won) para usarem `smartops_form_field_responses`:

- **ld**: `SELECT form_id, count(DISTINCT lead_id) FROM smartops_form_field_responses WHERE created_at >= since`
- **wins**: distinct lead_ids da mesma tabela → join em `lia_attendances` (canonical, `merged_into IS NULL`) → existência de deal com `status='ganha'` em `piperun_deals_history`.

`lead_id` em `smartops_form_field_responses` já é UUID (igual a `lia_attendances.id`), sem cast.

## Validação esperada

- Formulário **exocad I.A.** (fbe205b0) — Visitantes 130 / Leads **5** (antes mostrava 0).
- Formulário **exocad I.A. cópia** (63ecb106) — Visitantes 34 / Leads **1**.
- Form base (sem respostas) — Leads 0.

Sem mudanças no frontend; o componente `FormMetricsCard` já consome esses campos.

## Por que não usar `smartops_forms.submissions_count`?

Esse contador é incrementado por evento e pode estar inflado (16 vs 5 reais). A fonte da verdade é o `lead_id` único em `smartops_form_field_responses`. Mantemos a integridade da regra "1 lead canônico = 1 submissão" (`merged_into IS NULL` aplicado no join com `lia_attendances`).
