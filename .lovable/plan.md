

## Diagnóstico: CSS não está sendo aplicado

### Problema identificado

O componente `SmartOpsLeadsList` renderiza a estrutura corretamente (sidebar, filtros, lead rows), mas o **tema dark não é aplicado** — tudo aparece sem estilização sobre fundo branco.

**Duas causas raiz:**

1. **Google Fonts não carregadas** — O CSS referencia `Syne`, `DM Sans` e `DM Mono` mas essas fontes **não existem no `index.html`**. Apenas `Poppins` está declarada.

2. **CSS possivelmente sendo sobrescrito ou não aplicado corretamente** — O `@import './styles/intelligence-dark.css'` está entre `@tailwind utilities` e `@layer base` no `index.css`. Dependendo da ordem de processamento do PostCSS/Tailwind, as propriedades podem estar sendo sobrescritas por estilos base do Tailwind (ex: `background-color: transparent` nos resets). Além disso, o `body` em `index.html` aplica `background: hsl(var(--background))` que é light.

### Correção

| Arquivo | Ação |
|---|---|
| `index.html` | Adicionar `<link>` para Google Fonts: Syne (700,800), DM Sans (400,500,600), DM Mono (500,600) |
| `src/styles/intelligence-dark.css` | Garantir especificidade: adicionar `!important` nas propriedades visuais críticas (background, color) do `.intel-dark` e filhos diretos. Forçar `color-scheme: dark` no wrapper. |
| `src/index.css` | Mover o `@import` de `intelligence-dark.css` para **depois** de `@tailwind utilities` (confirmar que está no lugar certo) ou importar diretamente no componente |

### Detalhes das mudanças

**index.html** — Adicionar antes do `</head>`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@500&family=DM+Sans:wght@400;500;600&family=Syne:wght@700;800&display=swap" rel="stylesheet" />
```

**intelligence-dark.css** — Reforçar o escopo dark para vencer qualquer reset do Tailwind:
- `.intel-dark` e todos os elementos filhos devem ter `color` e `background` com seletores mais específicos ou com `!important` nos estilos base críticos
- Adicionar: `.intel-dark, .intel-dark * { box-sizing: border-box; }` e `.intel-dark { isolation: isolate; }` para criar um novo contexto de stacking
- Tratar herança do body adicionando `color: var(--id-ink) !important; background: var(--id-bg) !important;` ao `.intel-dark`

