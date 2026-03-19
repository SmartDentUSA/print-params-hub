

# Corrigir poll com auto-paginacao e verificar dados reais

## Diagnostico

Apos revisar todo o codigo, o webhook (`smart-ops-ecommerce-webhook`) **ja captura todos os campos** da Loja Integrada: tracking, pagamento, cupom, marketplace, itens detalhados, forma de envio, parcelas, bandeira, raw payload. A Dra. LIA **ja le** esses dados com detalhes. A timeline (`lead_activity_log`) **ja registra** cada evento com dados granulares.

O problema real e **operacional**: o `poll-loja-integrada-orders` busca apenas **1 pagina** (50 pedidos) e nao pagina automaticamente. Pedidos alem da primeira pagina nunca chegam ao webhook.

## Plano

### 1. Auto-paginacao no poll-loja-integrada-orders
- Adicionar loop `while (hasMore && page < maxPages)` que segue `res.meta.next`
- Default: `max_pages = 10` (ate 500 pedidos por execucao)
- Cada pagina envia os pedidos ao webhook normalmente
- Parametro `max_pages` configuravel via body da requisicao

### 2. Rodar sync completo para atualizar leads existentes
- Executar `poll-loja-integrada-orders` com `full: true` para reprocessar todos os pedidos
- Executar `sync-loja-integrada-clients` para garantir que todos os clientes tenham historico completo com tracking/pagamento
- Isso preenche os campos de todos os leads existentes que ficaram sem dados

### 3. Verificar dados reais via query no banco
- Apos deploy, rodar query para confirmar que leads com `lojaintegrada_historico_pedidos` possuem campos `tracking`, `url_pagamento`, `itens` preenchidos
- Verificar lead `danilohen@gmail.com` especificamente

## Arquivo alterado
- `supabase/functions/poll-loja-integrada-orders/index.ts` — adicionar auto-paginacao

## Detalhes tecnicos

```text
Fluxo corrigido:
  pg_cron → poll (pagina 1..N automaticamente) → webhook (ja captura tudo)
                                                      ↓
                                              lia_attendances atualizado
                                              lead_activity_log preenchido
                                              lead_product_history populado
                                              lead_cart_history com status
```

O webhook ja faz:
- Upsert lead com ~35 campos lojaintegrada_*
- Merge incremental de historico_pedidos (append + dedup por numero)
- Timeline com tracking, pagamento, itens, cupom, marketplace
- Cart history com status (active/abandoned/converted)
- Product history com contadores de compra/carrinho
- LTV calculado sobre pedidos aprovados

A LIA ja le:
- Ultimos 5 pedidos com rastreio, link pagamento, itens, forma de pagamento
- Cursos Astron detalhados
- Tags CRM e timeline recente

Nao precisa de migration (colunas ja existem). So precisa corrigir a paginacao do poll e rodar sync completo.

