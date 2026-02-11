
# Laudo Tecnico: SEO / GEO / AI / E-E-A-T
## Auditoria dos HTMLs Gerados e Publicados - SmartDent

---

## Metodologia

Analise completa de todos os componentes que geram HTML para bots e usuarios finais, incluindo:
- **SEO Proxy** (SSR para bots - 1.852 linhas)
- **KnowledgeSEOHead** (client-side SPA - 1.142 linhas)
- **SEOHead** (paginas de parametros)
- **OrganizationSchema** (schema corporativo)
- **index.html** (shell inicial)
- **vercel.json** (roteamento de bots)
- **robots.txt** (diretivas de crawling)
- **VideoSchema** (schemas de video)

---

## 1. STRUCTURED DATA / JSON-LD SCHEMAS (Nota: 9/10)

**O que esta implementado:**
- Organization + LocalBusiness + Store (tipo composto)
- TechArticle / MedicalWebPage / ScholarlyArticle (deteccao dinamica por keywords)
- BreadcrumbList em todas as paginas
- FAQPage com extracao automatica de perguntas do HTML
- HowTo com 4 metodos de extracao (ol/li, headings numerados, tabelas, markdown)
- VideoObject com duration, transcript, caption, audioLanguage (PandaVideo)
- Product com Offer, associatedMedia (DigitalDocument)
- Review com reviewRating para produtos recomendados
- LearningResource com educationalAudience
- SpeakableSpecification para Voice Search
- SearchAction na homepage
- InteractionStatistic em videos (WatchAction, PlayAction)
- HowToSection para instrucoes de processamento de resinas

**Ponto forte:** @graph unificado no client-side e schemas separados no SSR. Cobertura excepcionalmente ampla.

**Ponto fraco:** Algumas propriedades nao-padrao como `expertise` no Organization (nao e reconhecida pelo Google). `Certification` type existe mas nao e amplamente suportado pelo Google Rich Results.

---

## 2. E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) (Nota: 9/10)

**O que esta implementado:**
- Author Schema com Person, jobTitle, hasCredential (Doctoral/Masters), alumniOf (USP, UNICAMP, UNESP)
- Deteccao automatica de credenciais a partir do mini_bio do autor
- Lattes/CNPq como memberOf reconhecido
- knowsAbout dinamico por autor
- sameAs com redes sociais do autor (Lattes, LinkedIn, Instagram, YouTube)
- Publisher completo com legalName, foundingDate, numberOfEmployees, vatID, taxID, DUNS
- AggregateRating do Google Reviews
- Award e Certification (ISO 13485, ANVISA)
- reviewedBy em MedicalWebPage
- copyrightHolder em ScholarlyArticle
- 100% dos artigos com author_id atribuido (269 artigos corrigidos)

**Ponto forte:** O sistema detecta automaticamente graus academicos e universidades do mini_bio. Nivel de E-E-A-T comparavel a sites medicos de referencia.

**Ponto fraco:** `accreditation` nao e uma propriedade Schema.org valida para Organization (-0.5). Ratings "hardcoded" de 5/5 em Product Reviews podem ser questionaveis pelo Google (-0.5).

---

## 3. SEO TECNICO ON-PAGE (Nota: 8/10)

**O que esta implementado:**
- Canonical tags em todas as paginas (dominio padronizado: parametros.smartdent.com.br)
- Meta description dinamica (<=160 chars)
- Meta keywords dinamicas
- Meta robots: index, follow
- Meta author e publisher
- OG tags completas (og:type, og:title, og:description, og:image com dimensoes, og:locale, article:section, article:tag, article:published_time, article:modified_time)
- Twitter Cards (summary_large_image, player para videos)
- Preconnect/dns-prefetch para dominios criticos
- Critical CSS inline no index.html
- CSS preload com progressive enhancement
- Favicon completo (ICO, PNG 16-512, apple-touch-icon, SVG inline)
- PWA manifest com theme-color

**Ponto fraco:** Nao ha implementacao de `rel="prev"/"next"` para paginacao na listagem de artigos (-1). O preload do CSS com `onload` hack pode falhar em browsers antigos (-0.5). Nao ha meta `article:author` (URL do perfil do autor) no OG Protocol (-0.5).

