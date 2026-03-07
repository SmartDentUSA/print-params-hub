

# Auditoria: AI-Ready Semantic Article Structure

Analise de cada gerador de HTML contra a arquitetura ideal.

---

## Legenda

- ✅ = Implementado corretamente
- ⚠️ = Parcialmente implementado
- ❌ = Ausente / Fail

---

## 1. `generateKnowledgeArticleHTML` (Artigos da Base de Conhecimento)

```text
HEAD
 ├ SEO (title, description, canonical, keywords)     ✅
 ├ OpenGraph (title, desc, image, type, locale)       ✅
 ├ Twitter (card, title, desc, image)                 ✅
 ├ AI policy (ai-content-policy, AI-context, citation)✅
 └ JSON-LD @graph (Article, Person, FAQ, HowTo, etc)  ✅

BODY
 ├ header (role="banner", nav)                        ✅
 │
 ├ article (role="main", id="main-content")           ✅
 │   ├ H1                                             ✅
 │   ├ AI summary (llm-knowledge-layer, abstract)     ✅
 │   ├ hero image (eager, fetchpriority=high)          ✅
 │   │
 │   ├ definition paragraph (data-section="definition")✅
 │   ├ technology/clinical (content_html)              ✅
 │   │
 │   ├ LLM knowledge layer (citation-box)             ✅
 │   │
 │   ├ FAQ (data-section="faq")                       ✅
 │   ├ Author (data-section="author")                 ✅
 │   └ entity index                                   ⚠️ Injetado pelo ai-orchestrate pipeline, 
 │                                                        mas NÃO pelo seo-proxy SSR para artigos legados
 │
 └ footer (role="contentinfo")                        ✅
```

**Score: 9/10** — Falta entity index SSR para conteudo legado.

---

## 2. `generateHomepageHTML` (Pagina Inicial)

```text
HEAD
 ├ SEO (title, description, canonical)                ✅
 ├ OpenGraph (title, desc, image, type)               ✅
 ├ Twitter (card, title)                              ✅
 ├ AI policy (ai-content-policy, AI-context)           ✅
 └ JSON-LD @graph (WebSite + SearchAction)            ✅

BODY
 ├ header (role="banner", nav)                        ✅
 │
 ├ main > article                                     ✅
 │   ├ H1                                             ✅
 │   ├ AI summary (llm-knowledge-layer)               ✅
 │   ├ hero image                                     ❌ N/A (sem imagem hero)
 │   │
 │   ├ definition paragraph                           ❌ Ausente
 │   ├ technology explanation                         ❌ N/A (pagina de listagem)
 │   ├ clinical application                           ❌ N/A
 │   │
 │   ├ LLM knowledge layer                           ✅ (summary presente)
 │   │
 │   └ entity index                                   ❌ Ausente
 │
 └ footer (role="contentinfo")                        ✅
```

**Score: 6/10** — Pagina de listagem; falta entity index e paragrafo de contexto.

---

## 3. `generateBrandHTML` (Pagina de Marca)

```text
HEAD
 ├ SEO (title, description, canonical)                ✅
 ├ OpenGraph (title, desc, image)                     ✅
 ├ Twitter (card, title)                              ✅
 ├ AI policy (ai-content-policy, AI-context)           ✅
 └ JSON-LD @graph (Organization + Breadcrumb)         ✅

BODY
 ├ header (role="banner", nav)                        ✅
 │
 ├ main > article                                     ✅
 │   ├ H1                                             ✅
 │   ├ AI summary (llm-knowledge-layer)               ✅
 │   ├ hero image                                     ❌ Sem imagem hero
 │   │
 │   ├ definition paragraph                           ❌ Ausente
 │   ├ LLM knowledge layer                           ✅
 │   └ entity index                                   ❌ Ausente
 │
 └ footer (role="contentinfo")                        ✅
```

**Score: 6/10** — Mesmos gaps da homepage.

---

## 4. `generateModelHTML` (Pagina de Modelo)

```text
HEAD
 ├ SEO                                                ✅
 ├ OpenGraph                                          ✅
 ├ Twitter                                            ⚠️ Apenas card (falta desc/image)
 ├ AI policy                                          ✅
 └ JSON-LD @graph (Product + Breadcrumb)              ✅

BODY
 ├ header (role="banner", nav)                        ✅
 ├ main > article                                     ✅
 │   ├ H1                                             ✅
 │   ├ AI summary                                     ✅
 │   ├ hero image                                     ❌ Sem imagem
 │   ├ definition paragraph                           ⚠️ Usa model.notes (opcional)
 │   ├ LLM knowledge layer                           ✅
 │   └ entity index                                   ❌ Ausente
 │
 └ footer (role="contentinfo")                        ✅
```

**Score: 6/10**

---

## 5. `generateResinHTML` (Pagina de Resina/Parametros)

```text
HEAD
 ├ SEO (title, description, canonical, keywords)      ✅
 ├ OpenGraph (title, desc, image, type=product)        ✅
 ├ Twitter                                            ❌ Ausente
 ├ AI policy                                          ❌ Ausente
 └ JSON-LD (Organization + Product + Breadcrumb)      ✅ (mas 3 scripts separados, nao @graph)

BODY
 ├ header                                             ⚠️ Sem nav, sem role="banner"
 │
 ├ article                                            ❌ Sem <main>, sem <article>
 │   ├ H1                                             ✅ (mas solto no body)
 │   ├ AI summary                                     ❌ Ausente
 │   ├ hero image                                     ❌ Ausente
 │   │
 │   ├ definition paragraph                           ✅ (descricao da resina)
 │   ├ technology (parametros tecnicos)               ✅
 │   │
 │   ├ LLM knowledge layer                           ❌ Ausente
 │   │
 │   └ entity index                                   ❌ Ausente
 │
 └ footer                                             ❌ Ausente
```

