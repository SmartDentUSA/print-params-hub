

## Diagnostico: Idioma Nao Muda nos Conteudos e Paginas

### Problemas Encontrados

Foram identificados **3 problemas principais** que impedem a troca correta de idioma:

---

### Problema 1: Links do KnowledgeFeed sempre apontam para rota em Portugues

**Arquivo:** `src/components/KnowledgeFeed.tsx`

Os links dos artigos no feed (carrossel) estao hardcoded para a rota portuguesa `/base-conhecimento/...`, independentemente do idioma selecionado:

- **Linha 107:** Link fallback "Explorar Base de Conhecimento" -> `/base-conhecimento`
- **Linha 136:** `articleUrl` construido como `/base-conhecimento/${categoryLetter}/${slug}` (sempre PT)
- **Linha 198:** Botao "Ver todos" -> `/base-conhecimento`

**Correcao:** Usar o `language` do contexto para construir o path correto (`/en/knowledge-base/...` ou `/es/base-conocimiento/...`).

---

### Problema 2: Artigos Relacionados no KnowledgeContentViewer nao traduzem titulo/excerpt

**Arquivo:** `src/components/KnowledgeContentViewer.tsx`

Na secao de "Artigos Relacionados" (linhas 419-431), os titulos e excerpts sao exibidos sempre em portugues:

```tsx
// Linha 430-431: Sempre mostra article.title e article.excerpt (PT)
<h4>{article.title}</h4>
<p>{article.excerpt}</p>
```

**Correcao:** Aplicar a mesma logica de selecao de idioma ja usada no `displayContent` (linhas 196-221) para os artigos relacionados.

---

### Problema 3: Paginas secundarias totalmente hardcoded em Portugues

Varias paginas nao utilizam o sistema de traducao (`useLanguage`/`t()`):

| Pagina | Arquivo | Problemas |
|--------|---------|-----------|
| **ProductPage** | `src/pages/ProductPage.tsx` | Sem `useLanguage()`. Textos "Voltar", "Beneficios", "Caracteristicas", "Opcoes Disponiveis" hardcoded em PT. `og:locale` fixo em `pt_BR`. |
| **TestimonialPage** | `src/pages/TestimonialPage.tsx` | Sem `useLanguage()`. Textos "Voltar", "Transcricao do Depoimento" hardcoded em PT. |
| **CategoryPage** | `src/pages/CategoryPage.tsx` | Sem `useLanguage()`. Textos "Voltar", "Categoria Principal", "Subcategoria", "Publico-Alvo" hardcoded em PT. `og:locale` fixo em `pt_BR`. |
| **About** | `src/pages/About.tsx` | Sem `useLanguage()`. "Missao", "Visao", "Valores", "Nossos Diferenciais", "Videos Institucionais" hardcoded em PT. |
| **Footer** | `src/components/Footer.tsx` | "Contato", "Links", "Redes Sociais", "Sobre Nos", "Base de Conhecimento", "Todos os direitos reservados" hardcoded em PT. Link `/base-conhecimento` fixo. |
| **KnowledgeFAQ** | `src/components/KnowledgeFAQ.tsx` | "Perguntas Frequentes" e texto de rodape hardcoded em PT. |
| **Index** (sem dados) | `src/pages/Index.tsx` | Todos os textos do estado vazio hardcoded em PT. |

---

### Plano de Implementacao

#### Fase 1 - Correcoes Criticas (Links quebrados por idioma)

**1.1 Corrigir KnowledgeFeed.tsx**
- Importar `language` do contexto (ja importado)
- Criar helper `getBasePath()` que retorna o path correto por idioma
- Atualizar `articleUrl` (linha 136) para usar o basePath correto
- Atualizar link fallback (linha 107) e botao "Ver todos" (linha 198)

**1.2 Corrigir artigos relacionados no KnowledgeContentViewer.tsx**
- Nas linhas 430-431, usar logica de selecao de idioma:
  ```tsx
  <h4>{language === 'es' && article.title_es ? article.title_es 
    : language === 'en' && article.title_en ? article.title_en 
    : article.title}</h4>
  ```
- Aplicar o mesmo para `article.excerpt`

#### Fase 2 - Internacionalizacao das Paginas Secundarias

**2.1 Footer.tsx**
- Adicionar `useLanguage()` e usar `t()` para labels
- Corrigir link `/base-conhecimento` para usar path por idioma
- Traduzir "Contato", "Links", "Redes Sociais", etc.

**2.2 KnowledgeFAQ.tsx**
- Adicionar `useLanguage()` 
- Traduzir "Perguntas Frequentes" e texto de rodape

**2.3 ProductPage.tsx**
- Adicionar `useLanguage()` e `t()`
- Traduzir botoes, titulos de secoes, `og:locale` dinamico

**2.4 TestimonialPage.tsx**
- Adicionar `useLanguage()` e `t()`
- Traduzir textos estaticos

**2.5 CategoryPage.tsx**
- Adicionar `useLanguage()` e `t()`
- Traduzir textos e `og:locale` dinamico

**2.6 About.tsx**
- Adicionar `useLanguage()` e `t()`
- Traduzir titulos das secoes

**2.7 Index.tsx (estado vazio)**
- Adicionar `useLanguage()` e `t()`
- Traduzir mensagens do estado sem dados

#### Fase 3 - Adicionar chaves de traducao nos locales

**3.1 Adicionar chaves faltantes em `src/locales/pt.json`, `en.json`, `es.json`**

Chaves a adicionar:
- `common.back` / `common.loading`
- `product.benefits` / `product.features` / `product.options`
- `testimonial.transcription`
- `category.main_category` / `category.subcategory` / `category.target_audience`
- `about.mission` / `about.vision` / `about.values` / `about.differentiators`
- `footer.contact` / `footer.links` / `footer.social` / `footer.about_us` / `footer.all_rights`
- `faq.title` / `faq.subtitle`

---

### Arquivos a Modificar

| Arquivo | Tipo de Mudanca |
|---------|-----------------|
| `src/components/KnowledgeFeed.tsx` | Corrigir links por idioma |
| `src/components/KnowledgeContentViewer.tsx` | Traduzir artigos relacionados |
| `src/components/Footer.tsx` | Adicionar i18n completo |
| `src/components/KnowledgeFAQ.tsx` | Adicionar i18n |
| `src/pages/ProductPage.tsx` | Adicionar i18n |
| `src/pages/TestimonialPage.tsx` | Adicionar i18n |
| `src/pages/CategoryPage.tsx` | Adicionar i18n |
| `src/pages/About.tsx` | Adicionar i18n |
| `src/pages/Index.tsx` | Adicionar i18n (estado vazio) |
| `src/locales/pt.json` | Adicionar chaves faltantes |
| `src/locales/en.json` | Adicionar traducoes EN |
| `src/locales/es.json` | Adicionar traducoes ES |

### Resultado Esperado

Apos as correcoes:
- Trocar o idioma no seletor refletira imediatamente em **todas** as paginas
- Links do feed de artigos navegarao para a rota correta do idioma selecionado
- Artigos relacionados mostrarao titulo/excerpt no idioma correto
- Todas as paginas secundarias (Produto, Depoimento, Categoria, Sobre) terao textos traduzidos
- Footer e FAQ respeitarao o idioma selecionado

