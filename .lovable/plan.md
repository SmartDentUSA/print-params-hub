

## Corrigir enriquecimento de histórico: situacao vem como URI, não como objeto

### Problema confirmado nos logs

Os logs mostram `Enrichment: LTV=0 | pedidosPagos=0` para todos os clientes. A função `enrichWithOrderHistory` tenta ler `o.situacao.codigo`, mas a API `/pedido/?cliente_id=X` retorna `situacao` como string URI (ex: `/api/v1/situacao/5/`) e não como objeto `{ codigo: "pago", nome: "Pago" }`.

Resultado: nenhum pedido passa no filtro → LTV=0, nenhuma tag de recorrência.

### Solução

**1. Mapear IDs de situação para códigos**

A Loja Integrada usa IDs numéricos fixos para situações. Criar um mapa:
```
1 → "aguardando_pagamento"
2 → "em_producao" (ou "pagamento_confirmado")  
3 → "pagamento_aprovado" / "pago"
4 → "enviado"
5 → "entregue"
6 → "cancelado"
```

**2. Atualizar `enrichWithOrderHistory`** (linhas 284-290)

Antes de filtrar, normalizar o campo `situacao` de cada pedido:
- Se `situacao` é string contendo `/situacao/(\d+)` → extrair ID, mapear para código
- Se `situacao` é objeto → usar `codigo` como já faz
- Se nenhum → ignorar

**3. Adicionar log de debug temporário**

Na `fetchClienteOrderHistory`, logar o campo `situacao` do primeiro pedido retornado para confirmar o formato real da API.

### Mudanças

- **Arquivo**: `supabase/functions/smart-ops-ecommerce-webhook/index.ts`
  - Adicionar mapa `SITUACAO_ID_TO_CODIGO` com os IDs conhecidos
  - No `enrichWithOrderHistory`, tratar `situacao` como string URI extraindo o ID
  - Log de debug do formato de `situacao` no primeiro pedido
- **Deploy**: da edge function atualizada

### Resultado esperado

Pedidos com `situacao: "/api/v1/situacao/5/"` (entregue) serão reconhecidos como pagos, calculando LTV corretamente e aplicando tags `EC_CLIENTE_RECORRENTE` / `EC_CLIENTE_INATIVO`.

