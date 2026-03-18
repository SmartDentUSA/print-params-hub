

# Force LI API Fetch + Capture All Fields

## Problem
The webhook currently only fetches from the LI API when `items` are missing. But the webhook payload can be incomplete or vary in format. Additionally, several fields from the real LI payload are not being captured:

- `valor_desconto`, `valor_envio`, `valor_subtotal` (order financials)
- `peso_real` (weight)
- `data_modificacao` (last modified)
- Tracking code (`envios[].objeto`)
- Installments (`pagamentos[].numero_parcelas`)
- Card brand (`pagamentos[].bandeira`)
- Marketplace info (`marketplace_info`)
- `cupom_desconto` is an object `{id, codigo, tipo, valor}` but stored as string
- `itens[].sku`, `itens[].preco_cheio`, `itens[].preco_promocional`

## Changes

### 1. Database Migration — Add missing columns to `lia_attendances`

```sql
ALTER TABLE lia_attendances
  ADD COLUMN IF NOT EXISTS lojaintegrada_valor_desconto numeric,
  ADD COLUMN IF NOT EXISTS lojaintegrada_valor_envio numeric,
  ADD COLUMN IF NOT EXISTS lojaintegrada_valor_subtotal numeric,
  ADD COLUMN IF NOT EXISTS lojaintegrada_peso_real numeric,
  ADD COLUMN IF NOT EXISTS lojaintegrada_data_modificacao text,
  ADD COLUMN IF NOT EXISTS lojaintegrada_tracking_code text,
  ADD COLUMN IF NOT EXISTS lojaintegrada_parcelas integer,
  ADD COLUMN IF NOT EXISTS lojaintegrada_bandeira_cartao text,
  ADD COLUMN IF NOT EXISTS lojaintegrada_marketplace jsonb,
  ADD COLUMN IF NOT EXISTS lojaintegrada_cupom_json jsonb,
  ADD COLUMN IF NOT EXISTS lojaintegrada_pedido_id bigint,
  ADD COLUMN IF NOT EXISTS lojaintegrada_raw_payload jsonb;
```

### 2. Edge Function — Force API fetch + extract all fields (`smart-ops-ecommerce-webhook/index.ts`)

**a) Always fetch full order from LI API** — Change `needsFullFetch` logic (line 451) to always try fetching when we have API keys and an order ID/numero, regardless of whether items exist. This ensures we always have the most complete data.

**b) Extract new fields** after line 554:
- `valor_desconto`, `valor_envio`, `valor_subtotal`, `peso_real` from order root
- `data_modificacao` from order root
- `envios[0].objeto` as tracking code
- `pagamentos[0].numero_parcelas` and `pagamentos[0].bandeira`
- `marketplace_info` as JSON object
- `cupom_desconto` as JSON object (not string)
- `order.id` as pedido_id (distinct from numero)
- Store full `rawPayload` as `lojaintegrada_raw_payload`

**c) Write all new fields** in both update (line 688+) and insert (line 740+) blocks.

**d) Enrich `lojaintegrada_historico_pedidos`** snapshots with richer data: sku, tracking, parcelas, desconto, envio.

## Files Changed

| File | Change |
|------|--------|
| Migration SQL | Add 12 columns to `lia_attendances` |
| `supabase/functions/smart-ops-ecommerce-webhook/index.ts` | Force API fetch, extract + store all new fields, store raw payload |

