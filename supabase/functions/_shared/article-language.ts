export type ArticleLanguage = 'pt' | 'en' | 'es';

/** Repair URL auto-linking that older editors accidentally applied inside JSON-LD. */
export function repairArticleJsonLd(html: string): string {
  return html.replace(/<script\b([^>]*\btype\s*=\s*["']application\/ld\+json["'][^>]*)>([\s\S]*?)<\/script>/gi, (whole, attrs, json) => {
    try { JSON.parse(json); return whole; } catch { /* Try only the known auto-link corruption. */ }
    const repaired = json.replace(/<a\s[^>]*>(https?:\/\/[^<]+)<\/a>/gi, '$1');
    try {
      const value = JSON.parse(repaired);
      return `<script${attrs}>${JSON.stringify(value).replace(/</g, '\\u003c')}</script>`;
    } catch { return whole; }
  });
}

export function hasArticleTranslation(article: any, language: ArticleLanguage): boolean {
  return language === 'pt' || Boolean(article[`title_${language}`]?.trim() && article[`content_html_${language}`]?.trim());
}

export function localizeArticle(article: any, requested: ArticleLanguage) {
  const language = hasArticleTranslation(article, requested) ? requested : 'pt';
  const path = language === 'en' ? '/en/knowledge-base' : language === 'es' ? '/es/base-conocimiento' : '/base-conhecimento';
  const locale = language === 'en' ? 'en-US' : language === 'es' ? 'es-ES' : 'pt-BR';
  if (language === 'pt') return { content: { ...article, content_html: repairArticleJsonLd(article.content_html || '') }, language, path, locale };
  const html = repairArticleJsonLd(article[`content_html_${language}`]);
  const excerpt = article[`excerpt_${language}`] || html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
  return { language, path, locale, content: { ...article,
    title: article[`title_${language}`], content_html: html, excerpt,
    meta_description: excerpt, faqs: article[`faqs_${language}`] || [],
    ai_context: article[`ai_context_${language}`] || null,
  } };
}
