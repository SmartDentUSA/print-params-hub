

# Plan: Show proposal items from ALL ganho deals in enrollment

## Problem

When searching for lead 57867531 (Matheus Guilherme Lucas), the enrollment modal only shows items from the single matched deal. This lead has **5 deals total, 3 won ("ganha")**, but only one deal's items are extracted.

The data shows:
- Deal `oz0b2fl3...` (Ganha): **Impressora 3D Anycubic Mono SE** + **Resina 3D Smart Print**
- Deal `57867531` (ganha): **Teflon RayShape - PEQUENO** x3
- Deal `56506351` (ganha): empty proposals
- Deal `56243300` (ganha): empty proposals

Currently `extractProposalItems()` only processes one deal. The user expects to see ALL items from all won deals.

## Fix

### 1. `src/components/smartops/EnrollmentModal.tsx` — extract items from ALL ganho deals

**`populateFromResult`** (line 150-169): Change to extract items from ALL ganho deals, not just the matched one.

```typescript
// Current:
const items = extractProposalItems(deal);

// New:
const allGanho = result.piperun_deals_history.filter(isDealGanho);
const items = allGanho.flatMap(d => extractProposalItems(d));
```

Same change in **`handleSelectDeal`** (line 176-184) — keep showing all items regardless of which deal is selected, or remove the per-deal item switching.

### 2. Add deal origin label to each item

To help the user know which deal each item came from, add `deal_title` or `deal_id` to the `ProposalItem` interface and display it as a small label in the equipment card.

**`src/types/courses.ts`**: Add `deal_ref?: string` to `ProposalItem`.

**`src/lib/courseUtils.ts` — `extractProposalItems`**: Accept an optional `dealLabel` param and attach it to each item.

**`src/components/smartops/EquipmentSerialsSection.tsx`**: Show the deal reference as a subtle tag on each card.

## Result

All items from all ganho deals appear together in Step 2 with serial/date inputs, grouped by equipment stage. Each item shows which deal it came from.

