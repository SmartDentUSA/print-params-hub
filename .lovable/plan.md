

## Plano: Implementar polling de pedidos da Loja Integrada

### 4 mudancas em arquivos + 1 SQL via insert tool

**1. Criar `supabase/functions/poll-loja-integrada-orders/index.ts`**
Codigo fornecido pelo usuario, com auth por query params, rate limit 800ms, circuit breaker, retry em 429, sanitizacao `response.text()` + `JSON.parse()`.

**2. Corrigir `supabase/functions/smart-ops-ecommerce-webhook/index.ts` (linhas 154-182)**
Substituir `fetchOrderFromLI` — remover header `Authorization`, usar query params, adicionar sanitizacao segura:
```typescript
const authParams = `chave_api=${encodeURIComponent(apiKey)}&chave_aplicacao=${encodeURIComponent(appKey || '')}`;
const separator = resourceUri.includes('?') ? '&' : '?';
const url = `https://api.awsli.com.br${resourceUri}${separator}${authParams}`;
const res = await fetch(url, { headers: { Accept: 'application/json' } });
// + response.text() → JSON.parse() com try/catch
```

**3. Corrigir `supabase/functions/register-loja-webhooks/index.ts`**
- Remover funcao `buildAuthHeader` (linhas 31-35)
- Remover todos os headers `Authorization` das funcoes `registerWebhook` (linha 50), `listWebhooks` (linha 78), `deleteWebhook` (linha 103), e `test_auth` (linha 140)
- Manter apenas query params via `buildAuthParams` (que ja existe e funciona)

**4. Atualizar `supabase/config.toml`**
Adicionar ao final:
```toml
[functions.poll-loja-integrada-orders]
verify_jwt = false
```

**5. Cron job via SQL Editor (insert tool, nao migration)**
Agendar polling a cada 5 minutos usando `pg_cron` + `pg_net` com a service_role key do projeto.

**Deploy**: Manual via CLI conforme memoria do projeto.

