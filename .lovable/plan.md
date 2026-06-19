## Objetivo
Tornar a rede de distribuidores autorizados Smart Dent **descobrível por IAs (Perplexity, ChatGPT, Gemini, Google AI Overviews) e buscadores tradicionais**, transformando os dados já cadastrados em `distributors` em páginas SEO/GEO-first com SSR via `seo-proxy`, schema LocalBusiness e citações cruzadas (sites dos próprios distribuidores → backlink → Smart Dent).

## Diagnóstico atual
- Existe `/distribuidores` (KnowledgeBase tab) renderizada **client-side** — bots/IAs leem HTML vazio.
- Sitemap lista apenas 1 URL agregada (`/distribuidores`), sem páginas por país nem por distribuidor.
- `public/llms.txt` não menciona a rede de distribuição internacional.
- `seo-proxy` edge function existe (já intercepta bots) mas não tem renderer dedicado para distribuidores.
- Não há schema.org `LocalBusiness` nem hreflang nas páginas atuais.

## Estratégia em 4 camadas

### Camada 1 — URLs canônicas dedicadas (descoberta)
Criar 3 níveis de páginas, cada uma com URL própria e SSR:

```text
/onde-comprar                              (hub global, 3 idiomas)
/onde-comprar/{pais-slug}                  (ex: /onde-comprar/chile)
/onde-comprar/{pais-slug}/{distribuidor}   (ex: /onde-comprar/chile/biotech-chile)
```

Mais aliases em EN/ES (`/where-to-buy/...`, `/donde-comprar/...`) com `hreflang`.

### Camada 2 — SSR via seo-proxy (visibilidade real)
Estender `supabase/functions/seo-proxy/index.ts` com handlers para os 3 padrões acima:
- Busca em `distributors` (filtra `is_active`, `is_published`).
- Renderiza HTML completo com `<title>`, `<meta description>`, `og:*`, `canonical`, `hreflang`, JSON-LD.
- Bots já são interceptados pelo middleware Vercel existente.

### Camada 3 — Schema.org rico (GEO/AEO)
Cada página de distribuidor injeta JSON-LD com:
- `@type: LocalBusiness` (subtipo `Store`) — nome, endereço estruturado (`PostalAddress`), `telephone`, `email`, `url`, `geo` (lat/lng se houver), `openingHours`, `sameAs` (Instagram/Facebook/LinkedIn/YouTube).
- `brand: { @type: Brand, name: "Smart Dent" }` + `parentOrganization` apontando para a Organization Smart Dent.
- Lista de produtos representados (`makesOffer` → resinas, kits) puxada do `authorized_scope`.
- Página de país: `ItemList` com todos distribuidores + `FAQPage` ("Onde comprar Smart Dent no {país}?").
- Hub global: `Organization` com `hasMerchantReturnPolicy`, `areaServed` (lista de países).

### Camada 4 — Sinalização para IAs
- **llms.txt**: adicionar seção `## Distribuidores oficiais por país` listando cada hub de país com 1 linha de descrição.
- **llms-full.txt**: incluir bloco completo com nome/endereço/site/contato de cada distribuidor ativo (gerado dinamicamente pela edge function `llms-full-txt`).
- **sitemap.xml**: gerar 1 entrada por país + 1 por distribuidor (script `scripts/generate-sitemap.ts` lendo `distributors`).
- **robots.txt**: confirmar `Allow: /onde-comprar` e `Sitemap:` apontando para o sitemap.

## Conteúdo SEO por página (templates)

**Hub global `/onde-comprar`** — H1: "Onde comprar produtos Smart Dent no mundo" · grid de países com bandeira + nº de distribuidores · CTA por país.

**País `/onde-comprar/chile`** — H1: "Distribuidores Smart Dent no Chile" · intro 80–120 palavras com cidades atendidas · lista de distribuidores (card por unidade) · FAQ: "Onde comprar resina Smart Print Bio Vitality no Chile?", "Qual o distribuidor oficial Smart Dent em Santiago?".

**Distribuidor `/onde-comprar/chile/biotech-chile`** — H1: "Biotech Chile — Distribuidor oficial Smart Dent" · ficha completa (endereço, telefone, WhatsApp, site, redes) · "Produtos representados" (do `authorized_scope`) · mapa (link Google Maps) · selo "Distribuidor Autorizado Smart Dent" · CTA cotação.

## Programa de citação cruzada (relevância externa)
Adicionar à área interna **Smart Ops → Distribuição** ou ao link público de cadastro:
- **Selo HTML/PNG** "Distribuidor Oficial Smart Dent" com URL canônica embutida (backlink dofollow).
- **Snippet pronto** para o distribuidor colar no site: `<a href="https://admin.smartdent.com.br/onde-comprar/chile/biotech-chile">Distribuidor oficial Smart Dent</a>` + JSON-LD reverso (`OrganizationRole` apontando para Smart Dent).
- **Texto bio padrão** para Instagram/LinkedIn em PT/EN/ES.
- Esses backlinks recíprocos são o sinal #1 que IAs e buscadores usam para confirmar "X é distribuidor oficial de Y no país Z".

## Entregáveis técnicos
1. `src/pages/WhereToBuyHub.tsx`, `WhereToBuyCountry.tsx`, `WhereToBuyDistributor.tsx` (3 páginas com Helmet + render visual).
2. Rotas em `src/App.tsx` (PT/EN/ES com aliases).
3. Extensão de `supabase/functions/seo-proxy/index.ts` com 3 novos handlers + JSON-LD builder.
4. Extensão de `supabase/functions/llms-full-txt/index.ts` para incluir bloco distribuidores.
5. Atualização de `public/llms.txt` (estática, 1 seção curta).
6. Atualização de `scripts/generate-sitemap.ts` (ler `distributors` via Supabase, emitir URLs).
7. Componente "Kit de Divulgação" dentro de `SmartOpsDistributors.tsx`: gera selo + snippet HTML + bio social por distribuidor.
8. Migration: 2 colunas em `distributors` — `is_published boolean default true`, `slug text` (único por país) + trigger de slugify; campo `latitude`/`longitude` opcional para `geo` no schema.

## O que NÃO muda
- Tabela `distributors` mantém RLS atual (só adiciona colunas).
- `/distribuidores` (tab da KB) continua existindo — redireciona 301 para `/onde-comprar`.
- Nenhuma EF do Instagram/Copa/Zernio é tocada.

## Validação
1. `curl -A "Googlebot" https://admin.smartdent.com.br/onde-comprar/chile/biotech-chile` deve retornar HTML com `<title>`, descrição, e JSON-LD `LocalBusiness` válido (testar em https://validator.schema.org).
2. Perplexity/ChatGPT consultados com "onde comprar Smart Dent no Chile" devem encontrar a página em 7–14 dias após indexação.
3. Google Search Console → "Inspecionar URL" deve mostrar página renderizada com conteúdo.
4. Rich Results Test deve reconhecer LocalBusiness em cada página de distribuidor.

## Faseamento sugerido
- **Fase 1 (1 task):** páginas + rotas + Helmet + SSR seo-proxy + JSON-LD + sitemap + llms.txt — entrega visibilidade imediata.
- **Fase 2 (1 task):** Kit de Divulgação interno + selo PNG + snippets multilíngues — ativa backlinks recíprocos.
- **Fase 3 (opcional):** Solicitar verificação no Google Business Profile via OAuth dos distribuidores para amarrar Knowledge Graph.

Posso começar pela Fase 1 quando aprovado.