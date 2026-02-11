import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface DirectHTMLRendererProps {
  htmlContent: string;
  deviceMode?: 'mobile' | 'tablet' | 'desktop';
}

export function DirectHTMLRenderer({ htmlContent, deviceMode = 'desktop' }: DirectHTMLRendererProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  // Clean schema.org microdata that leaks as visible text
  const cleanSchemaMarkup = (html: string): string => {
    let cleaned = html.replace(/\s*itemscope\s*/gi, ' ');
    cleaned = cleaned.replace(/\s*itemtype="https?:\/\/schema\.org\/[^"]*"/gi, '');
    cleaned = cleaned.replace(/\s*itemprop="[^"]*"/gi, '');
    cleaned = cleaned.replace(/https?:\/\/schema\.org\/\w+"\s*>/gi, '');
    // Remove <a> tags linking to schema.org (created by reformatter)
    cleaned = cleaned.replace(/<a\s[^>]*href="https?:\/\/schema\.org\/[^"]*"[^>]*>[^<]*<\/a>/gi, '');
    // Fix itemtype attributes corrupted by reformatter (contains <a> tags instead of plain URL)
    cleaned = cleaned.replace(/\s*itemtype="<a\s[^>]*href="https?:\/\/schema\.org\/[^"]*"[^>]*>[^<]*<\/a>"/gi, '');
    // Clean leftover itemscope="" (empty)
    cleaned = cleaned.replace(/\s*itemscope=""/gi, '');
    return cleaned;
  };

  // Process HTML to add IDs to headings for better LLM citation
  const processHTML = (html: string): string => {
    let counter = 0;
    // Add IDs to h2, h3, h4 tags that don't have them
    return html.replace(/<(h[2-4])([^>]*)>/gi, (match, tag, attrs) => {
      counter++;
      if (attrs.includes('id=')) return match;
      const headingText = html.match(new RegExp(`${match}([^<]*)</${tag}>`))?.[1] || '';
      const slug = headingText
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      return `<${tag}${attrs} id="${slug || `section-${counter}`}">`;
    });
  };

  // Process external links to open in new tab
  useEffect(() => {
    if (!contentRef.current) return;

    const links = contentRef.current.querySelectorAll('a[href^="http"]');
    links.forEach((link) => {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    });
  }, [htmlContent]);

  const cleanedHTML = cleanSchemaMarkup(htmlContent);
  const processedHTML = processHTML(cleanedHTML);

  return (
    <article
      ref={contentRef}
      itemScope
      itemType="https://schema.org/TechArticle"
      className={cn(
        'article-content',
        deviceMode === 'mobile' && 'article-content-mobile',
        deviceMode === 'tablet' && 'article-content-tablet'
      )}
      data-section="main-content"
    >
      <div
        itemProp="articleBody"
        dangerouslySetInnerHTML={{ __html: processedHTML }}
      />
    </article>
  );
}
