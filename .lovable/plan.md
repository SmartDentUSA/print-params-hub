

## Diagnóstico: Pedidos da Loja Integrada Não Chegam ao Lead

### Problema Encontrado

O polling (`poll-loja-integrada-orders`) roda a cada 5 min e busca pedidos da API. Na última execução:
- **500 pedidos buscados, apenas 60 processados, 440 ignorados (falhas)**

A causa raiz está na **cascata de chamadas API**: o poll envia o pedido bruto ao webhook, e o webhook faz **3 chamadas adicionais à API da LI por pedido** (fetch full order + fetch client + fetch order history). Com 50 pedidos por página × 10 páginas, são ~1500 chamadas API, causando rate limiting massivo e timeouts.

O pedido do `thiago.nicoletti@smartdent.com.br` está entre os 440 que falharam. Seu `lojaintegrada_updated_at` é `null`.

Além disso, o payload do list API da LI retorna `cliente` como URI string (ex: `"/api/v1/cliente/21841660"`), não como objeto com email. Se a resolução via API falha (rate limit), o webhook retorna 400 "Email obrigatório".

### Correções

#### Arquivo: `supabase/functions/poll-loja-integrada-orders/index.ts`

**1. Resolver email do cliente no poll, antes de enviar ao webhook**
- Para cada pedido da lista, se `cliente` é uma URI string, fazer o fetch do cliente (com rate limiting controlado) e injetar `email`, `nome`, `telefone_celular`, `cpf` no payload antes de enviar ao webhook
- Isso elimina a necessidade do webhook fazer suas próprias chamadas à API para resolver o cliente

**2. Reduzir chamadas duplicadas**
- O webhook já faz `Force-fetching full order from LI API` para CADA pedido. Se o poll já envia o payload completo, o webhook não precisa refazer esse fetch
- Adicionar flag `_enriched_by_poll: true` no payload para que o webhook pule o re-fetch

**3. Aumentar delay entre pedidos para respeitar rate limit**
- Atual: 800ms entre páginas, 0ms entre pedidos individuais
- Novo: 300ms entre cada envio ao webhook + 1s entre páginas

**4. Avançar cursor mesmo com falhas parciais**
- Após processar um batch, atualizar o cursor `since` baseado no `data_modificacao` mais recente dos pedidos **buscados** (não só dos processados com sucesso)

#### Arquivo: `supabase/functions/smart-ops-ecommerce-webhook/index.ts`

**5. Pular re-fetch quando payload já vem enriquecido**
- Na linha 535, verificar se `order._enriched_by_poll === true`. Se sim, pular o `fetchOrderFromLI`
- Isso reduz as chamadas API pela metade

**6. Pular fetch de order history quando chamado pelo poll**
- O fetch de order history (linha 716) faz mais chamadas API. Quando chamado via poll (batch), pular o enrichment de histórico completo para evitar explosão de chamadas
- O histórico será populado apenas em chamadas individuais (webhook direto da LI)

### Resultado Esperado
- Poll processa ~90%+ dos pedidos ao invés de 12%
- Pedidos do Thiago e outros leads são capturados na próxima execução (5 min)
- Timeline do lead é atualizada automaticamente
- Rate limiting da API da LI é respeitado

### Arquivos
1. `supabase/functions/poll-loja-integrada-orders/index.ts` — enriquecer pedidos antes do envio
2. `supabase/functions/smart-ops-ecommerce-webhook/index.ts` — pular re-fetch quando já enriquecido

