import { institutionalCopy } from '../content/institutional';

const escape = (value: string) => value.replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]!));

/** The homepage crawler response uses the same copy as the visible React page. */
export function institutionalHomepage(): string {
  const c = institutionalCopy.pt;
  const origin = 'https://www.smartdent.com.br';
  const cats = ['resinas_3d', 'softwares_cad', 'scanners', 'impressoras_3d', 'pos_impressao', 'cimentos'];
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escape(c.seoTitle)}</title><meta name="description" content="${escape(c.seoDesc)}">
    <link rel="canonical" href="${origin}/">
    <link rel="alternate" hreflang="pt-BR" href="${origin}/">
    <link rel="alternate" hreflang="en" href="${origin}/en/institutional">
    <link rel="alternate" hreflang="es" href="${origin}/es/institucional">
    <link rel="alternate" hreflang="x-default" href="${origin}/">
    <meta property="og:type" content="website"><meta property="og:url" content="${origin}/">
    <meta property="og:title" content="${escape(c.seoTitle)}"><meta property="og:description" content="${escape(c.seoDesc)}">
    <script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'WebPage',url:origin+'/',name:c.seoTitle,description:c.seoDesc,inLanguage:'pt-BR'}).replace(/</g,'\\u003c')}</script>
    </head><body><main><h1>${escape(`${c.h1a} ${c.h1b} ${c.h1c}`)}</h1>
    <p>${escape(c.lead)}</p><p>${escape(c.tldr)}</p>
    <a href="https://loja.smartdent.com.br">${escape(c.ctaStore)}</a>
    <a href="/base-conhecimento?tab=parametros">${escape(c.ctaParams)}</a>
    <h2>${escape(c.solTitle)}</h2>${c.sol.map((s,i)=>`<section><h3>${escape(s[0])}</h3><p>${escape(s[1])}</p><a href="/base-conhecimento?tab=catalogo&amp;cat=${cats[i]}">${escape(c.shop)}</a></section>`).join('')}
    <h2>${escape(c.flowTitle)}</h2>${c.flow.map(s=>`<h3>${escape(s[0])}</h3><p>${escape(s[1])}</p>`).join('')}
    <h2>${escape(c.storyTitle)}</h2><p>${escape(c.story)}</p>
    <h2>${escape(c.usTitle)}</h2><p>${escape(c.us)}</p>
    <h2>${escape(c.faqTitle)}</h2>${c.faq.map(s=>`<h3>${escape(s[0])}</h3><p>${escape(s[1])}</p>`).join('')}
    </main></body></html>`;
}
