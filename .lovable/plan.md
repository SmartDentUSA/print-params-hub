

## Plano: Corrigir Vitality, adicionar visibilidade no admin, mostrar docs de produtos

### Problemas identificados

1. **Vitality "Apresentações (1)" mas nada aparece**: A presentation existe no banco mas com `label = ""`, `price = 0`, todos campos zerados. O card renderiza o container vazio porque todos os `>0` checks falham e `label` é vazio. Precisa mostrar pelo menos "Sem dados preenchidos" quando a presentation existe mas está vazia.

2. **Admin Catálogo sem controle de visibilidade**: A tabela `AdminCatalog` não tem coluna de checkbox para `visible_in_ui`. O admin não consegue habilitar/desabilitar a visibilidade dos produtos na UI pública.

3. **Documentos dos produtos não aparecem**: Os `catalog_documents` têm URLs malformadas (ex: `https://...supabase.co/storage/.../https://loja.smartdent.com.br/...`). A validação `isValidUrl` passa, mas os links estão quebrados. Além disso, a query está correta mas poucos produtos têm docs cadastrados (apenas 2 registros existem na tabela).

### Implementação

#### 1. `src/pages/SupportResources.tsx`
- Quando uma presentation existe mas todos os valores são zero/vazio, mostrar "Dados pendentes de preenchimento" em vez de um card vazio
- Manter a contagem correta no trigger do accordion

#### 2. `src/components/AdminCatalog.tsx`
- Adicionar coluna **"Visível"** na tabela com um `Checkbox` para toggle de `visible_in_ui`
- Ao clicar, chamar `updateCatalogProduct(id, { visible_in_ui: !current })` diretamente
- Adicionar filtro de status "Visível na UI" / "Oculto na UI" no dropdown de filtros
- Importar o componente `Checkbox` de `@/components/ui/checkbox`

#### 3. `src/components/AdminCatalog.tsx` (documentos)
- Exibir contagem de documentos por produto na tabela (badge com número de docs)
- Buscar contagem de `catalog_documents` agrupada por `product_id` no `loadData`

### Arquivos afetados
- **Editar**: `src/pages/SupportResources.tsx` — tratar presentations vazias
- **Editar**: `src/components/AdminCatalog.tsx` — adicionar coluna checkbox `visible_in_ui`, filtro, e contagem de docs

