## Problema
Hoje o editor de formulários só permite escolher o **fundo** (sólido, gradiente, imagem) e um **tema** Claro/Escuro. As cores dos textos (título, subtítulo, descrição, labels dos campos, textos auxiliares) ficam fixas pelo CSS do tema. Quando o usuário escolhe um fundo customizado (ex.: rosa, azul claro, imagem com áreas claras), os textos podem ficar ilegíveis e não há controle para ajustá-los.

## Objetivo
Adicionar controles de cor de texto no editor de formulário e aplicá-los na renderização pública, com uma opção "Automático" que calcula o contraste a partir do fundo.

## Mudanças

### 1. Schema (`smartops_forms`)
Adicionar colunas opcionais (text nullable):
- `heading_color` — título e h2 das seções
- `body_color` — subtítulo, descrição, parágrafos
- `label_color` — labels dos campos
- `muted_color` — textos auxiliares (trust_text, footer, hints)
- `auto_contrast` (boolean, default true) — quando ligado, ignora as cores acima e deriva do `bg_color`/luminância

Migration nova em `supabase/migrations/` (não editar existentes). Sem mexer em RLS/grants.

### 2. Editor — `src/components/SmartOpsFormBuilder.tsx`
- Novos estados: `metaHeadingColor`, `metaBodyColor`, `metaLabelColor`, `metaMutedColor`, `metaAutoContrast`.
- Carregar de `f.*` no `loadForm`, enviar no `save()`.
- Nova subseção **"Cores dos textos"** logo abaixo do bloco Tema/Layout, com:
  - Switch "Ajuste automático pelo fundo" (default ligado).
  - Quando desligado: 4 inputs `<input type="color">` + Input hex para heading/body/label/muted.
  - Botão "Resetar para o tema" que zera as 4.

### 3. Renderização — `src/pages/PublicFormPage.tsx`
- Estender o tipo `form` com os 5 novos campos.
- Calcular paleta efetiva:
  - Se `auto_contrast` (ou ausência das cores): derivar de `bg_color` (ou primeira parada do gradiente, ou `theme_mode`) via luminância YIQ → branco/preto + variantes 70%/50% opacity.
  - Caso contrário: usar as cores escolhidas.
- Injetar como CSS vars no wrapper: `--form-heading`, `--form-body`, `--form-label`, `--form-muted`.
- Trocar classes fixas (`text-muted-foreground`, `text-foreground`, etc.) nos elementos relevantes (h1 título, p subtitle/description, label dos campos, trust_text, h2 seções, footer) por `style={{ color: 'var(--form-xxx)' }}` mantendo Tailwind para tamanhos/peso.
- Atualizar o bloco `<style>` interno para que o modo dark e o muted-foreground respeitem as vars quando definidas.

### 4. Tipos
Regenerar `src/integrations/supabase/types.ts` não é necessário manualmente — apenas usar `as any` nos pontos de leitura como o código já faz para `theme_mode`.

## Fora de escopo
- Mudar tipografia (fonte/família) — não foi pedido.
- Cores por campo individual.
- Alterar comportamento de `brand_color_h/s/l` (cor da marca/CTA continua igual).

## Validação
- Abrir um formulário existente: textos devem permanecer iguais (auto_contrast=true e bg branco → preto).
- Trocar bg para `#0a0a23` com auto_contrast: textos viram brancos automaticamente.
- Desligar auto_contrast e escolher cores custom: refletir na hora no preview público.
- Build + rota `/f/:slug` renderiza sem erro.
