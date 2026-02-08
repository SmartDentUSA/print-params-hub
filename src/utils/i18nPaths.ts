/**
 * Returns the base path for the knowledge base based on the current language.
 */
export function getKnowledgeBasePath(language: string): string {
  switch (language) {
    case 'en':
      return '/en/knowledge-base';
    case 'es':
      return '/es/base-conocimiento';
    default:
      return '/base-conhecimento';
  }
}

/**
 * Returns the og:locale value based on the current language.
 */
export function getOgLocale(language: string): string {
  switch (language) {
    case 'en':
      return 'en_US';
    case 'es':
      return 'es_ES';
    default:
      return 'pt_BR';
  }
}

/**
 * Returns the translated title from a knowledge article based on the current language.
 */
export function getLocalizedTitle(article: any, language: string): string {
  if (language === 'es' && article.title_es) return article.title_es;
  if (language === 'en' && article.title_en) return article.title_en;
  return article.title;
}

/**
 * Returns the translated excerpt from a knowledge article based on the current language.
 */
export function getLocalizedExcerpt(article: any, language: string): string {
  if (language === 'es' && article.excerpt_es) return article.excerpt_es;
  if (language === 'en' && article.excerpt_en) return article.excerpt_en;
  return article.excerpt;
}
