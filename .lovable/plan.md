

# Fix: Webhook Loja Integrada — mapeamento de situação incompleto + falta filtro `situacao_alterada`

## Problemas Identificados

### 1. Códigos de situação com prefixo `pedido_` não mapeados
O webhook da Loja Integrada envia `situacao.codigo = "pedido_em_separacao"`, mas o `SITUACAO_CODIGO_MAP` (linha 16-31) só tem códigos sem prefixo (`"em_producao"`, `"enviado"`, etc.). O código `"pedido_em_separacao"` não existe no mapa, então cai no fallback `"order_created"` — gerando um evento errado de "pedido criado" quando na verdade é um pedido já em separação.

Códigos que a LI realmente envia (com prefixo `pedido_`):
- `pedido_em_separacao` → deveria ser `order_paid`
- `pedido_pago` → `order_paid`
- `pedido_enviado` → `order_invoiced`
- `pedido_entregue` → `order_delivered`
- `pedido_cancelado` → `order_cancelled`

### 2. Falta validação de `situacao_alterada`
A documentação da LI diz explicitamente: *"considere apenas os webhooks que estão como `situacao.situacao_alterada: true`"*. Nosso webhook não verifica isso, processando webhooks duplicados/informativos que não representam mudança real de status.

### 3. Duplicação resultante
Sem filtrar `situacao_alterada` e com o mapeamento errado (tudo vira `order_created`), o mesmo pedido gera múltiplas entradas na timeline e tags duplicadas.

## Correções

### 1. Adicionar códigos com prefixo `pedido_` ao `SITUACAO_CODIGO_MAP`

```ts
const SITUACAO_CODIGO_MAP: Record<string, string> = {
  // Existing codes (without prefix)
  aguardando_pagamento: "order_created",
  pagamento_em_analise: "order_created",
  pagamento_devolvido: "order_cancelled",
  pago: "order_paid",
  pagamento_confirmado: "order_paid",
  pagamento_aprovado: "order_paid",
  em_producao: "order_paid",
  pronto_envio: "order_paid",
  enviado: "order_invoiced",
  entregue: "order_delivered",
  cancelado: "order_cancelled",
  devolvido: "order_cancelled",
  boleto_impresso: "boleto_generated",
  boleto_vencido: "boleto_expired",
  // NEW: Loja Integrada sends codes WITH "pedido_" prefix
  pedido_pago: "order_paid",
  pedido_em_separacao: "order_paid",
  pedido_em_producao: "order_paid",
  pronto_para_envio: "order_paid",
  pedido_enviado: "order_invoiced",
  pedido_entregue: "order_delivered",
  pedido_cancelado: "order_cancelled",
};
```

### 2. Adicionar guard `situacao_alterada` logo após o parse

Após `parseLojaIntegradaPayload`, verificar se `situacao.situacao_alterada === false` e rejeitar:

```ts
const situacaoAlterada = situacaoObj?.situacao_alterada;
if (situacaoAlterada === false) {
  console.log(`[ecommerce-webhook] situacao_alterada=false, ignorando webhook informativo`);
  return new Response(JSON.stringify({ skipped: true, reason: "situacao_alterada=false" }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
```

## Arquivo alterado

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/smart-ops-ecommerce-webhook/index.ts` | Adicionar códigos `pedido_*` ao mapa + guard `situacao_alterada` |

