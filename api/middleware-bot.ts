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
    const upstream = await fetch(
      `https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/seo-proxy?originalPath=${url.pathname}`,
      { headers: { 'user-agent': request.headers.get('user-agent') || '' } }
    );
    const html = await upstream.text();
    return new Response(html, {
      status: upstream.status,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=3600, s-maxage=86400',
      },
    });
  }

  // Not a bot — serve React SPA
  return fetch(request);
}
