## Problema
Os KPIs de "Primeira mensalidade (clientes)" e "Total mensalidades pagas" estão contando TODOS os eventos `stripe_invoice_paid`, inclusive faturas de ativação (mode=`payment`, sem `stripe_subscription_id`). Por isso aparecem valores como R$ 34.767,79 vindos de "Exocad Ultimate Bundle - Ativação e Implantação Inicial".

## Correção em `src/components/SmartOpsStripePayments.tsx`

Ajustar somente a agregação `invoicePaidByLead` (linhas ~219-234) para considerar apenas invoices de assinatura:

- Passar a selecionar também `event_data` no query de `lead_activity_log`.
- Só somar o registro quando for de assinatura, ou seja:
  - `event_data.stripe_subscription_id` não vazio, OU
  - `event_data.mode === 'subscription'`
- Registros com `mode = 'payment'` (ativações one-time) são ignorados nesse mapa.

Nenhuma outra métrica muda — "Ativações pagas (R$)" continua sendo calculada a partir de `unit_total` das linhas de ativação, e os cards do bloco Ativações ficam intactos.

## Fora de escopo
- Sem mudanças no webhook, banco, ou nas colunas de `stripe_payment_units`.
- Sem alteração de layout ou de outros cards.
