## Clonar a Landing Page 1:1 no e-mail (mesmo texto, mesmas condições, mesmo layout)

O e-mail passa a ser um **espelho fiel da LP publicada**, renderizado em HTML email-safe. Nada de IA reescrevendo, nada de template genérico. Se está na LP, está no e-mail — nas mesmas palavras, mesma ordem, mesmos blocos, mesmas cores.

### Estratégia

Em vez de deixar a IA "montar" o e-mail a partir de um dossiê, vamos **ler o mesmo `content` (LPContent) usado pelo `PremiumLandingTemplate`** e renderizar cada seção da LP como uma tabela HTML compatível com Gmail/Outlook, mantendo:

- Textos verbatim (headline, subheadline, badges, eyebrow, bullets, parágrafos, itens de condições, CTA)
- Ordem exata das seções que existem no `content` da LP
- Paleta/tema da LP (cores primária, fundo, texto) aplicadas inline
- Imagem hero da LP
- Links de CTA apontando para a LP publicada (`/lp/{slug}`)

### O que o e-mail vai conter (na ordem da LP)

Renderiza **exatamente as seções que existirem em `lp.content`**, uma a uma, no mesmo layout visual da LP, adaptado para e-mail:

1. **Hero** — badge, eyebrow, headline (com `<span class="hl">` preservado como cor de destaque), subheadline, CTA primário, CTA secundário, trust row, imagem hero — texto idêntico.
2. **Posicionamento / Oferta** — título + parágrafos verbatim.
3. **Como funciona / Módulos / Benefícios / Implementação** — se existirem no `content` da LP, aparecem no e-mail com os mesmos textos e mesma ordem (não são mais suprimidos). O e-mail espelha a LP; não inventa nem remove blocos.
4. **Condições** — título + itens verbatim. `stripPrices` continua ativo só aqui, por política ("sem preços em e-mail IA"): valores em R$ viram "recorrência mensal", "ativação inclusa", etc. Todo o resto do texto do bloco fica igual.
5. **CTA Final** — headline + botão verbatim, cor do tema.
6. **Assinatura** — "Smart Dent | Fluxo Digital" + telefone/link da LP.

Se um bloco não existir na LP, ele simplesmente não aparece no e-mail. Se existir, aparece igual.

### Papel da IA

**Nenhum**, por padrão. A geração vira **determinística**: lê o `content` da LP e serializa em HTML email-safe. `source` na resposta passa a ser sempre `"landing_page_verbatim"`.

Fica um flag opcional (`aiTone: true`, desligado por padrão) que só pode ajustar micro-tom em `subject` e `preheader` — nunca o corpo. Se falhar, usa o headline/subheadline da LP.

### Mudanças de código

- `supabase/functions/smart-ops-generate-email-ai/index.ts`
  - `loadLpDossier` passa a devolver o `LPContent` completo (hero, positioning, howItWorks, modules, benefits, implementation, conditions, finalCta, theme, logoUrl, brandName, lpUrl) — sem descartar seções.
  - `buildLpEmailHtml` reescrita para iterar as seções presentes no `content` e renderizar cada uma como tabela HTML inline, com cores do `theme` da LP e imagem hero real.
  - `stripPrices` aplicado **apenas** aos itens da seção Condições.
  - Prompt de IA para corpo do e-mail é **removido**; IA só toca `subject`/`preheader` se `aiTone` estiver ligado.
  - `source` sempre `"landing_page_verbatim"`.

- `src/components/smartops/EmailCampaignWizard.tsx`
  - Badge do preview: "Espelho fiel da Landing Page (verbatim)".
  - Sem outras mudanças de UX.

### Fora do escopo

- Não altero a Landing Page.
- Não altero envio Gmail, SMS, config.toml, migrations.
- Preços continuam removidos **apenas** do bloco Condições no e-mail (política existente); LP fica intocada.
