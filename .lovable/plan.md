## Objetivo

Adicionar filtros de subcategoria na aba **Catálogo** da Base de Conhecimento e implementar autorização granular (categorias + subcategorias) na aba **Revendas**, com editor no SmartOps e exibição nos cards.

---

## 1) Catálogo — Subcategorias no filtro

Hoje os chips da aba Catálogo só filtram por categoria principal (`product_category`). Vamos adicionar uma segunda linha de chips logo abaixo, dinâmica:

- Quando o usuário seleciona uma categoria (ex.: `SCANNERS 3D`), aparece uma linha extra de chips com as subcategorias daquela categoria, derivadas de `system_a_catalog.product_subcategory` (distinct, ativos/aprovados/visíveis), em ordem alfabética + chip "Todas".
- Quando a categoria é `SOFTWARES` (ou `all`), a segunda linha **não aparece** — comportamento atual preservado, mostrando todos os softwares de qualquer subcategoria.
- Filtro combinado: categoria + subcategoria + termo de busca.

Arquivo: `src/components/knowledge/KbTabCatalogo.tsx` (sem mudança em schema).

---

## 2) Revendas — Autorização por categoria/subcategoria

### 2a) Banco — nova coluna em `distributors`

Migration adicionando:

```text
authorized_scope jsonb NOT NULL DEFAULT '{}'::jsonb
-- formato: { "SCANNERS 3D": ["SCANNER INTRAOAL (IOS)", "ACESSÓRIOS"], "RESINAS 3D": ["USO GERAL"] }
-- chave = product_category canônica; array = subcategorias autorizadas (vazio = todas daquela categoria)
```

JSONB foi escolhido em vez de duas colunas `text[]` porque preserva a relação categoria→subcategorias sem tabela auxiliar.

### 2b) Editor (`src/components/smartops/SmartOpsDistributors.tsx`)

Nova seção "Autorização Comercial" no dialog de edição:

- Carrega 1× o distinct de `(product_category, product_subcategory)` de `system_a_catalog` (mesma fonte do catálogo público).
- Para cada categoria canônica (com lista de aliases já existente em `KbTabCatalogo`), renderiza:
  - Checkbox da categoria (autoriza ela inteira).
  - Lista colapsável de subcategorias com checkboxes individuais.
- Estado salvo em `form.authorized_scope` (jsonb).
- Botão "Selecionar tudo" / "Limpar".

### 2c) Tab pública (`src/components/knowledge/KbTabDistribuidores.tsx`)

- Adiciona linha de chips de categoria acima da grade (mesmo componente `KbChips` usado em Catálogo / Vídeos / Artigos), incluindo chip "Todas".
- Filtra distribuidores onde `authorized_scope` contém a categoria selecionada (ou qualquer scope, no caso de "Todas").
- Em cada card, abaixo do nome, mostrar badges com as subcategorias autorizadas — agrupadas visualmente por categoria, usando as mesmas cores de `kbCategoryColors`. Se uma categoria está autorizada sem subcategorias específicas, mostra badge "Categoria · todas".
- Busca textual continua incluindo nome/cidade/estado/país.

---

## Detalhes técnicos

- **Fonte de verdade das subcategorias**: `system_a_catalog` (já é o que o Catálogo lê). Não precisamos do `workflow_cell_mappings` aqui — ele cobre o mapeamento 7×3 interno, e a UI de revendas precisa apenas refletir o que existe no catálogo público.
- **Normalização de categorias**: reutilizar `CAT_ALIASES` / `CANONICAL_CATS` de `KbTabCatalogo.tsx` extraindo para `src/components/knowledge/kbCategoryTaxonomy.ts` (novo módulo) e importando em ambos os lados (Catálogo, Distribuidores público, SmartOpsDistributors).
- **i18n**: novas chaves em `pt.json`/`en.json`/`es.json` (`kb.catalogo.subcategory_all`, `kb.distribuidores.chip_all`, `kb.distribuidores.authorized_label`, `smartops.distributors.scope_section`).
- **Sem mudança em RLS** — `distributors` já é lido pela tab pública via anon.

## Arquivos afetados

- Migration nova: `supabase/migrations/<timestamp>_distributors_authorized_scope.sql`
- Novo: `src/components/knowledge/kbCategoryTaxonomy.ts`
- Editado: `src/components/knowledge/KbTabCatalogo.tsx` (segunda linha de chips)
- Editado: `src/components/knowledge/KbTabDistribuidores.tsx` (chips + badges)
- Editado: `src/components/smartops/SmartOpsDistributors.tsx` (seção de autorização)
- Editado: `src/locales/{pt,en,es}.json`

## Fora do escopo

- Não mexe na coluna `numero_unidades` nem nos cards do Catálogo.
- Não altera roles/RLS.
- Não recategoriza dados existentes de `system_a_catalog`.
