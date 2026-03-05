

## Enriquecer leads e-commerce com historico do cliente na Loja Integrada

### Problema

O webhook processa cada pedido isoladamente. Quando a Paula Pedrosa entra pelo polling, o sistema ve apenas o pedido atual (situacao "aguardando_pagamento") e cria um lead com tag `EC_INICIOU_CHECKOUT` e status "novo". Porem ela ja tem 2 pedidos entregues (2020 e 2021), LTV de R$1.002,40, e deveria ser tratada como **cliente recorrente/inativo**.

### Solucao

Apos resolver os dados do cliente via `fetchClienteFromLI`, adicionar uma etapa de **enriquecimento historico**: buscar os pedidos anteriores desse cliente na API da LI e usar isso para classificar corretamente.

### Mudancas no `smart-ops-ecommerce-webhook/index.ts`

**1. Nova funcao `fetchClienteOrderHistory`**
- Recebe o `cliente_id` (numero)
- Faz GET em `/api/v1/pedido/?cliente_id={id}&limit=20&chave_api=...&chave_aplicacao=...`
- Retorna array de pedidos com `valor_total`, `situacao`, `data_criacao`
- Try/catch: retorna `[]` se falhar

**2. Logica de enriquecimento** (apos resolver cliente, antes do upsert ~linha 390)
- Se `liClienteId` existe, chamar `fetchClienteOrderHistory(liClienteId, ...)`
- Dos pedidos retornados, filtrar os que tem situacao paga/enviada/entregue (codigos: `pago`, `pagamento_confirmado`, `pagamento_aprovado`, `enviado`, `entregue`)
- Calcular:
  - `ltv` = soma dos `valor_total` dos pedidos pagos/entregues
  - `totalPedidosPagos` = contagem
  - `dataUltimaCompra` = data mais recente entre os pedidos pagos
  - `dataPrimeiraCompra` = data mais antiga
- Se `totalPedidosPagos > 0`:
  - Adicionar tag `EC_CLIENTE_RECORRENTE`
  - Se `dataUltimaCompra` > 12 meses atras → adicionar tag `EC_CLIENTE_INATIVO`
  - Setar `ativo_insumos = true` (ja comprou antes)
  - Setar `status_oportunidade = "ganha"` (ja foi cliente)
  - Guardar LTV no campo `valor_oportunidade` (se maior que o valor atual do pedido)

**3. Novos campos na tabela `lia_attendances`** (migration)
- `lojaintegrada_ltv` numeric — LTV total calculado dos pedidos
- `lojaintegrada_total_pedidos_pagos` integer — contagem de pedidos pagos
- `lojaintegrada_primeira_compra` timestamptz — data do primeiro pedido pago
- `lojaintegrada_historico_pedidos` jsonb — resumo dos ultimos 10 pedidos (numero, valor, status, data)

**4. Novas tags no `sellflux-field-map.ts`**
- `EC_CLIENTE_RECORRENTE` — ja comprou antes
- `EC_CLIENTE_INATIVO` — ultima compra > 12 meses

### Fluxo corrigido

```text
Pedido chega (pa.pedrosa@hotmail.com)
  → Resolve cliente URI → cliente_id = 12345
  → Fetch /pedido/?cliente_id=12345
  → Encontra 2 pedidos pagos (R$583 + R$419.40)
  → LTV = R$1.002,40 | totalPagos = 2 | ultimaCompra = 2021-09-03
  → Tags: EC_INICIOU_CHECKOUT + EC_CLIENTE_RECORRENTE + EC_CLIENTE_INATIVO
  → status_oportunidade = "ganha" | ativo_insumos = true
  → Upsert com dados completos
```

### Deploy
- Migration para novos campos
- Editar `sellflux-field-map.ts` (novas tags)
- Editar `smart-ops-ecommerce-webhook/index.ts` (nova funcao + logica)
- Deploy da edge function

