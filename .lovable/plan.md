

# Performance / Core Web Vitals - De 7/10 para 9/10

## Diagnostico Atual (7/10)

O principal gargalo e o carregamento externo do Google Fonts (Poppins), que e render-blocking e adiciona ~200-400ms ao LCP. Alem disso, GTM e Meta Pixel no `<head>` competem por bandwidth critica.

---

## Acoes de Implementacao

### 1. Self-host da fonte Poppins (impacto: +1.0)

**Problema:** A tag `<link href="https://fonts.googleapis.com/css2?family=Poppins...">` no `index.html` faz 2 requests externos (CSS + WOFF2) antes de renderizar texto.

**Solucao:**
- Baixar os 4 pesos da Poppins (300, 400, 600, 700) em formato WOFF2
- Salvar em `public/fonts/`
- Criar `@font-face` declarations no CSS critico inline do `index.html`
- Remover o `<link>` do Google Fonts e os `preconnect`/`dns-prefetch` para `fonts.googleapis.com` e `fonts.gstatic.com`
- Adicionar `<link rel="preload" as="font" type="font/woff2" href="/fonts/poppins-400.woff2" crossorigin>` para o peso principal (400)

**Arquivos alterados:**
- `index.html` (remover link externo, adicionar @font-face inline e preload)
- `public/fonts/` (novos arquivos WOFF2)

### 2. Defer GTM e Meta Pixel (impacto: +0.5)

**Problema:** Ambos os scripts estao no `<head>` e competem com recursos criticos durante o parse inicial.

**Solucao:**
- Mover o script GTM para o final do `<body>` (antes de `</body>`)
- Mover o script Meta Pixel para o final do `<body>`
- Ambos ja usam `async=true` internamente, mas estar no `<head>` ainda causa parser blocking

**Arquivo alterado:** `index.html`

### 3. Adicionar `content-visibility: auto` para lazy rendering (impacto: +0.5)

**Problema:** Secoes abaixo da dobra sao renderizadas imediatamente, consumindo recursos do browser.

**Solucao:**
- Adicionar `content-visibility: auto` com `contain-intrinsic-size` em secoes que ficam abaixo da dobra nos estilos de artigo
- Aplicar em `.article-content section`, `aside`, `.knowledge-sidebar`, e secoes de FAQ

**Arquivo alterado:** `src/styles/article-content.css`

### 4. Remover CSS preload hack com onload (impacto: +0.5)

**Problema:** A linha `<link rel="preload" href="/src/index.css" as="style" onload="this.onload=null;this.rel='stylesheet'">` pode causar FOUC (Flash of Unstyled Content) e falha em browsers antigos.

**Solucao:**
- Remover essa linha - o Vite ja faz code-splitting e injeta CSS automaticamente via `<script type="module">`
- O CSS critico inline no `<head>` ja cobre o above-the-fold

**Arquivo alterado:** `index.html`

---

## Resultado Esperado

| Item | Antes | Depois |
|---|---|---|
| Google Fonts externo | Sim (-1.0) | Self-hosted (+1.0) |
| Font preload | Nenhum (-0.5) | Preload WOFF2 400 |
| GTM/Pixel no head | Blocking (-0.5) | Deferred ao body |
| content-visibility | Nenhum (-0.5) | auto em below-fold |
| CSS preload hack | onload hack (-0.5) | Removido (Vite nativo) |
| **Nota Final** | **7/10** | **9/10** |

---

## Secao Tecnica

**Fontes a baixar (WOFF2, subset latin-ext):**
- `poppins-300.woff2` (Light)
- `poppins-400.woff2` (Regular)
- `poppins-600.woff2` (SemiBold)
- `poppins-700.woff2` (Bold)

**@font-face inline no index.html:**
```css
@font-face {
  font-family: 'Poppins';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/poppins-400.woff2') format('woff2');
}
```
(Repetido para 300, 600, 700)

**content-visibility em article-content.css:**
```css
.article-content section:nth-child(n+3),
.article-content .knowledge-faq,
.article-content aside {
  content-visibility: auto;
  contain-intrinsic-size: auto 500px;
}
```

