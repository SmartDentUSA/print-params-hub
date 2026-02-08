

## Auditoria: Exposicao das Paginas de Conteudo para Buscadores e IAs

### Status Geral

A infraestrutura de SEO esta **bem construida** na maioria dos pontos. O sistema de SSR via SEO Proxy, sitemaps, robots.txt e schemas JSON-LD esta funcional. Porem, foram identificados **5 problemas** que precisam de correcao.

---

### O que esta funcionando corretamente

| Item | Status |
|---|---|
| robots.txt permite todos os bots (Google, Bing, GPTBot, ClaudeBot, Perplexity, etc.) | OK |
| Vercel rewrite roteia bots para o SEO Proxy | OK |
| SEO Proxy retorna HTML completo com schemas para artigos | OK |
| Sitemaps (PT, EN, ES, documentos, principal) estao ativos | OK |
| JSON-LD com Article, FAQPage, HowTo, VideoObject, BreadcrumbList | OK |
| Meta tags OG, Twitter Card, AI-context | OK |
| hreflang no client-side (SPA) para PT, EN, ES | OK |
| Canonical URLs apontando para dominio correto (`parametros.smartdent.com.br`) | OK |
| RSS/Atom feeds para descoberta de conteudo | OK |

---

### Problemas Encontrados

#### 1. CRITICO: `noindex` em paginas EN/ES sem traducao pre-existente

**Arquivo:** `src/components/KnowledgeSEOHead.tsx` (linhas 1052-1057)

Quando o idioma e EN ou ES e o artigo nao tem traducao salva no banco, o componente injeta `<meta name="robots" content="noindex, follow">`. Como apenas **14 de 281 artigos** possuem traducao, **267 artigos** recebem `noindex` nas versoes EN/ES.

Embora bots sejam roteados para o SEO Proxy (que nao tem esse problema), o Google pode renderizar JavaScript e encontrar essa tag. Com a traducao automatica agora implementada, as traducoes serao salvas gradualmente, mas o `noindex` e avaliado na renderizacao inicial (antes da traducao completar).

**Correcao:** Remover a logica de `noindex` condicional. Artigos em PT devem ser indexaveis em todas as rotas de idioma, ja que o sistema de traducao automatica salvara a traducao no banco para futuras visitas.

#### 2. MODERADO: Canonical errado no KnowledgeHub do SEO Proxy

**Arquivo:** `supabase/functions/seo-proxy/index.ts` (linha 1170)

O canonical da pagina principal da Base de Conhecimento aponta para `/conhecimento` em vez de `/base-conhecimento`. Isso cria um sinal conflitante com o sitemap e o SPA.

```
Atual:  <link rel="canonical" href=".../conhecimento" />
Correto: <link rel="canonical" href=".../base-conhecimento" />
```

**Correcao:** Atualizar a linha 1170 para usar `/base-conhecimento`.

#### 3. MODERADO: BreadcrumbList com dominio errado no client-side

**Arquivo:** `src/components/KnowledgeSEOHead.tsx` (linhas 917, 922, 928)

O schema BreadcrumbList usa `https://smartdent.com.br` como base em vez de `https://parametros.smartdent.com.br`. Isso confunde o Google sobre qual dominio e o dono do conteudo.

```
Atual:  "item": "https://smartdent.com.br/base-conhecimento"
Correto: "item": "https://parametros.smartdent.com.br/base-conhecimento"
```

**Correcao:** Substituir o baseUrl do BreadcrumbList para usar a constante `baseUrl` ja definida no arquivo.

#### 4. MODERADO: SEO Proxy nao inclui hreflang nas paginas de artigos

**Arquivo:** `supabase/functions/seo-proxy/index.ts` (funcao `generateKnowledgeArticleHTML`)

O HTML servido aos bots para artigos nao inclui tags `<link rel="alternate" hreflang="...">`. Isso impede que buscadores descubram as versoes multilinguais diretamente pelo HTML pre-renderizado.

**Correcao:** Adicionar hreflang tags (pt-BR, en-US, es-ES, x-default) no `<head>` do HTML gerado por `generateKnowledgeArticleHTML`.

#### 5. INFO: Dados SEO ausentes em parte dos artigos

| Campo ausente | Quantidade | Impacto |
|---|---|---|
| OG Image | 261 de 281 | Social sharing fica sem imagem |
| Hero Image (content_image_url) | 269 de 281 | Artigo sem imagem principal |
| Keywords | 4 de 281 | Baixo impacto |
| Meta Description | 3 de 281 | Moderado impacto |
| Autor | 1 de 281 | Baixo impacto (E-E-A-T) |

As OG images ausentes afetam compartilhamento em redes sociais mas nao impactam indexacao.

---

### Plano de Correcao

#### Arquivo 1: `src/components/KnowledgeSEOHead.tsx`

- **Linha 1053-1057:** Remover logica condicional de `noindex`. Usar `<meta name="robots" content="index, follow" />` para todos os idiomas
- **Linhas 917, 922, 928:** Trocar `https://smartdent.com.br` por `${baseUrl}` (`https://parametros.smartdent.com.br`) no BreadcrumbList

#### Arquivo 2: `supabase/functions/seo-proxy/index.ts`

- **Linha 1170:** Corrigir canonical de `/conhecimento` para `/base-conhecimento`
- **Funcao `generateKnowledgeArticleHTML`:** Adicionar tags hreflang no `<head>` do HTML para PT, EN, ES e x-default, usando o pattern `/base-conhecimento/`, `/en/knowledge-base/`, `/es/base-conocimiento/`

### Resultado Esperado

- 100% dos artigos indexaveis em todos os idiomas (PT, EN, ES)
- Canonical URLs consistentes entre SEO Proxy, SPA e sitemaps
- BreadcrumbList apontando para o dominio correto
- Bots descobrem versoes multilinguais via hreflang no HTML pre-renderizado

