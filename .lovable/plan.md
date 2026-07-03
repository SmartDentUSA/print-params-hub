## Tornar todas as seções do editor de LP acessíveis

### Diagnóstico

A sidebar do editor já rola tecnicamente (fix anterior com `grid-rows-[1fr]`), mas a lista é comprida (Aparência, Hero, Como funciona, Card de preço, Condições, Benefícios, FAQ, CTA final, Rodapé) e o usuário não percebe que precisa rolar — a barra de rolagem quase não aparece.

### Correção em `src/components/smartops/LandingPageBuilderModal.tsx`

1. **Sub-navegação no topo da sidebar do editor**: adicionar uma barra sticky com botões que fazem `scrollIntoView` para cada seção. Botões: Aparência · Hero · Como funciona · Preço · Condições · Benefícios · FAQ · CTA final · Rodapé.

2. **Ancoragem das sections**: dar `id` a cada `<Section>` (novo prop opcional `anchorId`) para que a sub-navegação role até elas.

3. **Scrollbar visível**: adicionar classe utilitária (`scrollbar-thin` via style inline `scrollbarWidth: thin` + `scrollbar-gutter: stable`) na sidebar para deixar claro que há mais conteúdo abaixo.

4. **Redundância**: manter o comportamento `<details open>` como está; a sub-navegação apenas ajuda a saltar entre elas.

### Validação

- Abrir modal → aba "Editar & publicar" → clicar em "Condições" na sub-nav → sidebar rola até a seção com os 3 cards.
- Rodar `bunx tsgo` para checar tipos.

### Fora do escopo

- Sem mudanças em template, geração via IA, publicação ou preview.
