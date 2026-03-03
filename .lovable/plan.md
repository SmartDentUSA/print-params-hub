

# Fix: Watchdog Edge Function Failing

## Root Cause

Two issues preventing the watchdog from working when called from the browser:

### 1. Incomplete CORS Headers
The `Access-Control-Allow-Headers` is missing the `x-supabase-client-*` headers that the Supabase JS SDK sends automatically. The preflight OPTIONS request fails, blocking the actual request.

Current:
```
"authorization, x-client-info, apikey, content-type"
```

Required:
```
"authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version"
```

### 2. Timeout Risk
The watchdog found **36 orphan leads** and tries to re-ingest up to 10 sequentially via HTTP calls to `smart-ops-ingest-lead`. Each call takes ~15s (PipeRun + SellFlux sync), causing the function to exceed the edge function timeout before returning a response.

## Fix

| File | Change |
|---|---|
| `supabase/functions/system-watchdog-deepseek/index.ts` | Fix CORS headers; limit auto-remediation to 3 leads per run; add `dry_run` option so the dashboard can fetch stats without triggering remediation |

