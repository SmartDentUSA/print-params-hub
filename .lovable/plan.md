

# Fix: E-commerce Data Integrity + Card Display Issues

## Problems Found

### 1. Historico pedidos entries are sparse — missing itens, tracking, parcelas
The existing 20 orders for `danilohen@gmail.com` only contain `{data, numero, status, valor}`. The `enrichWithOrderHistory` function NOW builds rich snapshots (with itens, tracking, parcelas, bandeira), but the **merge logic (line 670-688) only ADDS new entries by numero — it never UPDATES existing entries** with richer data when they're re-fetched from the API.

**Fix**: Change merge logic to always replace existing entries with the newer, richer snapshot instead of skipping them.

### 2. Status chip in e-commerce table shows wrong colors
The table chip (line 923) checks for `status === "pago" || status === "Pedido Pago"` for green, and `status === "cancelado"` for red. But actual statuses are `pedido_enviado` and `pedido_cancelado` (with prefix). All "enviado" orders show as neutral/open instead of green.

**Fix**: Expand the status chip logic to recognize `pedido_enviado`, `pedido_pago`, `pedido_entregue` as "paid/delivered" (green) and `pedido_cancelado` as "lost" (red).

### 3. Duplicate lead records — `.com` vs `.com.br`
`danilohen@gmail.com` (20 orders, LTV R$9,518) and `danilohen@gmail.com.br` (0 orders) are separate leads. This is a data quality issue, not a code bug. New purchases from `.com.br` email go to the wrong (empty) record.

**Fix**: Not a code change — needs manual merge or auto-dedup rule. Will flag this but not include in code changes.

### 4. E-commerce section should always show (with empty state)
Per the `consistent-card-layout-policy` memory, sections should always show with empty-state placeholders. Currently, the e-commerce section is conditionally hidden when `hasSomething` is false.

**Fix**: Always show the section with a dashed empty-state placeholder when no data exists.

## Changes

### File: `supabase/functions/smart-ops-ecommerce-webhook/index.ts`

**Merge logic (lines 670-688)**: Replace skip-if-seen logic with always-overwrite:
```ts
// Instead of only adding NEW entries, always overwrite with latest snapshot
const merged: Array<Record<string, unknown>> = [];
const seen = new Set<string>();
// First, add all new entries (richer data from API)
for (const h of newHistory) {
  merged.push(h);
  seen.add(String(h.numero));
}
// Then add old entries that weren't in the new batch
for (const h of existingHistory) {
  if (!seen.has(String(h.numero))) {
    merged.push(h);
  }
}
```

### File: `src/components/smartops/LeadDetailPanel.tsx`

**a) Status chip logic (line 923)**: Expand to recognize `pedido_*` prefixed statuses:
```ts
const isPaidStatus = (s: string) => 
  ["pago","pedido_pago","pedido_enviado","enviado","pedido_entregue","entregue","Pedido Pago"].includes(s);
const isCancelledStatus = (s: string) => 
  ["cancelado","pedido_cancelado","devolvido"].includes(s);
```

**b) E-commerce section (line 872)**: Always show with empty state instead of returning null.

### Files Changed

| File | Change |
|------|--------|
| `supabase/functions/smart-ops-ecommerce-webhook/index.ts` | Fix merge logic to overwrite existing entries with richer snapshots |
| `src/components/smartops/LeadDetailPanel.tsx` | Fix status chip colors + always show e-commerce section with empty state |

