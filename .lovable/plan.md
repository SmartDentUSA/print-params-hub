# LP Builder v2 — LLM premium + Editor Visual WYSIWYG + paleta ajustada

## Escopo
1. Trocar o modelo da geração para o mais forte disponível no gateway (qualidade "Lovable-level" em HTML/CSS/Tailwind).
2. Consolidar a paleta oficial fornecida no system prompt e nos tokens de referência.
3. Adicionar editor visual **WYSIWYG** no modal, permitindo editar a LP gerada em blocos, textos, imagens e cores sem sair do admin.
4. Manter os dois modos de entrada (IA / Briefing) e a rota pública `/lp/:slug`.

## Modelo de LLM
- Atual: `google/gemini-3-flash-preview` (rápido, mas HTML fica genérico).
- Novo padrão para LP: **`google/gemini-3-pro-preview`** — melhor qualidade em raciocínio de layout/copy longa, ainda dentro do catálogo do Lovable Gateway.
- Se o catálogo confirmar disponibilidade de `anthropic/claude-sonnet-4.5` (ou id equivalente que o catálogo aceite hoje), uso ele — Claude Sonnet é o melhor da categoria em HTML/CSS estruturado. Verifico o id exato antes de implementar; se não estiver no catálogo, fico com `gemini-3-pro-preview`.
- Fallback automático para `gemini-3-flash-preview` em 429/402 (para não travar o admin quando a cota do pro estiver estressada).
- Temperature 0.55, `max_tokens` alto para a LP completa não ser truncada.

## System prompt — padrão estético oficial (atualizado)
Paleta consolidada (substitui a v1):
- Roxo principal `#2C245B` — superfícies dominantes e chrome
- Roxo hero `#1D173E` — fundo do hero e seções escuras
- Laranja CTA `#F47C42` — botão principal e destaques
- Fundo suave `#F4F5F8` — seções alternadas claras
- Texto `#202331` — corpo
- Sucesso `#168B5B` — status/checkmarks
- Branco `#FFFFFF` — cards e superfícies claras

Regras fixas embutidas no system prompt:
- Tipografia: `Inter` (corpo) + display limpa para títulos (`Manrope` como headline alternativa). Pesos 400/500/700/800.
- **Selo "ATIVAÇÃO INICIAL"** obrigatório: aparece como badge grande no hero e como faixa dourada/laranja no card de preço quando o briefing/ideia mencionar ativação.
- Hero: composição visual com "sorriso digital" ou fluxo CAD via SVG inline geométrico (sem imagens externas para evitar direitos autorais). Sem watermarks.
- Ícones lineares inline (SVG): licença, computador, treinamento, cartão, suporte, Brasil, módulos — biblioteca interna de paths hardcoded no prompt para o modelo reutilizar.
- CTA: botão principal `bg-[#F47C42] text-white` sobre roxo `#1D173E`; **CTA fixo no mobile** (`fixed bottom-0 inset-x-0 md:static` com sombra e safe-area).
- Cards: `rounded-2xl`, muito whitespace, textos curtos, `<details>` nativo para "ver mais detalhes".
- FAQ: acordeão com `<details><summary>` (nativo, acessível, sem JS). Preço e condições essenciais sempre visíveis fora do acordeão.
- Responsividade mobile-first estrita: hero empilha, tipografia fluida (`clamp()` via classes), grid 1→2→3.
- Acessibilidade AA: contraste checado nos pares (`#F47C42` sobre `#1D173E` = AA large; `#202331` sobre `#F4F5F8` = AAA). Focus ring visível `focus-visible:ring-2 ring-[#F47C42]`. Todos os botões com `aria-label`; imagens SVG decorativas com `aria-hidden`; tap-targets `min-h-11 min-w-11`.
- CTAs continuam marcados com `data-form-cta="primary|secondary"` — a rota pública converte em modal do formulário.