---

## 4. INTERNACIONALIZACAO / hreflang (Nota: 9/10)

**O que esta implementado:**
- hreflang pt-BR, en-US, es-ES e x-default em artigos individuais
- hreflang na pagina inicial da Base de Conhecimento
- hreflang nas paginas de categoria
- Sitemaps separados por idioma (PT, EN, ES)
- `htmlAttributes={{ lang: htmlLang }}` dinamico via Helmet
- og:locale dinamico
- Rotas i18n centralizadas em `src/utils/i18nPaths.ts`
- Traducao automatica de campos (title_en, content_html_en, etc.)
- Artigos sempre indexaveis mesmo sem traducao completa

**Ponto fraco:** Erro no path de espanhol: `/es/base-conocimento` esta incorreto (deveria ser `/es/base-conocimiento` com 'i') - encontrado na linha 475 do KnowledgeSEOHead (-1).

---

## 5. SSR / BOT RENDERING (Nota: 8/10)

**O que esta implementado:**
- SEO Proxy com 1.852 linhas servindo HTML pre-renderizado completo
- Deteccao de 30+ bots (AI, Search, Social)
- Vercel rewrites com regex de User-Agent para redirecionar bots ao proxy
- Content-Type `text/html; charset=utf-8`
- 9 funcoes de geracao HTML (homepage, brand, model, article, category, knowledge-hub, documents, testimonials, about)
- Fallback client-side no index.html (BOT SSR MIDDLEWARE)
- noscript fallback com conteudo semantico
- WCAG skip-link para acessibilidade

**Ponto fraco:** O middleware client-side no index.html usa `document.write()` que e considerado uma ma pratica e pode causar problemas de rendering (-1). O fallback client-side duplica a logica do Vercel rewrite, criando redundancia (-0.5). Headers de cache nao estao configurados para respostas do seo-proxy (-0.5).

---

## 6. GEO / LOCAL SEO (Nota: 9/10)

**O que esta implementado:**
- GeoCoordinates precisas (lat -22.0154, lng -47.8911) no OrganizationSchema
- OpeningHoursSpecification (seg-sex, 08:00-18:00)
- Meta tags geo.region (BR-SP), geo.placename (Sao Carlos), geo.position, ICBM
- PostalAddress completo (rua, cidade, estado, CEP, pais)
- areaServed dinamico do banco de dados
- LocalBusiness tipo composto com Organization e Store
- Telephone para Local Pack

**Ponto forte:** Implementacao completa e correta para Google Local Pack e Google Maps.

**Ponto fraco:** Geo meta tags estao hardcoded em vez de vindas do banco (-0.5). Falta `priceRange` diretamente no LocalBusiness (esta apenas nos Offers) (-0.5).

---

## 7. AI / GEO (Generative Engine Optimization) (Nota: 9/10)

**O que esta implementado:**
- Meta tags `ai-content-type` e `ai-topic` em todas as paginas
- Meta tag `AI-context` com contexto enriquecido (SPIN, instrucoes de processamento, categorias)
- Meta tag `ai:context` com contexto multilingue (pt, en, es)
- robots.txt liberando GPTBot, ChatGPT-User, PerplexityBot, ClaudeBot, Anthropic, CCBot, cohere-ai, Google-Extended
- `.ai-summary-box` para Featured Snippet capture
- `.ai-data-table` para tabelas estruturadas
- VeredictBox com DefinedTerm schema
- SpeakableSpecification apontando para blocos criticos
- LearningResource com `teaches` e `educationalAudience`
- `data-llm-summary="true"` e `data-section` attributes no HTML
- Export de parametros como JSON estruturado (`export-parametros-ia`)
- Heading IDs automaticos para citacao por LLMs (DirectHTMLRenderer)

**Ponto forte:** Uma das implementacoes mais completas de GEO que ja analisei. O sistema gera conteudo especificamente otimizado para ser citado por IAs generativas.

**Ponto fraco:** As meta tags `ai-content-type` e `ai:context` nao sao padroes oficiais - funcionam mas sem garantia de adocao (-0.5). Falta `llms.txt` como arquivo de instrucoes para crawlers de IA (-0.5).

