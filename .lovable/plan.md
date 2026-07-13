## Objetivo
Exibir 1 linha por unidade comprada no Stripe/Pagamentos. José Antonio (2 dongles) deve virar 2 linhas independentes, cada uma com seu próprio ID Dongle, pré-ativação, ativação e mensalidade.

## Mudanças

### 1. Nova tabela `stripe_payment_units` (migration)
Uma linha por unidade de dongle vendida.

Colunas:
- `id uuid pk`
- `lead_id uuid → lia_attendances`
- `stripe_event_id text` (referência ao `lead_activity_log` original)
- `stripe_checkout_id text`
- `stripe_customer_id text`
- `unit_index int` (1..N)
- `unit_total numeric` (valor rateado da unidade)
- `product_name text`
- `paid_at timestamptz`
- `id_dongle text`
- `stripe_seller_id text` (vendedor por unidade)
- `pre_ativacao_data date`, `pre_ativacao_status text`
- `ativacao_data date`, `ativacao_status text`
- `mensalidade_data date`, `mensalidade_status text`
- `created_at`, `updated_at` + trigger
- Unique `(stripe_checkout_id, unit_index)`
- GRANTs (authenticated / service_role) + RLS + policies + trigger `updated_at`

### 2. Backfill (mesma migration)
Para cada `stripe_checkout_completed` em `lead_activity_log`:
- Ler `quantity` do payload (default 1)
- Inserir N linhas em `stripe_payment_units`
- Unidade 1 herda `id_dongle`, `stripe_seller_id`, `pre_ativacao_*`, `ativacao_*`, `mensalidade_*` de `lia_attendances`; unidades 2..N ficam vazias

Resultado esperado: José Antonio passa a ter 2 linhas.

### 3. Edge function `stripe-webhook`
No `checkout.session.completed`:
- Expandir line items via Stripe API
- Para cada item com `quantity=N`, inserir N linhas em `stripe_payment_units` (idempotente por `stripe_checkout_id + unit_index`)

### 4. UI `SmartOpsStripePayments.tsx`
- Query passa a ler `stripe_payment_units` + join `lia_attendances` (nome/email/telefone) + `omie_vendedores` + `stripe_subscriptions` (dado compartilhado por customer)
- Colunas: **#** → Cliente → E-mail → Celular → Data → Produto → Valor (unit_total) → Vendedor → **ID Dongle** → Pré-Ativação → Status Pré → Ativação → Status Ativação → 1ª Mensalidade → Status Mensalidade → link
- `#` mostra "3 (1/2)", "4 (2/2)" para multi-unidade
- Todos os `onBlur/onChange` gravam em `stripe_payment_units` pelo `unit.id` (não mais em `lia_attendances`)
- `ID Dongle` é `<input type="text">` editável

## Fora de escopo
- Sem alterações em Omie, PipeRun, LIA, RLS de `lia_attendances`
- Colunas legadas em `lia_attendances` (`id_dongle`, `pre_ativacao_*`, etc.) permanecem — não são mais lidas por essa tela

## Verificação
Após deploy: José Antonio deve aparecer como 2 linhas, ambas com Janaina Santos como vendedora padrão, campos de dongle/ativação independentes.
