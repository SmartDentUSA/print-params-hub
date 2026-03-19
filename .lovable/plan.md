

# Corrigir datas do product/cart history e re-sincronizar todos os leads

## Problema identificado

No webhook `smart-ops-ecommerce-webhook`, a **timeline** (`lead_activity_log`) ja usa a data real do pedido (`liPedidoData`) na linha 917. Porem, o bloco de **product history** (linha 967) e **cart conversion** (linha 1050) usam `new Date().toISOString()`, gravando a data do sync em vez da data real do pedido. Isso faz pedidos de 2020 aparecerem como 2026.

## Plano

### 1. Corrigir datas no webhook (smart-ops-ecommerce-webhook/index.ts)

**Linha 967**: Substituir `const now = new Date().toISOString()` por `const orderDateForHistory = orderDate;` (que ja contem `liPedidoData || new Date().toISOString()` da linha 917).

Usar `orderDateForHistory` em todas as ocorrencias de `now` nesse bloco (linhas 987-1017):
- `last_interaction_at`
- `updated_at`
- `purchased_at`
- `added_to_cart_at`
- `first_viewed_at`
- `last_viewed_at`
- `last_interaction_at` (insert)

**Linha 1050**: Substituir `new Date().toISOString()` por `orderDate` no `converted_at`.

### 2. Corrigir dados existentes no banco (SQL via insert tool)

Atualizar `lead_activity_log` entries onde `event_timestamp` tem data de 2026 mas o `event_data->>'pedido'` corresponde a um pedido antigo. Corrigir usando a data real dos pedidos armazenados no `lojaintegrada_historico_pedidos`.

Atualizar `lead_product_history` para leads cujas datas (`purchased_at`, `added_to_cart_at`, `first_viewed_at`) sao de marco 2026 mas o pedido e antigo.

### 3. Re-sincronizar todos os leads

Executar `sync-loja-integrada-clients` com `enrich_orders: true` e `max_pages: 50` para repopular o `lojaintegrada_historico_pedidos` de todos os leads (incluindo os que foram limpos pela migracao de ghost data).

Depois, executar `poll-loja-integrada-orders` com `full: true` para reprocessar todos os pedidos pelo webhook com as datas corretas.

## Arquivos alterados
- `supabase/functions/smart-ops-ecommerce-webhook/index.ts` — usar data do pedido em vez de `now()` no product/cart history

## Detalhes tecnicos

```text
Antes (bug):
  orderDate = liPedidoData || now()  ← usado APENAS na timeline ✓
  now = new Date()                   ← usado no product/cart history ✗

Depois (corrigido):
  orderDate = liPedidoData || now()  ← usado em TUDO ✓
  product_history: purchased_at = orderDate
  cart_history: converted_at = orderDate
```

Nenhuma migration de schema necessaria. Apenas correcao de codigo + data fix via insert tool + re-sync.

