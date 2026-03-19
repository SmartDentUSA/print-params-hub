

# Corrigir Timeline, Adicionar Tabela E-commerce Detalhada, Financeiro Consolidado e Mix Unificado

## Resumo

Três problemas atuais + duas features novas solicitadas:

1. **Timeline fabricando eventos falsos de 2026** a partir de `tags_crm` usando `ld.updated_at`
2. **"Lead criado no sistema"** mostrando data técnica do sync (2026) em vez da origem real
3. **Tabela e-commerce** atual é simplificada demais — faltam colunas: SKU, Item, QTD, UNIT, Total, Frete, Meio/Forma de Pagamento, Status
4. **Resumo financeiro** no header precisa incluir LTV E-commerce + LTV Abandono + Financeiro Total consolidado
5. **Product Mix Intelligence** precisa somar também os produtos vendidos via e-commerce

## Plano de Implementação

### 1. Remover eventos sintéticos de tags na timeline
**Arquivo:** `src/components/smartops/LeadDetailPanel.tsx` (linhas 419-427)

Remover o bloco que transforma `tags_crm` em eventos cronológicos com data `ld.updated_at`. Tags como `EC_INICIOU_CHECKOUT` e `EC_PROD_RESINA` continuam visíveis como badges no hero, mas deixam de gerar eventos falsos datados de 2026 na timeline.

### 2. Corrigir data de "Lead criado no sistema"
**Arquivo:** `src/components/smartops/LeadDetailPanel.tsx`

Para leads `source = 'loja_integrada'`, usar como data de criação:
```text
lojaintegrada_cliente_data_criacao → primeiro evento e-commerce → data_primeiro_contato → created_at
```

**Arquivo:** `supabase/functions/sync-loja-integrada-clients/index.ts`

No insert de novos leads, preencher `data_primeiro_contato` com `client.data_criacao` quando disponível.

### 3. Expandir tabela e-commerce com colunas completas
**Arquivo:** `src/components/smartops/LeadDetailPanel.tsx` (linhas 1186-1220)

Reformatar a tabela de pedidos e-commerce para colunas: **PEDIDO | SKU | Item | QTD | UNIT | Total | Frete | Meio Pgto | Forma Pgto | Status**

Os dados de itens virão de:
1. `event_data.itens[]` do `lead_activity_log` (contém sku, nome, qty, preco por item)
2. `lojaintegrada_itens_json` como fallback
3. `itens_resumo` do `lojaintegrada_historico_pedidos` como último recurso

Cada pedido será renderizado com sub-linhas de itens (padrão igual ao CRM), mostrando forma/meio de pagamento extraídos do `event_data` ou `historico_pedidos`.

### 4. Adicionar bloco financeiro e-commerce no header
**Arquivo:** `src/components/smartops/LeadDetailPanel.tsx` (linhas 753-774)

Abaixo do grid CRM existente, adicionar novo bloco e-commerce:

```text
┌──────────────────────┬──────────────────────┐
│ Vendas E-com (ganhas)│ Vendas E-com (perdas)│
│ LTV E-commerce       │ LTV Abandono         │
└──────────────────────┴──────────────────────┘
Financeiro Total = P&S (ganhas) + LTV E-commerce
```

- **LTV E-commerce** = soma dos pedidos aprovados/pagos/faturados (historico + activity_log)
- **LTV Abandono** = soma dos pedidos cancelados + carrinhos abandonados
- **Financeiro Total** = CRM ganho + LTV E-commerce

### 5. Incluir e-commerce no Product Mix Intelligence
**Arquivo:** `src/components/smartops/LeadDetailPanel.tsx` (linhas 644-700)

Atualmente o `mixMap` só itera sobre `wonDeals` (CRM). Adicionar uma segunda iteração sobre os pedidos e-commerce aprovados (de `liHistorico` ou `activity_log`), usando `event_data.itens[]` para alimentar o mix com:
- SKU do item
- Nome do produto
- Quantidade
- Valor total
- Timestamp do pedido

Os itens e-commerce serão normalizados pelo mesmo `key = name.toLowerCase().trim()` e mesclados ao mix CRM existente. Na coluna "Deals", pedidos e-commerce contarão como IDs distintos (prefixo `EC-` + numero).

### 6. Backfill de data_primeiro_contato para leads LI existentes
**Operação SQL via insert tool**

Atualizar `data_primeiro_contato` dos leads com `source = 'loja_integrada'` que têm `lojaintegrada_cliente_data_criacao` preenchido mas `data_primeiro_contato` com data de 2026.

## Arquivos alterados
- `src/components/smartops/LeadDetailPanel.tsx` — timeline, tabela e-commerce, header financeiro, product mix
- `supabase/functions/sync-loja-integrada-clients/index.ts` — data_primeiro_contato no insert

## Resultado esperado

Para o lead Duilio (`financeiro@odontoprimecuiaba.com.br`):
- Timeline: sem eventos falsos de 2026, apenas pedidos reais de 2023
- Tabela e-commerce: 2 pedidos com itens estratificados (Resina 3D Smart Print Modelo DLP, qty, unit, total, frete, pagamento)
- Header: LTV E-commerce R$ 4.444,45, Financeiro Total = CRM + E-com
- Product Mix: "Resina 3D Smart Print Modelo DLP" aparece com dados CRM + E-commerce combinados

