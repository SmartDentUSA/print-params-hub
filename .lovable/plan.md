# Popular campo "Pres" com "grs" nas Resinas 3D

## Objetivo
No Catálogo de Produtos, garantir que a coluna **Pres** (unidade de apresentação) das variações de Resinas 3D venha preenchida com **"grs"** por padrão, tanto para linhas existentes quanto para novas.

## Escopo
Aplica-se apenas a variações (`catalog_product_variations`) cujo produto pai esteja na categoria de resina (`product_category` ILIKE '%resina%' OR `category` IN ('resin','Resinas')). Não afeta impressoras, serviços, insumos etc.

## Mudanças

1. **Migração de dados (backfill único)**
   - `UPDATE catalog_product_variations` setando `presentation = 'grs'` onde `presentation IS NULL OR presentation = ''`, restrito às variações cujo `catalog_product_id` pertence a produtos de resina.
   - Também aplicar presets físicos (`weight_kg`, `dimensions_cm`) quando `presentation_qty` bater com 250/500/1000 e os campos estiverem vazios — mesma tabela `RESIN_GRS_PRESETS` já usada no front (`AdminCatalogTable.tsx`).

2. **UI — `src/components/AdminCatalogTable.tsx`**
   - No `<Select>` da coluna Pres (linha ~393), quando a linha for resina (`isResinRow(product)`) e `v.presentation` estiver vazio, exibir "grs" como valor default no `SelectValue` (visual) e considerar "grs" como valor efetivo ao salvar outros campos da mesma linha.
   - No autosave de `presentation_qty` (linha ~378), remover a condição `!v.presentation` que hoje só grava "grs" se estiver vazio, e passar a gravar "grs" sempre que a linha for resina e a unidade atual não for uma explicitamente diferente (ex.: "ml", "un").

3. **Criação de novas variações de resina**
   - No hook/local que insere nova variação (a confirmar em `useCatalogVariations`), quando o produto pai for resina, default `presentation = 'grs'` no INSERT.

## Fora do escopo
- Não altera categorias, nomes canônicos, SKUs, mapeamentos de alias, nem variações de não-resinas.
- Não mexe em `system_a_catalog` (só `catalog_product_variations`).

## Validação
- Após a migração, rodar `SELECT count(*) FROM catalog_product_variations v JOIN system_a_catalog c ON c.id = v.catalog_product_id WHERE (c.product_category ILIKE '%resina%' OR c.category IN ('resin','Resinas')) AND (v.presentation IS NULL OR v.presentation = '')` — deve retornar 0.
- Abrir Gestão de Catálogo → filtrar Resinas 3D → confirmar visualmente que a coluna Pres está preenchida com "grs" em todas as linhas.
