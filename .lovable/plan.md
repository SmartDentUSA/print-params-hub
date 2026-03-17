

## Plano: Substituir e-commerce fake por tabela de itens de propostas + LTV corrigido

### Problema
1. Seção "🛒 E-commerce — Loja Integrada" exibe dados fake (20 pedidos idênticos de abril/2020) em 1.144 leads
2. LTV contabiliza apenas deals "ganha", mas não mostra o valor perdido como alternativa
3. Falta uma tabela consolidada com todos os itens de todas as propostas

### Mudanças

**1. Limpar dados fake no banco (SQL UPDATE via insert tool)**
```sql
UPDATE lia_attendances
SET lojaintegrada_historico_pedidos = NULL,
    lojaintegrada_total_pedidos_pagos = NULL,
    lojaintegrada_ltv = NULL
WHERE lojaintegrada_historico_pedidos IS NOT NULL
  AND jsonb_array_length(lojaintegrada_historico_pedidos) = 20
  AND (lojaintegrada_historico_pedidos->0->>'numero')::text = '1'
  AND (lojaintegrada_historico_pedidos->0->>'valor')::text = '717.7';
```

**2. Substituir seção E-commerce por "📦 Itens de Propostas" no `LeadDetailPanel.tsx`**

Nova seção abaixo dos Deals PipeRun que consolida todos os itens de todas as propostas de todos os deals em uma única tabela:

| Deal | Proposta | Item | Qtd | Unit | Total | Status |
|------|----------|------|-----|------|-------|--------|

- Cada linha = 1 item de proposta, com `deal_id`, `proposal_id`, nome do item, quantidade, valor unitário, valor total
- Status herdado do deal pai (Ganho/Perdido/Aberto)
- Cores: verde para ganho, vermelho para perdido, neutro para aberto

**3. Corrigir lógica de LTV no hero e stats**

- LTV Total = soma dos `value` apenas de deals com `status === "ganha"`
- Se LTV === 0 e existem deals perdidos: mostrar "R$ X perdido" em vermelho no lugar do LTV
- Stats row: trocar "Deals fechados" por "Ganhos / Perdidos" com contagem separada

**4. Remover seção E-commerce e timeline de pedidos fake**

- Remover bloco `ecomOrders` (linhas 676-724) — a seção toda de "E-commerce — Loja Integrada" que depende de `lojaintegrada_historico_pedidos`
- Remover timeline events de e-commerce orders (linhas 302-311)
- Manter `ecomItems` (`lojaintegrada_itens_json`) apenas se houver dados reais (verificação pós-limpeza)
- Remover stat "Pedidos e-com" do stats row

### Arquivo editado
- `src/components/smartops/LeadDetailPanel.tsx`

### Sem migration necessária
Apenas UPDATE de dados (via insert tool) + edição de código frontend.

