

# Fix: Invalid Date + Sort Propostas Detalhadas

## Changes — single file: `src/components/smartops/LeadDetailPanel.tsx`

### 1. Robust `formatDate` (lines 115-118)
Replace with version that guards empty/whitespace strings and validates `getTime()`:
```ts
const formatDate = (dt: string | null | undefined): string => {
  if (!dt || typeof dt !== 'string' || !dt.trim()) return "—";
  const d = new Date(dt);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
};
```

### 2. Sort flatProposals descending by date (after line 746)
Add sort before rendering, pushing invalid/missing dates to end:
```ts
flatProposals.sort((a, b) => {
  const dateA = a.date?.trim() ? new Date(a.date).getTime() : 0;
  const dateB = b.date?.trim() ? new Date(b.date).getTime() : 0;
  if (isNaN(dateA)) return 1;
  if (isNaN(dateB)) return -1;
  return dateB - dateA;
});
```
This sorts in-place right after the `flatProposals` array is fully built (after the cross-reference block ~line 770), so no variable rename needed — the existing `.map()` at line 1157 continues to work.

