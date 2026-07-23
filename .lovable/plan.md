## Objetivo
Ingerir os dois XLSX da Loja Integrada (`EXPORTAR_CLIENTES.xlsx` + `PEDIDOS_PRODUTOS_DETALHADOS.xlsx`) nas staging tables já criadas, preservando 100% das datas originais, e cruzar com `lia_attendances` para enriquecer o CDP.

## Estado atual (já pronto)
- Staging tables `loja_integrada_clientes_import` e `loja_integrada_pedidos_items_import` criadas com RLS + índices.
- Coluna `loja_integrada_customer_id` adicionada em `lia_attendances`.
- Função `match_li_customer_to_lead` (cascata email → CPF → CNPJ → telefone) criada.
- Edge Function `smart-ops-li-import-runner` deployada e registrada no `config.toml`.
- 15 lotes JSON gerados em `/tmp/li_import/` (5 clientes + 10 pedidos).

## Bloqueio
O secret `LI_IMPORT_SHARED_SECRET` (auth entre sandbox → Edge Function) já existe mas está mascarado — o sandbox não sabe o valor, então as chamadas retornariam 401.

## Passos

1. **Reset do shared secret**
   - Deletar `LI_IMPORT_SHARED_SECRET` (é isso que a confirmação da tela está pedindo).
   - Recriar com `generate_secret` para termos um valor novo que o sandbox pode usar.

2. **Executar os 15 lotes** via `supabase--curl_edge_functions` chamando `smart-ops-li-import-runner` com header `x-shared-secret`. Cada lote grava em staging preservando:
   - `data-criacao` (clientes) → `created_at_source`
   - `pedido_data_criacao` (itens) → `order_created_at`
   - `imported_at = now()` fica isolado, só administrativo.

3. **Identity resolution** — rodar `match_li_customer_to_lead()` em batch, populando `lia_attendances.loja_integrada_customer_id`.

4. **Enrichment CDP** — atualizar em `lia_attendances`:
   - `primeiro_pedido_ecommerce = MIN(order_created_at)` pagos
   - `ultimo_pedido_ecommerce = MAX(order_created_at)` pagos
   - LTV agregado a partir da staging (nunca `now()`).

5. **Reconciliação SKU** — gerar `/mnt/documents/reconciliacao-master-2026-07-23.csv` cruzando SKUs da staging com `system_a_catalog` (ações MATCH / RENOMEAR / CRIAR).

6. **Relatório final** — contagens: quantos clientes casaram com leads existentes, quantos são novos, quantos itens de pedido ficaram órfãos, top produtos por volume/receita.

## Garantias mantidas
- **Timeline preservada**: nenhum campo de negócio usa `now()`; pedido de 03/2025 aparece em 03/2025.
- **Commercial Intent Guard**: nenhum Deal PipeRun será criado a partir deste ingest.
- **CDP Integrity**: leads seguem canônicos (`merged_into IS NULL`).
- **Sem alteração** em funil Vendas ou CS.

## Detalhes técnicos
- Batches: 500 linhas/lote (clientes) e ~400/lote (itens) para caber no payload da Edge Function.
- Idempotência: staging usa `ON CONFLICT (source_id) DO UPDATE` — rodar 2x não duplica.
- Índice já criado em `(sku_produto, order_created_at)` para queries "quem comprou X em período Y".
