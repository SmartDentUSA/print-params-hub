

# Fix: Multi-strategy Auth in poll-loja-integrada-orders

## Change

**File**: `supabase/functions/poll-loja-integrada-orders/index.ts`

Replace lines 48-67 (single querystring auth + retry loop) with a dual-strategy auth loop that tries header auth first, then falls back to querystring. The retry logic for 429 is preserved inside each strategy.

### Lines 48-67 become:

```ts
const strategies = [
  {
    name: 'header',
    url: `${API_BASE}${endpoint}`,
    headers: {
      'Authorization': `chave_api ${API_KEY} aplicacao ${APP_KEY}`,
      'Accept': 'application/json',
    }
  },
  {
    name: 'querystring',
    url: endpoint.includes('?')
      ? `${API_BASE}${endpoint}&chave_api=${encodeURIComponent(API_KEY)}&chave_aplicacao=${encodeURIComponent(APP_KEY)}`
      : `${API_BASE}${endpoint}?chave_api=${encodeURIComponent(API_KEY)}&chave_aplicacao=${encodeURIComponent(APP_KEY)}`,
    headers: { 'Accept': 'application/json' }
  }
];

let response: Response | undefined;

for (const strategy of strategies) {
  let attempt = 0;
  for (; attempt < MAX_RETRIES; attempt++) {
    response = await fetch(strategy.url, { headers: strategy.headers });

    if (response.status === 429) {
      const wait = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
      console.warn(`[poll-li] Rate limit (${strategy.name}) → aguardando ${wait}ms (tentativa ${attempt + 1})`);
      await response.text();
      await new Promise(r => setTimeout(r, wait));
      continue;
    }
    break;
  }

  if (attempt === MAX_RETRIES) {
    console.warn(`[poll-li] Max retries com ${strategy.name}`);
    continue;
  }

  if (response?.ok) {
    console.log(`[poll-li] ✅ Auth OK com estratégia: ${strategy.name}`);
    break;
  }

  if (response?.status === 401) {
    console.warn(`[poll-li] 401 com ${strategy.name}, tentando próxima...`);
    await response.text();
    continue;
  }

  break; // non-401 error, stop
}
```

Lines 69+ (circuit breaker, JSON parse, rate limit delay) remain unchanged. Line 69 `if (attempt === MAX_RETRIES)` changes to check `if (!response || !response.ok)` since `attempt` is now scoped inside the loop.

### Line 69 becomes:
```ts
if (!response) throw new Error('Todas as estratégias de auth falharam');
```

Everything else (circuit breaker, JSON parse, the rest of the function) stays exactly as-is.

## Deploy
The edge function will be auto-deployed after the code change.

