

# Plan: Replace "LTV GANHO" with PipeRun Financial Summary (4 metrics)

## Problem
The "LTV GANHO" block shows a single aggregated value that doesn't match PipeRun's CRM view. The user wants the exact PipeRun layout: "Oportunidades ganhas / Propostas abertas" with 4 metrics.

## Data Available (confirmed via DB query)
Deal-level fields in `piperun_deals_history`:
- `value_products` — P&S value (available on all deals)
- `value_mrr` — MRR value (available, currently 0 for this lead)
- `status` — "Ganha", "aberta", "Perdida"

## Changes (LeadDetailPanel.tsx only, ADDITIVE)

### 1. Add computed values (after line 443)
```typescript
const openDeals = allDeals.filter((d: any) => !isWon(d.status) && !isLost(d.status));
const psWon = wonDeals.reduce((s, d) => s + (Number(d.value_products) || Number(d.value) || 0), 0);
const psOpen = openDeals.reduce((s, d) => s + (Number(d.value_products) || Number(d.value) || 0), 0);
const mrrWon = wonDeals.reduce((s, d) => s + (Number(d.value_mrr) || 0), 0);
const mrrOpenLost = [...openDeals, ...lostDeals].reduce((s, d) => s + (Number(d.value_mrr) || 0), 0);
```

### 2. Replace the ltv-block content (lines 745-749)
Replace the single "LTV GANHO" with a 2x2 grid matching PipeRun:

```
┌─────────────────────────┬─────────────────────────┐
│ R$ 74.871,20            │ R$ 20.327,70            │
│ Valor de P&S (ganhas)   │ Valor de P&S (abertas)  │
├─────────────────────────┼─────────────────────────┤
│ R$ 0,00                 │ R$ 0,00                 │
│ Valor MRR (ganhas)      │ Valor MRR (abertas+     │
│                         │ perdidas)               │
└─────────────────────────┴─────────────────────────┘
```

Title: "Oportunidades ganhas / Propostas abertas"

- Green for P&S won, accent for P&S open
- Muted for MRR when zero

### 3. Keep existing stats row (line 481-488) unchanged
The stats row already shows deal counts — no changes there.

## Validation
Data for `sorriatavares@gmail.com`:
- 12 won deals with value_products summing to match CRM's R$ 74.871,20
- 1 open deal (57948266) with value_products = R$ 20.080 (close to CRM's R$ 20.327,70 — difference likely from missing deals PRO3052/PRO1958)
- MRR = 0 across all deals (matches CRM)

**Files changed**: 1 (`src/components/smartops/LeadDetailPanel.tsx`)
**Nothing removed**: All existing sections preserved.

