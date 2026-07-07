## Objetivo
Nas métricas dos formulários, contar como "ganha" apenas leads cuja vitória (PipeRun `ganha` ou pedido de e-commerce) ocorreu **depois** da data de preenchimento do formulário (`la.created_at`). Vitórias anteriores (clientes que já compraram antes de preencher o form) deixam de inflar o contador.

## Alteração
Atualizar a função `public.fn_form_metrics(p_period_days integer)` — bloco `wins`:

- PipeRun: exigir `d->>'status' = 'ganha'` **e** `(d->>'closed_at')::timestamptz > la.created_at`.
- Loja Integrada: exigir `o.attendance_id = la.id` **e** `o.created_at > la.created_at` (usar o timestamp real do pedido).
- Remover a cláusula genérica `ltv_total > 0` (não tem data associada e provoca falsos positivos de clientes históricos).
- Manter filtro de período existente (`la.created_at >= since`) sem alteração no restante.

Sem mudanças no frontend — os cards continuam lendo `deals_won` da mesma RPC.

## Impacto esperado no exemplo (`# - Formulário exocad I.A.`)
- Saem da contagem os leads cujo `origem_primeiro_contato = "Lista Clientes Internos"` e outros cujo `closed_at` é anterior ao `created_at` do lead.
- Os 16 "ganhas" atuais devem cair para o subconjunto real de conversões pós-formulário.

## Detalhes técnicos
```sql
CREATE OR REPLACE FUNCTION public.fn_form_metrics(p_period_days integer DEFAULT 30) ...
  wins AS (
    SELECT f.id AS form_id, count(DISTINCT la.id)::bigint AS deals_won
    FROM f
    JOIN lia_attendances la
      ON la.form_name = f.name
     AND la.merged_into IS NULL
     AND la.created_at >= (SELECT since FROM period)
     AND coalesce(la.source,'') NOT IN ('loja_integrada','astron_postback')
    WHERE
      EXISTS (
        SELECT 1
        FROM jsonb_array_elements(coalesce(la.piperun_deals_history,'[]'::jsonb)) d
        WHERE lower(coalesce(d->>'status','')) = 'ganha'
          AND (d->>'closed_at') IS NOT NULL
          AND (d->>'closed_at')::timestamptz > la.created_at
      )
      OR EXISTS (
        SELECT 1 FROM loja_integrada_orders o
        WHERE o.attendance_id = la.id
          AND o.created_at > la.created_at
      )
    GROUP BY f.id
  )
```
Demais CTEs (`pv`, `ld`, `series`) permanecem iguais.
