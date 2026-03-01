

## Diagnóstico: Webhook da Loja Integrada não está chegando

### Situação atual
- **SellFlux recebeu** os dados do pedido #2357 (via integração própria dele com a LI)
- **Nosso webhook NÃO recebeu** — os logs só mostram o teste manual (TESTE-001)
- O registro dos webhooks retornou status 200, mas a listagem retorna a página raiz da API (não os webhooks), sugerindo problema de autenticação

### Causa provável
A API da Loja Integrada v1 tem dois domínios:
- `api.awsli.com.br` — escrita (POST/PUT)
- `apiv1-reader.production.awsli.com.br` — leitura (GET)

O formato de autenticação pode estar incorreto. A LI aceita `chave_api {KEY} aplicacao {APP_KEY}` no header, mas também pode exigir query params `?chave_api=X&chave_aplicacao=Y`.

### Plano de correção

1. **Corrigir a listagem de webhooks** no `register-loja-webhooks` para usar query params de autenticação em vez de header (ou ambos), e testar qual formato funciona
2. **Adicionar log de debug** no webhook `smart-ops-ecommerce-webhook` para registrar TODAS as requisições recebidas (mesmo com body vazio ou formato inesperado)
3. **Re-registrar os webhooks** com a URL correta e autenticação corrigida
4. **Testar com outro pedido simulado** para confirmar recebimento

### Alterações técnicas

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/register-loja-webhooks/index.ts` | Usar query params `?chave_api=X&chave_aplicacao=Y` para autenticação (além do header), corrigir URL do GET para listar webhooks |
| `supabase/functions/smart-ops-ecommerce-webhook/index.ts` | Adicionar log no início para registrar headers e body bruto de toda requisição recebida (debug temporário) |

