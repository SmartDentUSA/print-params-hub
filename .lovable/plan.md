## Problema
Os badges de categoria nos cards da Base de Conhecimento (`KbContentCard`) renderizam o campo cru `categoryName` vindo de `knowledge_categories.name` (PT), então em `/en` e `/es` aparecem rótulos como "Vídeos Tutoriais", "Casos Clínicos", "Catálogo de Produtos" ao invés das versões traduzidas.

As chaves já existem em `src/locales/{pt,en,es}.json` (`kb.chips.videos_tutoriais`, `kb.chips.casos_clinicos`, `kb.chips.ciencia`, `kb.chips.depoimentos`, `kb.chips.catalogo_produtos`, `kb.chips.falhas`, `kb.chips.parametros`) e o mapeamento `category UUID → translation key` já está nos arrays `CHIPS` de `KbTabVideos.tsx` e `KbTabArtigos.tsx`.

## Mudanças

### 1) `src/components/knowledge/kbCategoryTaxonomy.ts`
Adicionar um único mapa canônico `CATEGORY_ID_TO_TK` (UUID → token i18n) reunindo as 6 categorias usadas em vídeos/artigos (tutoriais, casos clínicos, ciência, depoimentos, catálogo de produtos, falhas, parâmetros). Exportar também helper `resolveCategoryTk(id, fallbackName)` que devolve o token ou `null`.

### 2) `src/components/knowledge/KbContentCard.tsx`
- Estender a interface `data` com `categoryTk?: string | null`.
- Renderizar o label como `t(data.categoryTk, { defaultValue: data.categoryName })` quando `categoryTk` estiver presente; caso contrário manter `data.categoryName` como hoje (fallback seguro para qualquer categoria sem mapeamento).
- Importar `useTranslation` (`react-i18next`).

### 3) `src/components/knowledge/KbTabVideos.tsx` e `KbTabArtigos.tsx`
- Trazer `categoryId: r.knowledge_categories?.id` no mapeamento de cards.
- Calcular `categoryTk` via `CATEGORY_ID_TO_TK[categoryId]` (ou via lookup nos próprios arrays `CHIPS` já existentes) e passar para `KbContentCard` no objeto `data`.

### 4) `src/components/knowledge/KbTabCatalogo.tsx`
- Para cards do catálogo, derivar `categoryTk` a partir do mapa `CAT_TO_CHIP_TK` já existente (chave = `normCat(product_category)`), passando-o ao `KbContentCard`. Continua usando `kb.chips.catalogo_produtos` como default quando não houver match de subcategoria canônica.

## Fora de escopo
- Não traduzir conteúdo dos cards (título/excerpt) — já tratado por `useCardTranslations`.
- Não tocar nos chips de filtro (já estão usando `t(tk)`).
- Não alterar `KnowledgeFeed.tsx` (já usa `getCategoryName(letter)` traduzido).

## Validação
Abrir `/en/knowledge-base?tab=videos`, `/es/...?tab=casos`, `/en/...?tab=catalogo`, conferir que cada card exibe o badge na língua ativa e que cards de categoria desconhecida ainda mostram o nome cru sem quebrar.
