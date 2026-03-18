

# Fix: Pedidos da Loja Integrada não aparecem na timeline (Auth 401)

## Problema Identificado

Os logs confirmam o problema exato:

```text
Failed to fetch order from LI: 401 A chave da aplicação enviada não é válida.
Failed to fetch client from LI: 401 A chave da aplicação enviada não é válida.
→ Pedido sem email, ignorando
```

**Causa raiz**: As funções `fetchOrderFromLI` e `fetchClienteFromLI` dentro do `smart-ops-ecommerce-webhook` usam **apenas autenticação por querystring**, que a API da Loja Integrada está rejeitando com 401. O `poll-loja-integrada-orders` funciona porque usa uma estratégia dupla (header primeiro, querystring como fallback) — mas o webhook de e-commerce não implementa essa mesma estratégia.

**Fluxo quebrado**:
1. `poll-loja-integrada-orders` busca pedidos da API (funciona com header auth)
2. Envia cada pedido para `smart-ops-ecommerce-webhook`
3. O payload do pedido tem `cliente: "/api/v1/cliente/12345"` (URI, não objeto)
4. O webhook tenta buscar os dados do cliente via API → **401**
5. Sem email → pedido é descartado

## Solução

### File: `supabase/functions/smart-ops-ecommerce-webhook/index.ts`

1. **Criar uma função auxiliar `apiFetchLI`** com a mesma estratégia dual-auth do `poll-loja-integrada-orders`:
   - Tentar primeiro com header `Authorization: chave_api {KEY} aplicacao {APP_KEY}`
   - Fallback para querystring
   - Retry com backoff em caso de rate limit (429)

2. **Atualizar `fetchOrderFromLI`** para usar `apiFetchLI` em vez do fetch direto com querystring

3. **Atualizar `fetchClienteFromLI`** para usar `apiFetchLI` em vez do fetch direto com querystring

### Detalhes Técnicos

A função `apiFetchLI` será semelhante ao padrão já existente no `poll-loja-integrada-orders`:

```typescript
async function apiFetchLI(path: string, apiKey: string, appKey: string | null): Promise<Response> {
  // Strategy 1: Header auth (preferred)
  const headerAuth = `chave_api ${apiKey} aplicacao ${appKey || ''}`;
  let res = await fetch(`https://api.awsli.com.br${path}`, {
    headers: { 'Authorization': headerAuth, 'Accept': 'application/json' }
  });
  if (res.ok) return res;
  
  // Strategy 2: Querystring fallback
  const qs = `chave_api=${encodeURIComponent(apiKey)}&chave_aplicacao=${encodeURIComponent(appKey || '')}`;
  const sep = path.includes('?') ? '&' : '?';
  res = await fetch(`https://api.awsli.com.br${path}${sep}${qs}`, {
    headers: { 'Accept': 'application/json' }
  });
  return res;
}
```

### Impacto

- Todos os pedidos que chegam via `poll-loja-integrada-orders` (incluindo o do `danilohen@gmail.com`) passarão a ser processados corretamente
- Os pedidos que chegam via webhook direto da LI também serão beneficiados
- O deploy é automático após a edição

### Arquivo Alterado
- `supabase/functions/smart-ops-ecommerce-webhook/index.ts` — substituir auth querystring por dual-auth strategy nas funções `fetchOrderFromLI` e `fetchClienteFromLI`

