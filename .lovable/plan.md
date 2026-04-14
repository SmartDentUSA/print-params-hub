

## Plano: Filtrar por `visible_in_ui` na página pública e adicionar controle de categoria

### Problema
1. **A página `/support-resources` não respeita `visible_in_ui`** -- a query filtra apenas `active` e `approved`, ignorando o checkbox do admin.
2. **Não há controle de visibilidade por categoria** -- o admin pode marcar produtos individuais mas não pode ocultar/mostrar uma categoria inteira de uma vez.
3. **Opções duplicadas no filtro de status** do AdminCatalog (linhas 314-317 repetem "Visível na UI" e "Oculto na UI").

### Implementação

#### 1. `src/pages/SupportResources.tsx`
- Adicionar `.eq("visible_in_ui", true)` na query de `system_a_catalog` (linha 68-72)
- Isso faz com que o checkbox do admin controle efetivamente o que aparece na página pública

#### 2. `src/components/AdminCatalog.tsx`
- **Remover opções duplicadas** no dropdown de status (linhas 316-317)
- **Adicionar botão "Selecionar/Desmarcar Categoria"**: ao lado do filtro de categoria, quando uma categoria estiver selecionada, mostrar dois botões:
  - "Tornar todos visíveis" -- faz `updateCatalogProduct` em batch para `visible_in_ui = true` em todos os produtos da categoria filtrada
  - "Ocultar todos" -- faz `visible_in_ui = false` em batch
- Isso permite ao admin controlar a visibilidade de uma categoria inteira de uma vez

#### 3. Ações em batch no `AdminCatalog.tsx`
- Adicionar função `handleBatchVisibility(visible: boolean)` que:
  1. Filtra os produtos pela categoria selecionada
  2. Para cada produto, chama `updateCatalogProduct(id, { visible_in_ui: visible })`
  3. Atualiza o state local
  4. Mostra toast com resultado

### Arquivos afetados
- **Editar**: `src/pages/SupportResources.tsx` -- adicionar filtro `visible_in_ui`
- **Editar**: `src/components/AdminCatalog.tsx` -- remover duplicatas, adicionar batch visibility

