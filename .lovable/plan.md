# Investigação — Recebimentos Stripe pararam

## Sintomas confirmados
- Último evento em `stripe_webhook_events`: **2026-07-20 18:55** (4 dias sem nada).
- Último `stripe_payment_units.paid_at`: **2026-07-20 18:21**.
- **Zero logs** na Edge Function `stripe-webhook` no período — ou seja, a Stripe **não está chamando o endpoint** (não é erro de assinatura nem de código, é falta de entrega).
- `STRIPE_WEBHOOK_SECRET` está presente nos secrets.
- `STRIPE_SECRET_KEY` **não aparece** na lista de secrets do projeto (usado só para `listLineItems`; não bloqueia recebimento, mas quebra a expansão de `stripe_payment_units` em `checkout.session.completed`).

## Hipóteses (ordem de probabilidade)
1. **Endpoint desativado / URL alterada no Stripe Dashboard** (Developers → Webhooks). Alguém pausou ou o endpoint foi recriado e o secret novo não foi salvo aqui.
2. **`STRIPE_WEBHOOK_SECRET` desatualizado** — se o secret do endpoint foi rotacionado no Stripe, todas as entregas falham na verificação de assinatura. Mas nesse caso apareceriam logs de "signature verification failed" — como não há **nenhum** log, é menos provável, salvo se o endpoint foi apagado.
3. **Modo test x live**: eventos recentes podem estar sendo emitidos em test mode enquanto o endpoint só ouve live (ou vice-versa).
4. **Nenhuma transação nova** (descartar com o usuário — ele afirma que há pagamentos).

## Passos de diagnóstico (sem alterar código)
1. Pedir ao usuário para abrir **Stripe Dashboard → Developers → Webhooks** e informar:
   - Status do endpoint `https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/stripe-webhook` (Enabled?).
   - Data/hora da última tentativa de entrega e se houve falhas (400/401/timeout).
   - Se o **Signing secret** exibido bate com o `STRIPE_WEBHOOK_SECRET` salvo aqui.
   - Se o endpoint está em **live mode** e ouvindo os `checkout.session.*` / `payment_intent.*` / `invoice.*` esperados.
2. Confirmar se `STRIPE_SECRET_KEY` deve ser (re)cadastrado para reabilitar expansão de unidades por dongle.

## Ações condicionadas (após diagnóstico)
- Se o endpoint estiver **pausado/removido**: recriar/reativar apontando para `/functions/v1/stripe-webhook`, capturar novo signing secret e atualizar `STRIPE_WEBHOOK_SECRET` via `update_secret`.
- Se o **signing secret divergiu**: atualizar `STRIPE_WEBHOOK_SECRET`.
- Se **STRIPE_SECRET_KEY** estiver ausente por engano: cadastrar via `add_secret` (o webhook continua funcionando sem ele, mas `listLineItems` cai no fallback de 1 unidade só).
- Após reativar, disparar um **"Send test webhook"** no Stripe e conferir que aparece linha nova em `stripe_webhook_events` + log na função.
- Fazer **backfill** dos eventos perdidos entre 20/07 e agora usando a Stripe API (script one-off que lista `events` com `created[gte]=1721...` e reposta no webhook via `curl -H stripe-signature ...` — ou consumir direto e inserir em `stripe_webhook_events` + `lead_activity_log`).

## Não fazer
- Não alterar `stripe-webhook/index.ts` até confirmar que o problema é entrega (não código).
- Não mexer em `stripe_payment_units` / `lead_activity_log` retroativos antes do backfill autorizado.
