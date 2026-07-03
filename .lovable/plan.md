## Problema
1. **Design não bate com a referência.** Comparando com o HTML colado (site que o "outro Lovable" gerou):
   - Referência: fundo **branco** + gradiente soft, header **sticky com logo Smart Dent + badge outline laranja**, headline preta com trecho em **gradiente roxo→laranja** (`bg-clip-text`), pill de preço "ATIVAÇÃO + 1º MÊS R$ 2.390 · depois R$ 1.199/mês", CTA primário em **gradiente roxo→laranja**, secundário outline roxo, imagem de produto real, banner "Menor barreira inicial…" com preço-âncora `R$ 100.000` **riscado em laranja**.
   - O meu template hoje: hero **dark navy** com SVG geométrico laranja — vibe completamente diferente.
2. **Botão "Regenerar" não aparece** na aba **Editar & publicar** — só está nas abas "Gerar por IA" / "Briefing".

## Escopo (frontend + edge function)

### 1. Redesign de `PremiumLandingTemplate.tsx` para bater com a referência

**Tokens exatos (do HTML colado):**
```
--text:        #42495C
--text-soft:   #5A5670
--text-mute:   #8B82A8
--purple:      #605882
--purple-line: #EFEBF4
--orange:      #DF7344
--peach-50:    #FFF6F1
--gradient-brand: linear-gradient(135deg, #605882 0%, #7A6FA3 45%, #DF7344 100%)
--gradient-soft:  linear-gradient(180deg, #FBF9FC 0%, #F5F1F8 60%, #FFF6F1 100%)
--shadow-elegant: 0 30px 60px -20px rgba(96,88,130,.35)
--shadow-card:    0 20px 40px -20px rgba(96,88,130,.25)
font-family: Inter (600–900 para display)
```
Publicar essas variáveis como CSS custom props no wrapper do template (não tocar em `index.css` global).

**Estrutura da página**, com todas as seções da referência:
- **Header sticky** (`bg-white/70 backdrop-blur`): logo textual "SMART DENT" + badge outline laranja "OFFICIAL RESELLER EXOCAD" · nav horizontal · CTA pill em gradient-brand com seta →.
- **Hero** (`bg: var(--gradient-soft)`, blobs radiais roxo/laranja com blur):
  - Selo pill branco outline laranja com ícone check.
  - Headline preta com `<span style="bg-clip-text text-transparent; background-image: var(--gradient-brand)">` no trecho destacado (via `headlineParts`).
  - Sub cinza; `<strong>` em roxo/preto conforme peso.
  - **Pill de preço** com borda roxa translúcida (`border-[#605882]/15 bg-white/70`): eyebrow uppercase mute + valor `text-3xl font-black #42495C` + nota "· depois R$ X/mês" com o valor em roxo.
  - Botões: primário **gradient-brand pill** com shadow roxa profunda; secundário outline roxo (`border-2 border-[#605882]`, hover invert).
  - Trust bullets inline (ícones lucide `shield-check`, `headphones`, `infinity` — reproduzo o SVG inline).
  - À direita: card de produto com blur radial de fundo, imagem `heroImageUrl` (se ausente → SVG fallback com composição roxa `Ultimate Lab Bundle` estilizada, sem o mesh laranja atual). Badge flutuante inferior "Revenda Oficial exocad".
- **Banner "Menor barreira inicial"** (novo `positioning`): card com borda `#DF7344/20`, fundo `linear-gradient white→#FFF6F1`, ícone circular laranja `trending-down`, eyebrow uppercase laranja tracking largo, headline preta com preço-âncora **`<span class="text-[#DF7344] line-through decoration-2">R$ 100.000</span>`** e preço destaque em gradient-brand.
- **Como funciona · Preço · Benefícios · FAQ · CTA final · Footer**: manter as seções que já tenho, mas retunar cores para o novo tema (roxo/laranja, sem navy).
- Sticky CTA mobile: pill gradient-brand (não laranja sólida).

### 2. Ampliar `LPContent` (não-breaking)

