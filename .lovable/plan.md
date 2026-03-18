

# Fix: API URLs, Merge Logic & Frontend Filter

All code locations confirmed. Here are the exact changes:

## 1. Edge Function (`supabase/functions/smart-ops-ecommerce-webhook/index.ts`)

### a) Line 171 — Fix `fetchOrderFromLI` resourceUri path
Strip `/api` prefix from resourceUri since LI webhooks send `/api/v1/...` but the working base is `/v1/`:
```ts
// Line 169-171: replace with
const authParams = `chave_api=${encodeURIComponent(apiKey)}&chave_aplicacao=${encodeURIComponent(appKey || '')}`;
const cleanUri = resourceUri.replace(/^\/api\//, '/');
const separator = cleanUri.includes('?') ? '&' : '?';
const url = `https://api.awsli.com.br${cleanUri}${separator}${authParams}`;
```

### b) Line 213 — Fix `fetchClienteFromLI` URL
Change `/api/v1/cliente/` to `/v1/cliente/`:
```ts
const url = `https://api.awsli.com.br/v1/cliente/${clienteId}/?${authParams}`;
```

### c) Line 256 — Fix `fetchClienteOrderHistory` URL + increase limit
Change `/api/v1/pedido/` to `/v1/pedido/` and `limit=20` to `limit=100`:
```ts
const url = `https://api.awsli.com.br/v1/pedido/?cliente_id=${clienteId}&limit=100&${authParams}`;
```

### d) Lines 676-688 — Fix merge logic to drop entries without `numero`
Replace the current merge block with:
```ts
const merged: Array<Record<string, unknown>> = [];
const seen = new Set<string>();
for (const h of newHistory) {
  const key = h.numero ? String(h.numero) : null;
  if (!key || key === 'undefined') continue;
  merged.push(h);
  seen.add(key);
}
for (const h of existingHistory) {
  const key = h.numero ? String(h.numero) : null;
  if (!key || key === 'undefined' || seen.has(key)) continue;
  merged.push(h);
  seen.add(key);
}
enrichmentData.lojaintegrada_historico_pedidos = merged;
```

## 2. Frontend (`src/components/smartops/LeadDetailPanel.tsx`)

### Line 872-873 — Filter stale entries + sort desc
```ts
const liHistorico = (Array.isArray(ld.lojaintegrada_historico_pedidos) ? [...ld.lojaintegrada_historico_pedidos] : [])
  .filter((p: any) => p.numero && String(p.numero) !== 'undefined')
  .sort((a: any, b: any) => new Date(b.data || b.data_criacao || 0).getTime() - new Date(a.data || a.data_criacao || 0).getTime());
```

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/smart-ops-ecommerce-webhook/index.ts` | Fix 3 API URLs `/api/v1/` → `/v1/`, limit 20→100, merge drops entries without `numero` |
| `src/components/smartops/LeadDetailPanel.tsx` | Filter stale entries without `numero`, sort desc |

