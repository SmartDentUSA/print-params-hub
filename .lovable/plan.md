

## Plano: Remover badges de subcategoria dos cards de resinas

Remover os badges "BIOCOMPATÍVEIS" e "USO GERAL" que foram adicionados nos cards de resinas em `src/pages/SupportResources.tsx`.

### Alteração
- Remover o bloco de renderização do badge `product.subcategory` no card (o `<span>` com classes `bg-emerald-100` / `bg-sky-100`)
- Opcionalmente, remover o campo `subcategory` da interface e da lógica de fetch, já que não será mais usado na UI

### Arquivo afetado
- `src/pages/SupportResources.tsx`

