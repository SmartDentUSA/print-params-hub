

# Plan: Atualizar cards e timeline para exibir todos os campos da Loja Integrada

## Problemas Encontrados

### 1. `event_data` na `lead_activity_log` está incompleto
O webhook (linha 869) salva apenas `{ pedido, valor, status, produtos, tags_added, fonte }` na timeline. Os novos campos capturados (tracking, parcelas, bandeira, desconto, envio, marketplace, SKUs dos itens) **não são gravados** na `event_data`.

### 2. LeadDetailPanel não exibe campos novos na timeline
A renderização da timeline (linha 339-357) só mostra `Valor`, `Status` e `Fonte`. Não exibe tracking, parcelas, bandeira, desconto, frete, itens com SKU/preço.

### 3. LeadDetailPanel não tem seção de E-commerce/Loja Integrada
Existe seção para **Deals PipeRun**, **Academy**, **Suporte**, mas **não existe seção dedicada** para o histórico de pedidos da Loja Integrada (`lojaintegrada_historico_pedidos`), LTV e-commerce, tracking codes, etc.

### 4. KanbanLeadCard não mostra tracking/status LI
O card no kanban não exibe informações de e-commerce como tracking ou último pedido.

---

## Correções

### A. Edge Function — Enriquecer `event_data` no `lead_activity_log`
**Arquivo:** `supabase/functions/smart-ops-ecommerce-webhook/index.ts` (linhas 869-876)

Adicionar ao `event_data`:
```ts
event_data: {
  pedido: numeroPedido,
  pedido_id: liPedidoId,
  valor: valorTotal,
  valor_desconto: liValorDesconto,
  valor_envio: liValorEnvio,
  valor_subtotal: liValorSubtotal,
  status: liPedidoStatus,
  produtos: productNames,
  tags_added: tagsToAdd,
  fonte: "loja_integrada",
  tracking: liTrackingCode,
  parcelas: liParcelas,
  bandeira: liBandeiraCartao,
  forma_pagamento: liFormaPagamento,
  forma_envio: liFormaEnvio,
  marketplace: liMarketplace,
  cupom: liCupomJson,
  itens: items.map(i => ({
    sku: i.sku, nome: i.nome || i.name,
    qty: i.quantidade || i.quantity || 1,
    preco: i.preco_venda || i.price || 0,
  })),
}
```

### B. LeadDetailPanel — Exibir campos enriquecidos na timeline ecommerce
**Arquivo:** `src/components/smartops/LeadDetailPanel.tsx` (linhas 339-357)

Expandir o `detail` do evento ecommerce para incluir:
- Tracking code (com link se disponível)
- Parcelas e bandeira do cartão
- Desconto e frete
- Forma de pagamento e envio
- Items com SKU e preço

### C. LeadDetailPanel — Nova seção "🛒 E-commerce Loja Integrada"
**Arquivo:** `src/components/smartops/LeadDetailPanel.tsx`

Adicionar após a seção Academy (linha ~844), uma nova seção condicional que exibe:
- LTV e-commerce (`lojaintegrada_ltv`), total pedidos pagos
- Tabela de `lojaintegrada_historico_pedidos` com colunas: Pedido, Data, Valor, Status, Tracking, Parcelas, Itens
- Último pedido (número, data, valor, status)
- Dados do cliente LI (CPF, endereço, CEP)

### D. KanbanLeadCard — Badge de tracking e último pedido LI
**Arquivo:** `src/components/smartops/KanbanLeadCard.tsx`

Adicionar badges condicionais:
- Tracking code (📦 + código)
- LTV e-commerce se > 0

---

## Arquivos alterados

| Arquivo | Mudança |
|--------|---------|
| `supabase/functions/smart-ops-ecommerce-webhook/index.ts` | Enriquecer `event_data` com todos os campos novos |
| `src/components/smartops/LeadDetailPanel.tsx` | Timeline enriquecida + nova seção E-commerce LI + tabela historico_pedidos |
| `src/components/smartops/KanbanLeadCard.tsx` | Badges de tracking e LTV e-commerce |

