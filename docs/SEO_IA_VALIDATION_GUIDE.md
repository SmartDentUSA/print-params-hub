# Guia de Validação e Monitoramento SEO/IA Regenerativa

## FASE 4: Validação e Monitoramento

Este documento orienta a validação e o monitoramento das otimizações implementadas nas Fases 1, 2 e 3.

---

## 1. Validação de Schemas (Structured Data)

### 1.1 Google Rich Results Test
**URL:** https://search.google.com/test/rich-results

#### Como testar:
1. Acesse a ferramenta
2. Insira a URL completa da página (exemplo: `https://parametros.smartdent.com.br/conhecimento/c/impressao-3d-odontologica`)
3. Clique em "Testar URL"

#### O que verificar:
- ✅ **TechArticle/Article Schema** detectado
- ✅ **BreadcrumbList Schema** detectado
- ✅ **FAQPage Schema** detectado (se houver FAQs)
- ✅ **HowTo Schema** detectado (se houver tutorial)
- ✅ **LearningResource Schema** detectado (novo - FASE 2)
- ✅ **VideoObject Schema** detectado (se houver vídeos)
- ✅ **Organization Schema** detectado
- ❌ Verificar se há **erros ou avisos críticos**

**URLs de teste prioritárias:**
- Homepage: `https://parametros.smartdent.com.br/`
- Produto: `https://parametros.smartdent.com.br/produtos/atos-resina-composta-direta-efeito-opaco`
- Artigo KB: `https://parametros.smartdent.com.br/conhecimento/c/impressao-3d-odontologica`
- Depoimento: `https://parametros.smartdent.com.br/depoimentos/[slug-depoimento]`

---

### 1.2 Schema Markup Validator (Schema.org)
**URL:** https://validator.schema.org/

#### Como testar:
1. Acesse a ferramenta
2. Cole a URL da página **OU** cole o código JSON-LD diretamente
3. Clique em "Validate"

#### O que verificar:
- ✅ **Nenhum erro crítico** (erros impedem rich snippets)
- ⚠️ **Avisos** são aceitáveis, mas devem ser revisados
- ✅ Todos os tipos de schema aparecem corretamente:
  - `@type: TechArticle` / `Article`
  - `@type: BreadcrumbList`
  - `@type: FAQPage`
  - `@type: HowTo`
  - `@type: LearningResource` ⭐ **NOVO (FASE 2)**
  - `@type: VideoObject`
  - `@type: Organization`
  - `@type: Product` (para produtos)
  - `@type: Review` (para depoimentos)

---

### 1.3 Bing Webmaster Tools - Markup Validator
**URL:** https://www.bing.com/webmasters/tools/markup-validator

#### Como testar:
1. Acesse Bing Webmaster Tools (cadastro necessário)
2. Navegue até **SEO → Markup Validator**
3. Insira a URL da página

#### O que verificar:
- ✅ Schema detectado pelo Bing
- ✅ Compatibilidade com Microsoft Search

---

## 2. Validação de Meta Tags e Open Graph

### 2.1 Facebook Sharing Debugger
**URL:** https://developers.facebook.com/tools/debug/

#### Como testar:
1. Insira a URL da página
2. Clique em "Debug"
3. Se necessário, clique em "Scrape Again" para limpar cache

#### O que verificar:
- ✅ `og:title` exibido corretamente
- ✅ `og:description` clara e informativa
- ✅ `og:image` carregando (imagem 1200x630px ideal)
- ✅ `og:type` = `article` (para artigos)
- ✅ **NOVO (FASE 3):** `article:section`, `article:tag`, `article:published_time`

---

### 2.2 Twitter Card Validator
**URL:** https://cards-dev.twitter.com/validator

#### Como testar:
1. Insira a URL da página
2. Clique em "Preview Card"

#### O que verificar:
- ✅ Twitter Card renderizado corretamente
- ✅ Tipo de card adequado:
  - `summary_large_image` para artigos com imagem
  - `player` para artigos com vídeos
- ✅ Imagem, título e descrição exibidos

---

### 2.3 LinkedIn Post Inspector
**URL:** https://www.linkedin.com/post-inspector/

#### Como testar:
1. Insira a URL da página
2. Clique em "Inspect"

