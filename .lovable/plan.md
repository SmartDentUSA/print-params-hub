

# Fix: Insights Loja Integrada duplicando + data errada no carrinho

## Problemas

### 1. Pedidos duplicados na timeline (4x Pedido #2032)
A `lead_activity_log` recebe um INSERT a cada chamada do webhook — sem nenhuma verificação de duplicata. Como o `poll-loja-integrada-orders` reprocessa os mesmos pedidos a cada execução, e a dedup do `message_logs` só olha 1 hora para trás, o mesmo pedido gera múltiplas entradas na timeline.

### 2. Data do carrinho errada (16/03 real → mostra 18/03)
Na `lead_cart_history` (linha 863) e `lead_activity_log` (linha 769), o webhook usa `new Date().toISOString()` (timestamp de processamento) em vez de `order.data_criacao` (data real do pedido).

## Correções

### 1. Dedup na `lead_activity_log` — Verificar antes de inserir (`smart-ops-ecommerce-webhook/index.ts`)

Antes do insert na linha 769, verificar se já existe um evento com mesmo `lead_id` + `event_type` + `entity_id`:

```ts
// Check if activity already logged for this order+event
const { data: existingActivity } = await supabase
  .from("lead_activity_log")
  .select("id")
  .eq("lead_id", leadId)
  .eq("event_type", `ecommerce_${eventType}`)
  .eq("entity_id", String(numeroPedido))
  .limit(1);

if (!existingActivity || existingActivity.length === 0) {
  // insert...
}
```

### 2. Aumentar janela de dedup do `message_logs` de 1h → 30 dias (linha 576)

```ts
// ANTES:
const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

// DEPOIS:
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
```

### 3. Usar `data_criacao` do pedido em vez de `now()` para timestamps

Na `lead_cart_history` (linha 863) e `lead_activity_log` (linha 769), usar a data real do pedido:

```ts
const orderDate = liPedidoData || new Date().toISOString();
```

E usar `orderDate` nos campos `created_at`, `event_timestamp`, `added_to_cart_at`, etc.

## Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/smart-ops-ecommerce-webhook/index.ts` | 3 fixes: dedup activity_log, janela 30d message_logs, usar data_criacao |

## Dados existentes duplicados

Os registros duplicados já existentes na `lead_activity_log` precisarão de uma limpeza manual via SQL (DELETE duplicatas mantendo o mais antigo por `lead_id + event_type + entity_id`).

