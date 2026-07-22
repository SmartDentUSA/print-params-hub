# Fix pontual: header de assinatura Zernio

Em `supabase/functions/smart-ops-zernio-lead-webhook/index.ts`, dentro de `verifyZernioSignature`, trocar:

```ts
const signature = req.headers.get("x-zernio-signature");
```

por:

```ts
const signature = req.headers.get("x-late-signature");
```

Nada mais é alterado (nem CORS, nem tratamento de `webhook.test`, nem normalizer, nem dedup).

## Deploy e validação
1. Deploy da função `smart-ops-zernio-lead-webhook`.
2. Pedir "Re-run delivery" do `webhook.test` na Zernio e confirmar que deixa de retornar 401.
