

# Fix: Deal "Itens" column showing lead name instead of product name

## Problem
For deals without embedded proposals (line 735-747), the code falls back to `d.product` for the "Itens" column. In PipeRun, the `product` field on some deals contains the person/lead name (e.g., "Matheus Guilherme Lucas") rather than an actual product name. This makes the table misleading.

## Fix — `src/components/smartops/LeadDetailPanel.tsx`

### Line 740: Guard against `d.product` being the lead's name
Before using `d.product` as fallback, compare it against the lead's name (`ld.nome`). If they match, show `d.deal_title` instead, or fall back to "—".

```ts
// Current (line 740):
itens: d.product || "—",

// New:
itens: (d.product && d.product !== ld.nome) ? d.product : (d.deal_title && d.deal_title !== ld.nome ? d.deal_title : "—"),
```

Same logic applies to line 716 where `d.product` is used as fallback when proposals have no valid items:
```ts
// Current (line 716):
: d.product || "—";

// New:
: (d.product && d.product !== ld.nome) ? d.product : "—";
```

This prevents the lead's own name from appearing as a product/item description in the proposals table.

