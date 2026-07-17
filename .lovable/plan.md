## Problema encontrado

Para "Resina 3D Smart Print Bio Bite Splint +Flex" a coluna **Docs** mostra `0`, mas o produto tem documentos em duas fontes:

- 3 documentos em `catalog_documents` — porém apontam para uma **linha duplicada** de `system_a_catalog` (`4aa4c2de…`, `active=false`, `visible=false`), enquanto a linha visível no admin é `10f52620…` (`active=true`). Os dois registros têm exatamente o mesmo `name` e o mesmo `slug` `resina-3d-smart-print-bio-bite-splint-flex-duravel`.
- 2 documentos em `resin_documents` para a resina canônica `f205c863…`, cujo slug é `resina-3d-smart-print-bio-bite-splint-flex` (sem `-duravel`). O `useCatalogDocCounts` faz JOIN estrito por `slug` idêntico e por isso a resina nunca casa com o mirror.

Portanto o hook atual sub-conta em dois cenários reais: (a) linha duplicada no espelho e (b) drift de slug entre resina canônica e mirror.

## O que fazer (somente leitura — nada muda em `resins`, `resin_documents`, `catalog_documents`, `system_a_catalog`)

Reescrever `src/hooks/useCatalogDocCounts.ts` para agregar por identidade "lógica" do produto:

1. **catalog_documents**: em vez de contar apenas por `product_id = <row.id>`, buscar o conjunto de `system_a_catalog.id` que compartilha o mesmo `(slug)` (fallback: mesmo `name` normalizado) do produto exibido e somar `catalog_documents.active = true` de todos eles. Assim, docs pendurados na linha-gêmea inativa aparecem no card visível. Deduplicar por `file_hash` (quando existir) ou `file_url` para não contar o mesmo PDF duas vezes.

2. **resin_documents**: casar `system_a_catalog` ↔ `resins` por cascata:
   - `slug` idêntico (atual).
   - fallback: `slug` sem sufixos comuns (`-duravel`, `-flex`, `-premium`) — comparação de "slug base".
   - fallback: `lower(trim(name))` idêntico entre `system_a_catalog.name` e `resins.name` (após remover prefixo "Resina 3D " opcional).
   Somar `resin_documents` de todos os `resin_id` casados. Deduplicar por `file_hash`/`file_url`.

3. Tooltip do badge continua mostrando "Catálogo: X · Resinas: Y", agora refletindo o total agregado.

Nenhuma dedupe/merge de linhas do catálogo é feita — apenas leitura agregada para exibição.

## Arquivos

**Alterado**
- `src/hooks/useCatalogDocCounts.ts` — nova lógica de agregação por slug/nome com dedupe por hash. Interface `DocCount` inalterada; `AdminCatalogTable.tsx` não precisa mudar.

**Não muda**
- `src/components/AdminCatalogTable.tsx`
- `src/components/AdminCatalog.tsx`
- Nenhuma migration, nenhuma escrita em banco.

## Detalhes técnicos

- Slug-base regex sugerida: `slug.replace(/-(duravel|flex|premium|hd|plus)$/,'')`.
- Normalização de nome: `NFD` → strip diacríticos → `lower` → `trim` → colapsar múltiplos espaços → remover prefixo `resina 3d ` opcional.
- Consultas em lote (uma para `catalog_documents.in(slugs_group_ids)`, uma para `resins` por `slug` e por `slug_base`, uma para `resin_documents.in(resin_ids)`).
- Sem N+1: continua rodando em um único `useEffect` por página.

## Aceitação

- Card "Resina 3D Smart Print Bio Bite Splint +Flex" no admin passa a exibir `5` (3 catálogo + 2 resina), com tooltip "Catálogo: 3 · Resinas: 2".
- Bite Flex (docs só em `catalog_documents`) continua com o número correto.
- Resinas que só têm `resin_documents` continuam com o número correto.
- Nenhuma escrita em `resins`, `resin_documents`, `catalog_documents` ou `system_a_catalog`.

## Fora do escopo

- Deduplicar/mesclar as linhas gêmeas em `system_a_catalog`.
- Corrigir slugs divergentes entre mirror e `resins`.
- Repontar `catalog_documents.product_id` para a linha canônica.

Esses três itens são candidatos a um mutirão de limpeza futuro, mas dependem de decisão do usuário sobre qual linha é canônica; ficam para uma pauta separada.
