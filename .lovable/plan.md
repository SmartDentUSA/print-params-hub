Mover a seção **"Escolha a melhor condição para ativar seu exocad"** (`#condicoes`) para logo antes da seção **"Perguntas Frequentes"** (`#faq`) em `src/components/lp/PremiumLandingTemplate.tsx`.

## Ordem atual
hero → como-funciona → preço → **condições** → benefícios → módulos → uso-regular → implantação → faq → contato

## Nova ordem
hero → como-funciona → preço → benefícios → módulos → uso-regular → implantação → **condições** → faq → contato

## Alteração
Apenas reposicionar o bloco `{c.conditions && ... <section id="condicoes"> ... }` (linhas ~730–818) para imediatamente antes de `<section id="faq">` (linha ~1018). Sem mudança de conteúdo, editor, defaults ou schema.