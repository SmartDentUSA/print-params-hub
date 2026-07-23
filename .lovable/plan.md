# Lista de itens PipeRun × Catálogo do sistema

## O que já confirmei

**No CSV `propostas-23-07-2026-15-39-39-600a.csv`:**
- 920 propostas, 368 linhas com item preenchido.
- **33 SKUs distintos** (chave = `Código único (Item)` — o ID interno do produto no PipeRun: 383, 384, 385, 987, 1272, 2051, 2246, …).
- Único texto disponível por item é `Descrição (Item)` — que é a **descrição de marketing**, não o nome do produto (código 383 = "ÚNICO GLAZE OPALESCENTE DO MUNDO!!!…" = **GlazeON** no catálogo).
- `Marca (Item)`, `Referência (Item)` e `Categoria (Item)` vêm **vazios** no export.

**No `system_a_catalog`:**
- 391 produtos com `name` real e `external_id` em UUID/slug.
- **Não existe** coluna com o ID interno do PipeRun em `system_a_catalog`, `products_catalog` ou `produto_aliases` — o `Código único` da proposta não bate com nenhum `external_id`. Match só é possível por **texto + preço**.

## Entregável

Um único CSV em `/mnt/documents/piperun-x-catalogo-2026-07-23.csv` com uma linha por SKU distinto do PipeRun, colunas:

```
piperun_code | descricao_proposta (trecho) | ocorrencias | valor_unit_mediano
             | match_catalogo (system_a_catalog.name) | sac_id | sac_external_id | sac_category
             | metodo_match (dict_manual | trigram | price_only | unmatched)
             | score_similaridade | observacao
```

E um resumo no chat: total de SKUs, quantos "matched" vs "unmatched", % de cobertura das 368 linhas de item da proposta, e a lista literal dos que ficaram sem match para você decidir.

## Como vou casar cada SKU (em ordem)

1. **Dicionário manual** para os códigos recorrentes já identificáveis pela descrição: 383→GlazeON, 384→SmartMake Base, 385/386/387→SmartMake SHADE A/B/C, 389/391/393→SmartMake Effect (emulsões incisais), 392/394→SmartMake Stain (croma), 397→Godê SmartMake, 398→SmartWash, 987→Resina Vitality 1KG, 1272-1276→variações SmartMake/SmartGum, 2051→Curso Imersão 3 dias, 2246→Acessório Rayshape.
2. **Trigram fuzzy** (`pg_trgm.similarity ≥ 0.35`) do primeiro trecho da descrição (antes de "SERINGA COM…", "Kit contém:", etc.) contra `system_a_catalog.name`.
3. **Cross-check por preço** contra `products_catalog.preco_venda` para descartar falsos positivos do fuzzy.
4. Resto = `unmatched`.

## Escopo

- Auditoria **read-only**. Nada muda no banco, no PipeRun, em edge functions ou na UI.
- Apenas o CSV de propostas que você enviou nesta thread.
- Se você aprovar, na sequência posso propor uma migration criando `system_a_catalog.piperun_product_id` (ou tabela `piperun_product_map`) para o parser de propostas parar de depender da descrição de marketing — mas isso é uma tarefa separada, aguardo aprovação em seguida.
