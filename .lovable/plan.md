

# Corrigir sync repetitivo de clientes da Loja Integrada

## Diagnóstico

O `sync-loja-integrada-clients` **sempre começa do offset 0** sem nenhum cursor de data. Toda vez que o cron roda (a cada 3h), ele busca os mesmos primeiros 500 clientes (10 páginas × 50) da API `/cliente/`, re-processa cada um, e ainda chama `enrichWithOrders` para todos — gerando dezenas de chamadas de API desnecessárias e reprocessando os mesmos leads.

Diferente do `poll-loja-integrada-orders` que tem `since_atualizado`, o sync de clientes não tem nenhum mecanismo de cursor.

## Problema secundário: enrichWithOrders em cada sync

Mesmo para leads que já foram sincronizados e já têm `lojaintegrada_historico_pedidos` populado, o sistema chama `enrichWithOrders` novamente — fazendo 1-2 chamadas extras à API da Loja Integrada **por cliente**, o que consome o rate limit rapidamente.

## Plano de Correção

### 1. Adicionar cursor `since_criado` ao sync de clientes
**Arquivo**: `supabase/functions/sync-loja-integrada-clients/index.ts`

- Antes de iniciar, buscar o `lojaintegrada_cliente_data_criacao` mais recente no banco
- Usar como parâmetro `since_criado` na API: `/cliente/?limit=50&offset=0&since_criado=YYYY-MM-DD`
- Se a API não suportar `since_criado`, usar fallback: **pular clientes que já existem no banco E foram atualizados recentemente** (últimas 24h no `lojaintegrada_updated_at`)

### 2. Skip enrichWithOrders para leads recentemente sincronizados
- Verificar `lojaintegrada_updated_at` do lead existente antes de chamar `enrichWithOrders`
- Se foi atualizado nas últimas 24h, pular o enriquecimento de pedidos (já está fresco)
- Isso reduz drasticamente as chamadas à API

### 3. Lógica de skip otimizada
```text
Para cada cliente da API:
  1. Buscar lead existente por email
  2. Se existe E lojaintegrada_updated_at < 24h → SKIP (já sincronizado recentemente)
  3. Se existe E lojaintegrada_updated_at > 24h → UPDATE campos + enrich orders
  4. Se não existe → INSERT + enrich orders
```

## Arquivo alterado
- `supabase/functions/sync-loja-integrada-clients/index.ts`

## Impacto
- Reduz chamadas à API de ~500/sync para ~10-50/sync (apenas novos ou desatualizados)
- Elimina re-processamento dos mesmos leads a cada 3h
- Preserva capacidade de fazer sync completo via `full: true`

