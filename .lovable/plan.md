

## Fix: URLs com "/undefined/" na Base de Conhecimento

### Problema
URLs de artigos geram `/base-conhecimento/undefined/slug` porque em alguns contextos o JOIN com `knowledge_categories` não retorna o `letter`, resultando em `undefined`.

### Mudanças

#### 1. Criar utilitário centralizado `getArticleUrl`
**Novo: `src/utils/knowledgeUrls.ts`**
- Função `getArticleUrl(article, language)` que constrói a URL defensivamente
- Se `category.letter` estiver ausente, faz fallback para `/base-conhecimento/{slug}` e emite `console.warn`
- Reutilizada em todos os componentes

#### 2. Rota de fallback no React Router
**`src/App.tsx`**
- Adicionar rota `/base-conhecimento/:slug` (e equivalentes en/es) que busca o artigo por slug, resolve o `category.letter` e faz `navigate(replace: true)` para a URL canônica

#### 3. Corrigir URL em `KnowledgeContentViewer.tsx` (linha 655)
- Trocar construção inline por `getArticleUrl(article, language)` nos artigos relacionados

#### 4. Corrigir URL em `KnowledgeFeed.tsx` (linha 136)
- Trocar construção inline por `getArticleUrl(article, language)` no carousel de artigos recentes

#### 5. Filtrar categorias desabilitadas nos links
- Em `KnowledgeFeed.tsx` e `KnowledgeContentViewer.tsx`, não renderizar como link clicável se `category.enabled === false`
- Artigos de categorias desabilitadas continuam acessíveis por URL direta (já funciona)

#### 6. Garantir JOINs nas queries
- `useLatestKnowledgeArticles.ts`: já tem `knowledge_categories(name, letter)` — OK
- `useKnowledge.ts > fetchRelatedContents`: já tem `knowledge_categories(*)` — OK
- `useKnowledge.ts > fetchContentsByCategory`: já tem `knowledge_categories!inner(*)` — OK
- Todas as queries já incluem o JOIN. O problema real é que `knowledge_categories` retorna como nome da relação, não como `category`. Ajustar o utilitário para aceitar ambos os formatos (`article.category` e `article.knowledge_categories`)

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/utils/knowledgeUrls.ts` | Novo — função `getArticleUrl` |
| `src/App.tsx` | +3 rotas de fallback (pt/en/es) |
| `src/components/KnowledgeContentViewer.tsx` | Usar `getArticleUrl` linha 655 |
| `src/components/KnowledgeFeed.tsx` | Usar `getArticleUrl` linha 136, filtrar disabled |
| `src/pages/KnowledgeBase.tsx` | Nova lógica: se `contentSlug` sem `categoryLetter`, buscar e redirect |

