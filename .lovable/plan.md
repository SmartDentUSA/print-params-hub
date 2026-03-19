
## Diagnóstico confirmado

Revisei o código e os dados reais do lead `financeiro@odontoprimecuiaba.com.br`.

O problema não é a timeline em si. A timeline está vindo de `lead_activity_log` e, para este lead, ela já traz os 2 pedidos reais:

- Pedido `#963` em `24/04/2023` com item e valor `R$ 2.666,67`
- Pedido `#1078` em `14/09/2023` com item e valor `R$ 1.777,78`

Soma real encontrada no banco para esse lead: `R$ 4.444,45`.

Mas o card de e-commerce está inconsistente porque hoje ele depende de caches quebrados:

1. `lojaintegrada_ltv = 57.433,20` nesse lead, embora os eventos reais somem `4.444,45`
2. `lojaintegrada_historico_pedidos = null`
3. `lead_product_history` tem só 1 linha e só `R$ 1.777,78`, quando deveria refletir os 2 pedidos
4. O mesmo `lojaintegrada_ltv = 57.433,20` aparece em vários outros leads, o que confirma resíduo do bug antigo de “ghost data”

Também identifiquei outro ponto estrutural:
- o bloco UI “E-commerce Loja Integrada” usa `lojaintegrada_historico_pedidos` e `lojaintegrada_ltv`
- quando o histórico está nulo, ele não consegue estratificar os itens por pedido
- `lojaintegrada_itens_json` hoje é sobrescrito por snapshots do webhook e não é uma base confiável para montar várias compras históricas

## O que vou implementar

### 1. Corrigir a fonte de verdade do card de e-commerce
Ajustar `src/components/smartops/LeadDetailPanel.tsx` para o card não confiar cegamente em `lojaintegrada_ltv` e `lojaintegrada_historico_pedidos`.

Nova ordem de prioridade no card:
1. usar `lojaintegrada_historico_pedidos` quando existir
2. se estiver vazio/nulo, reconstruir a visão com `lead_activity_log` de e-commerce
3. calcular LTV e total de pedidos a partir dos pedidos reais únicos, não do cache antigo

Resultado:
- o card continuará igual visualmente
- mas passará a mostrar os itens estratificados mesmo quando o cache estiver incompleto

### 2. Corrigir o backend para não perpetuar cache contaminado
Ajustar a sincronização da Loja Integrada para sempre sobrescrever os campos derivados com valores canônicos:

- `lojaintegrada_ltv`
- `lojaintegrada_total_pedidos_pagos`
- `lojaintegrada_historico_pedidos`

Hoje o `sync-loja-integrada-clients` atualiza parte dos dados, mas não saneia completamente o cache de e-commerce legado. Vou alinhar isso para que:
- valores fantasmas sejam zerados/substituídos
- histórico real filtrado por cliente volte a ser a base oficial

### 3. Rebuild dos dados derivados já existentes
Executar uma correção em lote para os leads já afetados:

- recalcular `lojaintegrada_ltv` com base em pedidos reais
- repopular `lojaintegrada_historico_pedidos`
- reconstruir `lead_product_history` a partir dos eventos/pedidos reais, agregando por produto corretamente

Para o caso do Duilio, o esperado após rebuild é:
- LTV e-commerce: `R$ 4.444,45`
- 2 pedidos reais
- 1 produto agregado com:
  - `purchase_count = 2`
  - `total_purchased_qty = 5`
  - `total_purchased_value = 4.444,45`

### 4. Validar no banco antes de concluir
Antes de considerar pronto, vou validar em dados reais:

#### Lead alvo
`financeiro@odontoprimecuiaba.com.br`
- histórico preenchido
- LTV correto
- itens por pedido corretos
- product history agregado corretamente

#### Validação global
Vou conferir também:
- quantos leads ainda têm `lojaintegrada_ltv > 0` com `historico_pedidos null`
- quantos leads têm atividade e-commerce sem product history coerente
- amostra dos leads mais afetados pelo valor fantasma repetido

## Arquivos envolvidos

- `src/components/smartops/LeadDetailPanel.tsx`
- `supabase/functions/sync-loja-integrada-clients/index.ts`
- possivelmente `supabase/functions/smart-ops-ecommerce-webhook/index.ts`
- migration/backfill SQL para saneamento dos leads existentes

## Detalhe técnico importante

```text
Causa real observada:
timeline -> usa lead_activity_log -> dados reais
card e-commerce -> usa caches lojaintegrada_* -> alguns ainda contaminados
product history -> derivado antigo incompleto -> precisa rebuild

Efeito:
o usuário vê eventos corretos,
mas o resumo/LTV/itens estratificados continuam errados ou incompletos
```

## Resultado esperado

Sem remover nada da interface e sem mudar a lógica comercial:
- o card de e-commerce passa a refletir os dados reais
- os itens da compra voltam a aparecer estratificados
- os leads existentes ficam saneados no banco
- o sistema deixa de reutilizar LTV fantasma herdado de syncs antigos
