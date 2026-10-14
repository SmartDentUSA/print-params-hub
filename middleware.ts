import { rewrite } from '@vercel/functions';

const PUBLIC_HOST = /^(?:www\\.smartdent\\.com\\.br|[a-z0-9-]+\\.vercel\\.app)$/i;

/** Canonicalize the apex host; public pages are served from static assets. */
export default function middleware(request: Request) {
  const incoming = new URL(request.url);

  if (incoming.hostname.toLowerCase() === 'smartdent.com.br') {
    incoming.hostname = 'www.smartdent.com.br';
    return Response.redirect(incoming, 308);
  }

  // Don't launch the Chromium snapshot function for ordinary page views.
  // vercel.json routes known crawlers through the lightweight SEO proxy and
  // serves visitors the static SPA entry point.
  if (!PUBLIC_HOST.test(incoming.hostname)) return;
  if (incoming.headers.get('user-agent')?.match(/googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|applebot|petalbot|semrushbot|ahrefsbot|gptbot|chatgpt-user|oai-searchbot|perplexitybot|claudebot|anthropic|bytespider|cohere-ai|google-extended|amazonbot|youbot|diffbot/i)) {
    const destination = new URL('/api/seo-proxy', incoming);
    destination.searchParams.set('originalPath', incoming.pathname + incoming.search);
    return rewrite(destination);
  }
}
 
export const config = { matcher: '/', runtime: 'nodejs' };
