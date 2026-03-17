

## Problema: Dados fake de e-commerce em 1.144 leads

### Diagnóstico
Uma importação em massa inseriu **dados idênticos** de pedidos em todos os 1.144 leads que têm `lojaintegrada_historico_pedidos` preenchido:
- `lojaintegrada_historico_pedidos`: 1 valor único (20 pedidos de abril/2020) replicado em 1.144 leads
- `lojaintegrada_total_pedidos_pagos`: 1 valor único em 1.144 leads
- `lojaintegrada_ltv`: 1 valor único em 1.144 leads
- `lojaintegrada_itens_json`: **1.144 valores distintos** — parece conter dados reais

### Solução
Limpar os 3 campos contaminados via UPDATE, preservando `lojaintegrada_itens_json` e o campo `loja_cliente_id` (que identifica o cliente real na Loja Integrada).

**SQL a executar** (data operation, não migration):
```sql
UPDATE lia_attendances
SET 
  lojaintegrada_historico_pedidos = NULL,
  lojaintegrada_total_pedidos_pagos = NULL,
  lojaintegrada_ltv = NULL
WHERE lojaintegrada_historico_pedidos IS NOT NULL
  AND jsonb_array_length(lojaintegrada_historico_pedidos) = 20
  AND (lojaintegrada_historico_pedidos->0->>'numero')::text = '1'
  AND (lojaintegrada_historico_pedidos->0->>'valor')::text = '717.7';
```

O filtro é cirúrgico: só limpa registros cuja primeira entrada é exatamente `numero=1, valor=717.7` (o payload fake). Se no futuro algum lead receber dados reais da Loja Integrada via webhook/polling, esses serão preservados.

### Impacto no UI
- A seção "🛒 E-commerce — Loja Integrada" deixará de aparecer para leads sem pedidos reais
- Os campos `lojaintegrada_itens_json` (que parecem ter dados reais distintos) continuam intactos
- A timeline unificada perde os 20 eventos falsos por lead

### Arquivo: nenhuma mudança de código
O `LeadDetailPanel.tsx` já renderiza condicionalmente (`ecomOrders.length > 0`), então limpar os dados no banco é suficiente.

