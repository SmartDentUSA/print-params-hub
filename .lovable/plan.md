
# Fix WaLeads Authentication - Key as Query Parameter

## Problem

The WaLeads API is ignoring the `key` field sent in the JSON body and returning:
```text
"key should not be empty", "key must be a mongodb id"
```

The key stored for "Paulo Comercial" (`687fb5b160ced29ac0b3ac9d`) is a valid 24-character MongoDB ObjectId, so the format is correct. The API simply expects it as a **URL query parameter**, not in the request body.

## Fix

### 1. `supabase/functions/smart-ops-send-waleads/index.ts`

**Move `key` from body to URL query parameter:**

Change line 99 from:
```typescript
const waRes = await fetch(`${WALEADS_BASE_URL}/public/message/${tipo}`, {
```
to:
```typescript
const waRes = await fetch(`${WALEADS_BASE_URL}/public/message/${tipo}?key=${member.waleads_api_key}`, {
```

**Remove `key` from apiBody** (lines 89, 91):
```typescript
// Text
apiBody = { chat: cleanPhone, message: finalMessage, isGroup: false };
// Media
apiBody = { chat: cleanPhone, url: media_url, isGroup: false };
```

### 2. `supabase/functions/smart-ops-cs-processor/index.ts`

Same change: move `key` to the URL query parameter on the fetch call, using the team member's `waleads_api_key`.

Current line (~148):
```typescript
const waRes = await fetch(`${WALEADS_BASE_URL}/public/message/${waleadsTipo}`, {
```
Change to:
```typescript
const waRes = await fetch(`${WALEADS_BASE_URL}/public/message/${waleadsTipo}?key=${waleadsApiKey}`, {
```

## Summary

| File | Change |
|---|---|
| `smart-ops-send-waleads/index.ts` | Move `key` from JSON body to URL `?key=...`, clean body |
| `smart-ops-cs-processor/index.ts` | Add `?key=...` to fetch URL |

No new secrets needed -- the key is already stored per team member in `team_members.waleads_api_key`.