---

## 8. CONTEUDO SEMANTICO / HTML QUALITY (Nota: 8/10)

**O que esta implementado:**
- Hierarquia H1 > H2 > H3 > H4 correta
- article, aside, header, footer semanticos
- itemScope/itemProp em artigos (TechArticle)
- Sanitizacao automatica de schema.org microdata que vaza como texto visivel
- Links externos com target="_blank" rel="noopener noreferrer"
- Alt text para imagens
- dateTime em tags `<time>` (datePublished, dateModified)
- ARIA roles (banner, main, contentinfo)

**Ponto fraco:** O SSR proxy gera HTML com estilos inline extensivos em vez de classes CSS (-1). Algumas paginas do SSR nao incluem `<main>` role (-0.5). O `articleBody` no schema inclui todo o texto plano do artigo, podendo ultrapassar limites recomendados (-0.5).

---

## 9. PERFORMANCE / CORE WEB VITALS (Nota: 7/10)

**O que esta implementado:**
- Critical CSS inline no index.html (LCP/FCP optimization)
- Preconnect para Supabase e Google Fonts
- OG image preload
- `fetchpriority="high"` para imagens LCP (mencionado na arquitetura)
- `decoding="async"` para imagens
- Font display swap (via Google Fonts URL)
- Lazy loading em imagens do SSR proxy

**Ponto fraco:** Google Fonts carregado via CSS externo em vez de self-hosted (-1). Nao ha `<link rel="preload">` para a fonte Poppins como font file (-0.5). O CSS preload com `onload` hack pode causar FOUC (-0.5). Nao ha implementacao de `content-visibility: auto` para lazy rendering (-0.5). Meta Pixel e GTM no `<head>` bloqueiam rendering (-0.5).

---

## 10. FEED / SYNDICATION / DISCOVERY (Nota: 9/10)

**O que esta implementado:**
- RSS feed (`knowledge-feed?format=rss`)
- Atom feed (`knowledge-feed?format=atom`)
- `<link rel="alternate">` auto-discovery no index.html e KnowledgeSEOHead
- 5 Sitemaps XML separados (geral, knowledge PT, EN, ES, documents)
- Sitemaps declarados no robots.txt
- robots.txt liberando todos os bots relevantes
- Allow para arquivos PDF

**Ponto forte:** Cobertura excelente de syndication e discovery.

**Ponto fraco:** Falta sitemap para paginas de produtos/parametros especificas (-0.5). Feeds RSS/Atom filtrados apenas para categorias C, D, E (-0.5).

---

## RESUMO EXECUTIVO

| Categoria | Nota |
|---|---|
| 1. Structured Data / JSON-LD | 9/10 |
| 2. E-E-A-T | 9/10 |
| 3. SEO Tecnico On-Page | 8/10 |
| 4. Internacionalizacao / hreflang | 9/10 |
| 5. SSR / Bot Rendering | 8/10 |
| 6. GEO / Local SEO | 9/10 |
| 7. AI / Generative Engine Optimization | 9/10 |
| 8. Conteudo Semantico / HTML Quality | 8/10 |
| 9. Performance / Core Web Vitals | 7/10 |
| 10. Feed / Syndication / Discovery | 9/10 |
| **MEDIA GERAL** | **8.5/10** |

---

## TOP 5 ACOES PRIORITARIAS PARA CHEGAR A 9.5+

1. **Corrigir typo hreflang ES** - `/es/base-conocimento` deve ser `/es/base-conocimiento` (impacto alto, esforco baixo)
2. **Adicionar `llms.txt`** - Arquivo padrao emergente para instrucoes a crawlers de IA (impacto medio, esforco baixo)
3. **Self-host Google Fonts** - Eliminar render-blocking externo e melhorar LCP (impacto alto, esforco medio)
4. **Remover `document.write()` do middleware SSR** - Substituir por meta refresh ou confiar apenas no Vercel rewrite (impacto medio, esforco baixo)
5. **Adicionar cache headers no SEO Proxy** - `Cache-Control: public, max-age=3600` para respostas SSR (impacto medio, esforco baixo)
