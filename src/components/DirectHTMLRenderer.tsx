import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface DirectHTMLRendererProps {
  htmlContent: string;
  deviceMode?: 'mobile' | 'tablet' | 'desktop';
}

export function DirectHTMLRenderer({ htmlContent, deviceMode = 'desktop' }: DirectHTMLRendererProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Clean schema.org microdata that leaks as visible text
  const cleanSchemaMarkup = (html: string): string => {
    try {
      let cleaned = html.replace(/\s*itemscope\s*/gi, ' ');
      cleaned = cleaned.replace(/\s*itemtype="https?:\/\/schema\.org\/[^"]*"/gi, '');
      cleaned = cleaned.replace(/\s*itemprop="[^"]*"/gi, '');
      cleaned = cleaned.replace(/https?:\/\/schema\.org\/\w+"\s*>/gi, '');
      cleaned = cleaned.replace(/<a\s[^>]*href="https?:\/\/schema\.org\/[^"]*"[^>]*>[^<]*<\/a>/gi, '');
      cleaned = cleaned.replace(/\s*itemtype="<a\s[^>]*href="https?:\/\/schema\.org\/[^"]*"[^>]*>[^<]*<\/a>"/gi, '');
      cleaned = cleaned.replace(/\s*itemscope=""/gi, '');
      // Safeguard: never return empty if input had content
      if (!cleaned.trim() && html.trim()) {
        console.warn('DirectHTMLRenderer: cleanSchemaMarkup zeroed content, returning original');
        return html;
      }
      return cleaned;
    } catch (err) {
      console.error('DirectHTMLRenderer: cleanSchemaMarkup error, returning original', err);
      return html;
    }
  };

  // Process HTML to add IDs to headings for better LLM citation
  const processHTML = (html: string): string => {
    let counter = 0;
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

  // Process external links + intercept clicks on placeholder/internal links
  useEffect(() => {
    if (!contentRef.current) return;

    const links = contentRef.current.querySelectorAll('a[href^="http"]');
    links.forEach((link) => {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    });

    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a');
      if (!target) return;

      const href = target.getAttribute('href');

      // Block placeholder links
      if (!href || href === '#' || href.startsWith('javascript:')) {
        e.preventDefault();
        return;
      }

      // Intercept internal knowledge base links → use React Router
      if (href.startsWith('/base-conhecimento/') || href.startsWith('/en/knowledge-base/') || href.startsWith('/es/base-conocimiento/')) {
        e.preventDefault();
        navigate(href);
      }
    };

    const container = contentRef.current;
    container.addEventListener('click', handleClick);
    return () => container.removeEventListener('click', handleClick);
  }, [htmlContent, navigate]);

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