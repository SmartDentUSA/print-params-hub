
## Como testar o webhook do Stripe

Você tem 3 formas — da mais simples pra mais realista:

### 1. Botão "Enviar evento de teste" no próprio Stripe (mais rápido)
No painel do Stripe, na página do endpoint que você acabou de criar:

1. Clique no endpoint `https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/stripe-webhook`
2. Botão **"Enviar evento de teste"** (canto superior direito)
3. Escolhe o evento (ex.: `checkout.session.completed`)
4. Clica em **"Enviar evento de teste"**

O Stripe monta um payload fake e dispara. Vai aparecer status 200 na aba "Tentativas" do endpoint.

⚠️ Limitação: o payload de teste NÃO tem telefone/email de nenhum lead real seu, então o webhook vai gravar em `stripe_webhook_events` com `error='lead_not_found'`. Isso é esperado — confirma que assinatura + código funcionam.

### 2. Checkout real em modo teste (recomendado pra validar o match do lead)
Fluxo completo com dados de um lead real:

1. Certifique-se que a chave configurada é `sk_test_...` (modo sandbox)
2. Crie um Payment Link ou Checkout Session no Stripe modo teste
3. Abre o link no navegador anônimo e preenche:
   - Email: um email que existe em `lia_attendances` (ex.: um lead seu)
   - Telefone: idem
   - Cartão de teste: `4242 4242 4242 4242`, validade futura, CVV qualquer
4. Finaliza a compra

Aí o webhook recebe `checkout.session.completed` com telefone/email reais → resolve o `lead_id` → grava na timeline.

### 3. Ver o resultado
Depois de qualquer teste, eu te ajudo consultando:

- **Aba "Tentativas"** do endpoint no Stripe (mostra status HTTP e response)
- **Logs da Edge Function** — link no painel Supabase
- **Tabela `stripe_webhook_events`** — SELECT dos últimos eventos (event_id, event_type, lead_id, error)
- **Tabela `lead_activity_log`** — se `lead_id` foi resolvido, entra uma linha nova

### O que fazer agora

Me confirme qual caminho quer seguir:

- **A)** Só valida com "Enviar evento de teste" do Stripe (rápido, ignora match de lead)
- **B)** Faz um checkout real em modo teste com um lead seu (valida ponta a ponta)

Depois que você disparar o teste, me avisa que eu consulto os logs + as duas tabelas e te confirmo se chegou tudo certo.
