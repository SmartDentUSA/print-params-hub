# Exportação Master do Catálogo de Produtos (CSV)

## Objetivo
Gerar um único arquivo `.csv` (em `/mnt/documents/`) unificando **todos os produtos** do sistema (Sistema A + Sistema B + Resinas legadas) com **uma linha por variação** (produto sem variação = 1 linha), enriquecido com:
- IDs cruzados Sistema A ↔ Sistema B
- Categoria / subcategoria / etapa 7×3
- SKU, NCM, GTIN, presentation, peso, dimensões, cor, preços (BRL/USD/EUR)
- Contagem de documentos disponíveis
- Formulário(s) do sistema associado(s)
- Formulário Meta associado + valor exato de `produto_interesse`
- Situação (ativo/aprovado/visível)

## Fontes de dados
| Tabela | Uso |
|---|---|
| `system_a_catalog` (filtrado por `category IN PRODUCT_CATALOG_ENTITY_TYPES`) | Produto canônico, external_id (=Sistema A id), `product_category` (etapa 7×3), NCM/GTIN mestre, presentation |
| `catalog_product_variations` | Variações (SKU, cor, presentation, GTIN, NCM/HS, peso, dimensões, unidade, preços) |
| `products_catalog` | Espelho Sistema B (`product_id` Sistema B, `workflow_stages`, `system_a_product_id` bridge) |
| `resins` | Resinas legadas ainda não migradas (mantidas como linha separada com origem=`resins`) |
| `catalog_documents` | `COUNT(*)` por `product_id` ativo |
| `smartops_forms` + `smartops_form_fields` | Formulários internos que referenciam o produto (busca por slug/nome em opções de campo `produto_interesse`) |
| `meta_lead_ingestion_log` + `produto_aliases` | Mapeamento formulário Meta → produto (via aliases e nome) |

## Colunas do CSV (na ordem exata)
```
origem                        (system_a | resins)
system_b_product_id           (products_catalog.product_id via system_a_product_id)
system_a_external_id          (system_a_catalog.external_id)
system_a_row_id               (system_a_catalog.id)
nome_produto
etapa_7x3                     (system_a_catalog.product_category — já em MAIÚSCULO)
categoria                     (system_a_catalog.category)
subcategoria                  (system_a_catalog.product_subcategory)
slug
fabricante                    (extra_data->>'manufacturer' ou resins.manufacturer)
variacao_id                   (catalog_product_variations.id — null se sem variação)
variacao_label                (presentation + cor)
presentation
presentation_qty
cor
sku
ncm_hs                        (variação → fallback pai)
gtin_ean                      (variação → fallback pai)
peso_kg
dimensoes_cm
unidade
preco_brl
preco_usd
preco_eur
visivel                       (visible_in_ui)
ativo                         (active)
aprovado                      (approved)
situacao                      (label consolidado: ATIVO/INATIVO/RASCUNHO)
docs_count                    (COUNT catalog_documents WHERE active=true)
formularios_internos          (lista separada por " | " de smartops_forms.name que oferecem este produto)
formularios_meta              (lista Meta form names associados via alias)
produto_interesse_values      (valores exatos usados nos formulários para este produto)
image_url
canonical_url
last_sync_at
updated_at
```

## Implementação
1. **Script único ad-hoc via `supabase--read_query`** (não cria migração, não altera schema, não adiciona código ao repo). Consulta com CTEs:
   - `products` = produtos do `system_a_catalog` (filtrados por `PRODUCT_CATALOG_ENTITY_TYPES`) + resinas legadas em `resins` que não têm par em `system_a_catalog`.
   - `vars` = `catalog_product_variations` LEFT JOIN em `products`; produtos sem variação geram 1 linha placeholder.
   - `docs` = `SELECT product_id, count(*) FROM catalog_documents WHERE active GROUP BY 1`.
   - `sysb` = `products_catalog` bridged por `system_a_product_id`.
   - `forms_internos` = agregação por match de nome/slug em `smartops_form_fields.options` (JSONB) filtrando `field_key ILIKE '%produto_interesse%'`.
   - `forms_meta` = agregação via `produto_aliases` + `meta_lead_ingestion_log` (últimos 90 dias) agrupada por form.
2. **Escrita**: `COPY (...) TO STDOUT CSV HEADER` → `/mnt/documents/catalogo-produtos-master-YYYY-MM-DD.csv`.
3. **Verificação**: `wc -l` e `head -3` do CSV; conferir totais (~257 variações + ~30 produtos sem variação ≈ 280–300 linhas).
4. **Entrega**: apresentar o path do arquivo e resumo (linhas, produtos únicos, variações, docs médios).

## Detalhes técnicos
- Etapa 7×3 vem de `system_a_catalog.product_category` (já normalizada em MAIÚSCULO nas migrações anteriores — ex.: `3.1 RESINAS 3D - BIOCOMPATÍVEIS`).
- Match de "formulário Meta ↔ produto" é heurístico (não existe FK). Usaremos:
  1. `produto_aliases` (alias → produto_slug), quando cobrir;
  2. Fallback: nome do produto normalizado (NFD, lowercase) contido em `meta_lead_ingestion_log.form_name` ou payload `field_data`.
- Se um produto tiver múltiplos aliases/formulários, agregamos com `string_agg(DISTINCT ..., ' | ')`.
- Produtos "não classificados" (categorias-container, clientes) já são excluídos via `PRODUCT_CATALOG_ENTITY_TYPES` conforme governança em `docs/CATALOG_PRODUCT_GOVERNANCE.md`.

## O que NÃO será feito
- Nenhuma alteração de schema, RLS ou dados.
- Nenhum código novo no repositório (é uma exportação one-shot).
- Nenhuma alteração no `system_a_catalog`/`catalog_product_variations`.

## Entregável
Arquivo único: `/mnt/documents/catalogo-produtos-master-2026-07-21.csv` pronto para download.
