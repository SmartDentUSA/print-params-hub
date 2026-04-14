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
 * Falls back to `/base-conhecimento/{slug}` if letter is missing.
 */
export function getArticleUrl(article: ArticleWithCategory, language: string = 'pt'): string {
  const basePath = getKnowledgeBasePath(language);
  const cat = article.category || article.knowledge_categories;
  const letter = cat?.letter?.toLowerCase();

  if (!letter) {
    console.warn('[KnowledgeBase] article sem category.letter:', article.slug);
    return `${basePath}/${article.slug}`;
  }

  return `${basePath}/${letter}/${article.slug}`;
}

/**
 * Checks if an article's category is enabled for navigation links.
 */
export function isCategoryEnabled(article: ArticleWithCategory): boolean {
  const cat = article.category || article.knowledge_categories;
  return cat?.enabled !== false;
}
