

## Desacoplar SellFlux do webhook da Loja Integrada

### Problema
O `smart-ops-ecommerce-webhook` está misturando duas responsabilidades: atualizar leads **e** sincronizar com SellFlux. Você quer apenas a primeira.

### Mudança
Remover toda a lógica de SellFlux do `smart-ops-ecommerce-webhook/index.ts`:

1. **Remover imports** de `sendCampaignViaSellFlux`, `sendLeadToSellFlux` do `sellflux-field-map.ts`
2. **Remover variáveis** `SELLFLUX_WEBHOOK_CAMPANHAS` e `SELLFLUX_WEBHOOK_LEADS`
3. **Remover o bloco "SellFlux integration"** (~20 linhas) que faz o sync de contato e disparo de campanha
4. **Simplificar o message_log** — gravar status fixo `"recebido"` em vez de depender do resultado SellFlux
5. **Manter intacto** toda a lógica de: parsing do payload LI, normalização de telefone, criação/atualização de lead em `lia_attendances`, aplicação de tags, e log do evento

O webhook continua recebendo eventos da Loja Integrada e atualizando `lia_attendances` com tags, status e dados do cliente — apenas sem tocar no SellFlux.

