import { rewrite } from '@vercel/functions';

const PUBLIC_HOST = /^(?:www\.smartdent\.com\.br|[a-z0-9-]+\.vercel\.app)$/i;

/** The root HTML file wins over vercel.json rewrites, so route it before static files. */
export default function middleware(request: Request) {
  const incoming = new URL(request.url);

  if (incoming.hostname.toLowerCase() === 'smartdent.com.br') {
    incoming.hostname = 'www.smartdent.com.br';
    return Response.redirect(incoming, 308);
  }

  if (!PUBLIC_HOST.test(incoming.hostname)) return;

  const destination = new URL('/api/public-page', incoming);
  destination.searchParams.set('path', incoming.pathname + incoming.search);
  return rewrite(destination);
}

export const config = { matcher: '/', runtime: 'nodejs' };
