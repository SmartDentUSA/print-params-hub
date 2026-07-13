## Objetivo
1. Ordenar a lista de pagamentos do **mais antigo → mais novo**.
2. Adicionar **dashboard consolidado** no cabeçalho de Stripe / Pagamentos, incluindo os valores de ativações pagas e mensalidades pagas.

## Mudanças em `src/components/SmartOpsStripePayments.tsx`

### 1. Ordenação
- Trocar `.order("paid_at", { ascending: false })` para `ascending: true` para exibir do mais antigo ao mais novo.

### 2. Dashboard consolidado (KPIs)
Substituir a `Badge` única do topo por uma grid de cards de KPI calculada via `useMemo` sobre `filtered`/`groups`.

Cards (em ordem):

- **Pagamentos** — `groups.length`
- **Unidades vendidas** — `filtered.length`
- **Faturamento total** — soma de `unit_total` (Ativação inicial paga na Stripe)
- **Ticket médio** — total / groups.length
- **Valor de ativações pagas** — soma de `unit_total` das unidades com `ativacao_status` = concluída/paga (ou `ativacao_data` preenchida quando não houver status). Representa o quanto já foi efetivamente ativado.
- **Valor de mensalidades pagas** — soma dos valores de mensalidade paga. Fonte:
  - Preferência: soma de `stripe_subscriptions` (invoices pagas), agregado por `stripe_customer_id` das unidades listadas.
  - Fallback: contagem × valor de mensalidade quando `mensalidade_status` = paga/ativa e existir valor base na assinatura.
  - Confirmo qual campo em `stripe_subscriptions` guarda o total pago (ex.: `amount_paid_total` / soma de invoices) na hora da implementação; se não houver campo consolidado, mostro placeholder com `—` e abro TODO em vez de exibir número incorreto.
- **Assinaturas ativas** — unidades com `subscription_status` ativa/trial
- **Vencidas / Canceladas** — unidades com status vencida/cancelada/bloqueada
- **Pré-ativações pendentes** — unidades sem `pre_ativacao_data` ou status ≠ concluída
- **Ativações pendentes** — unidades sem `ativacao_data` ou status ≠ concluída
- **Dongles sem ID** — unidades com `id_dongle` vazio

Layout: `grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2`. Cada card: label (xs, muted) + valor (lg, bold). Cores via tokens já usados no arquivo (`text-primary`, `text-emerald-400`, `text-amber-400`, `text-red-400`) — sem cores hardcoded fora do padrão.

A linha de filtros (busca / status / atualizar) fica acima da grid de KPIs; a badge antiga é removida.

## Fora de escopo
- Sem mudanças em banco, webhook ou lógica de gravação.
- Sem novas colunas na tabela.