#### O que verificar:
- ✅ Preview do link exibido corretamente
- ✅ Imagem, título e descrição aparecem

---

## 3. Validação de Meta Tags de IA (FASE 3)

### 3.1 Verificar Meta Tag AI-Context
Inspecionar elemento na página (F12 no navegador):

```html
<!-- Deve aparecer no <head> -->
<meta name="AI-context" content="Conteúdo técnico-científico sobre [categoria]. Público-alvo: cirurgiões-dentistas e técnicos em prótese dentária. Nível: Expert. Tipo: [Artigo técnico/Tutorial prático]." />
```

### 3.2 Testar com ChatGPT Search
1. Acesse ChatGPT (versão Plus ou Team com Search ativo)
2. Faça perguntas relacionadas ao seu conteúdo:
   - "Quais são os melhores parâmetros para impressão 3D de modelos odontológicos?"
   - "Como configurar resina ATOS para impressora 3D?"
3. **Verificar se o site aparece como referência**

### 3.3 Testar com Perplexity AI
**URL:** https://www.perplexity.ai/

1. Faça perguntas relacionadas ao conteúdo
2. Verifique se `parametros.smartdent.com.br` aparece nas fontes

---

## 4. Monitoramento no Google Search Console

### 4.1 Rich Snippets - FAQPage
**Caminho:** Google Search Console → **Melhorias → FAQ**

#### Métricas a acompanhar:
- 📈 **Páginas válidas com FAQ schema**
- 📊 **Impressões de rich snippets** (comparar antes/depois)
- 📊 **CTR médio** (meta: +20-30% após rich snippets)

**Prazo esperado:** 7-14 dias após implementação para aparecer dados

---

### 4.2 Breadcrumbs
**Caminho:** Google Search Console → **Melhorias → Breadcrumbs**

#### O que verificar:
- ✅ Breadcrumbs aparecendo nos resultados de busca
- ✅ Nenhum erro relatado

---

### 4.3 Desempenho de Busca
**Caminho:** Google Search Console → **Desempenho → Resultados de pesquisa**

#### Métricas a monitorar (antes vs. depois):
- 📊 **CTR médio** (meta: +15-30%)
- 📈 **Impressões** (meta: +10-20%)
- 📈 **Cliques** (meta: +20-40%)
- 📊 **Posição média** (meta: melhoria de 1-3 posições)

**Período de análise:** Comparar 4 semanas após vs. 4 semanas antes

---

### 4.4 URLs Indexadas
**Caminho:** Google Search Console → **Indexação → Páginas**

#### O que verificar:
- ✅ Todas as páginas importantes indexadas
- ❌ Verificar "Páginas excluídas" e resolver problemas

---

## 5. Monitoramento de IA Regenerativa (FASE 2 e 3)

### 5.1 Google AI Overviews (SGE)
**Como monitorar:**
- Fazer buscas no Google relacionadas ao conteúdo
- Verificar se o site aparece nas **AI Overviews** (caixas de IA do Google)

**Queries de teste:**
- "como configurar impressora 3D odontológica"
- "parâmetros resina ATOS impressão 3D"
- "melhores práticas impressão 3D dental"

**Prazo esperado:** 30-60 dias para indexação em AI Overviews

---

### 5.2 ChatGPT Search
**Como monitorar:**
- Fazer perguntas técnicas sobre o conteúdo do site
- Verificar se `parametros.smartdent.com.br` aparece nas **fontes citadas**

**Queries de teste:**
- "Quais os parâmetros ideais para impressão 3D de modelos odontológicos?"
- "Como configurar resina Smart Dent Bio Vitality?"

**Frequência:** Testar semanalmente

---

### 5.3 Perplexity AI
**URL:** https://www.perplexity.ai/

**Como monitorar:**
- Fazer perguntas relacionadas ao conteúdo
- Verificar se o site aparece nas **fontes** (footnotes)

**Frequência:** Testar semanalmente

---

## 6. Ferramentas de Monitoramento Contínuo

### 6.1 Google Analytics 4 (GA4)
**Métricas chave:**
- **Taxa de rejeição** (meta: redução de 10-20%)
- **Tempo médio na página** (meta: aumento de 20-30%)
- **Páginas por sessão** (meta: aumento de 15-25%)
- **Origem do tráfego:** Orgânico (Google Search)

