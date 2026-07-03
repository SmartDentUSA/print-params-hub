
## Objetivo
Receber webhooks do Stripe, validar assinatura, achar o lead pelo telefone/email no CRM (`lia_attendances`) e gravar cada evento financeiro na timeline (`lead_activity_log`).

Secrets já disponíveis: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.

## 1. Migração DB
Nova tabela `stripe_webhook_events` para idempotência:

- `event_id text primary key` (id do evento Stripe)
- `event_type text not null`
- `lead_id uuid null` (fk lógica → `lia_attendances.id`)
- `payload jsonb not null`
- `processed_at timestamptz default now()`
- `error text null`

RLS ligado, GRANTs padrão (`service_role` all; `authenticated` select para debug). Sem policy pública.

## 2. Edge Function `supabase/functions/stripe-webhook/index.ts`
- `verify_jwt = false` (adicionar em `supabase/config.toml`)
- Body cru + `stripe.webhooks.constructEventAsync(body, sig, STRIPE_WEBHOOK_SECRET)`
- SDK: `import Stripe from "npm:stripe@17"`
- Dedupe: insert em `stripe_webhook_events` (on conflict do nothing → se já existe, responde 200)
- CORS mínimo (webhook não precisa, mas headers em erros)

### Resolução de lead
1. Extrai `phone` do evento (customer_details.phone, charge.billing_details.phone, subscription.customer expandido) → normaliza para dígitos BR (55 + DDD + número, mesma regra usada em outras funções).
2. Busca em `lia_attendances` onde `merged_into IS NULL`:
   - Primeiro por `telefone` (match exato dos últimos 10-11 dígitos)
   - Fallback por `email` (lowercase)
3. Se não achar → grava evento em `stripe_webhook_events` com `lead_id = null` e `error = 'lead_not_found'`. Não cria lead novo (fora do escopo).

### Eventos tratados (mapa → `event_type` no `lead_activity_log`)
| Stripe | activity_log.event_type |
|---|---|
| `checkout.session.completed` | `stripe_checkout_completed` |
| `checkout.session.async_payment_succeeded` | `stripe_checkout_paid` |
| `checkout.session.async_payment_failed` | `stripe_checkout_failed` |
| `payment_intent.succeeded` | `stripe_payment_succeeded` |
| `payment_intent.payment_failed` | `stripe_payment_failed` |
| `charge.refunded` | `stripe_refund` |
| `invoice.paid` | `stripe_invoice_paid` |
| `invoice.payment_failed` | `stripe_invoice_failed` |
| `invoice.payment_action_required` | `stripe_invoice_action_required` |
| `customer.subscription.created` | `stripe_subscription_created` |
| `customer.subscription.updated` | `stripe_subscription_updated` |
| `customer.subscription.deleted` | `stripe_subscription_canceled` |

Eventos fora da lista → 200 OK, apenas dedupe (sem timeline).

### Insert em `lead_activity_log`
- `lead_id` = uuid do lead
- `activity_type` = 'payment' (ou 'subscription' para eventos de sub)
- `event_type` = mapa acima
- `channel` = 'stripe'
- `source` = 'stripe_webhook'
- `title` = descrição amigável ex: `"Pagamento Stripe: R$ 297,00 — Assinatura Mensal"`
- `description` = produto(s) / plano / motivo de falha
- `metadata jsonb` com:
  - `amount` (centavos → decimal), `currency`
  - `stripe_event_id`, `stripe_object_id` (session/pi/invoice/sub id)
  - `mode` (payment/subscription), `status`
  - `products` (linha itens quando disponível: name, price_id, product_id, qty)
  - `customer` (id, email, phone, name)
  - `raw` (payload resumido)
- `occurred_at` = timestamp do evento Stripe (`event.created`)

### Response
- 200 sempre que assinatura válida (mesmo para "lead_not_found" ou evento ignorado) para o Stripe não reentregar
- 400 apenas em falha de assinatura

## 3. Config
Atualizar `supabase/config.toml` adicionando bloco:
```
[functions.stripe-webhook]
verify_jwt = false
```

## 4. Deploy + teste
1. Deploy da função
2. Usuário clica "Enviar evento de teste" no Stripe (checkout.session.completed test mode)
3. Verifica logs da função + row em `stripe_webhook_events` e (se telefone/email do teste bater com algum lead) em `lead_activity_log`

## Fora de escopo (próxima iteração)
- Criar lead novo quando phone/email do Stripe não existe no CRM
- Atualizar `deals` / status comercial / RFM
- Mapear `stripe.product.id` ⇢ SKU Smart Dent

## Detalhes técnicos
- Normalização telefone: reutilizar mesma lógica de `_shared` que outras funções WA usam (11 dígitos com DDD; se vier +55, remove; guarda ambos formatos na query com `or(telefone.eq.X,telefone.eq.Y)`).
- Idempotência: `insert ... on conflict (event_id) do nothing returning event_id` → se retorno vazio, já processado, responde 200 imediato.
- SDK Stripe com `apiVersion: "2026-03-25.dahlia"`.
- Assinatura Deno: `constructEventAsync` (não a versão sync, exige subtle crypto).

Após aprovar, executo migração + criação da função + deploy.
