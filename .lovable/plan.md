# Auditoria de marca — KB vs. Manual Smart Dent

## O que o manual define

- **Fonte principal:** Host Grotesk
- **Paleta oficial:**
  - `#EDF0F7` (fundo claro)
  - `#8B9EB4` (cinza-azulado médio)
  - `#546085` (azul institucional)
  - `#363E56` (navy escuro — cor principal)
  - `#DE6E37` (laranja — único acento vibrante)
- **Tom visual:** minimalista, sofisticado, alto valor percebido.

## O que a KB usa hoje (auditado)

| Item | Arquivo | Valor atual | Status |
|---|---|---|---|
| Fonte do shell KB | `src/components/knowledge/kbStyles.ts` | `Inter` | ❌ fora da marca |
| Fonte de artigo | `src/styles/knowledge-base.css` + `index.html` | `Poppins` | ❌ fora da marca |
| Cor primária de artigos | `src/styles/knowledge-base.css` (`--kb-primary`) | `#0369a1` (sky-700) | ❌ azul errado |
| Cor de chips/tabs/CTAs no shell | `src/components/knowledge/kbStyles.ts` | `#1A73E8` (Google blue) | ❌ azul errado |
| Nav ativo da sidebar | `src/components/knowledge/shell/kbShellStyles.ts` (`.kbs-nav-btn.on`, `.kbs-toptab.on`) | `#0F172A` (slate-900) | ⚠️ próximo, mas não é o navy da marca |
| Card CTA "Soluções" | `.kbs-cta` | gradiente `#1E3A5F → #0F172A` | ⚠️ tom navy genérico |
| Fundo do app KB | `.kbs-root` | `#EEF1F6` | ⚠️ próximo, deve ser `#EDF0F7` |
| Acento laranja `#DE6E37` | — | não usado em lugar nenhum | ❌ ausente |

**Conclusão:** KB não segue a marca. Fonte, azul e ausência do laranja são os desvios mais visíveis.

## Plano de correção (somente KB)

Escopo restrito aos arquivos da Base de Conhecimento — nada em outras áreas do app.

### 1. Tokens de marca no KB
Adicionar em `src/styles/knowledge-base.css` (topo, `:root`):

```
--sd-navy: #363E56;      /* primária */
--sd-blue: #546085;      /* secundária */
--sd-cool: #8B9EB4;      /* neutros frios */
--sd-bg:   #EDF0F7;      /* fundo */
--sd-accent: #DE6E37;    /* laranja — só destaque */
```

Reapontar as variáveis existentes:
- `--kb-primary: var(--sd-navy)`
- `--kb-primary-light: var(--sd-blue)`
- `--kb-accent: var(--sd-accent)`

### 2. Tipografia Host Grotesk
- Carregar Host Grotesk via Google Fonts em `index.html` (`<link>` preconnect + `family=Host+Grotesk:wght@400;500;600;700;800`).
- Trocar `font-family` em:
  - `src/components/knowledge/kbStyles.ts` (`.kb-root`)
  - `src/components/knowledge/shell/kbShellStyles.ts` (adicionar em `.kbs-root`)
  - `src/styles/knowledge-base.css` (`.knowledge-article`)
- Ordem: `'Host Grotesk', 'Poppins', system-ui, sans-serif` (fallback protege enquanto a fonte não carrega).
- Não trocar Poppins no resto do app (fora do escopo).

### 3. Substituição de cores no shell KB
Editar `src/components/knowledge/kbStyles.ts`:
- Todo `#1A73E8` (tabs on, chips on, sort/view, action-btn, model-item) → `#363E56` (navy).
- Sombra `rgba(26,115,232,…)` → `rgba(54,62,86,…)`.
- Hover accent (`kb-card:hover` border) → `rgba(84,96,133,.35)`.

Editar `src/components/knowledge/shell/kbShellStyles.ts`:
- `.kbs-root` background `#EEF1F6` → `#EDF0F7`.
- `.kbs-nav-btn.on` e `.kbs-toptab.on` background `#0F172A` → `#363E56`.
- `.kbs-cta` gradiente → `linear-gradient(160deg, #546085 0%, #363E56 100%)`; texto do botão continua `#363E56`.
- Contadores ativos, badges: usar `#363E56`.

### 4. Laranja `#DE6E37` como acento único
Aplicar apenas em pontos de destaque para não poluir:
- Foco/hover do input de busca (`.kb-si-in:focus` border) → `#DE6E37`.
- Sublinhado de links dentro de artigos (`.knowledge-article a:hover`) → `#DE6E37`.
- Badge "novo/destaque" (`.kb-special-badge` default) → fundo `#DE6E37`.
- Botão CTA primário do artigo (`src/styles/knowledge-base.css`, gradiente do botão) mantém navy; hover troca para laranja.

### 5. Ajustes finos de consistência
- `--kb-card-bg` → `#F5F7FB` (levemente mais azulado, dentro da família da paleta).
- Textos secundários (`.kb-excerpt`, `.kbs-hero-text p`) → `#546085` no lugar de `#5F6368`/`#64748B` (usa o azul da marca).
- Bordas neutras (`rgba(0,0,0,0.07)`) → `rgba(84,96,133,0.14)` para harmonizar.

## Fora do escopo (não mexer)
- Cores globais do app (`src/index.css` design tokens do shadcn).
- Outras páginas (Admin, SmartOps, PublicLandingPage etc.).
- Componentes de negócio dentro dos tabs (KbTabCatalogo, KbTabVideos etc.) — só herdam via CSS.
- Editor HUB — permanece igual.

## Entrega esperada
- Base de Conhecimento com Host Grotesk carregada.
- Todos os azuis "Google/sky" trocados por navy `#363E56` + `#546085`.
- Fundo do app KB no `#EDF0F7`.
- Laranja `#DE6E37` presente apenas nos pontos de destaque acima.
- Zero mudança visual fora da rota `/base-conhecimento`.
