# E-mail IA a partir da Landing Page do produto

**Referência visual de fidelidade**: `https://parametros.smartdent.com.br/lp/exocad_dentalcad_rms` — o e-mail gerado deve reproduzir a mesma linguagem visual dessa LP (hero com card do produto, badge/eyebrow roxo, headline com destaque gradiente, bullets com check, botão CTA gradiente roxo→laranja, seção de posicionamento com fundo suave, "como funciona" em passos).

Hoje o gerador (`smart-ops-generate-email-ai`) só usa o dossiê do `system_a_catalog`. Vamos passar a usar **o conteúdo real da LP publicada** do produto como fonte primária de copy + guia visual, mantendo o tom escolhido no wizard.

## Fluxo atual (já existe)
- Wizard `Campanhas → Email` (`EmailCampaignWizard.tsx`) já carrega a LP publicada do produto via `campaign_produto_map` → `smartops_forms` → `smartops_form_landing_pages`, e envia `produto_id`, `cta_principal` (landing), `tom` para a edge function.

## O que muda

### 1. Edge function `smart-ops-generate-email-ai`
- Se `cta_principal.tipo === "landing"` (ou existir LP publicada mapeada ao produto), carregar:
  ```
  select id, hero_image_url, content
  from smartops_form_landing_pages
  where status='published' and id = <cta_principal.id>
  ```
- Extrair do JSON `content` (schema `LPContent` em `src/components/lp/PremiumLandingTemplate.tsx`):
  - `hero.badge`, `hero.eyebrow`, `hero.headline` / `headlineParts` (marcar quais trechos são highlight), `hero.sub`, `hero.bullets`, `hero.trustInline`, `hero.productCardCaption`
  - `positioning.eyebrow`, `positioning.headline`, `positioning.body`
  - `howItWorks.items` (título + desc)
  - `trustBar`, `resellerBadge`
- Novo bloco no prompt: `═══ LANDING PAGE DO PRODUTO (fonte primária) ═══` com esse conteúdo estruturado, instruindo o LLM a:
  - Reaproveitar headline/sub/bullets **reescritos no tom** (não copiar literal, mas manter a mesma mensagem/posicionamento).
  - Espelhar a hierarquia da LP: hero → bullets → posicionamento → como funciona → CTA.
  - Usar `hero_image_url` da LP (fallback `image_url` do catálogo) no topo.

### 2. Skeleton HTML fiel à LP de referência (embutido no prompt)
Skeleton fixo (tabelas 600px, Gmail-safe, inline styles) que o LLM apenas preenche com textos — assim garantimos a mesma "beleza" da LP:

- **Header** (600px, fundo branco): logo Smart Dent + badge de revendedor autorizado quando presente.
- **Hero card** (fundo `linear-gradient(180deg,#FAF7FF 0%,#FFFFFF 100%)`, borda `#EEE7FA`, radius 16px, padding 32px):
  - Eyebrow em `#7C3AED` uppercase 12px letter-spacing 2px.
  - Headline em **Manrope 800**, 30-34px, `#1B1030`. Trechos com `highlight` renderizados com `background: linear-gradient(90deg,#7C3AED,#F97316); -webkit-background-clip:text; color:transparent`.
  - Sub em Inter 500, 16px, `#4A4458`.
  - Imagem hero (`hero_image_url`) centralizada, radius 12px, sombra suave.
  - Bullets em lista com bullet roxo (•) `#7C3AED`.
- **Trust inline** (linha com 2-4 itens `✓ label`, ícones inline em SVG data-uri ou emoji `✓` colorido).
- **Positioning band** (fundo `#F4EEFB`, padding 28px, radius 16px): eyebrow, headline em Manrope 700, body em Inter 400.
- **How it works** (3 cards horizontais, numerados 01/02/03 em círculo gradiente).
- **CTA principal** (botão gradiente `#7C3AED → #F97316`, texto branco, radius 12px, padding 16px 32px, `<a>` inline table para compatibilidade Outlook).
- **Rodapé**: CTA secundário como link sublinhado + assinatura "Smart Dent | Fluxo Digital" em Inter 500 `#6B6478` + linha fina divisória `#EEE7FA`.
- Paleta e tipografia **fixas no skeleton** (Inter/Manrope via Google Fonts + fallbacks web-safe). LLM não escolhe cor nem fonte.

### 3. Reforço no system prompt
Adicionar regras:
- "O e-mail deve parecer uma versão condensada da LP: mesmas cores (`#7C3AED`, `#F97316`, `#1B1030`, `#F4EEFB`), mesmas fontes (Manrope headline, Inter body), mesmo tom visual (cards, gradientes suaves, muito espaço em branco)."
- "NÃO inventar seções que não existem na LP. Se a LP não tem `howItWorks`, omitir o bloco."
- "Reescrever a headline aplicando o TOM (`${tom}`) mantendo o significado da headline original da LP."

### 4. Wizard (frontend)
Mudança mínima:
- Badge "Copy baseada na Landing Page" no passo de geração quando o CTA principal for `landing`.
- Envio da flag `use_landing_page: true` para a edge function (default quando existir LP; usuário pode desligar em toggle discreto).

## Fora de escopo
- Não altera `PremiumLandingTemplate` nem schema das tabelas.
- Não gera imagens novas.
- Não mexe em SMS/WhatsApp/disparo.

## Arquivos afetados
- `supabase/functions/smart-ops-generate-email-ai/index.ts` — carregar LP, novo prompt + skeleton fiel à LP de referência.
- `src/components/smartops/EmailCampaignWizard.tsx` — badge + toggle + envio da flag.

## Validação
- Produto **com** LP (ex.: `exocad_dentalcad_rms`) → gerar com tom `consultivo`, `técnico`, `celebrativo` → conferir que headline, bullets e posicionamento ecoam a LP, com paleta roxo→laranja e imagem hero da LP; só o texto muda entre tons.
- Produto **sem** LP → cai no fluxo atual (dossiê do catálogo), sem erro.
- Renderizar HTML gerado em Gmail preview (largura 600px, sem quebra de layout).
