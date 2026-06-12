export const config = { runtime: 'edge' };

const BOTS = [
  'googlebot', 'bingbot', 'slurp', 'duckduckbot',
  'gptbot', 'chatgpt-user', 'oai-searchbot',
  'claudebot', 'anthropic-ai', 'anthropic',
  'perplexitybot', 'ccbot', 'bytespider',
  'applebot', 'applebot-extended',
  'yandexbot', 'baiduspider', 'petalbot',
  'semrushbot', 'ahrefsbot', 'dotbot', 'mj12bot', 'rogerbot', 'serpstatbot',
  'prerender', 'lighthouse',
  'facebookexternalhit', 'twitterbot', 'linkedinbot',
  'whatsapp', 'telegrambot',
  'meta-externalagent', 'meta-externalfetcher',
  'amazonbot', 'youbot', 'diffbot', 'mistralai-user',
  'google-extended', 'google-cloudvertexbot',
  'duckassistbot', 'kagibot', 'phindbot', 'timpibot', 'iaskbot',
  'cohere-ai'
];

export default async function handler(request: Request) {
  const ua = (request.headers.get('user-agent') || '').toLowerCase();
  const isBot = BOTS.some(b => ua.includes(b));
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/base-conhecimento\/[a-z]\/([a-zA-Z0-9-]+)/);

  if (isBot && match) {
    const slug = match[1];
    // Timeout guard: never hold the edge function more than 1.5s waiting for SSR.
    // If the upstream SEO proxy is slow/down, fall back to the SPA so the page
    // still renders instead of returning a Vercel 5xx.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);
    try {
      const upstream = await fetch(
        `https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/seo-proxy?originalPath=${url.pathname}`,
        {
          headers: { 'user-agent': request.headers.get('user-agent') || '' },
          signal: controller.signal,
          cf: { cacheTtl: 3600, cacheEverything: true } as any,
        }
      );
      clearTimeout(timeoutId);
      if (!upstream.ok) {
        // Upstream failed — serve SPA so bots still get a valid 200.
        return fetch(request);
      }
      const html = await upstream.text();
      return new Response(html, {
        status: upstream.status,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
          'x-ssr-source': 'middleware-bot',
          'x-ssr-slug': slug,
        },
      });
    } catch (_err) {
      clearTimeout(timeoutId);
      // Timeout or network error — degrade to SPA instead of 5xx.
      return fetch(request);
    }
  }

  // Not a bot — serve React SPA
  return fetch(request);
}
