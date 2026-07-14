
## Diagnóstico

Investiguei o console e o código. São **dois problemas distintos**, e nenhum é "aleatório":

### 1) Cards duplicados / sumidos na Base de Conhecimento → Aba Catálogo
No console aparece:
```
column products_catalog.id does not exist
Perhaps you meant to reference the column "products_catalog.product_id"
```
A tabela `products_catalog` usa `product_id` como PK (não `id`). Confirmei no schema. Dois arquivos consultam com `id` e quebram silenciosamente:

- `src/components/knowledge/KbTabCatalogo.tsx` (linha ~434): a query cai inteira → o hook não consegue casar `system_a_catalog` × `products_catalog` (datasheet/manual/specs longos), então os cards renderizam só com o que veio do `system_a_catalog`. Efeito visual: itens sem specs "somem" da UI e itens com nomes parecidos entre as duas fontes aparecem "duplicados" (cai para o cruzamento por nome/slug em vez do produto certo).
- `src/hooks/useCatalogCRUD.ts` (função `mirrorTechSpecsToProductsCatalog`): mesmo bug — `select('id, ...').eq('id', m.id)`. Espelhamento manual de specs não grava.

### 2) Distribuição afetando o catálogo mestre
A aba **Distribuição → Catálogo de Produtos** (`DealerCatalogGrid.tsx`) grava direto em `system_a_catalog`:
- `saveField(id, patch)` → `supabase.from('system_a_catalog').update(patch).eq('id', id)`
- edita `price`, `price_usd`, `price_eur`, `ncm`, `gtin`, `presentation`, `quantity_multiplier`, `active`, etc.

Ou seja: qualquer ajuste feito ali muda o catálogo que alimenta a Base de Conhecimento, o site publicado, o Copilot e a sincronia com Sistema A. Isso viola o requisito do usuário. A `DealerPriceTable` (a tabela por distribuidor) já está correta — grava em `dealer_price_items`, isolada.

## Plano de correção

### A. Fix do erro `products_catalog.id`
1. `src/components/knowledge/KbTabCatalogo.tsx`
   - Trocar o `select` da query `products_catalog` para usar `product_id` no lugar de `id`.
   - Ajustar o mapa de lookup (onde hoje se faz `by[row.id]` ou similar) para chavear por `product_id` — vou revisar as linhas 470–560 e ajustar exatamente onde a chave é consumida.
2. `src/hooks/useCatalogCRUD.ts` → `mirrorTechSpecsToProductsCatalog`
   - `select('product_id, name, slug')` e `.eq('product_id', m.product_id)`.

Sem migration: o schema já é o correto; era só o SELECT que estava errado.

### B. Blindar Distribuição (nunca mais gravar em `system_a_catalog`)
`src/components/smartops/distributors/DealerCatalogGrid.tsx`:
- Transformar a grid em **leitura pura** do catálogo. Remover:
  - `saveField()` (não escreve mais em `system_a_catalog`)
  - `toggleActive()` que altera `active` do catálogo mestre
  - qualquer input editável que dispare `update` no `system_a_catalog`
- Manter busca, filtros, visualização e o link/ação que joga o produto para dentro da tabela de preços do distribuidor (isso já usa `dealer_price_items`, ok).
- Adicionar banner discreto: "Somente leitura. Edições de preço/margem por distribuidor ficam na aba Tabelas de Preço."
- Se o usuário precisar corrigir preço/atributo do catálogo mestre, o caminho continua sendo a Base de Conhecimento → Catálogo (aba admin), não a Distribuição.

Verifiquei que:
- `DealerPriceTable.tsx` só **lê** `system_a_catalog` (para importar/recalcular) e grava exclusivamente em `dealer_price_items` / `dealer_price_lists` / `dealer_price_list_snapshots` — **mantido como está**.
- `DealerProposalWizard.tsx` grava apenas em `dealer_proposals` — **mantido**.
- O historial de snapshots implementado antes fica intacto.

### C. Verificação
1. Após as edições, abrir `/base-conhecimento` → aba Catálogo e conferir no console que o erro 42703 sumiu e que datasheet/manual/specs voltam a aparecer.
2. Abrir Distribuição → Catálogo e confirmar que os campos não são mais editáveis; qualquer tentativa de update no `system_a_catalog` a partir dessa tela não existe mais no bundle (grep).
3. `tsgo` para checagem de tipos.

## Fora de escopo
- Não vou tocar em migrations, RLS, nem no fluxo de sincronia Sistema A.
- Não vou mexer em `products_catalog` (schema está certo — o bug é do cliente).
- Não vou alterar a lógica de câmbio (`FxRateBadge`) nem o histórico de propostas.

## Arquivos que serão alterados
- `src/components/knowledge/KbTabCatalogo.tsx` (fix do select + uso de `product_id`)
- `src/hooks/useCatalogCRUD.ts` (fix do mirror)
- `src/components/smartops/distributors/DealerCatalogGrid.tsx` (read-only, remove escritas em `system_a_catalog`)