```ts
export type LPContent = {
  brandName?: string;
  nav?: { items: { label: string; anchor?: string }[]; cta?: string };
  resellerBadge?: string; // "Official Reseller exocad"
  hero: {
    badge?: string;              // pill topo do hero
    eyebrow?: string;
    headline: string;            // fallback plano
    headlineParts?: { text: string; highlight?: boolean }[]; // NOVO
    sub?: string;
    subStrong?: string[];        // termos a renderizar em <strong> (opcional)
    bullets?: string[];          // legado (não usado no novo hero)
    trustInline?: { icon: "shield"|"headphones"|"infinity"|"check"|"clock"; label: string }[]; // NOVO
    pricePill?: { label: string; value: string; note?: string; noteStrong?: string }; // NOVO
    primaryCta: string;
    secondaryCta?: string;
    productCardCaption?: string; // "Revenda Oficial exocad"
  };
  positioning?: {                // NOVO — banner "Menor barreira inicial"
    eyebrow?: string;
    headline: string;
    strikePrice?: string;        // "R$ 100.000"
    highlightPrice?: string;     // "R$ 2.390"
    body?: string;
  };
  howItWorks?: ...   // mantido
  price?: ...        // mantido
  benefits?: ...     // mantido
  testimonials?: ... // mantido
  faq?: ...          // mantido
  finalCta?: ...     // mantido
  legal?: string;
};
```
`DEFAULT_LP_CONTENT` populado no espírito do briefing atual (sem preços inventados — os do fallback vêm do briefing exocad já salvo).

### 3. Renderização

**Headline com gradient text:**
```tsx
<h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-black tracking-tight leading-[1.05]">
  {parts.map((p, i) =>
    p.highlight ? (
      <span key={i} className="bg-clip-text text-transparent"
            style={{ backgroundImage: "var(--gradient-brand)" }}>
        {p.text}
      </span>
    ) : (
      <span key={i}>{p.text}</span>
    ),
  )}
</h1>
```
Fallback: se `headlineParts` ausente, renderiza `hero.headline` plano.

**Fonte:** injetar `<link>` do Google Fonts Inter no `<head>` via effect só na página pública `/lp/:slug` (na prévia dentro do modal usa fonte do sistema — já ok).

### 4. `LandingPageBuilderModal` — botão Regenerar sempre acessível

- Adicionar botão **"Regenerar"** no cabeçalho ao lado de Salvar/Publicar, visível em todas as abas quando existe `lp.input_prompt`. Ao clicar, chama a edge function com `mode: lp.mode` e `input: lp.input_prompt`. Se ambos vazios, botão desabilitado com tooltip "Preencha ideia ou briefing primeiro".
- No editor lateral (aba Editar), adicionar campos para os novos blocos:
  - Nav (lista de itens + CTA).
  - Hero: `headlineParts` (uma linha por chunk com toggle "destacar"), `pricePill` (label / value / note), `trustInline` (item + ícone).
  - `positioning` (eyebrow, headline, strikePrice, highlightPrice, body).

### 5. Edge function `landing-page-generator`

- Atualizar o **JSON schema** exigido pelo `response_format` para incluir `nav`, `resellerBadge`, `hero.headlineParts`, `hero.trustInline`, `hero.pricePill`, `hero.productCardCaption`, `positioning`.
- Reforçar no system prompt:
  - Quebrar a headline em 3–5 chunks; marcar 1 chunk como `highlight: true` (será renderizado em gradient roxo→laranja).
  - Modo **briefing**: reproduzir literalmente preços, âncora e nomes de módulos; nunca inventar.
  - Modo **ai**: sem preços a menos que aparecem na ideia.
- Modelos mantidos (`google/gemini-3.1-pro-preview` como default; fallback `openai/gpt-5.4`).

### 6. `PublicLandingPage.tsx`
Sem mudança de lógica — segue renderizando `<PremiumLandingTemplate />`. Só se beneficia automaticamente do novo layout.

## Fora de escopo
- Upload de imagem do card de produto (segue via URL manual).
- Extração automática de assets `smart-dent-logo.png` / `exocad-rms-hero.png` do site referência — usaremos placeholders/URLs do usuário.
- Migrações de banco — `content` (jsonb) absorve os campos novos.

## Checklist de verificação
- [ ] Prévia do modal mostra header claro sticky + hero com gradiente soft + headline com trecho em gradient roxo→laranja + pill de preço + banner "Menor barreira inicial" com R$ 100.000 riscado laranja.
- [ ] Botão "Regenerar" aparece nas três abas quando existe `input_prompt`.
- [ ] `/lp/{slug}` público renderiza igual à prévia.
- [ ] Sem regressão em landings existentes (fallback para `hero.headline` plano quando `headlineParts` ausente).
