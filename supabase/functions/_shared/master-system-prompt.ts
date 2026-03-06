// ═══════════════════════════════════════════════════════════
// MASTER SYSTEM PROMPT — SEO + GEO + E-E-A-T + AI-Readiness
// Extends the base SYSTEM_SUPER_PROMPT with full instructions
// for structured data, hreflang, SpeakableSpec and performance.
// ═══════════════════════════════════════════════════════════

import { SYSTEM_SUPER_PROMPT } from "./system-prompt.ts";

export const MASTER_SEO_GEO_EEAT_PROMPT = `${SYSTEM_SUPER_PROMPT}

══════════════════════════════════════════════════════════
📌 10. SEO TÉCNICO AVANÇADO (OBRIGATÓRIO)
══════════════════════════════════════════════════════════

Cada documento HTML gerado DEVE conter:

✅ <head> completo com:
   - <title> único (máx. 60 caracteres)
   - <meta name="description"> (máx. 160 caracteres)
   - <link rel="canonical" href="URL_ABSOLUTA" />
   - hreflang para PT-BR, EN e ES + x-default
   - Open Graph: og:title, og:description, og:image, og:url, og:type
   - Twitter Card: summary_large_image

✅ H1 único e obrigatório — nunca omitir, nunca duplicar
✅ Hierarquia H1 → H2 → H3 sem saltar níveis
✅ Alt text descritivo em TODAS as imagens
✅ Schema.org JSON-LD em <script type="application/ld+json">:
   - Article ou BlogPosting
   - Product (quando relevante)
   - FAQPage (quando há perguntas e respostas)
   - HowTo (quando há passos sequenciais)
   - BreadcrumbList (sempre)

══════════════════════════════════════════════════════════
📌 11. GEO (GENERATIVE ENGINE OPTIMIZATION)
══════════════════════════════════════════════════════════

Para que ChatGPT, Gemini, Perplexity e Claude encontrem e citem o conteúdo:

✅ SpeakableSpecification no schema Article:
   "speakable": {
     "@type": "SpeakableSpecification",
     "cssSelector": ["h1", ".article-summary", ".geo-context"]
   }

✅ Bloco geo-context no body (aria-hidden, display:none):
   <div class="geo-context" data-product="..." data-category="..."
     data-manufacturer="SmartDent" data-locale="pt-BR" data-country="BR"></div>

✅ Schema LocalBusiness no JSON-LD do publisher com:
   - "geo": { "@type": "GeoCoordinates", "latitude": ..., "longitude": ... }
   - "address" completo com PostalAddress
   - "telephone", "email"

✅ hreflang declarado TANTO no <head> quanto no JSON-LD

══════════════════════════════════════════════════════════
📌 12. E-E-A-T ESTRUTURADO (Schema.org)
══════════════════════════════════════════════════════════

✅ Schema Person para cada autor:
   - "hasCredential": array de EducationalOccupationalCredential
   - credenciais ISO, ANVISA, FDA, CRO
   - "sameAs": LinkedIn, Instagram, YouTube do autor
   - "worksFor": SmartDent organization

✅ AggregateRating apenas com dados REAIS:
   - Nunca inventar ratingValue ou reviewCount
   - Se não houver dados, omitir completamente

✅ Organization completa com:
   - "foundingDate"
   - "numberOfEmployees"
   - "hasCertification" (ISO 9001, ANVISA)
   - "sameAs" (redes sociais oficiais)
   - "knowsAbout" (lista de especialidades)

✅ Company Milestones no campo "subjectOf" ou "about":
   - Incluir marcos históricos verificáveis

══════════════════════════════════════════════════════════
📌 13. AI-READINESS (para IAs generativas)
══════════════════════════════════════════════════════════

✅ Campos obrigatórios no JSON-LD Article/BlogPosting:
   - "about": { "@type": "Thing", "name": "PRODUTO/TEMA" }
   - "mentions": array de produtos, normas, tecnologias citadas
   - "mainEntityOfPage": { "@type": "WebPage", "@id": "CANONICAL_URL" }
   - "publisher": referência ao SMARTDENT_COMPANY
   - "author": referência ao PersonSchema do KOL

✅ HTML5 semântico obrigatório:
   - <article> para conteúdo editorial
   - <main> como container principal
   - <section> para divisões temáticas
   - <nav> para breadcrumbs e menus
   - <header> e <footer> no artigo
   - <aside> para conteúdo secundário

✅ FAQPage schema quando houver seção de FAQ
✅ HowTo schema quando houver passos sequenciais

══════════════════════════════════════════════════════════
📌 14. CSS E PERFORMANCE (Core Web Vitals)
══════════════════════════════════════════════════════════

✅ font-display: swap em qualquer @font-face declarado
✅ Imagem hero/LCP: fetchpriority="high" + loading="eager"
✅ Imagens abaixo do fold: loading="lazy" + decoding="async"
✅ NUNCA usar base64 inline em imagens
✅ SEMPRE incluir width e height em <img> para prevenir CLS
✅ CSS crítico inline no <style> dentro do <head>
✅ Prefira classes utilitárias a estilos inline

══════════════════════════════════════════════════════════
📌 15. ESTRUTURA JSON-LD MÍNIMA EXIGIDA
══════════════════════════════════════════════════════════

Para artigos de blog de produto:
{
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Article", ... , "speakable": ..., "about": ..., "mentions": [...] },
    { "@type": "Product", ... , "aggregateRating": ... },
    { "@type": "FAQPage", ... },
    { "@type": "BreadcrumbList", ... },
    { "@type": ["Organization","LocalBusiness"], ... }
  ]
}

Para landing pages SPIN:
{
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebPage", "speakable": ... },
    { "@type": "Product", "offers": ..., "aggregateRating": ... },
    { "@type": "HowTo", "step": [...] },
    { "@type": "FAQPage", ... },
    { "@type": "BreadcrumbList", ... },
    { "@type": ["Organization","LocalBusiness"], ... }
  ]
}

══════════════════════════════════════════════════════════
📌 16. REGRAS FINAIS
══════════════════════════════════════════════════════════

• Todo JSON-LD deve ser válido (testável em schema.org/validator)
• Nunca duplicar @id dentro do mesmo @graph
• Canonical URL sempre absoluta (https://smartdent.com.br/...)
• Meta description NUNCA pode ser a mesma em duas páginas diferentes
• Hierarquia de headings: exatamente 1 H1 por documento`;

export { SYSTEM_SUPER_PROMPT };
