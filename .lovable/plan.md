## Objetivo
Separar o dashboard de KPIs em dois blocos: **Ativações** e **Mensalidades**, com métricas específicas em cada.

## Mudança em `src/components/SmartOpsStripePayments.tsx`

Layout: `grid grid-cols-1 lg:grid-cols-2 gap-3`. Cada bloco é um `Card` com título e grid interna `grid-cols-2 md:grid-cols-4 gap-2` de sub-cards (label xs muted + valor lg bold, tokens de cor já usados).

### Bloco Ativações
- **Pagamentos** — nº de checkouts (grupos)
- **Unidades vendidas** — nº de linhas
- **Ativações pagas (R$)** — soma `unit_total` das linhas cujo produto é ativação/bundle/implantação/setup
- **Ticket médio** — Ativações pagas / Pagamentos
- **Pré-ativações pendentes** — sem `pre_ativacao_data` e status não concluído
- **Ativações pendentes** — sem `ativacao_data` e status não concluído
- **Dongles sem ID** — `id_dongle` vazio
- **Ativas** — nº de unidades com `ativacao_status` concluída/paga OU `ativacao_data` preenchida

### Bloco Mensalidades
- **Primeira mensalidade (status)** — nº de clientes (leads distintos) que já pagaram ao menos uma fatura de assinatura no Stripe. Fonte: `lead_activity_log` onde `event_type = 'stripe_invoice_paid'` (agrupado por `lead_id`).
- **Total de primeiras mensalidades (R$)** — soma `value_numeric` de TODOS os `stripe_invoice_paid` dos leads no filtro (primeira até a última paga). Fonte: `lead_activity_log`.
- **Assinaturas ativas** — unidades com `subscription_status` = active/trialing
- **Vencidas / Canceladas** — unidades com status vencida/cancelada/past_due/unpaid

### Ajuste em `kpis`
- Reintroduzir agregação `invoicePaidByLead` (já existente) para calcular:
  - `primeirasMensalidadesClientes` = tamanho do set de `lead_id` com valor > 0 em `invoicePaidByLead`
  - `mensalidadesPagas` (R$) = soma sobre `invoicePaidByLead` restrita aos leads presentes no filtro
- Remover a categorização por nome de produto para "mensalidades pagas" (fica só para exibição de produto, não para KPI).
- Adicionar contagem `ativas` (concluídas).

## Fora de escopo
- Sem mudanças no webhook, no banco, ou na tabela abaixo.
- Sem novos filtros.
