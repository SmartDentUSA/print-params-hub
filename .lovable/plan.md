
## Objetivo
Unificar os dois arquivos oficiais da Loja Integrada com o CDP existente para ter identidade e histórico de compra completos por lead — preservando **100% dos timestamps originais** dos pedidos.

**Arquivos**
- `EXPORTAR_CLIENTES.xlsx` — 2.003 clientes (id, email, cpf/cnpj, telefones, endereço, `data-criacao`, situacao).
- `PEDIDOS_PRODUTOS_DETALHADOS.xlsx` — 3.738 linhas item-a-item (cliente_id, pedido_numero, sku_produto, nome_produto, quantidade, valor_total, pedido_situacao, `pedido_data_criacao`, endereços com CPF/CNPJ).

## Regra inviolável de timestamps
Toda linha ingerida usa a **data real do evento** do arquivo:
- Cliente → `data-criacao` do XLSX vira `created_at_source` no staging.
- Pedido/Item → `pedido_data_criacao` do XLSX vira `order_created_at` no staging e é a data usada em qualquer agregado (`primeiro_pedido_ecommerce`, `ultimo_pedido_ecommerce`, LTV, mix de produtos, filtros "quem comprou o produto X e quando").
- `now()` só será gravado em colunas administrativas separadas (`imported_at`) — nunca em campos que representam o evento de negócio.
- Backfills em `lia_attendances` (LTV, últimos pedidos) usam `MIN/MAX(pedido_data_criacao)` do staging — nada de "data da importação".
- Reforça a Core Memory de Timestamps e a Ecommerce Timestamps.

## Plano

### 1. Staging (não invasivo, imutável)
Criar duas tabelas paralelas às atuais `loja_integrada_orders/items` — não sobrescreve nada que vem por API:
- `loja_integrada_clientes_import` (PK `id`, `created_at_source TIMESTAMPTZ NOT NULL`, `imported_at DEFAULT now()`).
- `loja_integrada_pedidos_items_import` (PK `(pedido_numero, sku_produto, cliente_id)`, `order_created_at TIMESTAMPTZ NOT NULL`, `imported_at DEFAULT now()`).
- Índices por `order_created_at`, `sku_produto`, `cliente_id`, `pedido_situacao` para permitir filtros "quem comprou X entre datas".

### 2. Import
- Converter XLSX → CSV via pandas parseando as datas no formato `MM/DD/YYYY HH:MM:SS` presente nos arquivos.
- `\copy` para staging preservando strings originais + coluna TIMESTAMPTZ normalizada em UTC.

### 3. Reconciliação com as tabelas vivas
Comparar staging × `loja_integrada_orders` / `order_items`:
- Pedidos ausentes na tabela viva → gap real de backfill da API (lista separada).
- Divergências de status ou itens → auditoria.
- Nenhuma escrita nas tabelas vivas — apenas relatório.

### 4. Identity resolution → CDP
Match `EXPORTAR_CLIENTES.id` com `lia_attendances` (`merged_into IS NULL`) na cascata:
`email` → `cpf` normalizado → `cnpj` normalizado → `telefone-celular`/`telefone-principal` (digits-only).

Gravar no lead:
- `loja_integrada_customer_id` (nova coluna).
- `primeiro_pedido_ecommerce` = `MIN(order_created_at)` dos pedidos pagos.
- `ultimo_pedido_ecommerce` = `MAX(order_created_at)`.
- `total_pedidos_ecommerce`, `ltv_ecommerce` — considerando somente status pagos.

Sem criação de Deal (Commercial Intent Guard: e-commerce nunca abre Deal).

### 5. Mix de produtos (real, com data)
`ProfessionalMixSummary` passa a agregar itens do staging mapeados às 6 categorias normativas via `system_a_catalog.categoria`, mantendo o `order_created_at` para permitir cortes por período.

### 6. CSV Master de reconciliação (entrega)
`/mnt/documents/reconciliacao-master-2026-07-23.csv` — 1 linha por SKU único combinando `system_a_catalog` + `resins` + PipeRun (607 ativos) + Loja Integrada (distinct `sku_produto`, ~436), com métricas de venda (qtde, leads distintos, primeira e última venda REAL, valor total) vindas de `deal_items` + staging. Coluna de ação: `MATCH | RENOMEAR | CRIAR | DESATIVAR`.

### 7. Auditoria em chat
- Clientes casados vs órfãos.
- Pedidos no staging ausentes em `loja_integrada_orders`.
- SKUs distintos faltantes no catálogo.
- Faixa de datas efetivamente coberta pelo staging (min/max `order_created_at`).

## O que NÃO alterar
- Funil Vendas / CS do PipeRun.
- `loja_integrada_orders` / `order_items` (fonte API — staging é paralelo).
- Origens congeladas (`origin_id` frozen).
- Nenhum Deal criado por este processo.

## Detalhes técnicos
- Migration única com CREATE TABLE + GRANT (`authenticated` SELECT via `has_role(admin)`, `service_role` ALL) + RLS + coluna `lia_attendances.loja_integrada_customer_id TEXT` indexada.
- Função SQL `public.match_li_customer_to_lead(li_id)` retornando `lead_id` seguindo cascata.
- Backfill LTV via `UPDATE lia_attendances` a partir de agregado por `cliente_id`, usando exclusivamente `order_created_at` do staging.
- Script Python que gera o CSV master lê apenas tabelas (nada de `query_leads`).
