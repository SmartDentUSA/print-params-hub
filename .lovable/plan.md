

# Plan: Sync Loja Integrada Clients + Enhanced Order Fields

## Current State

- `poll-loja-integrada-orders` fetches `/pedido/` and forwards each order to `smart-ops-ecommerce-webhook`
- `smart-ops-ecommerce-webhook` resolves client data from the order's `cliente` URI, but only when processing an order
- There is no dedicated client sync -- clients without orders are never imported

## What the User Wants

Import **all 60 clients** from `/api/v1/cliente/` into `lia_attendances` as leads, mapping these fields:
- `nome`, `email`, `cpf`, `cnpj`, `razao_social`, `sexo`, `data_nascimento`, `tipo` (PF/PJ), `data_criacao`, `id` (as `lojaintegrada_cliente_id`)
- Then for each client, fetch their orders to enrich with LTV/history (reusing existing logic)

From orders, also capture: `situacao` (full object with `codigo`, `nome`, `aprovado`, `cancelado`), `valor_total`, `valor_envio`, `valor_subtotal`, `valor_desconto`, `utm_campaign`, `numero`, `data_criacao`, `data_modificacao`, `peso_real`

The order fields are **already mapped** in `smart-ops-ecommerce-webhook`. The missing piece is the **client-first sync**.

## Plan

### 1. New Edge Function: `sync-loja-integrada-clients`

A new function that:

1. Fetches `/api/v1/cliente/?limit=50&offset=N` in paginated batches (reusing `apiFetch` multi-strategy auth from `poll-loja-integrada-orders`)
2. For each client:
   - Skip anonymized clients (`nome === "Cliente anonimizado"` or `email` contains `@lojaintegrada.com.br`)
   - Skip test clients (`cpf === "99999999999"`)
   - Upsert into `lia_attendances` by email, mapping:
     - `nome` → `nome`
     - `email` → `email`  
     - `cpf` → `pessoa_cpf`
     - `cnpj` → `empresa_cnpj`
     - `razao_social` → `empresa_razao_social`
     - `sexo` → `lojaintegrada_sexo`
     - `data_nascimento` → `lojaintegrada_data_nascimento`
     - `tipo` (PF/PJ) → stored in `lojaintegrada_tipo_pessoa`
     - `id` → `lojaintegrada_cliente_id`
     - `data_criacao` → `lojaintegrada_cliente_data_criacao`
     - `source` = `"loja_integrada"`
   - After upserting the client, call `smart-ops-ecommerce-webhook` internally (or fetch orders for that client via `/pedido/?cliente_id=X`) to enrich with order history/LTV

3. Pagination: auto-follows `meta.next` until all clients are synced
4. Returns summary: `{ total_clients, synced, skipped, errors }`

### 2. Add Missing Column (if needed)

Check if `lojaintegrada_tipo_pessoa` and `lojaintegrada_cliente_data_criacao` columns exist in `lia_attendances`. If not, add them via migration.

### 3. No Changes to Existing Functions

`smart-ops-ecommerce-webhook` and `poll-loja-integrada-orders` remain unchanged -- they already handle order-level enrichment correctly.

## Technical Details

```text
Flow:
  sync-loja-integrada-clients
    │
    ├─ GET /api/v1/cliente/?limit=50&offset=0
    │   └─ For each client:
    │       ├─ Filter out anonymized/test
    │       ├─ Upsert lead in lia_attendances (by email)
    │       └─ GET /api/v1/pedido/?cliente_id=X&limit=100
    │           └─ Enrich lead with LTV/history (reuse enrichWithOrderHistory logic)
    │
    ├─ GET /api/v1/cliente/?limit=50&offset=50
    │   └─ (repeat)
    │
    └─ Return summary JSON
```

The function uses the same dual-strategy auth (header + querystring fallback), circuit breaker, and rate limit delay already proven in `poll-loja-integrada-orders`.

