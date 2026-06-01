## Problema observado pelo usuário

Quando o lead abre o link do formulário (`/f/:slug`) dentro do **WhatsApp** (ou Instagram/Facebook/Telegram), a tela mostra **Bad Gateway**. Só depois de vários F5 a página finalmente carrega. Isso está derrubando a taxa de preenchimento.

## Causa raiz

No `vercel.json`, o último rewrite intercepta **todas as rotas** quando o User-Agent contém qualquer termo da lista de bots — e essa lista inclui `whatsapp`, `facebookexternalhit`, `telegrambot`, `linkedinbot`. O navegador in-app do WhatsApp manda UA com "WhatsApp" no nome, então cai no rewrite:

```
/:path*  (UA contém whatsapp/etc.)  →  seo-proxy?originalPath=/:path*
```

O `seo-proxy` não tem handler para a rota `/f/:slug` (formulário público é SPA, não tem SSR de SEO) → devolve **404** → o Vercel propaga como **502 Bad Gateway**.

Comprovado por teste:
- `curl /f/<slug> -A "WhatsApp/2.0"` → **502**
- `curl /f/<slug> -A "Mozilla/5.0"` → **200**
- `seo-proxy?originalPath=/f/<slug>` → **404**

O F5 às vezes "resolve" porque o Cloudflare/CDN serve cache antigo do `index.html`, ou porque o WhatsApp eventualmente reabre fora do in-app browser.

## Correção

Adicionar em `vercel.json`, **antes** do bloco de bots, um rewrite passthrough para `/f/:path*` apontando para `/index.html` (SPA). Como o Vercel avalia rewrites em ordem e o primeiro match vence, o rewrite de bots deixa de capturar formulários — eles passam a ser servidos pelo SPA para qualquer User-Agent.

```json
{ "source": "/f/:path*", "destination": "/index.html" }
```

Esse rewrite vai logo acima do `"source": "/:path*"` com `has: user-agent`. Comportamento para navegadores normais não muda (já carregam o SPA via fallback do Vercel). A diferença é que o navegador in-app do WhatsApp/IG/FB/Telegram agora também recebe o SPA em vez de cair no seo-proxy.

## Validação após deploy

1. `curl -I https://parametros.smartdent.com.br/f/<slug-real> -A "WhatsApp/2.0"` → deve retornar **200** (antes: 502).
2. Abrir o link do formulário diretamente dentro do WhatsApp Mobile → carregar de primeira, sem F5.
3. Conferir que `/base-conhecimento/...` continua sendo servido pelo `seo-proxy` quando UA é bot (SEO preservado).

## Arquivos alterados

- `vercel.json` — 1 linha de rewrite adicionada (sem mexer em edge functions, sem mexer no `PublicFormPage.tsx`, sem mexer no `smart-ops-ingest-lead`).

## Fora de escopo

- `seo-proxy` não precisa de handler novo (formulário não tem valor SEO).
- O submit do formulário continua igual — a causa NÃO é o ingest, é o carregamento inicial da página.
