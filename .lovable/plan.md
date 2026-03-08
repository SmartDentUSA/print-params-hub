

# Integração do Knowledge System nos Geradores HTML do seo-proxy

## Objetivo

Transformar cada página HTML gerada pelo `seo-proxy` em um **semantic entity document** que consome dados reais do sistema (produtos, categorias, especialistas, artigos, depoimentos, links externos) para alimentar um Knowledge Layer completo para LLMs e motores de busca.

## Estado Atual vs. Desejado

Atualmente o seo-proxy usa um dicionário estático (`ENTITY_INDEX`) com ~12 termos fixos. A proposta é substituí-lo por dados dinâmicos do banco de dados, criando um grafo de conhecimento real.

## Arquitetura da Integração

```text
┌─────────────────────────────────────────────────┐
│           seo-proxy/index.ts                     │
│                                                   │
│  fetchKnowledgeContext(supabase, pageContext)     │
│    ├── products (system_a_catalog)                │
│    ├── categories (knowledge_categories)          │
│    ├── experts/authors (authors)                  │
│    ├── articles (knowledge_contents)              │
│    ├── testimonials (system_a_catalog)            │
│    ├── external_links (external_links)            │
│    └── resins (resins)                            │
│                                                   │
│  buildKnowledgeLayer(data)                        │
│    ├── HEAD: entity meta tags                     │
│    ├── HEAD: ai-crawler-policy                    │
│    ├── HEAD: JSON-LD @graph enrichment            │
│    ├── BODY: nav with categories/products         │
│    ├── BODY: citation blocks                      │
│    ├── BODY: LLM knowledge layer section          │
│    └── BODY: entity index section                 │
└─────────────────────────────────────────────────┘
```

## Implementação (1 arquivo: `seo-proxy/index.ts`)

### 1. Nova função: `fetchKnowledgeContext()`

Busca dados do sistema em paralelo para montar o contexto de conhecimento da página:

- **Products**: Top 5 produtos ativos do `system_a_catalog` (category=product)
- **Categories**: Todas as categorias ativas do `knowledge_categories`
- **Authors/Experts**: Autores com artigos publicados
- **Related Articles**: 5 artigos mais recentes da mesma categoria (quando aplicável)
- **Testimonials**: 3 depoimentos recentes (category=video_testimonial)
- **External Links**: Links externos aprovados e relevantes

Usa `Promise.all()` para executar as queries em paralelo sem impactar performance.

### 2. HEAD — Knowledge Metadata Layer

#### 2.1 AI Crawler Policy (novo)
```html
<meta name="robots" content="index, follow" />
<meta name="ai-crawler-policy" content="allow: GPTBot, ClaudeBot, PerplexityBot, Google-Extended" />
```

#### 2.2 Entity References (novo)
Meta tags dinâmicas baseadas nos dados reais da página:
```html
<meta name="entity:product" content="SmartPrint Model" />
<meta name="entity:technology" content="Impressão 3D LCD" />
<meta name="entity:organization" content="Smart Dent" />
<meta name="entity:expert" content="Dr. João Silva" />
```

#### 2.3 JSON-LD @graph expandido
Adicionar ao @graph existente as entidades reais:
- `Product` nodes para produtos relacionados
- `Person` nodes para especialistas
- `MedicalEntity` quando aplicável
- `Article` nodes para artigos relacionados

### 3. BODY — Header com navegação por entidades

O `buildStandardHeader()` será expandido para incluir navegação por categorias e seções de produtos vindos do banco:

```html
<header role="banner">
  <nav aria-label="Principal">...</nav>
  <nav aria-label="Categorias" data-section="knowledge-nav">
    <a href="/base-conhecimento/a">Impressoras</a>
    <a href="/base-conhecimento/b">Resinas</a>
    <a href="/produtos">Produtos</a>
  </nav>
</header>
```

### 4. BODY — Citation Blocks (novo helper)

`buildCitationBlocks()` — gera blocos de citação com dados reais de especialistas e depoimentos:

```html
<section data-section="citations" class="llm-citation-layer">
  <blockquote cite="..." data-expert="Dr. João Silva" data-role="Especialista">
    Texto do depoimento ou citação técnica...
  </blockquote>
</section>
```

