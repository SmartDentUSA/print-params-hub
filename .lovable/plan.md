

## Ativar webhooks da Loja Integrada

### Problema
Os webhooks não estão cadastrados na Loja Integrada. Pedidos criados/atualizados não são enviados para nosso sistema.

### Solução (3 passos sequenciais)

**Passo 1 — Testar autenticação**
Chamar `register-loja-webhooks` com `{ "action": "test_auth" }` para validar que as chaves API/App estão funcionando.

**Passo 2 — Registrar webhooks**
Chamar `register-loja-webhooks` com `{ "action": "register" }` para cadastrar os eventos `pedido_criado` e `pedido_atualizado` apontando para:
`https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/smart-ops-ecommerce-webhook`

**Passo 3 — Validar**
Listar webhooks com `{ "action": "list" }` para confirmar que foram registrados.

Após isso, você faz uma nova compra teste e verificamos os logs.

### Nenhuma alteração de código necessária
As Edge Functions `register-loja-webhooks` e `smart-ops-ecommerce-webhook` já estão implementadas e deployed.

