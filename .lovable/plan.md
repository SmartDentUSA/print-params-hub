# LP Builder v3 — Qualidade "Awwwards" real

## Diagnóstico do resultado atual
Na prévia mostrada:
- Fundo branco em toda a página (deveria ter hero roxo `#1D173E`).
- Botões `QUERO COMEÇAR AGORA` e `TIRAR UMA DÚVIDA NO WHATSAPP` renderizam como `<button>` nativos do navegador — o modelo **não incluiu a lista de classes Tailwind** que o system prompt exige.
- Sem selo "ATIVAÇÃO INICIAL", sem card de preço, sem SVGs de ícones, sem CTA fixo mobile.
- Tipografia default do browser (não Inter/Manrope).

**Causa raiz**: mesmo com o system prompt detalhado, `google/gemini-3.1-pro-preview` está sendo conservador e produzindo HTML minimalista. Precisamos de um modelo com melhor aderência a instruções longas de UI + reforçar com exemplo.

## Correções

### 1. Trocar de modelo para o melhor em instruction-following visual
Segundo o catálogo `ai-models-chat`:
- **`openai/gpt-5.5`** — "Most capable GPT-5.5 model for demanding reasoning, **coding**, and instruction-following tasks." Fast mode ✓.
- Alternativa: `openai/gpt-5.4` (também Fast ✓, mais econômico).

Vou usar **`openai/gpt-5.5`** como primário, com `service_tier: "priority"` (Fast mode) para reduzir latência. Fallback: `openai/gpt-5.4` → `google/gemini-3.1-pro-preview` → `google/gemini-3-flash-preview`.

### 2. Reforçar o system prompt com exemplo few-shot
Adicionar ao system prompt um trecho de exemplo mostrando exatamente o padrão de output esperado — hero completo com selo, card de preço com faixa "ATIVAÇÃO INICIAL", botão com todas as classes, seção FAQ em `<details>`. Modelos de instrução seguem muito melhor quando têm um golden example.

Também mudar de instrução aberta ("gere uma LP") para checklist obrigatória validada:
- [ ] `<section>` hero com `bg-[#1D173E]`
- [ ] Badge `ATIVAÇÃO INICIAL` visível no hero
- [ ] `<h1>` com Manrope-like (classe `font-[Manrope]` ou `font-black tracking-tight`)
- [ ] Card de preço com faixa laranja
- [ ] Botão principal com **exatamente** essas classes: `inline-flex items-center justify-center min-h-11 px-6 py-3 rounded-xl bg-[#F47C42] text-white font-semibold text-base shadow-lg hover:brightness-110 transition`
- [ ] Grid de benefícios com SVGs inline
- [ ] `<details>` FAQ
- [ ] CTA fixo mobile `<div class="fixed inset-x-0 bottom-0 z-40 md:hidden ...">`
- [ ] Footer legal minimalista

O prompt instrui o modelo a produzir o HTML **verificando cada item da checklist**.

### 3. Aumentar orçamento de tokens
`max_tokens: 8000` está apertado. Subir para **`max_tokens: 16000`** para GPT-5.5 e permitir a LP inteira sem truncar.

### 4. Post-processing de segurança (network)
Depois de receber o HTML, o edge function faz uma passada rápida:
- Se algum `<button data-form-cta="primary">` **não tem** `bg-[#F47C42]` na classe → injeta a lista canônica.
- Se não existe `Ativação Inicial` no HTML → injeta o badge no primeiro `<section>`.
- Se não existe o CTA fixo mobile → append de um bloco padrão antes de `</main>`.

Isso garante que mesmo se o modelo pular algo, o output sai apresentável.

### 5. Preview do modal: forçar tipografia oficial
Adicionar `<link rel="preconnect">` para Google Fonts + import de Inter/Manrope no `srcDoc` da prévia, e definir `<style>body{font-family:'Inter',...} h1,h2,h3{font-family:'Manrope',...}</style>`.

### 6. Rota pública `/lp/:slug`
Aplicar o mesmo bootstrap de fontes + Tailwind CDN + safe-area no `<PublicLandingPage>` para render fiel.

## Alterações
- `supabase/functions/landing-page-generator/index.ts`:
  - Modelo primário → `openai/gpt-5.5` com `service_tier: "priority"`.
  - Cascade de fallback (5.5 → 5.4 → gemini-3.1-pro → gemini-3-flash).
  - System prompt com **exemplo few-shot** e **checklist**.
  - `max_tokens: 16000`.
  - Nova função `sanitizeAndReinforce(html)` que injeta classes canônicas em `data-form-cta`, badge de ativação e CTA mobile fixo se ausentes.
- `src/components/smartops/LandingPageBuilderModal.tsx`:
  - `previewSrcDoc` inclui Google Fonts (Inter + Manrope) e reset mínimo.
- `src/pages/PublicLandingPage.tsx`:
  - Mesmo bootstrap de fontes.

## Validação
Regenerar a LP do card exocad → esperar output com:
1. Hero roxo escuro com selo laranja "ATIVAÇÃO INICIAL" grande.
2. Botões laranja preenchidos.
3. Card de preço com faixa destacada.
4. Grid de ícones lineares SVG.
5. FAQ em acordeão.
6. CTA fixo aparece só em mobile (testar viewport 375).

Se ainda ficar aquém depois disso, próximo passo é gerar a LP em duas etapas (esqueleto + refinamento por seção), mas começamos com single-shot + GPT-5.5 que deve resolver.