### 5. BODY — LLM Knowledge Layer expandido (novo helper)

`buildLLMKnowledgeLayer()` — seção estruturada com dados do sistema:

```html
<section data-section="knowledge-graph" class="llm-knowledge-layer" 
         aria-label="Dados Estruturados para IA" 
         style="position:absolute;left:-9999px;...">
  <dl>
    <dt>Entity</dt><dd>Resina SmartPrint</dd>
    <dt>Category</dt><dd>Material para impressão 3D</dd>
    <dt>Organization</dt><dd>Smart Dent</dd>
    <dt>Applications</dt><dd>modelos dentários, guias cirúrgicos</dd>
    <dt>Technology</dt><dd>impressão 3D LCD</dd>
    <dt>Experts</dt><dd>Dr. João, Dra. Maria</dd>
    <dt>Related Products</dt><dd>SmartPrint Model, SmartPrint Surgical</dd>
  </dl>
</section>
```

### 6. BODY — Entity Index expandido (novo helper)

`buildEntityIndexSection()` — índice visível de entidades no final da página:

```html
<section data-section="entity-index" aria-label="Índice de Entidades">
  <h2>Entidades Relacionadas</h2>
  <nav>
    <h3>Produtos</h3>
    <ul><li><a href="/produtos/smartprint">SmartPrint Model</a></li></ul>
    <h3>Artigos</h3>
    <ul><li><a href="/base-conhecimento/b/guia-resinas">Guia de Resinas</a></li></ul>
    <h3>Especialistas</h3>
    <ul><li>Dr. João Silva - Prótese Dentária</li></ul>
  </nav>
</section>
```

### 7. Entity Index JSON-LD expandido

Substituir o `buildEntityIndexJsonLd()` estático por um que combine:
- Entidades do dicionário estático (Wikidata)
- Produtos reais do `system_a_catalog`
- Autores reais da tabela `authors`
- Artigos relacionados do `knowledge_contents`

## Aplicação por Gerador

| Gerador | Knowledge Context | Nav Expandido | Citations | LLM Layer | Entity Index |
|---------|-------------------|---------------|-----------|-----------|--------------|
| Homepage | Full (products, categories, experts) | Categories + Products | Top testimonials | Completo | Todos |
| Brand | Products da marca | Categories | — | Marca + Produtos | Produtos |
| Model | Resinas do modelo | Categories | — | Modelo + Resinas | Resinas |
| Resin | Produto específico | Categories | Testimonials da resina | Completo | Relacionados |
| Catalog | Produto/Depoimento | Categories + Products | Self (se testimonial) | Completo | Relacionados |
| KB Hub | All categories | Categories | — | Categorias | Categorias + Artigos |
| KB Category | Artigos da categoria | Categories | — | Categoria | Artigos |
| KB Article | Full context | Categories | Expert citations | Completo | Todos |

## Performance

- Todas as queries extras usam `Promise.all()` em paralelo
- Limite de 5-10 itens por query (sem impacto significativo)
- Cache HTTP existente (`s-maxage=3600`) protege contra queries repetidas
- Total estimado: +3 queries por página (~50ms extra)

## Resumo das Mudanças

Arquivo único: `supabase/functions/seo-proxy/index.ts`

1. Nova função `fetchKnowledgeContext()` — busca dados do sistema em paralelo
2. Novo helper `buildAICrawlerPolicy()` — meta tags de crawler AI
3. Novo helper `buildEntityReferenceMetas()` — entity:* meta tags
4. Expandir `buildStandardHeader()` — nav com categorias/produtos do DB
5. Novo helper `buildCitationBlocks()` — citações com dados reais
6. Novo helper `buildLLMKnowledgeLayer()` — knowledge layer estruturado com dados do DB
7. Novo helper `buildEntityIndexSection()` — índice de entidades no final da página
8. Expandir `buildEntityIndexJsonLd()` — combinar dicionário estático + dados reais
9. Expandir JSON-LD @graph de cada gerador — adicionar Product/Person/Article nodes reais
10. Aplicar todos os novos helpers nos 8 geradores

