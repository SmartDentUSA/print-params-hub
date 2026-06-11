## Objetivo
Levar `parametros.smartdent.com.br` de ~5/10 para ~9/10 em velocidade, SEO, GEO e AI-readiness, **sem quebrar nada** em produção (Evolution API, Copilot, Dra. LIA, Piperun, Sellflux, Omie continuam intactos).

## Escopo (4 frentes)

### 1. Edge `seo-proxy` com paridade total ao `processHTML` da VPS
Hoje o `seo-bot` da VPS injeta JSON-LD MedicalWebPage→TechArticle, E-E-A-T Person Schema, breadcrumbs e canonical correto via 4 regex no `processHTML`. Vamos replicar os mesmos 4 regex na edge `seo-proxy` (Supabase) para que, quando o tráfego de bots for roteado pela Lovable (`vercel.json`), a saída HTML seja idêntica ou superior à atual.

- Replicar regex: (a) JSON-LD principal, (b) breadcrumbs, (c) E-E-A-T author, (d) canonical absoluto `https://parametros.smartdent.com.br/...`.
- Garantir headers: `Cache-Control: public, max-age=300, s-maxage=600`, `Content-Type: text/html; charset=utf-8`, `X-Robots-Tag: index, follow`.
- Validar com `curl -A "Googlebot"` antes do cutover.

### 2. Canonical correto no `<head>` estático (`index.html`)
Trocar qualquer canonical/og:url que aponte para `print-params-hub.lovable.app` por `https://parametros.smartdent.com.br`. Isso vale para humanos (SPA) e fallback de social crawlers (LinkedIn/Slack/Facebook que não executam JS).

### 3. RSS feed (`/rss.xml`)
Criar edge function `rss-feed` que gera RSS 2.0 a partir das últimas N publicações da knowledge base (mesma fonte do sitemap). Expor via rewrite no `vercel.json`. Adicionar `<link rel="alternate" type="application/rss+xml">` no `index.html`.

### 4. DNS cutover (humanos via Lovable, bots via edge)
- Alterar A record de `parametros.smartdent.com.br` para `185.158.133.1` (Lovable), TTL 300.
- Adicionar TXT `_lovable.parametros` para verificação.
- `vercel.json` já detecta User-Agent de bots (Googlebot, Bingbot, GPTBot, ClaudeBot, PerplexityBot, facebookexternalhit, etc.) e roteia para `seo-proxy`.
- Humanos: HTTP/2 + Brotli + edge proximity → LCP cai de 3–10s para 500–1500ms.
- Bots: SSR seletivo via `seo-proxy` com JSON-LD/canonical injetados.

## Sequência de execução

```text
1. Audit (5 min)
   - Ler edge seo-proxy atual e seo-bot/server.js da VPS
   - Confirmar 4 regex do processHTML
   - Ler index.html (canonical atual)
   - Ler vercel.json (rotas + bot detection)

2. Build (sem deploy de DNS ainda)
   - Atualizar supabase/functions/seo-proxy/index.ts (4 regex + headers)
   - Atualizar index.html (canonical + RSS link)
   - Criar supabase/functions/rss-feed/index.ts
   - Atualizar vercel.json (rewrite /rss.xml + confirmar bot UA list)
   - Remover referência aos 4 sitemaps fantasma (-laudos/-resinas/-artigos/-parametros)

3. Validação pré-cutover (15 min, em paralelo)
   - curl -A "Googlebot" https://print-params-hub.lovable.app/base-conhecimento/a/<slug>
     → confirma JSON-LD + canonical correto
   - curl https://print-params-hub.lovable.app/rss.xml
     → confirma feed válido
   - curl https://print-params-hub.lovable.app/llms.txt e /llms-full.txt
     → confirma edges respondendo

4. DNS cutover (janela curta)
   - A record parametros → 185.158.133.1, TTL 300
   - TXT _lovable.parametros
   - Manter VPS ligada como fallback

5. Validação pós-cutover (15 min)
   - dig parametros.smartdent.com.br → 185.158.133.1
   - curl -A "Mozilla" https://parametros.smartdent.com.br/ → HTTP/2, Brotli
   - curl -A "Googlebot" https://parametros.smartdent.com.br/base-conhecimento/...
   - Lighthouse mobile: LCP < 2s, score > 85
   - Search Console: testar URL ao vivo

6. Janela de fallback (14 dias)
   - VPS ligada, sem tráfego novo
   - D+14: pm2 stop seo-bot, remover vhost nginx, desligar VPS
```

## O que NÃO muda
- Evolution API (Docker na VPS) — continua intocada
- `smartdentops` — continua na VPS
- Supabase (edges, RPCs, RLS, triggers) — sem mudanças de schema
- Copilot, Dra. LIA, Piperun, Sellflux, Omie, Astron — fluxos zero
- Sitemaps principais (`/sitemap.xml`, `/knowledge-sitemap.xml`) — já são edges, sem mexer
- `llms.txt` / `llms-full.txt` — já são edges, sem mexer
- Rotas internas do app (`/admin`, `/copilot`, etc.) — SPA continua igual
- Catálogo, ROI, Campaign Central — sem toque

## Risco e mitigação
| Frente | Risco | Mitigação |
|---|---|---|
| Edge `seo-proxy` paridade | Médio (regex pode divergir) | Diff entre saída VPS atual e edge antes do cutover; só faz cutover se idênticos |
| Canonical `index.html` | Baixo | Apenas string replace; cobre fallback de social crawlers |
| RSS feed novo | Baixíssimo | Rota nova `/rss.xml`, não conflita com nada |
| DNS cutover | Médio | TTL 300, VPS ligada 14 dias, rollback em 5 min via DNS revert |

## Resultado esperado
- LCP humanos: 3–10s → 0.5–1.5s
- Zero `EAI_AGAIN` / 502 (88.8% dos erros atuais somem)
- Bots recebem HTML completo com JSON-LD MedicalWebPage + E-E-A-T + canonical correto
- RSS feed indexável (+ Feedly/agregadores AI)
- Score geral: ~5/10 → ~9/10

## Detalhes técnicos
- `seo-proxy` precisa importar mesma lib de extração de slug que o seo-bot usa
- `vercel.json` precisa do `has` matcher para User-Agent regex (já existe parcialmente)
- RSS deve ter `<atom:link rel="self">` e `<lastBuildDate>` para validar W3C
- Após cutover, atualizar `BASE_URL` em qualquer script que ainda referencie `print-params-hub.lovable.app`
- Sitemap `lastmod` deve usar `updated_at` real do Postgres, não `now()`

## Pergunta final
Posso ir direto para o **Audit (passo 1)** lendo os arquivos da edge `seo-proxy`, `index.html` e `vercel.json` para validar a paridade antes de propor o build? Não toco em nada de produção até você liberar o build mode.
