## Padronizar o e-mail em 4 seções fixas espelhadas da LP

O e-mail gerado sempre terá exatamente **4 seções**, na ordem abaixo, com conteúdo copiado literalmente da Landing Page (sem reescrita de IA no layout, sem blocos extras como "Como funciona", "Módulos", "Benefícios" etc.).

### Estrutura fixa

**Seção 1 — Hero com imagem (verbatim da LP)**
- Badge (ex.: "LICENÇA OFICIAL - RMS PARA O BRASIL")
- Eyebrow (ex.: "PRÉ-LANÇAMENTO")
- Headline principal em display grande, exatamente como na LP (com destaque colorido em `<span class="hl">` quando existir)
- Subheadline curta, exatamente como na LP
- CTA primário + CTA secundário (mesmos textos da LP)
- Trust row (ícones/textos curtos da LP, ex.: "Licença Oficial exocad", "Casos Ilimitados", "Suporte Smart Dent")
- Imagem hero da LP (produto/campanha) à direita/abaixo em fallback mobile
- Nada é reescrito por IA nesta seção

**Seção 2 — Oferta / Posicionamento**
- Bloco de fundo suave (tom claro do tema da LP)
- Título curto de posicionamento vindo da LP (ex.: "Oportunidade histórica da exocad no Brasil")
- 2–4 parágrafos curtos vindos direto do bloco de posicionamento da LP
- Sem preços, sem valores numéricos comerciais (sanitizador `stripPrices` continua ativo)

**Seção 3 — Condições**
- Título "Condições" (ou o rótulo equivalente da LP)
- Lista das condições comerciais da LP (ativação, recorrência, treinamento, suporte, licenciamento), em bullets curtos
- Valores em R$ são removidos/parafraseados para "recorrência mensal", "ativação inclusa" etc. (mantendo a política de "sem preços em e-mail IA")
- Sem cards decorativos extras

**Seção 4 — CTA final**
- Banner com fundo escuro/gradiente do tema da LP
- Headline curta de fechamento (verbatim da LP `finalCta.title` quando existir, senão headline principal encurtada)
- Um único botão CTA (mesmo texto da LP `nav.cta` / `finalCta.button`)
- Linha de assinatura simples "Smart Dent | Fluxo Digital" + link/telefone da LP

### O que muda no código

- `supabase/functions/smart-ops-generate-email-ai/index.ts`
  - Reescrever `buildLpEmailHtml` para renderizar **somente** essas 4 seções, nessa ordem, ignorando `modules`, `benefits`, `implementation`, "como funciona", "por que escolher".
  - `loadLpDossier` passa a extrair apenas: `hero {badge, eyebrow, headline, subheadline, ctaPrimary, ctaSecondary, trustRow, heroImage}`, `positioning {title, paragraphs}`, `conditions {title, items}`, `finalCta {title, button, footerLine}`, `theme`, `logoUrl`, `brandName`.
  - IA continua desligada para layout; ela só pode ajustar micro-tom em textos curtos (opcional) — se falhar, usa verbatim.
  - `stripPrices` reforçado para a Seção 3 (Condições).
  - Resposta continua expondo `source: "landing_page_verbatim" | "landing_page_ai" | "catalog_dossier"`.

- `src/components/smartops/EmailCampaignWizard.tsx`
  - Badge do preview atualizado para: "E-mail padrão 4 seções (Hero · Oferta · Condições · CTA)".
  - Sem outras mudanças de UX.

### Fora do escopo

- Não altero a Landing Page.
- Não altero envio Gmail / SMS / config.toml.
- Não crio migrations.
- Não coloco preços no e-mail gerado por IA.
- Removo do e-mail (não da LP) blocos "Como funciona", "Módulos" e "Benefícios" — eles não fazem parte das 4 seções pedidas.
