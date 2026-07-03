# LP Builder v4 — Pivô para template React premium + IA como preencher de slots

## Por que o que temos hoje não chega lá
A referência `smart-exocad-booster.lovable.app` é:
- App React/Vite com CSS bundlado (`/assets/styles-CWDn-gD9.css`)
- Imagens reais do produto (`exocad-rms-hero.png`, `smart-dent-logo.png`) pré-carregadas
- Google Fonts Inter 100-900
- Layout artesanal desenhado por humano com espaçamentos, sombras e composições específicas

O que fazemos hoje:
- LLM gera HTML puro + classes Tailwind → renderiza num iframe com Tailwind CDN → sem imagens curadas, sem CSS custom, sem tipografia consistente.

**Diagnóstico**: mesmo com GPT-5.5 e few-shot, HTML avulso gerado em uma call jamais vai igualar uma LP React feita à mão. O caminho é inverter a arquitetura.

## Nova arquitetura: Template + Content Model

### 1. Um template React premium hand-crafted (uma vez)
Novo componente `src/components/lp/PremiumLandingTemplate.tsx` que porta 1:1 o layout da referência:
- Barra pré-header com selos ("Revenda Oficial", "Suporte BR", "Licença legítima")
- Hero split (headline + subhead + CTA duplo à esquerda / imagem hero à direita) fundo `#1D173E`
- Faixa de trust com logos
- Seção "Como funciona" em 3 cards numerados
- Card de preço central com **ribbon "ATIVAÇÃO INICIAL"** e lista de inclusos
- Grid de benefícios (6 cards com ícones lineares)
- FAQ acordeão `<details>` estilizado
- CTA final full-width roxo
- Footer legal minimalista

Feito à mão em React + Tailwind, com o mesmo cuidado da referência. Isso é **UMA** vez de trabalho e resolve o problema pra sempre.

### 2. Content model estruturado (não HTML)
Muda a tabela: `generated_html` deixa de ser fonte da verdade. Novo campo `content jsonb` com schema fixo:
```json
{
  "hero": { "eyebrow": "...", "headline": "...", "sub": "...", "primaryCta": "...", "secondaryCta": "..." },
  "heroImage": { "asset_id": "..." | null, "svgFallback": true },
  "trustBar": [ "logo1", "logo2", ... ],
  "howItWorks": [ { "title": "...", "desc": "..." }, ... ],
  "price": { "ribbon": "ATIVAÇÃO INICIAL", "title": "...", "includes": ["..."], "note": "..." },
  "benefits": [ { "icon": "licenca|computador|treinamento|cartao|suporte|brasil|modulos", "title": "...", "desc": "..." } ],
  "testimonials": [ { "quote": "...", "author": "..." } ],
  "faq": [ { "q": "...", "a": "..." } ],
  "finalCta": { "headline": "...", "cta": "..." },
  "legal": "..."
}
```
`generated_html` fica como fallback/legado; `content` passa a ser o padrão para novas gerações.

### 3. IA gera CONTENT, não HTML
O edge function `landing-page-generator` muda:
- Ainda usa `openai/gpt-5.5` com structured output (`response_format: json_schema` strict).
- System prompt encolhe: "receba a ideia/briefing, produza JSON no schema abaixo, respeitando o tom Smart Dent, sem inventar preços".
- Retorna o JSON parseado.

Ganho: LLM só escreve copy — algo que ele faz muito bem. Design, CSS, animações, responsividade, acessibilidade são do template.

### 4. Renderização
`PublicLandingPage` e o preview do modal agora renderizam `<PremiumLandingTemplate content={content} />` diretamente (não via `dangerouslySetInnerHTML`+iframe). Preview no admin fica dentro de um wrapper com `transform: scale()` pra caber no dialog.

### 5. Editor visual → editor de slots
GrapesJS sai (não funciona bem com componentes React). Entra editor de slots inline:
- Painel lateral no modal com campos de texto para cada slot do content.
- Cliques nos textos da prévia focam o campo correspondente (contentEditable opcional).
- Botão "Regenerar com IA" por seção (regenera só o `hero`, só o `faq`, etc.).

Isso é o WYSIWYG que o usuário realmente quer: **edita e vê**, sem quebrar o design.

### 6. Firecrawl para bootstrapping (opcional, nice-to-have)
Se o usuário colar uma URL de referência no briefing:
- Chamamos Firecrawl `scrape` com `formats: ['branding', 'markdown']`.
- Alimentamos o LLM com: (a) a copy da referência em markdown, (b) branding extraído (cores, fontes, logo) — se quiser sobrepor a paleta padrão.
- Firecrawl está disponível como connector; precisa ser linkado uma vez.

### 7. Imagens do hero
Três opções por LP, escolhidas no modal:
- Upload direto (persistido em Storage `landing-page-assets`).
- Composição SVG geométrica (fallback default do template — nada de externo).
- URL absoluta.

## Alterações
- **Novo componente**: `src/components/lp/PremiumLandingTemplate.tsx` (~600 linhas, hand-crafted, matching a referência).
- **Migration**: add `content jsonb DEFAULT '{}'`, `hero_image_url text`, `content_version int DEFAULT 1` em `smartops_form_landing_pages`. Bucket público `landing-page-assets`.
- **Edge function** `landing-page-generator`: retorna JSON conforme schema (usa `response_format: json_schema` strict em GPT-5.5).
- **Modal**: abas viram
  1. **Gerar** — briefing/ideia + botão gerar (chama a IA, popula content).
  2. **Editar** — grid de campos por seção + prévia ao vivo (React render).
  3. **Imagem hero** — upload/URL/SVG.
  4. **Publicar** — toggle status.
- **PublicLandingPage**: render `<PremiumLandingTemplate content={lp.content} />`, sem iframe.
- **Remover** dependência `grapesjs*` (não usaremos mais).

## Escopo desta iteração
1. Migration + bucket.
2. Novo template React (o core do trabalho).
3. Edge function reescrita para content JSON.
4. Modal com aba **Gerar** + **Editar** (form-based) + **Publicar** funcionando.
5. PublicLandingPage renderizando o template.
6. Firecrawl e upload de imagem ficam para v4.1 (deixamos os campos prontos, ligamos depois).

## Fora de escopo
- Editor drag-and-drop tipo Framer (mantém edição via campos + regenerar por seção).
- Múltiplos templates (só o Premium por enquanto — depois adicionamos "Curso", "Evento", "Simples").

## Validação
- Regenerar a LP do card exocad → JSON preenchido → PublicLandingPage renderiza igual à referência (com nossa copy).
- Editar headline no admin → preview atualiza instantaneamente.
- Publicar → `/lp/ativacao-exocad-dentalcad-ia` mostra o template premium com o content salvo.