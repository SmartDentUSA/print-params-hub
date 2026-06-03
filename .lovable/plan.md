## Problema

Os 52 formulários clonados do `ioconnect` ficaram todos apontando para o mesmo produto da origem (`ioConnect TruAbutment`, id `bea3eb9f-...`). Não foi feito o re-link de `smartops_forms.product_catalog_id` para o produto específico de cada formulário (Medit i700, INO200, Resina Vitality, etc.).

Os 17 campos em si foram copiados corretamente em todas as 52 cópias (mesmo número de `conditions`, `workflow_cell_target`, `options`, `roi_config` da origem). O que está faltando é a ligação form → produto correto, que é o que alimenta o "produto de interesse" e os automatismos comerciais.

## O que vou fazer

1. **Carregar a tabela de-para slug→nome-do-produto** a partir do CSV original (52 linhas, coluna 2 = nome do produto).
2. **Fazer match com `products_catalog.name`** (normalizando: lower + sem acento + sem espaços duplos). Para nomes ambíguos (ex.: "MEDIT i700" vs "MEDIT i700 Wireless"), priorizar match exato do sufixo do slug.
3. **Gerar migration** que faz `UPDATE smartops_forms SET product_catalog_id = <product_id_correto> WHERE id = <form_id>` para cada uma das 52 cópias.
4. **Relatório de matches** ao final: quantos casaram automaticamente e quais (se houver) precisam decisão manual. Para os não-resolvidos, vou listar candidatos e pedir confirmação antes de aplicar.
5. **Não tocar** em `smartops_form_fields` — paridade já validada (17 campos, mesmas conditions e workflow targets da origem).
6. **Não tocar** no formulário `ioconnect` original.

## Detalhes técnicos

- Tabela alvo: `public.smartops_forms`, coluna `product_catalog_id uuid` → `public.products_catalog(product_id)`.
- Escopo do UPDATE: somente os 52 ids criados em `2026-06-03 23:41:18` (filtro por `created_at` + `slug != 'ioconnect'`).
- Estratégia de match (ordem de precedência):
  1. Match exato case-insensitive entre nome do CSV e `products_catalog.name`.
  2. Fuzzy normalizado (lower, sem acento, sem pontuação, sem "smart print bio" / "scanner intraoral" prefix).
  3. Fallback: deixar `product_catalog_id` inalterado e listar na saída para decisão manual.

## Pergunta antes de executar

Quer que eu trate como erro bloqueante qualquer slug que não casar 1:1 com um produto no catálogo (paro e te mostro a lista), ou prefere que eu aplique o que casou e te entregue a lista dos pendentes para resolver depois?
