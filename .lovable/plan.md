## Problem

`export-leads-full` returns 403 "Admin required" because it calls `supabase.rpc("is_admin", { _user_id: ... })`, but the database function signature is `is_admin(user_id uuid)` (verified via `pg_proc`). Wrong param name → RPC returns null → admin check fails for every user.

## Fix

In `supabase/functions/export-leads-full/index.ts`, change the RPC call:

```ts
// before
await supabase.rpc("is_admin", { _user_id: userData.user.id });

// after
await supabase.rpc("is_admin", { user_id: userData.user.id });
```

That's the only change needed. Function will redeploy automatically.
