

# Fix: Timeline Dedup + Historico Ordering + DB Unique Index

## Summary

Three targeted fixes to eliminate duplicate timeline entries and ensure correct data display.

## Changes

### 1. Database Migration — Unique partial index + cleanup duplicates

Create a migration that:
- **Deletes existing duplicate rows** from `lead_activity_log` (keeping the oldest per `lead_id + event_type + entity_id` combo where `source_channel = 'ecommerce'`)
- **Creates a unique partial index**: `(lead_id, event_type, entity_id) WHERE entity_id IS NOT NULL AND source_channel = 'ecommerce'`

This makes the DB the single source of truth for dedup.

### 2. Edge Function — Replace select-then-insert with insert-catch-conflict (`smart-ops-ecommerce-webhook/index.ts`)

**Lines 849-862**: Remove the `skipActivityInsert` logic (select + check). Replace with a direct insert that catches the unique constraint violation silently:

```ts
// Just insert — let the DB unique index handle dedup
const { error: actInsertErr } = await supabase.from("lead_activity_log").insert({...});
if (actInsertErr) {
  if (actInsertErr.code === "23505") { // unique_violation
    console.log(`[ecommerce-webhook] activity_log dedup (DB constraint): ${eventType} pedido=${numeroPedido}`);
  } else {
    console.warn("[ecommerce-webhook] timeline insert error:", actInsertErr.message);
  }
}
```

This eliminates the race condition between select and insert.

### 3. Frontend — Client-side dedup + sort historico by date desc (`LeadDetailPanel.tsx`)

**a) Timeline dedup (line 339-373)**: Before iterating `activity_log`, filter using a `Set` keyed on `event_type|entity_id`:

```ts
const seenKeys = new Set<string>();
const dedupedLogs = (detail?.activity_log || []).filter(ev => {
  if (!ev.entity_id) return true;
  const key = `${ev.event_type}|${ev.entity_id}`;
  if (seenKeys.has(key)) return false;
  seenKeys.add(key);
  return true;
});
dedupedLogs.forEach((ev) => { ... });
```

**b) Historico table sort (line 864)**: Sort `liHistorico` by date descending so newest orders appear first:

```ts
const liHistorico = (Array.isArray(ld.lojaintegrada_historico_pedidos) ? [...ld.lojaintegrada_historico_pedidos] : [])
  .sort((a: any, b: any) => new Date(b.data || b.data_criacao || 0).getTime() - new Date(a.data || a.data_criacao || 0).getTime());
```

## Files Changed

| File | Change |
|------|--------|
| Migration SQL | Delete dupes + create unique partial index on `lead_activity_log` |
| `supabase/functions/smart-ops-ecommerce-webhook/index.ts` | Replace select-then-insert with insert + catch `23505` |
| `src/components/smartops/LeadDetailPanel.tsx` | Client-side dedup filter + sort historico desc |

