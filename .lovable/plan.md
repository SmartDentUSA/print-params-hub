## Context
The function `triggerOutboundMessages` in `supabase/functions/_shared/waleads-messaging.ts` sends a seller briefing via WhatsApp (Evolution API) every time it runs. This can result in duplicate notifications to the same seller for the same lead on the same day.

## Goal
Add a deduplication check against `message_logs` before the `sendWaLeadsMessage` call that delivers the seller briefing.

## Implementation

### File: `supabase/functions/_shared/waleads-messaging.ts`

1. Inside `triggerOutboundMessages`, after building the `briefing` string (line ~535) and before calling `sendWaLeadsMessage` for the seller (line ~537), insert:

```typescript
const hoje = new Date().toISOString().split('T')[0];
const hojeStart = `${hoje}T00:00:00.000Z`;
const hojeEnd = `${hoje}T23:59:59.999Z`;

const { count } = await supabase
  .from('message_logs')
  .select('*', { count: 'exact', head: true })
  .eq('lead_id', leadId)
  .in('tipo', ['briefing_vendedor', 'briefing_vendedor_block'])
  .gte('created_at', hojeStart)
  .lte('created_at', hojeEnd);

if (count && count > 0) {
  console.log('[notifySeller] dedup blocked - already sent today');
  return { skipped: true, reason: 'already_notified_today' };
}
```

2. Because `triggerOutboundMessages` currently returns `Promise<void>`, change its signature to return `Promise<{ skipped?: boolean; reason?: string } | void>` so the caller can optionally react to the skip.

3. The `sendWaLeadsMessage` call at line 537 should only execute when the dedup check passes.

## Notes
- The table `message_logs` does not have a `data_envio_dia` column. Use `created_at` range-filtered to the current UTC day instead.
- No database migration is required because `message_logs` already exists and `tipo` is a free text field.