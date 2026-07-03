Reformatar a seção **Módulos** para o layout de referência:

- **Header alinhado à esquerda** (não centralizado):
  - Eyebrow em uppercase espaçada — `O QUE ESTÁ INCLUÍDO` (novo campo `eyebrow` opcional no `modules`).
  - Headline grande à esquerda: default `15 módulos do DentalCAD, todos num único bundle.`
  - Subtitle default: `O Ultimate Lab Bundle é o pacote mais amplo do DentalCAD para laboratórios. Cobre do fluxo restaurador básico até prótese total, implantes, barras, splints e planejamento estético.`
- **Grid de 3 colunas** (`md:grid-cols-2 lg:grid-cols-3`) com cards mais compactos:
  - Ícone de **check** (não mais `modulos`) em círculo suave.
  - Nome do módulo em bold, descrição curta abaixo.
- **Rodapé estilo aviso**: barra clara com borda, texto pequeno.
  - Default footnote: `Observação: a disponibilidade final acompanha a versão, a região e as condições vigentes do fabricante. O bundle não inclui xSNAP, In-CAD Nesting/Nesting, exocam, exoplan, ChairsideCAD ou outros produtos independentes — esses são adquiridos separadamente.`
  - Renderizar com destaque em bold para "não inclui" via detecção simples (dividir string em torno da palavra) — ou aceitar `footnoteHtml` opcional. Mais simples: renderizar como `<p>` normal (o usuário edita no editor); default vem com a palavra destacada só visualmente pelo styling? Melhor: manter texto puro no default, sem HTML rich.
- **Editor**: adicionar campo `Eyebrow` (novo `TextField`) na seção Módulos do `LandingPageBuilderModal`; título/subtítulo/itens/rodapé já editáveis.

## Alterações

- `src/components/lp/PremiumLandingTemplate.tsx`
  - Estender tipo `modules` com `eyebrow?: string`.
  - Reescrever o JSX da seção `#modulos` para header à esquerda + grid 3 colunas + card compacto com ícone de check + rodapé com fundo `var(--lp-bg-soft)` e borda.
  - Atualizar defaults: `eyebrow`, `title`, `subtitle`, `footnote` (mantém os 15 itens).
- `src/components/smartops/LandingPageBuilderModal.tsx`
  - Adicionar `TextField` "Eyebrow" na seção Módulos.
- `supabase/functions/landing-page-generator/index.ts`
  - Adicionar `eyebrow` opcional ao schema `modules`.

Sem mudança em outras seções, sem alteração de dados salvos (campos opcionais).