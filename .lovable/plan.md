## Ajustes na Landing Page

### 1. Condições — opção "De: / Por:" com desconto

Adicionar ao tipo de cada card em `conditions.cards` um campo opcional:

- `originalPrice?: string` — preço "De" (ex.: `R$ 3.500`)
- Quando preenchido:
  - Renderiza o `originalPrice` **riscado** acima do `priceLabel`
  - Calcula automaticamente o desconto em **%** e em **R$** (parseando os números do texto, ignorando "R$"/pontos/vírgulas)
  - Exibe uma badge tipo `Economize R$ 1.101 (31%)` ao lado do preço atual
- Quando vazio: comportamento atual, sem alterações

No editor (`LandingPageBuilderModal.tsx`), adicionar em cada card:
- Campo `Preço original (De)` — opcional
- Preview do desconto calculado em tempo real, apenas informativo

### 2. Menu não funciona

Causa: a IA gera labels como "Benefícios", "Investimento", "Dúvidas" mas envia anchors que não batem com as seções reais do template (`#beneficios`, `#investimento`, `#duvidas` não existem — as seções são `#condicoes`, `#preco`, `#faq`, etc.).

Correção em `PremiumLandingTemplate.tsx`:

- Criar função `resolveAnchor(label, anchor)` que:
  1. Se `anchor` aponta para uma seção existente na página, usa ele
  2. Caso contrário, mapeia por label normalizado:
     - `benefícios/beneficios` → `#beneficios` (id da seção BENEFITS, adicionar)
     - `módulos/modulos/recursos` → `#modulos`
     - `como funciona` → `#como-funciona`
     - `investimento/preço/preco/planos/condições/condicoes` → `#condicoes` (se existir) ou `#preco`
     - `dúvidas/duvidas/faq/perguntas` → `#faq`
     - `contato/fale conosco` → `#contato`
- Adicionar `id="beneficios"` na seção BENEFITS (hoje sem id)
- Substituir o click do link por scroll suave com offset do header sticky (~72px) para evitar o header cobrir o título da seção

### 3. Logo da empresa

Atualmente o header exibe apenas `brandName` como texto (default `SMART DENT`). Duas possíveis interpretações do "logo errado":

**Opção A (recomendada):** permitir upload/URL de logo da empresa.
- Adicionar `logoUrl?: string` em `LPContent`
- No header: se `logoUrl` presente, mostra `<img>` (altura 32px) + `brandName` opcional; senão, cai no texto atual
- No editor: campo `URL do logo` na aba Marca/Header, ao lado de `Nome da marca`

**Opção B:** apenas garantir que `brandName` gerado pela IA respeite o valor definido pelo usuário e não sobrescreva com "SMART DENT" quando a LP é de outra marca.

Preciso confirmar qual das duas antes de executar (ver pergunta abaixo).

### Arquivos afetados

- `src/components/lp/PremiumLandingTemplate.tsx` — tipo `LPContent`, render dos cards de condição, resolveAnchor + scroll suave, id da seção benefits, render do logo
- `src/components/smartops/LandingPageBuilderModal.tsx` — campo `originalPrice` no editor de cards + preview do desconto, campo `logoUrl` (se Opção A)

### Fora do escopo

- Não altero lógica de publicação, formulário público, geração via IA, nem outras seções.

### Pergunta ao usuário

Sobre o logo: você quer **(A)** um campo para colar/upload da URL do logo (imagem no header), ou **(B)** apenas corrigir o nome da marca que está saindo errado? Se for B, me diga qual é o nome correto.
