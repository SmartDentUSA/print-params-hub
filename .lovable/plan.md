

# Auditoria: Uso dos Dados do Sistema nos Geradores HTML

## Fonte de Dados Central: `fetchKnowledgeContext()`

Busca 6 datasets em paralelo via `Promise.all()`:

```text
fetchKnowledgeContext(supabase, opts?)
 ├── system_a_catalog (category=product)  → products[]
 ├── knowledge_categories (enabled=true)  → categories[]
 ├── authors (active=true)                → authors[]
 ├── knowledge_contents (active=true)     → articles[]
 ├── system_a_catalog (video_testimonial) → testimonials[]
 └── external_links (approved=true)       → externalLinks[]
```

## Uso por Gerador

| Gerador | fetchKnowledgeContext | Dados Próprios | Helpers Usados |
|---------|---------------------|----------------|----------------|
| Homepage | ✅ Full (limit=5) | brands | CrawlerPolicy, EntityMetas, Nav, Citations, LLMLayer, EntityIndex, KnowledgeGraph |
| Brand | ✅ limit=3 | brands+models | CrawlerPolicy, EntityMetas, Nav, LLMLayer, EntityIndex, KnowledgeGraph |
| Model | ✅ limit=3 | models+parameter_sets | CrawlerPolicy, EntityMetas, Nav, LLMLayer, EntityIndex |
| Resin | ✅ limit=3 | parameter_sets+resins | CrawlerPolicy, EntityMetas, Nav, Citations, LLMLayer, EntityIndex |
| Catalog | ✅ limit=3 | system_a_catalog | CrawlerPolicy, EntityMetas, Nav, Citations, LLMLayer, EntityIndex, KnowledgeGraph |
| KB Hub | ✅ Full | (uses ctx.categories) | CrawlerPolicy, EntityMetas, Nav, LLMLayer, EntityIndex, KnowledgeGraph |
| KB Category | ✅ categoryId filtered | knowledge_contents | CrawlerPolicy, EntityMetas, Nav, LLMLayer, EntityIndex |
| KB Article | ❌ **Parcial** | knowledge_contents+authors+videos+resins | EntityIndex (sem knowledgeCtx) |

---

## Anomalia Critica: `generateKnowledgeArticleHTML`

O gerador mais complexo e importante **nao usa** os novos helpers de integração:

```text
KB Article — Helpers NÃO utilizados:
 ├── buildAICrawlerPolicy()          ❌ Ausente
 ├── buildEntityReferenceMetas()     ❌ Ausente
 ├── buildStandardHeaderWithNav()    ❌ Usa header inline proprio
 ├── buildCitationBlocks()           ❌ Ausente
 ├── buildLLMKnowledgeLayer()        ❌ Ausente
 ├── buildEntityIndexSection()       ❌ Ausente
 ├── buildKnowledgeGraphJsonLd()     ❌ Ausente
 └── buildEntityIndexJsonLd()        ⚠️  Usa sem knowledgeCtx (só estático)
```

Linha 1890: `buildEntityIndexJsonLd(...)` é chamado **sem** o segundo parâmetro `knowledgeCtx`, então só usa o dicionário estático de 12 termos — não injeta produtos, autores nem artigos reais do banco.

Linha 1759-1767: Header é construído inline em vez de usar `buildStandardHeaderWithNav(knowledgeCtx)`, então **não tem navegação por categorias**.

---

## Dados do Sistema: O Que é Usado vs. O Que Poderia Ser Usado

### ✅ Dados Corretamente Consumidos (7 geradores)

| Dataset | Usado em HEAD | Usado em BODY | Formato |
|---------|--------------|---------------|---------|
| products (system_a_catalog) | entity:product metas, JSON-LD Product nodes | EntityIndex links, LLMLayer dl | ✅ Completo |
| categories (knowledge_categories) | — | Nav links, EntityIndex | ✅ Completo |
| authors | entity:expert metas, JSON-LD Person nodes | EntityIndex lista, LLMLayer dl | ✅ Completo |
| articles (knowledge_contents) | JSON-LD Article nodes | EntityIndex links, LLMLayer dl | ✅ Completo |
| testimonials | — | Citation blockquotes | ✅ Completo |
| externalLinks | — | ❌ **Nunca renderizado** | ❌ Fail |

### ❌ Dados NÃO Consumidos no KB Article

| Dataset | Disponível | Usado | Gap |
|---------|-----------|-------|-----|
| products | Sim (via knowledgeCtx) | ❌ Não | Sem entity:product metas, sem Product JSON-LD nodes, sem EntityIndex |
| categories | Sim | ❌ Não | Sem nav por categorias |
| authors (do ctx) | Sim | ❌ Não | Usa apenas o author do próprio artigo |
| articles relacionados | Sim | ❌ Não | Sem links para artigos da mesma categoria |
| testimonials | Sim | ❌ Não | Sem citation blocks |
| externalLinks | Sim | ❌ Não | Nunca usado em nenhum gerador |

---

## Problema Global: `externalLinks` Nunca Renderizado

O `fetchKnowledgeContext` busca external_links aprovados, mas **nenhum** dos 8 geradores usa `knowledgeCtx.externalLinks` em qualquer helper ou template. Os dados são buscados e descartados.

---

## Plano de Correção (3 items)

### 1. Integrar KB Article com Knowledge System

No `generateKnowledgeArticleHTML` (linhas 1427-1896):

- Passar `knowledgeCtx` para `buildEntityIndexJsonLd()` (linha 1890)
- Substituir header inline por `buildStandardHeaderWithNav(knowledgeCtx)`
- Adicionar `buildAICrawlerPolicy()` no HEAD
- Adicionar `buildEntityReferenceMetas()` no HEAD
- Adicionar `buildCitationBlocks(knowledgeCtx)` antes do footer
- Adicionar `buildLLMKnowledgeLayer()` antes do entity index
- Adicionar `buildEntityIndexSection(knowledgeCtx)` antes do footer
- Adicionar `buildKnowledgeGraphJsonLd(knowledgeCtx)` no HEAD

### 2. Implementar renderização de `externalLinks`

Criar helper `buildExternalReferencesSection(knowledgeCtx)` que renderiza links externos aprovados como:
```html
<section data-section="external-references">
  <h3>Referências Externas</h3>
  <ul><li><a href="..." rel="noopener">Nome</a></li></ul>
</section>
```
Adicionar ao `buildEntityIndexSection()` existente.

### 3. Adicionar external links ao JSON-LD

No `buildEntityIndexJsonLd()`, adicionar external links como `mentions` com `@type: "WebPage"`.

---

## Resumo da Auditoria

| Aspecto | Status | Detalhe |
|---------|--------|---------|
| fetchKnowledgeContext | ✅ 8/8 geradores | Busca 6 datasets em paralelo |
| Helpers de HEAD (CrawlerPolicy, EntityMetas) | ⚠️ 7/8 | KB Article não usa |
| Helpers de BODY (Nav, Citations, LLMLayer, EntityIndex) | ⚠️ 7/8 | KB Article não usa |
| EntityIndex JSON-LD com dados dinâmicos | ⚠️ 7/8 | KB Article usa só estático |
| KnowledgeGraph JSON-LD | ⚠️ 5/8 | KB Article, Model, KB Category não usam |
| externalLinks renderização | ❌ 0/8 | Dados buscados mas nunca renderizados |
| Header com nav de categorias | ⚠️ 7/8 | KB Article usa header inline |

**Score geral de uso de dados: 7.5/10** — O gerador mais importante (KB Article) é o único que não está integrado com o Knowledge System.

