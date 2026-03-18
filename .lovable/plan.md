

# Plan: Cupom + SKU Unificado (Loja Integrada + PipeRun)

## Problem
1. **Cupom** badge is missing from KanbanLeadCard; cupom data has serialization bug (`[object Object]`) in webhook
2. **SKU** column is missing from all product tables (Itens de Propostas, Product Mix Intelligence, E-commerce orders) — both PipeRun and Loja Integrada share the same SKU codes
3. Existing 25 records with corrupted cupom data need fixing

## Changes

### 1. Fix Cupom Serialization in Webhook
**File: `supabase/functions/smart-ops-ecommerce-webhook/index.ts`** (line ~545)

Current: `String(order.cupom_desconto)` — if object, produces `[object Object]`

Fix: Extract the cupom name properly:
```typescript
const rawCupom = order.cupom_desconto;
const liCupomDesconto = rawCupom
  ? (typeof rawCupom === "object" ? (rawCupom.codigo || rawCupom.nome || rawCupom.code || JSON.stringify(rawCupom)) : String(rawCupom))
  : null;
```
Also save the full object in `lojaintegrada_cupom_json` (already mapped but not populated).

### 2. Add Cupom Badge to KanbanLeadCard
**File: `src/components/smartops/KanbanLeadCard.tsx`** (line ~155, after tracking/LTV section)

Add: `🎟️ {cupom}` badge when `lojaintegrada_cupom_desconto` exists and is not `[object Object]`.

### 3. Add SKU Column to "Itens de Propostas" Table
**File: `src/components/smartops/LeadDetailPanel.tsx`** (lines ~1167, ~1172)

- Add `<th>SKU</th>` to header
- Extract SKU from item: `item.sku || item.external_code || item.referencia || item.cod || item.item_id || "—"`
- Add to `allProposalItems` type and push logic (line ~451-468)

### 4. Add SKU Column to "Product Mix Intelligence" Table
**File: `src/components/smartops/LeadDetailPanel.tsx`** (line ~957)

- Rename `Cód` header to `SKU` for clarity
- The `cod` field already maps `item.item_id || item.cod || item.referencia` — extend to include `item.sku || item.external_code` with priority

### 5. Add SKU + Cupom to E-commerce Orders Table
**File: `src/components/smartops/LeadDetailPanel.tsx`** (lines ~1131-1148)

- Add `<th>Itens/SKU</th>` column to the Loja Integrada orders table
- Extract from `lojaintegrada_itens_json` (stored per-lead) matching by order number, showing SKU list
- Add `<th>Cupom</th>` column showing cupom per order if available in historico

### 6. Add Cupom Card to E-commerce Summary
**File: `src/components/smartops/LeadDetailPanel.tsx`** (lines ~1095-1126)

Add a summary card for Cupom alongside LTV/Rastreio/CPF when `lojaintegrada_cupom_desconto` exists.

### 7. Backfill: Fix 25 Corrupted Cupom Records
Use Supabase query to update the 25 records where `lojaintegrada_cupom_desconto = '[object Object]'` — extract the correct value from `lojaintegrada_cupom_json` if available, otherwise clear.

## Files Changed
1. `supabase/functions/smart-ops-ecommerce-webhook/index.ts` — fix cupom serialization
2. `src/components/smartops/KanbanLeadCard.tsx` — add cupom badge
3. `src/components/smartops/LeadDetailPanel.tsx` — SKU columns in 3 tables + cupom card + cupom column

## Data Verification
- Query DB post-deploy to confirm SKU data is rendering from both `piperun_deals_history` items and `lojaintegrada_itens_json`
- Confirm cupom badge appears for leads with valid coupon data
- Verify the 25 corrupted records are fixed

