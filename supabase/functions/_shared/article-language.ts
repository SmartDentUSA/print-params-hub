export type ArticleLanguage = 'pt' | 'en' | 'es';

export function hasArticleTranslation(article: any, language: ArticleLanguage): boolean {
  return language === 'pt' || Boolean(article[`title_${language}`]?.trim() && article[`content_html_${language}`]?.trim());
}

export function localizeArticle(article: any, requested: ArticleLanguage) {
  const language = hasArticleTranslation(article, requested) ? requested : 'pt';
  const path = language === 'en' ? '/en/knowledge-base' : language === 'es' ? '/es/base-conocimiento' : '/base-conhecimento';
  const locale = language === 'en' ? 'en-US' : language === 'es' ? 'es-ES' : 'pt-BR';
  if (language === 'pt') return { content: article, language, path, locale };
  const html = article[`content_html_${language}`];
  const excerpt = article[`excerpt_${language}`] || html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
  return { language, path, locale, content: { ...article,
    title: article[`title_${language}`], content_html: html, excerpt,
    meta_description: excerpt, faqs: article[`faqs_${language}`] || [],
    ai_context: article[`ai_context_${language}`] || null,
  } };
}
