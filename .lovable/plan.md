# Fix 1 — Content-Type correto no SSR de bots (WhatsApp/Facebook)

## Problema
O `vercel.json` faz **rewrite externo** para `https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/seo-proxy` quando detecta bot. Vercel não preserva o `Content-Type: text/html` em rewrites cross-domain — a resposta chega como `text/plain`, e Facebook/WhatsApp ignoram as OG tags.

## Solução
Substituir o rewrite externo por uma **API route interna** (`/api/seo-proxy.ts`) que:
1. Roda em Vercel Edge/Node
2. Faz `fetch` server-side ao `seo-proxy` do Supabase
3. Retorna a resposta forçando `Content-Type: text/html; charset=utf-8`

## Arquivos

### 1. Criar `api/seo-proxy.ts`
Função Vercel (Node runtime) que:
- Lê `originalPath` da query
- Faz `fetch` a `https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/seo-proxy?originalPath=<path>`
- Encaminha `user-agent` original do bot
- Retorna `Response` com:
  - `Content-Type: text/html; charset=utf-8` (sobrescreve qualquer coisa do upstream)
  - `Cache-Control: public, max-age=300, s-maxage=300`
  - Status code preservado
  - Body HTML preservado

```ts
export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const originalPath = url.searchParams.get('originalPath') || '/';
  const upstream = `https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/seo-proxy?originalPath=${encodeURIComponent(originalPath)}`;

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
}
```

### 2. Atualizar `vercel.json`
Trocar os 2 rewrites de bot (linhas `/f/:path*` e `/:path*` com header user-agent) para apontar para `/api/seo-proxy?originalPath=...` em vez do domínio externo do Supabase.

Antes:
```json
"destination": "https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/seo-proxy?originalPath=/f/:path*"
```
Depois:
```json
"destination": "/api/seo-proxy?originalPath=/f/:path*"
```

## Validação após deploy
```bash
curl -A "WhatsApp/2.0" -I https://parametros.smartdent.com.br/f/equipamento-uv-shapecure-d
# Esperado: content-type: text/html; charset=utf-8
#           x-ssr-source: seo-proxy-internal

curl -A "facebookexternalhit/1.1" -s https://parametros.smartdent.com.br/f/equipamento-uv-shapecure-d | grep -E 'og:(title|image|url)'
# Esperado: og:title com "Equipamento UV ShapeCure D"
```

## Escopo
- Apenas Fix 1 (Content-Type). Fix 2 (`hero_image_url` NULL no DB) fica para um próximo passo.
- Nenhuma mudança no frontend, no `seo-proxy` do Supabase, ou em outras rewrites (llms.txt, sitemap, rss continuam como estão — eles funcionam pois browsers/crawlers de XML/TXT não exigem Content-Type estrito).
