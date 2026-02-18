
# Excluir Categoria F ("Parâmetros Técnicos") das Últimas Publicações

## Diagnóstico

No hook `useLatestKnowledgeArticles.ts`, a query atual busca **todos os artigos ativos** sem filtrar por categoria. Os dados de categoria já chegam no resultado via `knowledge_categories(name, letter)`.

A categoria F já é tratada como "oculta mas acessível via URL direta" no `KnowledgeBase.tsx` (linha `setCategories(cats.filter(c => c.enabled))`), mas esse filtro não é aplicado no feed de popularidade.

## Solução

**Arquivo:** `src/hooks/useLatestKnowledgeArticles.ts`

Adicionar um `.filter()` logo após a query de artigos, antes do sort por views, excluindo qualquer artigo cuja `knowledge_categories.letter` seja `'F'`:

```typescript
// Filtrar artigos da categoria F (Parâmetros Técnicos)
const filteredArticles = (articlesData || []).filter(
  article => article.knowledge_categories?.letter?.toUpperCase() !== 'F'
);
```

E então aplicar o sort e slice em `filteredArticles` ao invés de `articlesData`.

## Impacto

| | Antes | Depois |
|---|---|---|
| Categoria F no feed | Aparece | Excluída |
| Outras categorias | Inalteradas | Inalteradas |
| Ordenação por views | Mantida | Mantida |
| Fallback por data | Mantido | Mantido |

## Seção Técnica

A filtragem é feita **client-side** após o fetch, sem nenhuma alteração na query SQL. Isso é intencional: a categoria F permanece acessível via URL direta (ex: `/base-conhecimento/f/slug`), apenas não aparece no carrossel da página inicial. Nenhuma migração de banco é necessária.

**Arquivo alterado:** `src/hooks/useLatestKnowledgeArticles.ts` (1 linha de mudança funcional)
