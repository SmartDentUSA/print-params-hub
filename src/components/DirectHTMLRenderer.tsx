import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface DirectHTMLRendererProps {
  htmlContent: string;
  deviceMode?: 'mobile' | 'tablet' | 'desktop';
}

export function DirectHTMLRenderer({ htmlContent, deviceMode = 'desktop' }: DirectHTMLRendererProps) {
  const contentRef = useRef<HTMLDivElement>(null);

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

  const processedHTML = processHTML(htmlContent);

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