## Editor Visual WYSIWYG
Adiciono uma **terceira aba** no `LandingPageBuilderModal`: **"Editor Visual"**, ativa depois que a LP foi gerada.

**Tecnologia**: **GrapesJS** com preset de landing page (`grapesjs`, `grapesjs-preset-webpage`, `grapesjs-plugin-forms`, `grapesjs-tailwind`).
- Motivo: GrapesJS importa HTML arbitrário direto (o output da IA), permite edição visual em blocos, texto inline, arrastar componentes, editar estilos por painel — sem precisar re-estruturar a saída da IA em um schema próprio (como Puck exigiria).
- Alternativa considerada e descartada: Puck (exige converter HTML em JSON estruturado — inviável para HTML gerado por LLM); TipTap (é editor de texto, não de layout).

**Comportamento**:
- Ao abrir a aba, GrapesJS carrega o `generated_html` atual.
- Painéis à direita: blocos (hero, seção, card, FAQ, CTA), estilos (cor/tipografia/spacing), camadas.
- Barra superior: desfazer/refazer, alternar preview desktop/tablet/mobile, salvar.
- Injeta a paleta oficial como *color swatches* pré-definidos no picker.
- Preserva marcadores `data-form-cta` (bloco especial "CTA do formulário" que sempre renderiza um botão com o attribute correto).
- Ao salvar: grava HTML + CSS combinados de volta em `generated_html`. Opcionalmente guarda o *dump* JSON do GrapesJS num campo novo `editor_state jsonb` para carregar o estado com fidelidade na próxima abertura.

**Fluxo completo do modal**:
1. Aba **Gerar por IA** — cria/regenera do zero (LLM premium).
2. Aba **Briefing (prompt)** — cria/regenera a partir de texto colado.
3. Aba **Editor Visual** — refina a última versão gerada (habilitada quando existe HTML).
4. Botões globais: **Salvar rascunho** / **Publicar**.

## Alterações de código
- `supabase/functions/landing-page-generator/index.ts`:
  - Trocar modelo padrão para `google/gemini-3-pro-preview` (com fallback para flash em 429/402).
  - Atualizar `DESIGN_SYSTEM` com a nova paleta e regras (selo, CTA fixo, ícones, acessibilidade).
  - Enriquecer o prompt com a biblioteca de SVG paths para ícones lineares.
- `src/components/smartops/LandingPageBuilderModal.tsx`:
  - Adicionar terceira aba "Editor Visual".
  - Novo componente `LandingPageVisualEditor.tsx` encapsulando GrapesJS.
  - `onSave` da aba visual grava HTML+CSS de volta na tabela.
- `src/pages/PublicLandingPage.tsx`: nenhuma mudança de contrato (`data-form-cta` continua o gancho).
- Migration: adiciona coluna `editor_state jsonb` em `smartops_form_landing_pages` para persistir o dump do editor.
- Deps novas: `grapesjs`, `grapesjs-preset-webpage`, `grapesjs-plugin-forms`, `grapesjs-tailwind`.

## Fora de escopo
- Editor real-time colaborativo.
- Templates prontos além dos gerados pela IA (o editor visual permite montar do zero se o usuário quiser).
- Integração com checkout Stripe embutido — CTA continua abrindo o formulário do card.

## Validação
- Gerar LP no modo IA para `# - FORMS - Ativação exocad DentalCad I.A` → conferir presença do badge "ATIVAÇÃO INICIAL" no hero, CTA fixo no mobile (viewport ≤768), FAQ em `<details>`, cores exatas.
- Abrir aba Editor Visual → arrastar um bloco novo, trocar cor do CTA para `#F47C42`, salvar → recarregar modal → confirmar persistência.
- Publicar → abrir `/lp/ativacao-exocad-dentalcad-ia` no mobile → conferir CTA fixo, acessibilidade (tab-through, focus ring, contrast), abrir modal do formulário via CTA.