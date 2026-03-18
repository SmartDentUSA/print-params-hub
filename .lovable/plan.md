

# Fix: Filtrar pedidos por cliente no `enrichWithOrders`

## Contexto Importante

Os pedidos **NÃO** estão em uma tabela separada `lojaintegrada_historico_pedidos` — estão em uma **coluna JSONB** na tabela `lia_attendances`. Portanto, o código com `supabase.from('lojaintegrada_historico_pedidos').delete()` não funcionaria.

A solução correta é filtrar os pedidos retornados pela API **antes** de processá-los, dentro da função `enrichWithOrders` que já existe.

## Alteração

**File: `supabase/functions/sync-loja-integrada-clients/index.ts`**

Após a linha 99 (`const pedidos = ordersRes?.objects || [];`), adicionar o filtro por `cliente`:

```typescript
// Filtrar apenas pedidos que realmente pertencem a este cliente
const pedidosReais = pedidos.filter((p: any) => {
  const clienteRef = p.cliente;
  if (!clienteRef) return false;
  if (typeof clienteRef === 'string') {
    return clienteRef.includes(`/cliente/${clienteId}`);
  }
  if (typeof clienteRef === 'object') {
    return clienteRef.id === clienteId || String(clienteRef.id) === String(clienteId);
  }
  return false;
});
console.log(`[sync-li-clients] Pedidos API: ${pedidos.length}, reais do cliente ${clienteId}: ${pedidosReais.length}`);
```

Depois, substituir `pedidos` por `pedidosReais` nas referências subsequentes (linhas 100, 115-116).

Adicionalmente, **limpar o histórico existente** do lead antes de inserir os filtrados, para purgar pedidos fantasmas já armazenados. Isso é feito zerando a coluna JSONB antes do merge:

- Linha 109-113: Em vez de carregar o histórico existente e fazer append, **substituir completamente** com apenas os pedidos filtrados reais. Isso elimina os ~100 pedidos fantasmas que já estão no banco.

Todos os campos do mapeamento original (linhas 117-131: `numero`, `id`, `data_criacao`, `data_modificacao`, `valor_total`, `valor_subtotal`, `valor_envio`, `valor_desconto`, `peso_real`, `utm_campaign`, `situacao_codigo`, `situacao_nome`, `situacao_aprovado`, `situacao_cancelado`) são mantidos exatamente como estão.

### Migration SQL: Limpar os ~29 leads corrompidos

```sql
UPDATE lia_attendances
SET 
  lojaintegrada_historico_pedidos = '[]'::jsonb,
  lojaintegrada_total_pedidos = 0,
  lojaintegrada_pedidos_aprovados = 0,
  ltv_total = NULL,
  lojaintegrada_ultimo_pedido = NULL
WHERE jsonb_array_length(COALESCE(lojaintegrada_historico_pedidos, '[]'::jsonb)) = 100
  AND lojaintegrada_historico_pedidos IS NOT NULL;
```

## Arquivos Alterados
1. `supabase/functions/sync-loja-integrada-clients/index.ts` — filtro por `clienteId` + replace em vez de append
2. Migration SQL — limpar dados corrompidos existentes