**Score: 3/10** — Pagina mais deficiente. Sem estrutura semantica, sem AI layer, sem footer.

---

## 6. `generateSystemACatalogHTML` (Produtos e Depoimentos)

```text
HEAD
 ├ SEO                                                ✅
 ├ OpenGraph                                          ✅
 ├ Twitter (card, title)                              ✅
 ├ AI policy                                          ✅
 └ JSON-LD (Product/Review + Breadcrumb)              ✅

BODY
 ├ header (role="banner", nav)                        ✅
 │
 ├ main > article                                     ✅
 │   ├ H1                                             ✅
 │   ├ AI summary (llm-knowledge-layer)               ✅
 │   ├ hero image                                     ⚠️ Sem fetchpriority/eager
 │   │
 │   ├ definition paragraph                           ✅ (description)
 │   ├ features/benefits                              ✅
 │   │
 │   ├ LLM knowledge layer                           ✅
 │   │
 │   └ entity index                                   ❌ Ausente
 │
 └ footer                                             ❌ Ausente (nao tem footer)
```

**Score: 6/10** — Sem footer, sem entity index, imagem sem performance attrs.

---

## 7. `generateKnowledgeHubHTML` (Hub da Base de Conhecimento)

```text
HEAD
 ├ SEO                                                ✅
 ├ OpenGraph                                          ⚠️ Apenas title e type
 ├ Twitter                                            ❌ Ausente
 ├ AI policy                                          ❌ Ausente
 └ JSON-LD (WebSite)                                  ⚠️ Sem Breadcrumb

BODY
 ├ header                                             ❌ Ausente (sem header)
 │
 ├ article                                            ❌ Sem main, sem article
 │   ├ H1                                             ✅ (solto no body)
 │   ├ AI summary                                     ❌ Ausente
 │   ├ LLM knowledge layer                           ❌ Ausente
 │   └ entity index                                   ❌ Ausente
 │
 └ footer                                             ❌ Ausente
```

**Score: 2/10** — Pagina mais basica do sistema.

---

## 8. `generateKnowledgeCategoryHTML` (Categoria da Base)

```text
HEAD
 ├ SEO                                                ✅
 ├ OpenGraph                                          ⚠️ Apenas title
 ├ Twitter                                            ❌ Ausente
 ├ AI policy                                          ❌ Ausente
 └ JSON-LD (Breadcrumb)                               ✅

BODY
 ├ header                                             ❌ Ausente
 ├ article                                            ❌ Sem main, sem article
 │   ├ H1                                             ✅ (solto)
 │   ├ AI summary                                     ❌ Ausente
 │   └ entity index                                   ❌ Ausente
 │
 └ footer                                             ❌ Ausente
```

**Score: 2/10**

---

## Resumo Geral

| Gerador | Score | Problemas Criticos |
|---------|-------|-------------------|
| Knowledge Article | **9/10** | Entity index falta no SSR |
| Homepage | **6/10** | Sem entity index, sem paragrafo descritivo |
| Brand | **6/10** | Idem |
| Model | **6/10** | Twitter incompleto, sem entity index |
| System A Catalog | **6/10** | Sem footer, sem entity index, imagem sem perf |
| Resin | **3/10** | Sem main/article/nav/footer, sem AI layer |
| Knowledge Hub | **2/10** | Sem header/main/article/footer, sem AI |
| Knowledge Category | **2/10** | Idem |

---

## Plano de Correcao

### Prioridade 1 — Criticas (Score < 4)

**Resin Page**: Adicionar `<main>`, `<article>`, `<nav>`, `<footer>`, `ai-content-policy`, AI summary block, `@graph` unificado.

**Knowledge Hub**: Adicionar header com nav, `<main>`, `<article>`, footer, AI policy, AI summary, Breadcrumb.

**Knowledge Category**: Mesmo tratamento do Hub.

### Prioridade 2 — Melhorias (Score 6)

**Homepage, Brand, Model**: Adicionar entity index JSON-LD com termos mapeados do `entity-dictionary.ts`, paragrafo descritivo.

**Catalog**: Adicionar footer, `fetchpriority="high"` na imagem, entity index.

### Prioridade 3 — Refinamento (Score 9)

**Knowledge Article SSR**: Injetar entity index baseado em `matchEntities(content_html)` para artigos legados que nao passaram pelo pipeline `ai-orchestrate-content`.

### Implementacao

Todas as mudancas sao no arquivo `supabase/functions/seo-proxy/index.ts`:

1. Criar helper `buildStandardHeader()` e `buildStandardFooter()` para reutilizar em todas as paginas
2. Criar helper `buildAIHeadTags(context)` que gera ai-content-policy + AI-context + Twitter completo
3. Aplicar a estrutura padrao (header > main > article > H1 > summary > content > footer) em todas as 8 funcoes
4. Importar `matchEntities` do entity-dictionary e injetar entity graph JSON-LD em todas as paginas
5. Deploy da edge function

