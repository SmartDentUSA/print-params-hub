## Objetivo
Tornar distribuidores e eventos indexáveis por bots (Google, Perplexity, ChatGPT) através de URLs com path real + SSR no middleware de bot.

## Mudanças

### 1. Frontend — rotas SPA reais (`src/App.tsx`)
Adicionar duas rotas que reaproveitam `KnowledgeBase` forçando o tab correspondente:

```
/distribuidores  → <KnowledgeBase lang="pt" forcedTab="distribuidores" />
/eventos         → <KnowledgeBase lang="pt" forcedTab="eventos" />
```

Em `src/pages/KnowledgeBase.tsx`:
- Adicionar prop opcional `forcedTab?: KbTab`.
- Se presente, usar como initial tab e sincronizar URL sem query param (`?tab=...`).

Resultado: links e bots conseguem navegar para `/distribuidores` e `/eventos` diretamente; o conteúdo da SPA é o mesmo das abas atuais (zero duplicação).

### 2. Sitemap (`scripts/generate-sitemap.ts` ou `public/sitemap.xml`)
Adicionar entradas:
- `/distribuidores` — priority 0.8, changefreq monthly
- `/eventos` — priority 0.8, changefreq weekly

### 3. Bot SSR — `supabase/functions/seo-proxy/index.ts`
Adicionar dois branches no roteador (linha ~2256):

```ts
} else if (segments[0] === 'distribuidores' && segments.length === 1) {
  html = await generateDistribuidoresHTML(supabase);
} else if (segments[0] === 'eventos' && segments.length === 1) {
  html = await generateEventosHTML(supabase);
}
```

#### `generateDistribuidoresHTML(supabase)`
- Query: `from('distributors').select('razao_social, nome_fantasia, pais, cidade, estado, site_url, instagram, owner_whatsapp, authorized_scope, logo_url, tipo, canal_venda').eq('active', true)`
- HTML: `<title>Distribuidores e Revendas Oficiais Smart Dent | América Latina</title>`, meta description conforme briefing, canonical `${BASE_URL}/distribuidores`, hreflang PT/EN/ES (mesma URL por enquanto), OG tags, breadcrumbs schema.
- JSON-LD `ItemList` com um `Organization` por distribuidor:
  ```json
  {
    "@type": "Organization",
    "name": "...",
    "url": "site_url",
    "logo": "logo_url",
    "address": { "@type": "PostalAddress", "addressLocality": "cidade", "addressRegion": "estado", "addressCountry": "pais" },
    "sameAs": ["instagram"],
    "areaServed": "pais"
  }
  ```
- Body visível: agrupado por país (Brasil → Chile → Colômbia → Costa Rica → República Dominicana → EUA → Uruguai → Venezuela), cards com nome, cidade/estado, escopo autorizado, link para site e WhatsApp.
- Rodapé com link para `/base-conhecimento` e `buildBotRedirectScript('/distribuidores')` para devolver o usuário humano à SPA.

#### `generateEventosHTML(supabase)`
- Query: `from('smartops_events').select('*').eq('is_active', true).order('start_date')`
- HTML: `<title>Eventos de Odontologia Digital 2026 | Smart Dent</title>`, meta description completa, canonical, OG, breadcrumbs.
- JSON-LD `ItemList` com um `Event` por registro:
  ```json
  {
    "@type": "Event",
    "name": "...",
    "startDate": "start_date",
    "endDate": "end_date",
    "eventStatus": "https://schema.org/EventScheduled",
    "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
    "location": { "@type": "Place", "name": "location", "address": { "addressCountry": "country" } },
    "url": "website_url",
    "image": "cover_image_url",
    "organizer": { "@type": "Organization", "name": "Smart Dent", "url": BASE_URL }
  }
  ```
- Body visível: cards com nome, datas formatadas, local, stand, link para o site oficial.
- `buildBotRedirectScript('/eventos')` no final.

### 4. Edge middleware (`api/middleware-bot.ts`)
Hoje só intercepta `/base-conhecimento/{letter}/{slug}`. Ampliar o regex para também capturar `/distribuidores` e `/eventos`:

```ts
const match =
  url.pathname.match(/^\/base-conhecimento\/[a-z]\/([a-zA-Z0-9-]+)/) ||
  url.pathname.match(/^\/(distribuidores|eventos)\/?$/);
```

Mesma lógica de fetch para o seo-proxy com `originalPath=${url.pathname}`, mesmo timeout e fallback para SPA.

### 5. robots.txt / canonical
Nenhuma mudança necessária — `Allow: /` já cobre. Garantir que canonical SSR aponta para `https://admin.smartdent.com.br/distribuidores` e `/eventos`.

## Arquivos afetados
- `src/App.tsx` — 2 rotas novas
- `src/pages/KnowledgeBase.tsx` — prop `forcedTab`
- `scripts/generate-sitemap.ts` (ou `public/sitemap.xml`) — 2 entradas
- `supabase/functions/seo-proxy/index.ts` — 2 funções + 2 branches do roteador
- `api/middleware-bot.ts` — regex ampliado

## Validação
1. Após deploy do edge function, `curl -A "Googlebot" https://admin.smartdent.com.br/distribuidores` deve retornar HTML server-rendered com 200 e `x-ssr-source: middleware-bot`.
2. Idem para `/eventos`.
3. Usuário humano em `/distribuidores` vê a SPA com a aba "Distribuidores" já ativa.
4. Rich Results Test do Google valida o `ItemList`/`Organization`/`Event`.
