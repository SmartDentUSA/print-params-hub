

# Fix: Backfill Missing Proposals + Prevent Future Gaps

## Summary

The sync engine (`smart-ops-sync-piperun`) already requests `with[]=proposals` (line 292). The `upsertDealHistory` function replaces snapshots by `deal_id` — so re-syncing WILL overwrite empty snapshots. The root cause was likely that these deals were first ingested via webhook (which doesn't include proposals) and subsequent syncs didn't reach them (offset/pagination or timing).

## Changes

### 1. Create Edge Function: `backfill-deal-proposals` (new file)

A targeted function that:
- Accepts a list of `deal_ids` (or auto-detects deals with `proposals: []` and `value > 0`)
- Fetches each deal individually from PipeRun API with `with[]=proposals,proposals.items`
- Rebuilds the `RichDealSnapshot` using `buildRichDealSnapshot`
- Replaces the snapshot in `piperun_deals_history` via `upsertDealHistory`
- Calls `callNormalizeFromLead` to propagate to normalized tables

```text
Input:  { deal_ids?: string[], auto_detect?: boolean, limit?: number }
Output: { backfilled: number, errors: number, details: [...] }
```

Auto-detect query logic:
```sql
SELECT id, piperun_deals_history
FROM lia_attendances
WHERE piperun_deals_history IS NOT NULL
  -- Find any deal in the JSONB array with value > 0 but empty proposals
```

For each matching lead, iterate `piperun_deals_history`, find snapshots where `proposals` is empty and `value > 0`, fetch from PipeRun `/deals/{deal_id}?with[]=proposals&with[]=proposals.items`, rebuild snapshot.

### 2. Update `smart-ops-piperun-webhook/index.ts` — Re-fetch deal with proposals

The webhook payload from PipeRun does NOT include `proposals` data. After processing the webhook deal, if the snapshot has `proposals: []` and `value > 0`, make a follow-up API call to fetch the deal with `with[]=proposals` and update the snapshot.

Add after the `buildRichDealSnapshot` call (~line 200-250 area):
```ts
// If proposals are empty but deal has value, re-fetch with proposals
if (dealSnapshot.proposals.length === 0 && (dealSnapshot.value ?? 0) > 0) {
  const enriched = await piperunGet(PIPERUN_API_KEY, `deals/${dealId}`, {}, 
    { "with[]": ["proposals", "proposals.items"] });
  if (enriched.success && enriched.data?.data?.proposals) {
    // Rebuild snapshot with proposals
    const enrichedDeal = { ...deal, proposals: enriched.data.data.proposals };
    dealSnapshot = buildRichDealSnapshot(enrichedDeal, overrides);
  }
}
```

### 3. Immediate backfill execution

After deploying the new function, invoke it with:
```json
{ "deal_ids": ["56243300", "56506351"] }
```

This will fix the two confirmed missing-proposal deals for `lucasmatheus@hotmail.com`.

## Technical Details

- **File 1** (new): `supabase/functions/backfill-deal-proposals/index.ts`
- **File 2** (edit): `supabase/functions/smart-ops-piperun-webhook/index.ts` — add proposal re-fetch when webhook snapshot has empty proposals
- **No migration needed** — data structure unchanged
- **Reuses**: `piperunGet`, `buildRichDealSnapshot`, `upsertDealHistory`, `callNormalizeFromLead` from `_shared/piperun-field-map.ts`

