export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const originalPath = url.searchParams.get('originalPath') || '/';
  const upstream = `https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/seo-proxy?originalPath=${encodeURIComponent(originalPath)}`;

  try {
    const res = await fetch(upstream, {
      headers: {
        'user-agent': req.headers.get('user-agent') || 'bot',
        'accept': 'text/html',
      },
    });

    const html = await res.text();
    return new Response(html, {
      status: res.status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
        'X-SSR-Source': 'seo-proxy-internal',
      },
    });
  } catch (err) {
    return new Response(
      `<!doctype html><html><head><title>SSR error</title></head><body>upstream error: ${String(err)}</body></html>`,
      {
        status: 502,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'X-SSR-Source': 'seo-proxy-internal-error',
        },
      },
    );
  }
}