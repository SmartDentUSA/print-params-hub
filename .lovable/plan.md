
# ✅ COMPLETED: `lead_status` Updated on Won/Lost Deals

All three PipeRun processors now set `lead_status = "CLIENTE_ativo"` when a deal is won:
- `smart-ops-piperun-webhook/index.ts` — line 844
- `smart-ops-sync-piperun/index.ts` — line 441
- `piperun-full-sync/index.ts` — line 299

SQL migration executed: all existing leads with `status_oportunidade = 'ganha'` updated to `lead_status = 'CLIENTE_ativo'`.

# ✅ COMPLETED: Fix Dados Inconsistentes (HTML em propostas + owner_name)

## Changes Made
1. **`_shared/piperun-field-map.ts`**: `parseProposalItems()` now strips HTML via `stripHtmlShared()` before splitting, and filters CSS garbage fragments (rgb, font-size, etc.)
2. **`piperun-full-sync/index.ts`** + **`smart-ops-sync-piperun/index.ts`**: Pass `ownerName` from `proprietario_lead_crm` as fallback to `buildRichDealSnapshot()`
3. **SQL Migration**: Cleared 696 corrupted `itens_proposta_parsed` entries; backfilled `owner_name` in 460 deal snapshots

## Remaining (separate issue)
- E-commerce checkout gap: 387 checkouts with 0 conversions — investigate Loja Integrada webhook flow
