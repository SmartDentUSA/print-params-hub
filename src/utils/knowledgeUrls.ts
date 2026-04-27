import { getKnowledgeBasePath } from './i18nPaths';

interface ArticleWithCategory {
  slug: string;
  category?: { letter?: string; enabled?: boolean } | null;
  knowledge_categories?: { letter?: string; enabled?: boolean } | null;
  category_id?: string;
}

/**
 * Builds a knowledge article URL defensively.
 * Accepts both `article.category` and `article.knowledge_categories` formats.
 * Falls back to category 'g' (Catálogo de Produtos) if letter is missing —
 * NEVER emits `undefined` in the path. This prevents reindexing /undefined/ URLs in GSC.
 */
export function getArticleUrl(article: ArticleWithCategory, language: string = 'pt'): string {
  const basePath = getKnowledgeBasePath(language);
  const cat = article.category || article.knowledge_categories;
  const rawLetter = cat?.letter;

  if (!rawLetter) {
    console.warn('[KnowledgeBase] article sem category.letter, usando fallback "g":', article.slug);
    return `${basePath}/g/${article.slug}`;
  }

  return `${basePath}/${rawLetter.toLowerCase()}/${article.slug}`;
}

/**
 * Defensive helper for inline URL building. Returns a safe lowercase letter
 * or 'g' as fallback — NEVER returns 'undefined' as a string.
 */
export function safeCategoryLetter(letter?: string | null): string {
  if (!letter || typeof letter !== 'string' || letter.trim().length === 0) return 'g';
  return letter.toLowerCase();
}

/**
 * Checks if an article's category is enabled for navigation links.
 */
export function isCategoryEnabled(article: ArticleWithCategory): boolean {
  const cat = article.category || article.knowledge_categories;
  return cat?.enabled !== false;
}
