

## Plano: Layout Sidebar + Conteúdo na página Support Resources

### Objetivo
Transformar a página `/support-resources` (categoria G) para usar o mesmo layout de duas colunas da Base de Conhecimento: **sidebar esquerda** com as categorias de produtos, e **área principal à direita** com os cards dos produtos da categoria selecionada.

### Layout

```text
┌──────────────────────────────────────────────────┐
│  Header + Hero                                   │
│  [Category Pills: A B C D E F [G]]               │
├────────────┬─────────────────────────────────────┤
│  Sidebar   │  Conteúdo                           │
│            │                                     │
│  Conteúdo  │  "Selecionar conteúdo"              │
│  ────────  │  (placeholder quando nenhuma         │
│  RESINAS   │   categoria selecionada)            │
│  SCANNERS  │                                     │
│  IMPRESSÃO │  Ou: Grid 4col desktop / 2col mobile│
│  ...       │  com cards dos produtos             │
│            │                                     │
└────────────┴─────────────────────────────────────┘
```

### Alterações em `src/pages/SupportResources.tsx`

1. **Adicionar sidebar esquerda** (grid `lg:grid-cols-4`, sidebar = 1 col, conteúdo = 3 col) — mesmo padrão do `KnowledgeBase.tsx`
2. **Sidebar mostra categorias** extraídas dos `product_category` dos produtos carregados (ex: "RESINAS 3D", "IMPRESSÃO 3D", "SCANNERS 3D")
3. **Ao clicar numa categoria**, filtrar e mostrar apenas os cards daquela categoria na área principal
4. **Sem categoria selecionada**: mostrar placeholder "Selecione uma categoria" (igual ao "Selecionar conteúdo" da KB)
5. **Filtro `visible_in_ui = true`** na query de produtos (correção do bug anterior)
6. **Buscar resinas** da tabela `resins` (active = true) — agrupadas na categoria "RESINAS 3D"
7. **Accordion em cada card** com:
   - Descrição do produto/resina
   - Documentos técnicos (PDFs)
   - Apresentações/SKUs (somente resinas — dados de `resin_presentations`)

### Dados buscados
- `system_a_catalog` com `visible_in_ui = true` + `catalog_documents`
- `resins` com `active = true` + `resin_documents` + `resin_presentations`

### Arquivo afetado
- **Reescrever**: `src/pages/SupportResources.tsx`

