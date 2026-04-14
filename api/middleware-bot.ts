export const config = { runtime: 'edge' };

const BOTS = [
  'googlebot', 'bingbot', 'slurp', 'duckduckbot',
  'gptbot', 'chatgpt-user', 'claudebot', 'anthropic-ai',
  'perplexitybot', 'ccbot', 'bytespider', 'applebot',
  'yandexbot', 'semrushbot', 'ahrefsbot', 'prerender',
  'facebookexternalhit', 'twitterbot', 'linkedinbot',
  'whatsapp', 'telegrambot', 'lighthouse'
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
