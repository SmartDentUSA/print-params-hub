import { isInstitutionalHost } from '../src/utils/institutionalHost.js';
import { PUBLIC_ORIGIN, publicText, publicUrl } from '../src/utils/publicDomain.mjs';
import { institutionalHomepage } from '../src/utils/institutionalHomepage.js';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const publicHost = isInstitutionalHost(url.hostname) || (url.hostname.endsWith('.vercel.app') && url.searchParams.get('__public') === '1');
  const originalPath = url.searchParams.get('originalPath') || '/';
  const originalUrl = new URL(originalPath, PUBLIC_ORIGIN);
  for (const [key,value] of url.searchParams) if (key !== 'originalPath' && key !== '__public' && !originalUrl.searchParams.has(key)) originalUrl.searchParams.append(key,value);
  if (publicHost && originalUrl.pathname === '/') {
    return new Response(institutionalHomepage(), {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300, s-maxage=300' },
    });
  }
  const upstreamUrl = new URL('https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/seo-proxy');
  upstreamUrl.searchParams.set('originalPath', originalUrl.pathname);
  for (const [key,value] of originalUrl.searchParams) if (key !== 'originalPath') upstreamUrl.searchParams.append(key,value);
  const upstream = upstreamUrl.toString();

  try {
    const res = await fetch(upstream, {
      redirect: 'manual',
      headers: {
        'user-agent': req.headers.get('user-agent') || 'bot',
        'accept': 'text/html',
      },
    });

    const html = publicHost ? publicText(await res.text()) : await res.text();
    const headers = new Headers({
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': res.headers.get('Cache-Control') || 'public, max-age=300, s-maxage=300',
      'X-SSR-Source': 'seo-proxy-internal',
    });
    const location = res.headers.get('Location');
    if (location) headers.set('Location', publicHost ? publicUrl(location) : location);
    return new Response(html, {
      status: res.status,
      headers,
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
