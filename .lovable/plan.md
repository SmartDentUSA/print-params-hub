# Landing Page Builder por Formulário

## Objetivo
No card de cada formulário (ex.: `# - FORMS - Ativação exocad DentalCad I.A`), adicionar um botão **LandingPage** ao lado de "Configurações". Ele abre um construtor onde a landing page é gerada em dois modos e sempre usa o formulário do próprio card como CTA.

## Padrão estético (fixo em toda LP gerada)
Alinhado ao briefing `LOVABLE.docx` e à referência https://smart-exocad-booster.lovable.app/#contato:
- **Paleta**: roxo profundo `#2A0F4C` / `#3A1566` como fundo dominante, branco `#FFFFFF` como base clara, laranja luminoso `#FF6A1A` (CTA principal), texto `#202331`, superfícies suaves `#F4F5F8`, sucesso `#168B5B`.
- **Tipografia**: `Inter` (ou `Manrope` como alternativa), pesos 400/500/700, títulos grandes e diretos.
- **Visual**: premium de odontologia digital — hero escuro roxo com detalhes laranja, cards claros, badges de "Licença oficial", numerais grandes de preço, seções full-width alternando roxo/branco, cantos suavemente arredondados (`rounded-2xl`), sombras discretas.
- **Botões**: primário laranja preenchido, secundário outline branco/roxo; hover com leve elevação.
- **Composição**: hero → faixa de confiança → dor/transformação → oferta e preços em destaque → módulos/benefícios → depoimentos → FAQ → CTA final → footer legal (mesma ordem descrita no briefing e na referência).

Este padrão vai como *design system tokens* fixos no system prompt do gerador; os dois modos de criação só variam o conteúdo, nunca o estilo base — garantindo consistência visual entre todas as LPs.

## Modos de criação
1. **100% por IA** — usuário informa uma ideia curta (produto, público, oferta, tom) e a IA gera todo o HTML/copy usando o padrão estético acima.
2. **Upload de prompt/instruções** — usuário cola um briefing completo (como o `LOVABLE.docx` do exocad RMS Ultimate) e a IA converte o briefing em landing page fiel ao conteúdo, também dentro do padrão estético.

Nos dois modos o output é o mesmo HTML semântico com Tailwind, contendo os placeholders `{{FORM_CTA_PRIMARY}}` e `{{FORM_CTA_SECONDARY}}` que a rota pública substitui pelo formulário do card em modal (via `QualificationFormInline`).

## Fluxo UX (dentro do card do formulário)
1. Novo botão `Layout` (ícone `Layout` do lucide) em `FormMetricsCard`, entre `Settings` e `Pencil`.
2. Clique abre `LandingPageBuilderModal`:
   - Aba **Gerar por IA**: campo curto de ideia + inputs opcionais (título/subtítulo/oferta) + botão `Gerar landing`.
   - Aba **Briefing (prompt)**: `Textarea` grande para colar o documento; botão `Gerar landing`.
   - Após gerar: preview iframe + editor HTML (só leitura de código, com botão "Regenerar" e "Salvar rascunho").
   - Botão `Publicar` grava `published_at` e disponibiliza em `/lp/{form.slug}`.
3. Cabeçalho do modal mostra badge com URL final (`/lp/{slug}`) e status (rascunho/publicado).

## Modelo de dados
Nova tabela `public.smartops_form_landing_pages`:
- `id uuid pk default gen_random_uuid()`
- `form_id uuid not null unique references smartops_forms(id) on delete cascade`
- `mode text not null check (mode in ('ai','briefing'))`
- `input_prompt text` (ideia ou briefing bruto)
- `generated_html text`
- `theme jsonb default '{}'::jsonb` (overrides opcionais dos tokens)
- `status text not null default 'draft'` (`draft` / `published`)
- `published_at timestamptz`
- `updated_at timestamptz default now()`
- `created_at timestamptz default now()`

Com `GRANT` para `authenticated`/`service_role`, RLS habilitada, policies restritas a admins, e `GRANT SELECT ... TO anon` + policy pública apenas quando `status='published'` (para a rota `/lp/:slug`).

## Edge Function `landing-page-generator`
- Recebe `{ form_id, mode, input }`.
- Busca `smartops_forms` para injetar nome/slug/objetivo no prompt.
- Usa AI SDK + Lovable AI Gateway com `google/gemini-3-flash-preview`.
- **System prompt fixo** com o padrão estético acima (paleta, tipografia, ordem de seções, componentes, tom Smart Dent) + regras:
  - Sempre HTML puro com Tailwind classes disponíveis;
  - CTAs devem usar exatamente `{{FORM_CTA_PRIMARY}}` e `{{FORM_CTA_SECONDARY}}`;
  - Modo `briefing`: fidelidade total ao conteúdo colado; modo `ai`: expandir a ideia dentro do mesmo padrão;
  - Nunca inventar preços, prazos ou dados técnicos ausentes do input.
- Retorna `{ html }`; frontend grava em `smartops_form_landing_pages`.

## Rota pública `/lp/:slug`
- Novo `PublicLandingPage.tsx` (lazy) + rota em `src/App.tsx`.
- Lê `smartops_form_landing_pages` join `smartops_forms` por `slug` + `status='published'`.
- Renderiza HTML gerado; substitui placeholders por botões que abrem modal com `QualificationFormInline` do formulário. Preserva tracking existente (page view + form submit).
- Head com `<title>`/`description` derivados do formulário e `og:*` self-referentes via `react-helmet-async`.

## Alterações de código
- `src/components/smartops/FormMetricsCard.tsx`: novo prop `onEditLandingPage` + botão `Layout`.
- `src/components/SmartOpsFormBuilder.tsx`: estado do modal + hook para carregar/salvar landing + wiring do prop.
- `src/components/smartops/LandingPageBuilderModal.tsx` (novo): abas IA/Briefing, preview iframe, publish/rascunho.
- `src/pages/PublicLandingPage.tsx` (novo) + rota `/lp/:slug` em `src/App.tsx`.
- `supabase/functions/landing-page-generator/index.ts` (novo) usando AI SDK + Lovable Gateway.
- Migration SQL criando `smartops_form_landing_pages`, GRANTs, RLS e policies.

## Fora de escopo
- Editor visual WYSIWYG (v2 — por ora só regenerar/editar HTML bruto).
- Checkout Stripe embutido (o briefing exocad menciona, mas a LP apenas exibe conteúdo e usa o formulário como CTA).
- Templates prontos além dos dois modos.

## Validação
- Publicar uma LP no modo IA para um form existente → abrir `/lp/{slug}` → conferir paleta roxo/branco/laranja, tipografia Inter, seções na ordem correta.
- Colar o briefing do exocad no modo Briefing → conferir hero com "R$ 2.390 / R$ 1.199", CTAs abrindo o modal com o formulário do card, e visual equivalente ao de https://smart-exocad-booster.lovable.app/#contato.
- Submeter o formulário pela LP → verificar lead criado no CRM idêntico a `/f/{slug}`.