### 6.2 Google Tag Manager
**Eventos a rastrear:**
- Cliques em CTAs (Call-to-Actions)
- Downloads de PDFs
- Visualizações de vídeos
- Tempo de rolagem na página

---

## 7. Checklist de Validação Completa

### Para CADA página importante:
- [ ] Testar no Google Rich Results Test
- [ ] Validar no Schema.org Validator
- [ ] Testar compartilhamento no Facebook Debugger
- [ ] Testar compartilhamento no Twitter Card Validator
- [ ] Verificar meta tag `AI-context` no código-fonte
- [ ] Fazer busca manual no Google e verificar snippet
- [ ] Testar no ChatGPT Search (1x por semana)
- [ ] Testar no Perplexity AI (1x por semana)

---

## 8. Cronograma de Monitoramento

### Semana 1-2 (Validação Inicial)
- ✅ Validar todos os schemas
- ✅ Verificar meta tags Open Graph
- ✅ Testar compartilhamento social

### Semana 3-4 (Primeiros dados GSC)
- 📊 Analisar Google Search Console
- 📊 Verificar rich snippets aparecendo

### Semana 5-8 (Análise de impacto)
- 📈 Comparar CTR antes/depois
- 📈 Comparar impressões antes/depois
- 📈 Analisar Google Analytics

### Mensal (Monitoramento contínuo)
- 🔍 Testar IA Regenerativa (ChatGPT, Perplexity)
- 🔍 Revisar erros no GSC
- 🔍 Atualizar schemas se necessário

---

## 9. KPIs de Sucesso

### SEO Tradicional (Prazo: 30-60 dias)
- ✅ **CTR:** Aumento de **20-30%**
- ✅ **Impressões:** Aumento de **10-20%**
- ✅ **Posição Média:** Melhoria de **1-3 posições**
- ✅ **Rich Snippets:** Aparecem em **80%+ das páginas elegíveis**

### IA Regenerativa (Prazo: 60-90 dias)
- ✅ **ChatGPT Search:** Site citado em **30%+ das queries relacionadas**
- ✅ **Perplexity AI:** Site aparece nas **fontes** em **25%+ das queries**
- ✅ **Google AI Overviews:** Site citado em **15%+ das queries SGE**

### E-E-A-T (Expertise, Authoritativeness, Trustworthiness)
- ✅ **OrganizationSchema:** Inclui `expertise`, `certifications`, `awards`
- ✅ **LearningResource Schema:** Implementado em **100% dos artigos**
- ✅ **TechArticle Schema:** Inclui `proficiencyLevel: "Expert"` e autor com `sameAs` links

---

## 10. Troubleshooting

### Problema: Rich Snippets não aparecem no Google
**Soluções:**
1. Aguardar 14-30 dias (Google leva tempo para indexar)
2. Verificar erros no Google Search Console → Melhorias
3. Re-validar schemas no Rich Results Test
4. Solicitar reindexação da página no GSC

### Problema: Meta tags não aparecem no Facebook
**Soluções:**
1. Usar Facebook Debugger e clicar em "Scrape Again"
2. Verificar se `og:image` está acessível (não bloqueado por robots.txt)
3. Garantir que imagem tem **pelo menos 600x315px** (ideal: 1200x630px)

### Problema: ChatGPT/Perplexity não citam o site
**Soluções:**
1. Aguardar 60-90 dias (IA demora mais para indexar)
2. Garantir que `LearningResource Schema` está implementado
3. Verificar se meta tag `AI-context` está presente
4. Criar conteúdo mais rico e detalhado (IA prefere fontes completas)

---

## 11. Recursos Adicionais

### Documentação Oficial
- [Google Search Central - Structured Data](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data)
- [Schema.org Documentation](https://schema.org/docs/documents.html)
- [Open Graph Protocol](https://ogp.me/)

### Ferramentas Online
- [Rich Results Test](https://search.google.com/test/rich-results)
- [Schema Markup Validator](https://validator.schema.org/)
- [Facebook Debugger](https://developers.facebook.com/tools/debug/)
- [Twitter Card Validator](https://cards-dev.twitter.com/validator)

---

**Última atualização:** 2025-11-19
**Responsável:** Equipe Smart Dent  
**Versão:** 1.0 (Implementação completa das Fases 1, 2 e 3)
