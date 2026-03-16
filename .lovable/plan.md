

## Diagnóstico: CSS não carrega por falta de `postcss-import`

### Causa raiz

O `postcss.config.js` **não inclui o plugin `postcss-import`**. Sem ele, as declarações `@import` no `index.css` (como `@import './styles/intelligence-dark.css'`) **não são processadas** — o browser recebe um `@import` literal que, por estar DEPOIS de `@tailwind utilities` (que gera CSS real), é **ignorado silenciosamente** pela spec CSS (imports devem vir antes de qualquer regra).

### Solução mais simples (sem alterar config PostCSS)

Importar o CSS diretamente no componente via JavaScript import, que o Vite resolve nativamente:

| Arquivo | Ação |
|---|---|
| `src/components/SmartOpsLeadsList.tsx` | Adicionar `import "@/styles/intelligence-dark.css"` no topo |
| `src/index.css` | Remover a linha `@import './styles/intelligence-dark.css'` (evita duplicação/conflito) |

Isso garante que o Vite processa o CSS como módulo e o injeta corretamente no bundle, independente da ordem de `@tailwind` directives.

### Por que funciona

O Vite tem suporte nativo a CSS imports via `import "file.css"` em arquivos JS/TS. Diferente do PostCSS `@import`, o Vite resolve o arquivo, processa com PostCSS individualmente, e injeta o `<style>` no DOM. Não depende de posicionamento relativo a `@tailwind`.

