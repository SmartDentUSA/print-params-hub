

# Fix: Sync Engines Not Processing Won/Lost Deal Status

## Root Cause

Both `smart-ops-sync-piperun` and `piperun-full-sync` determine `lead_status` exclusively from `STAGE_TO_ETAPA[deal.stage_id]`. They **completely ignore `deal.status`** (0=open, 1=won, 2=lost).

The webhook handler (`smart-ops-piperun-webhook`) correctly handles won/lost at lines 822-843 — adding tags like `C_CONTRATO_FECHADO`, `J04_COMPRA`, `C_PQL_RECOMPRA`, setting `status_oportunidade`, and triggering cross-sell/upsell logic. But the sync engines skip all of this.

**Impact by the numbers:**
- 4,142 leads have `status_oportunidade = ganha` but only 180 have the `C_CONTRATO_FECHADO` tag
- 1,341 won leads are stuck with `lead_status = fechamento` — never transitioned
- 916 won leads still show `lead_status = novo`
- March sales appear "paralyzed" because won deals aren't being registered as closed

## Fix Plan

### 1. Add won/lost processing to `processDeal()` in `smart-ops-sync-piperun/index.ts`

After the existing stage-based `lead_status` logic (line ~414), add the same won/lost block from the webhook:

```
if deal.status === 1 (won):
  - Add tags: C_CONTRATO_FECHADO, J04_COMPRA, C_PQL_RECOMPRA, C_OPP_ENCERRADA_COMPRA, C_REENTRADA_NUTRICAO
  - Add product tag: COMPROU_{PRODUTO}
  - Set status_oportunidade = "ganha"
  - Remove stale tags: J03_NEGOCIACAO, C_PERDIDO

if deal.status === 2 (lost):
  - Add tags: C_OPP_ENCERRADA_NAO_COMPROU, C_REENTRADA_NUTRICAO
  - Set status_oportunidade = "perdida_renutrir"
```

### 2. Same fix in `piperun-full-sync/index.ts`

Apply the identical won/lost processing block after the existing `STAGE_TO_ETAPA` mapping (line ~240).

### 3. Backfill existing data via migration

Create a SQL migration to fix the 4,000+ leads already in the database:
- For leads with `status_oportunidade = 'ganha'` missing `C_CONTRATO_FECHADO` tag → add all expected tags
- For leads with `piperun_deals_history` containing won deals but `status_oportunidade` still showing `'aberta'` → correct the status

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/smart-ops-sync-piperun/index.ts` | Add won/lost processing in `processDeal()` |
| `supabase/functions/piperun-full-sync/index.ts` | Add won/lost processing in deal loop |
| SQL Migration | Backfill tags and status for existing won/lost leads |

