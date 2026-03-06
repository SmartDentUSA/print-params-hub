// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATE ENGINE — Builds complete HTML document with JSON-LD, SEO head,
// GEO context, E-E-A-T schemas, and performance optimizations
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  buildSeoHead,
  buildHreflangTags,
  buildGeoContextBlock,
  buildSpeakableSpecification,
  DEFAULT_SPEAKABLE_SELECTORS,
  PERFORMANCE_CSS,
  getSiteBaseUrl,
  escapeHtml,
  type HreflangEntry,
} from '../_shared/seo-fine-tuning.ts';
import {
  buildOrganizationSchema,
  buildPersonSchema,
  buildAggregateRating,
  getDefaultAuthor,
  SMARTDENT_COMPANY,
  type KOLAuthor,
} from '../_shared/authority-data-helper.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export interface TemplateEngineInput {
  // Content
  title: string;
  description: string;
  slug: string;
  bodyHtml: string;           // The <article> HTML from AI
  language?: string;          // 'pt-BR' | 'en' | 'es'

  // SEO
  canonical?: string;         // Full URL — auto-built from slug if omitted
  ogImage?: string;
  robots?: string;
  hreflangEntries?: HreflangEntry[];

  // Schemas
  pageType: 'blog' | 'landing-page' | 'product' | 'faq';
  productName?: string;
  productDescription?: string;
  productImage?: string;
  productSku?: string;
  productPrice?: number;
  productCurrency?: string;

  // E-E-A-T
  author?: KOLAuthor;
  ratingValue?: number;
  reviewCount?: number;
  datePublished?: string;
  dateModified?: string;

  // FAQs
  faqs?: { question: string; answer: string }[];

  // HowTo
  howToSteps?: { name: string; text: string }[];

  // GEO
  geoProductName?: string;
  geoCategory?: string;

  // Breadcrumbs
  breadcrumbs?: { name: string; url: string }[];
}

export interface TemplateEngineOutput {
  html: string;
  stats: TemplateStats;
}

export interface TemplateStats {
  htmlSizeBytes: number;
  h1Count: number;
  imgWithoutAlt: number;
  hasCanonical: boolean;
  hasJsonLd: boolean;
  hasSpeakable: boolean;
  hasHreflang: boolean;
  hasFaqSchema: boolean;
  hasHowToSchema: boolean;
  score: number; // 0-10 composite SEO/GEO/E-E-A-T/AI score
  warnings: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// JSON-LD BUILDERS
// ═══════════════════════════════════════════════════════════════════════════

function buildArticleSchema(input: TemplateEngineInput, canonical: string, author: KOLAuthor): object {
  const rating = input.ratingValue && input.reviewCount
    ? buildAggregateRating(input.ratingValue, input.reviewCount)
    : null;

  return {
    '@context': 'https://schema.org',
    '@type': input.pageType === 'blog' ? 'Article' : 'WebPage',
    '@id': canonical,
    headline: input.title,
    description: input.description,
    url: canonical,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    datePublished: input.datePublished || new Date().toISOString().split('T')[0],
    dateModified: input.dateModified || new Date().toISOString().split('T')[0],
    author: {
      '@type': 'Person',
      name: author.name,
      url: `${SMARTDENT_COMPANY.url}/autores/${author.id}`,
    },
    publisher: {
      '@type': 'Organization',
      name: SMARTDENT_COMPANY.name,
      logo: { '@type': 'ImageObject', url: SMARTDENT_COMPANY.logo },
    },
    image: input.ogImage
      ? { '@type': 'ImageObject', url: input.ogImage, width: 1200, height: 630 }
      : undefined,
    ...(rating ? { aggregateRating: rating } : {}),
    speakable: buildSpeakableSpecification(DEFAULT_SPEAKABLE_SELECTORS),
    about: input.productName
      ? [{ '@type': 'Thing', name: input.productName }]
      : undefined,
    mentions: input.productName
      ? [{ '@type': 'Product', name: input.productName }]
      : undefined,
    inLanguage: input.language || 'pt-BR',
  };
}

function buildProductSchema(input: TemplateEngineInput, canonical: string): object | null {
  if (!input.productName) return null;
  const rating = input.ratingValue && input.reviewCount
    ? buildAggregateRating(input.ratingValue, input.reviewCount)
    : null;

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.productName,
    description: input.productDescription || input.description,
    url: canonical,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    ...(input.productImage ? { image: input.productImage } : {}),
    ...(input.productSku ? { sku: input.productSku } : {}),
    brand: { '@type': 'Brand', name: 'SmartDent' },
    manufacturer: {
      '@type': 'Organization',
      name: SMARTDENT_COMPANY.name,
      url: SMARTDENT_COMPANY.url,
    },
    ...(input.productPrice
      ? {
          offers: {
            '@type': 'Offer',
            priceCurrency: input.productCurrency || 'BRL',
            price: input.productPrice,
            availability: 'https://schema.org/InStock',
            url: canonical,
            seller: { '@type': 'Organization', name: SMARTDENT_COMPANY.name },
          },
        }
      : {}),
    ...(rating ? { aggregateRating: rating } : {}),
  };
}

