
# ✅ COMPLETED: `lead_status` Updated on Won/Lost Deals

All three PipeRun processors now set `lead_status = "CLIENTE_ativo"` when a deal is won:
- `smart-ops-piperun-webhook/index.ts` — line 844
- `smart-ops-sync-piperun/index.ts` — line 441
- `piperun-full-sync/index.ts` — line 299

SQL migration executed: all existing leads with `status_oportunidade = 'ganha'` updated to `lead_status = 'CLIENTE_ativo'`.

## Remaining (separate issue)
- E-commerce checkout gap: 387 checkouts with 0 conversions — investigate Loja Integrada webhook flow
