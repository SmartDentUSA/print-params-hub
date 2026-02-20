

# Fix: Google Drive KB Sync 401 Error

## Root Cause

The `sync-google-drive-kb` function calls `ingest-knowledge-text` passing the **service role key** as Bearer token. However, `ingest-knowledge-text` validates the token using `auth.getClaims()`, which only works with **user JWTs** -- not service role keys. Result: 401 Unauthorized.

## Solution

Update `ingest-knowledge-text` to also accept the **service role key** as a valid authorization method. If the Bearer token matches the service role key, skip the user claims check and proceed directly.

## Changes

### File: `supabase/functions/ingest-knowledge-text/index.ts`

Replace the auth check block (lines 60-79) with logic that:

1. First checks if the Bearer token equals `SUPABASE_SERVICE_ROLE_KEY` -- if so, skip user validation (trusted server-to-server call)
2. Otherwise, validate as a user JWT using `getClaims()` as before

```
Before (simplified):
  token -> getClaims() -> fail if not user JWT

After (simplified):
  token == SERVICE_ROLE_KEY ? -> allow (server call)
  token != SERVICE_ROLE_KEY ? -> getClaims() as before
```

### No other files need changes

The `sync-google-drive-kb` function already sends the correct Authorization header with the service role key. The UI component (`AdminApostilaImporter`) is also unaffected.

## Technical Detail

The specific code change in the auth block:

```typescript
const token = authHeader.replace("Bearer ", "");

// Allow service-role calls (server-to-server)
if (token !== SUPABASE_SERVICE_ROLE_KEY) {
  const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
```

## What This Fixes

- The "Erro" status on the sync log for "Smart Print Bio Vitality - SDR" (and any other files)
- Future syncs from both manual triggers and pg_cron will work correctly

## Pre-requisite Reminder

The `GOOGLE_DRIVE_API_KEY` secret is still missing from Supabase Edge Function Secrets. You need to add it for the Drive file listing/export to work. The current error happens *after* the Drive API call succeeds, so either the key is set elsewhere or a test file was used. But for production, ensure this secret is configured.