function buildFAQSchema(faqs: { question: string; answer: string }[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

function buildHowToSchema(
  title: string,
  steps: { name: string; text: string }[]
): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: title,
    step: steps.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: s.name,
      text: s.text,
    })),
  };
}

function buildBreadcrumbSchema(
  breadcrumbs: { name: string; url: string }[]
): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((b, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: b.name,
      item: b.url,
    })),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// STATS ANALYZER
// ═══════════════════════════════════════════════════════════════════════════

function analyzeHtml(html: string, schemas: object[]): TemplateStats {
  const warnings: string[] = [];
  const h1Count = (html.match(/<h1[\s>]/gi) || []).length;
  const imgWithoutAlt = (html.match(/<img(?![^>]*\balt=)[^>]*>/gi) || []).length;
  const hasCanonical = html.includes('rel="canonical"');
  const hasJsonLd = html.includes('application/ld+json');
  const hasSpeakable = html.includes('SpeakableSpecification');
  const hasHreflang = html.includes('rel="alternate"');
  const hasFaqSchema = html.includes('"FAQPage"');
  const hasHowToSchema = html.includes('"HowTo"');
  const htmlSizeBytes = new TextEncoder().encode(html).length;

  if (h1Count === 0) warnings.push('CRITICO: Nenhum H1 encontrado');
  if (h1Count > 1) warnings.push(`ALTO: ${h1Count} H1 encontrados — deve haver exatamente 1`);
  if (imgWithoutAlt > 0) warnings.push(`ALTO: ${imgWithoutAlt} imagens sem alt text`);
  if (!hasHreflang) warnings.push('MEDIO: Sem hreflang — conteúdo multilíngue não declarado');
  if (!hasFaqSchema) warnings.push('MEDIO: Sem FAQPage schema');
  if (htmlSizeBytes > 200_000) warnings.push(`MEDIO: HTML muito grande (${Math.round(htmlSizeBytes / 1024)}KB > 200KB)`);

  // Score 0-10
  let score = 0;
  if (hasCanonical) score += 1;
  if (hasJsonLd) score += 2;
  if (hasSpeakable) score += 1;
  if (hasHreflang) score += 1;
  if (hasFaqSchema) score += 1;
  if (hasHowToSchema) score += 0.5;
  if (h1Count === 1) score += 1;
  if (imgWithoutAlt === 0) score += 0.5;
  if (html.includes('font-display')) score += 0.5;
  if (html.includes('fetchpriority')) score += 0.5;
  score = Math.min(10, Math.round(score * 10) / 10);

  return {
    htmlSizeBytes,
    h1Count,
    imgWithoutAlt,
    hasCanonical,
    hasJsonLd,
    hasSpeakable,
    hasHreflang,
    hasFaqSchema,
    hasHowToSchema,
    score,
    warnings,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN BUILDER
// ═══════════════════════════════════════════════════════════════════════════

export function buildDocument(input: TemplateEngineInput): TemplateEngineOutput {
  const baseUrl = getSiteBaseUrl();
  const canonical = input.canonical || `${baseUrl}/blog/${input.slug}`;
  const lang = input.language || 'pt-BR';
  const author = input.author || getDefaultAuthor();

  const hreflangEntries = input.hreflangEntries || [
    { lang: 'pt-BR', url: `${baseUrl}/blog/${input.slug}` },
    { lang: 'en', url: `${baseUrl}/en/blog/${input.slug}` },
    { lang: 'es', url: `${baseUrl}/es/blog/${input.slug}` },
  ];

  // Build all JSON-LD schemas
  const schemas: object[] = [
    buildOrganizationSchema(),
    buildArticleSchema(input, canonical, author),
    buildPersonSchema(author, canonical),
  ];

  if (input.productName) {
    const productSchema = buildProductSchema(input, canonical);
    if (productSchema) schemas.push(productSchema);
  }

  if (input.faqs && input.faqs.length > 0) {
    schemas.push(buildFAQSchema(input.faqs));
  }

  if (input.howToSteps && input.howToSteps.length > 0) {
    schemas.push(buildHowToSchema(input.title, input.howToSteps));
  }

  if (input.breadcrumbs && input.breadcrumbs.length > 0) {
    schemas.push(buildBreadcrumbSchema(input.breadcrumbs));
  }

  const jsonLdTags = schemas
    .map((s) => `<script type="application/ld+json">\n${JSON.stringify(s, null, 2)}\n</script>`)
    .join('\n');

  const seoHead = buildSeoHead({
    title: input.title,
    description: input.description,
    canonical,
    ogImage: input.ogImage,
    ogType: input.pageType === 'blog' ? 'article' : 'website',
    hreflangEntries,
    robots: input.robots,
    language: lang,
  });

  const geoBlock = buildGeoContextBlock({
    productName: input.geoProductName || input.productName || input.title,
    category: input.geoCategory || 'odontologia digital',
    manufacturer: 'SmartDent',
    country: 'Brasil',
  });

  const breadcrumbNav = input.breadcrumbs && input.breadcrumbs.length > 0
    ? `<nav aria-label="Breadcrumb">
  <ol class="breadcrumb">
    ${input.breadcrumbs.map((b, i) =>
      i < input.breadcrumbs!.length - 1
        ? `<li><a href="${b.url}">${escapeHtml(b.name)}</a></li>`
        : `<li aria-current="page">${escapeHtml(b.name)}</li>`
    ).join('\n    ')}
  </ol>
</nav>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="${lang}" dir="ltr">
${seoHead}
<body>
${jsonLdTags}

${geoBlock}

<header role="banner">
  <a href="${baseUrl}" rel="home">
    <img src="${SMARTDENT_COMPANY.logo}" alt="SmartDent" width="160" height="40" loading="eager" fetchpriority="high" />
  </a>
</header>

<main role="main">
  ${breadcrumbNav}

  ${input.bodyHtml}
</main>

<footer role="contentinfo">
  <p>&copy; ${new Date().getFullYear()} ${SMARTDENT_COMPANY.legalName} — <a href="${baseUrl}/privacidade">Privacidade</a></p>
</footer>

<style>
${PERFORMANCE_CSS}
</style>
</body>
</html>`;

  const stats = analyzeHtml(html, schemas);

  return { html, stats };
}

// ═══════════════════════════════════════════════════════════════════════════
// HTTP HANDLER
// ═══════════════════════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const input: TemplateEngineInput = await req.json();

    if (!input.title || !input.description || !input.slug || !input.bodyHtml) {
      return new Response(
        JSON.stringify({ success: false, error: 'title, description, slug, bodyHtml are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const output = buildDocument(input);

    return new Response(JSON.stringify({ success: true, ...output }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Template Engine error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
