## Objetivo
Adicionar aging da primeira mensalidade no bloco **Mensalidades** de `src/components/SmartOpsStripePayments.tsx`, com 4 faixas:

- **0–10 dias**
- **11–20 dias**
- **21–30 dias**
- **> 30 dias → Primeira mensalidade não paga**

Só entram unidades já **ativadas** (`isDoneStatus(ativacao_status) || ativacao_at`). A contagem parte da data da **primeira invoice de assinatura** paga (`stripe_invoice_paid` com `stripe_subscription_id` ou `mode='subscription'`).

Para o bucket ">30 / não paga", a base é o tempo desde a `ativacao_at` quando **não** há invoice de assinatura registrada, OU quando a diferença desde a primeira mensalidade paga já ultrapassou 30 dias sem nova cobrança recente — regra final:

- Se **não existe** `firstSubInvoiceByLead` para o lead → conta como "não paga" apenas se `(now - ativacao_at) > 30 dias`.
- Se **existe** primeira mensalidade e `diffDays ≤ 10` → 0–10.
- `11 ≤ diffDays ≤ 20` → 11–20.
- `21 ≤ diffDays ≤ 30` → 21–30.
- `diffDays > 30` → não paga (assumindo ciclo mensal vencido sem nova invoice).

## Alterações em `SmartOpsStripePayments.tsx`

### Fetch (~linha 220)
- Incluir `event_timestamp` e `event_data` no `select` de `lead_activity_log` (event_data já pode estar; garantir).
- Filtrar apenas invoices de assinatura (`stripe_subscription_id` presente OU `mode='subscription'`).
- Construir novo mapa `firstSubInvoiceByLead: Map<lead_id, Date>` com a **menor** data por lead. Guardar em `useState`.

### `useMemo` de KPIs (~linha 385)
Adicionar contadores `mens0a10`, `mens11a20`, `mens21a30`, `mensNaoPaga`. Para cada row de `filtered`:
1. Ignora se não estiver ativa.
2. `first = firstSubInvoiceByLead.get(lead_id)`.
3. Se `first`:
   - `diff = floor((now - first)/86400000)`
   - `diff ≤ 10` → mens0a10; `11–20` → mens11a20; `21–30` → mens21a30; `> 30` → mensNaoPaga.
4. Se `!first` e `ativacao_at` e `(now - ativacao_at) > 30 dias` → mensNaoPaga.

### UI
No `Card` "Mensalidades", ampliar a grid interna para `grid-cols-2 md:grid-cols-4` (linha adicional se necessário) e acrescentar mini-cards:
- **0–10 dias**
- **11–20 dias**
- **21–30 dias**
- **> 30 dias — Não paga** (destacar com token de alerta, ex.: `text-destructive`)

## Fora de escopo
- Sem migration, sem webhook, sem mudanças no bloco Ativações ou em `stripe_payment_units`.
- ID Smart Dent segue como plano separado.
