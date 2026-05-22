---
name: Copilot Product Owners Tool
description: Tool query_product_owners + fn_product_owners para listar base instalada real de um produto (anti-alucinação)
type: feature
---
Quando o usuário pedir "lista de quem comprou X", "proprietários do X", "base instalada de X" ou "recompra de insumos por proprietário", o Copilot DEVE chamar `query_product_owners({ busca })`, que executa `fn_product_owners(_busca text)`:

- Fonte: **APENAS CRM (PipeRun)** — `deals.status='ganha'` JOIN `deal_items` ON `deal_items.deal_id = deals.piperun_deal_id` filtrando `product_name`/`nome_produto` ILIKE `%busca%`. Dados Omie estão BLOQUEADOS (ver `copilot-omie-data-blocked`).
- Para cada lead canônico (merged_into IS NULL): nome, email, telefone (`telefone_normalized`), cidade/uf, data_primeira_compra, data_ultima_compra, qtd_unidades (sum `quantity`), receita_total (sum `total_value`), n_deals.
- Coluna `fonte` retorna sempre `'piperun'`.
- Cruza com `lia_attendances.data_ultima_compra_insumos` para devolver `dias_desde_insumo` e `status_recompra`: ativo ≤45d, alerta ≤90d, inativo >90d, sem_recompra (null).
- Executor agrega `por_mes` (clientes/unidades/receita) e `resumo_recompra`.

PROIBIDO inventar quantidades ou nomes. `total_clientes` do payload é verdade absoluta — se o usuário insistir num número maior, reafirmar o real e explicar a fonte.
