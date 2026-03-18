

# Fix: Limpar dados fictícios de e-commerce e corrigir sync

## Problema identificado

O lead `danilohen@gmail.com` (e ~1.178 outros) possui `lojaintegrada_historico_pedidos` com **dados legados em formato antigo** (campos `numero: 1, 2, 3...`, `status`, `valor`, `data`) importados de um batch anterior. O formato real da API usa campos como `situacao_aprovado`, `data_criacao`, `valor_total`.

O sync atual faz append+dedup por `numero`, mas nunca remove os registros legados porque eles têm números sequenciais simples que não colidem com os números reais da API. Resultado: dados fictícios persistem e o LTV fica incorreto (calculado só sobre `situacao_aprovado`, que não existe nos legados, resultando em LTV=0).

## Plano

### 1. Limpar dados legados via SQL (insert tool)

Executar UPDATE para purgar entradas do `lojaintegrada_historico_pedidos` que estão no formato antigo (sem campo `situacao_aprovado`), em todos os leads afetados. Resetar campos derivados (`lojaintegrada_ltv`, `lojaintegrada_total_pedidos_pagos`) para forçar recalculo no próximo sync.

### 2. Atualizar Edge Function `sync-loja-integrada-clients`

Adicionar lógica de "purge legacy" no `enrichWithOrders`: antes do merge, filtrar entradas existentes que não possuem `situacao_aprovado` (formato legado). Isso garante que syncs futuros limparão automaticamente resíduos antigos.

### 3. Resultado

Após a limpeza + próxima execução do cron (a cada 3h), os dados reais da API da Loja Integrada serão sincronizados corretamente com LTV calculado sobre pedidos aprovados.

