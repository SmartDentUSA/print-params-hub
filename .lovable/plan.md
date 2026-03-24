

# Fix: `lead_status` Not Updated on Won/Lost Deals

## Root Cause (Confirmed)

All three PipeRun processors (webhook, sync, full-sync) correctly set `status_oportunidade = "ganha"` and add tags like `C_CONTRATO_FECHADO`. However, **none of them update `lead_status`** when a deal is won or lost.

The `lead_status` field is only set from `STAGE_TO_ETAPA[deal.stage_id]`, which maps to stage names like "fechamento", "novo", "negociacao" — never to a terminal state reflecting the deal outcome.

This means:
- 4,142+ leads show `status_oportunidade = "ganha"` but `lead_status` remains "fechamento" or "novo"
- The funnel view shows 0 leads in "ganho" because no code ever writes that value
- March sales appear paralyzed in dashboards that read `lead_status`

## Fix

### 1. Add `lead_status` update in won/lost blocks (3 files)

In each of the three won/lost processing blocks, add one line after `status_oportunidade` assignment:

| File | Location |
|------|----------|
| `smart-ops-piperun-webhook/index.ts` | Line ~843, after `updateData.status_oportunidade` |
| `smart-ops-sync-piperun/index.ts` | Line ~440, after `smartPayload.status_oportunidade` |
| `piperun-full-sync/index.ts` | Line ~305, after `smartPayload.status_oportunidade` |

Logic:
- Won → `lead_status = "CLIENTE_ativo"` (terminal stage per funnel hierarchy)
- Lost → `lead_status = "perdido"` (or keep current if already in nurturing)

### 2. Backfill migration for existing data

```sql
-- Won leads: set lead_status = 'CLIENTE_ativo'
UPDATE lia_attendances
SET lead_status = 'CLIENTE_ativo', updated_at = now()
WHERE status_oportunidade = 'ganha'
  AND merged_into IS NULL
  AND lead_status NOT IN ('CLIENTE_ativo');

-- Lost leads: keep lead_status as-is (they're in re-nurturing flows)
```

### 3. E-commerce checkout gap (separate issue)

The 387 checkouts with 0 conversions is a **separate problem** in the Loja Integrada polling/webhook flow — not related to the PipeRun sync. This should be investigated independently by checking:
- Whether `smart-ops-ecommerce-webhook` receives status updates beyond `checkout_iniciado`
- Whether the Loja Integrada API is sending payment confirmation webhooks

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/smart-ops-piperun-webhook/index.ts` | Add `lead_status = "CLIENTE_ativo"` on won |
| `supabase/functions/smart-ops-sync-piperun/index.ts` | Add `lead_status = "CLIENTE_ativo"` on won |
| `supabase/functions/piperun-full-sync/index.ts` | Add `lead_status = "CLIENTE_ativo"` on won |
| SQL Migration | Backfill `lead_status` for existing won leads |

## Expected Impact

- ~4,142 leads will correctly show as `CLIENTE_ativo` in the funnel
- March sales dashboard will immediately reflect R$20K+ in confirmed revenue
- Future won deals will flow through correctly in real-time

