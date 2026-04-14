

## Fix: Video Sitemap via Vercel API Function

### Contexto

O `vercel.json` atual já tem um rewrite direto para a Supabase Edge Function (linha 8-10), mas isso não funciona porque rewrites para URLs externas em projetos Vite/SPA no Vercel não fazem proxy — eles apenas redirecionam internamente. O Vercel precisa de uma **API Function** como intermediário para fazer o fetch e retornar o XML.

### Mudanças

#### 1. Criar `api/video-sitemap.ts` (na raiz, ao lado de `package.json`)

Serverless function simples que faz fetch da Edge Function e retorna o XML:

```typescript
export default async function handler(req: any, res: any) {
  try {
    const upstream = await fetch(
      'https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/video-sitemap'
    );
    const xml = await upstream.text();
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    res.status(200).send(xml);
  } catch (e) {
    res.status(500).send('Error fetching sitemap');
  }
}
```

#### 2. Atualizar `vercel.json`

- Adicionar bloco `functions` para configurar runtime Node.js 20
- Alterar o rewrite de `/video-sitemap.xml` para apontar para `/api/video-sitemap` em vez da URL externa
- Manter todos os outros rewrites e headers existentes intactos

```json
{
  "functions": {
    "api/*.ts": {
      "runtime": "nodejs20.x"
    }
  },
  "rewrites": [
    { "source": "/docs/:path*", "destination": "..." },
    { "source": "/video-sitemap.xml", "destination": "/api/video-sitemap" },
    // ... demais rewrites inalterados
  ]
}
```

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `api/video-sitemap.ts` | **Novo** — proxy serverless |
| `vercel.json` | Adicionar `functions`, alterar destination do video-sitemap |

### Verificação pós-deploy
`https://parametros.smartdent.com.br/video-sitemap.xml` deve retornar XML com `<urlset>` e entries `<video:video>`.

