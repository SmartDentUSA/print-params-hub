# Plano — Enriquecer LP exocad Ultimate Lab Bundle

Objetivo: incluir os blocos de conteúdo oficiais (módulos, regras regionais, implantação/treinamento/suporte), reforçar o título antes dos cards de condições e remover o card "Pré-venda Limitada".

## 1. Novos blocos no template (`src/components/lp/PremiumLandingTemplate.tsx`)

Estender `LPContent` com 3 novos campos opcionais e renderizá-los como seções:

- **`modules`** → seção "O que está inclui no Ultimate Lab Bundle"
  - `title`, `subtitle`, `items: { name: string; application: string }[]`
  - Renderização: grid 2 colunas em desktop, lista em mobile; nome do módulo em destaque + aplicação comercial em texto secundário. Ancora `#modulos` (já existe no nav).
  - Nota curta ao final: "Disponibilidade final acompanha a versão, região e condições vigentes da exocad."

- **`regionalRules`** → seção "Uso seguro e regular da licença"
  - `title`, `intro?`, `items: string[]`, `footnote?`
  - Renderização: card claro com ícone `shield`, lista de bullets em tom informativo (não ameaçador). Copy padrão fornecida pelo usuário.

- **`implementation`** → seção "Implantação, ativação, treinamento e suporte"
  - `title`, `activation: { title; items: string[] }`, `training: { title; body: string }`, `support: { title; items: string[] }`
  - Renderização: 3 subcards horizontais (Ativação inicial, Treinamento inicial, Suporte Smart Dent).

Ordem no `<main>`: hero → positioning → howItWorks → **modules (novo)** → conditions → benefits → **regionalRules (novo)** → **implementation (novo)** → testimonials → faq → finalCta.

## 2. Título forte antes dos cards de condições

Na seção `#condicoes`, garantir headline visível:
- Headline: **"Escolha a melhor condição para ativar seu exocad"**
- Sub (opcional): breve linha institucional.

Ajustar defaults do `LandingPageBuilderModal` para preencher `conditions.title` com esse texto quando vazio, e reforçar tipografia no template (já existe suporte a `conditions.title/subtitle`).

## 3. Remover card "Pré-venda Limitada"

No `LandingPageBuilderModal.tsx` (defaults + preview live) e em qualquer seed gerado pelo `landing-page-generator`:
- Filtrar/remover o card cujo `ribbon` ou `title` contenha "Pré-venda" da lista `conditions.cards` padrão.
- Não alterar a lógica genérica: apenas remover o item padrão. Cards salvos manualmente pelo usuário no banco não são tocados; se houver, será removido via edição manual da landing existente (posso incluir migração se solicitado).

## 4. Editor (Cards de edição)

Em `LandingPageBuilderModal.tsx` adicionar 3 novas `Section` correspondentes:
- **Módulos** — tabela editável (nome + aplicação), botões add/remove.
- **Uso seguro** — textarea intro + lista editável.
- **Implantação e suporte** — 3 sub-blocos (ativação, treinamento, suporte).

Adicionar entradas no `EDITOR_SECTIONS` (sidebar sticky) com âncoras `#edit-modules`, `#edit-regional`, `#edit-implementation`.

## 5. AI generator (`supabase/functions/landing-page-generator/index.ts`)

Atualizar `CONTENT_SCHEMA_DOC` para incluir os 3 novos objetos no schema, com regras:
- IA nunca inventa módulos além dos listados oficialmente.
- Regras regionais devem manter o texto institucional (sem tom ameaçador).
- Treinamento: usar exatamente a redação segura "Treinamento inicial remoto, conforme agenda e formato definidos pela Smart Dent…".

## 6. Conteúdo padrão pré-preenchido

Salvar como defaults no `LandingPageBuilderModal` (para novas LPs Ultimate Lab Bundle) a lista completa de 15 módulos, as 9 regras regionais e os blocos 13.1/13.2/13.3 exatamente como fornecidos pelo usuário.

## Detalhes técnicos

- Nenhum backend/DB novo: `content` da LP já é JSONB livre em `smartops_form_landing_pages`.
- Type-check: `bunx tsgo --noEmit` após alterações.
- Validação: abrir `/admin` → Editar & Publicar; conferir sidebar, scroll suave às novas seções, preview live e página pública `/lp/<slug>`.

## Arquivos afetados

- `src/components/lp/PremiumLandingTemplate.tsx` (schema + render)
- `src/components/smartops/LandingPageBuilderModal.tsx` (editor + defaults + sidebar)
- `supabase/functions/landing-page-generator/index.ts` (schema IA)
