# Prompt para o Lovable — Landing Page Institucional Smart Dent

> Como usar: copie **tudo o que está abaixo da linha horizontal** e cole no Lovable do projeto `print-params-hub`.
> Os números do prompt foram lidos do banco em 24/09/2026 — ver `docs/LANDING_PAGE_BLUEPRINT.md` para o raciocínio comercial e as lacunas.

---

## CONTEXTO

Você vai evoluir a landing page institucional que **já existe** no arquivo:

```
src/components/knowledge/KbTabInstitucional.tsx
```

Ela é renderizada em `/institucional` (PT), `/en/institutional` (EN) e `/es/institucional` (ES) via `src/App.tsx` → `KnowledgeBase forcedTab="institucional"`.

**NÃO recrie a página. NÃO troque o design system. NÃO reescreva o CSS.**
A página já tem uma identidade visual pronta, em um `<style>` inline com as classes `sdi-*` (glassmorphism sobre gradiente claro, tokens `--ink:#2f3650`, `--mut:#5d6782`, `--or:#e5703a`, cards `.sdi-card`, painéis `.sdi-glass`, seções `.sdi-sec`, títulos `.sdi-h2`, botões `.sdi-btn.pri` / `.sdi-btn.gho`). **Toda seção nova deve usar essas mesmas classes e esses mesmos tokens**, criando apenas as classes novas estritamente necessárias, no mesmo arquivo e no mesmo padrão de nomenclatura (`sdi-...`).

Também **não altere**:
- o `<h1>` do hero e o bloco `.sdi-tldr` (estão indexados);
- a estrutura de i18n: todo texto novo entra no objeto `C` nas **três** línguas (`pt`, `en`, `es`) — nenhuma string solta no JSX;
- o `@graph` JSON-LD existente (Organization / WebPage / ItemList / VideoObject) — você vai **adicionar** nós, não substituir;
- as tags `Helmet`, canonical e hreflang.

---

## O PROBLEMA A RESOLVER

A página hoje é uma vitrine de 6 categorias de produto. Isso causa dois prejuízos:

1. **O dentista/laboratório que procura scanner ou impressora** vê marcas revendidas (MEDIT, Rayshape, Asiga, exocad) e conclui que a Smart Dent é mais uma revenda. Ele não entende que a empresa resolve o fluxo inteiro.
2. **O distribuidor** lê "resinas, scanners, impressoras" e acha que o negócio é equipamento — venda única. Ele não enxerga que **79% do catálogo é insumo de recompra**.

O eixo da correção: a página deve ser organizada pelo **fluxo de trabalho em 7 etapas**, que é a taxonomia oficial da empresa (usada em `system_a_catalog.product_category`, no Workflow 7×3 do Revenue OS e no `workflow_stage_target` dos formulários).

---

## TAREFA 1 — Migration: expor a nota dos treinamentos com segurança

A tabela `smartops_nps_responses` tem RLS que só permite leitura a `authenticated`. A landing é pública, então **não leia essa tabela direto do client**. Crie uma migration com uma view agregada (só números, nenhum dado pessoal):

```sql
create or replace view public.v_public_training_rating as
select
  count(*)                                                     as respostas,
  round(avg(score_recomendacao)::numeric, 2)                   as media_recomendacao,
  round(avg(score_satisfacao)::numeric, 2)                     as media_satisfacao,
  round(avg(score_treinamentos)::numeric, 2)                   as media_treinamento,
  round(100.0 * count(*) filter (where score_recomendacao >= 4)
        / nullif(count(*), 0), 0)                              as pct_satisfeitos
from public.smartops_nps_responses
where survey_type = 'pos_treinamento';

grant select on public.v_public_training_rating to anon, authenticated;
```

A view é `security definer` por padrão (roda com os privilégios do owner), então o `anon` lê o agregado sem enxergar as respostas individuais. **Não conceda `select` na tabela base.**

Valores esperados hoje: `respostas = 39`, `media_recomendacao = 4.87`, `media_satisfacao = 4.77`, `media_treinamento = 4.74`, `pct_satisfeitos = 100`.

---

## TAREFA 2 — Hook `useSocialProof`

Crie `src/hooks/useSocialProof.ts` com React Query, devolvendo os dois blocos de prova:

- **Google**: reaproveite o padrão que já existe em `src/hooks/useCompanyData.ts` — a nota vem de `system_a_catalog` com `category = 'company_info'` **e `active = true`**, em `extra_data.reviews_reputation.google_rating` e `.google_review_count`. Essa tabela tem política de leitura pública para itens ativos, então funciona sem login.
  ⚠️ Existem **duas** linhas `company_info`; a inativa está desatualizada (156 avaliações). **Filtre sempre por `active = true`** — a linha correta hoje traz `google_rating = 5` e `google_review_count = 206`, sincronizada em 24/09/2026.
- **Treinamentos**: `select * from v_public_training_rating` (a view da Tarefa 1).

Regras de renderização:
- Enquanto carrega, **não** mostre skeleton nem número placeholder — simplesmente não renderize o bloco (evita layout shift e evita exibir número falso).
- Se `respostas < 20`, esconda o bloco de treinamento (amostra fraca não é prova).
- Nunca deixe número hard-coded no JSX. Os únicos números fixos permitidos na página são os da Tarefa 3 (catálogo), que vêm de contagem estável.

---

## TAREFA 3 — Nova seção: "O fluxo digital Smart Dent" (substitui os 6 cards)

Substitua a seção atual `Nossas soluções` (array `c.sol`, classes `.sdi-cards` / `.sdi-card`) por uma faixa de **7 etapas numeradas**. Cada etapa é um card `.sdi-card` com:

- número grande da etapa + ícone (`lucide-react`, já importado no arquivo);
- título da etapa;
- linha **"Compra uma vez"** — equipamentos, texto em `--mut`;
- linha **"Recompra sempre"** — insumos, texto em `--or` (`#e5703a`), com uma tag `FABRICAÇÃO PRÓPRIA` quando for marca Smart Dent;
- dois links no rodapé do card, no padrão `.sdi-card-a` que já existe: `Ver no catálogo` → `/categorias/<slug>` e `Falar com especialista` → `/f/<slug-do-formulário>`.

Conteúdo exato (PT; traduza para EN/ES mantendo os nomes de produto):

| # | Etapa | Compra uma vez | Recompra sempre | Formulário |
|---|-------|----------------|-----------------|------------|
| 1 | Captura digital | Scanners intraorais MEDIT i600, i700, i700 Wireless, i900, BLZ INO200, BLZ Leap 500 · Bancada Medit T310, BLZ LS100 | Acessórios, ioConnect TruAbutment, BLZ Dental DMC | `/f/ios-medit-i700` |
| 2 | CAD | exocad DentalCAD · exoplan | Assinatura DentalCAD RMS, Crédito exocad I.A., terceirização de projetos CAD | `/f/software-cad-exocad-dentcad` |
| 3 | Impressão 3D | Rayshape Edge Mini · Asiga MAX 2 · Asiga Ultra · MiiCraft Alpha · Elegoo Mars 5 Ultra · SmartSlicer I.A. | **Resinas Smart Print Bio** — Vitality, Denture, Bite Splint Clear e +Flex, Temp B1, Hybrid A2, GOWhite, Direct Aligner, Clear Guide, Try-In Calcinável — e **Smart Print** modelo: Precision, Model Plus, Universal, Ocre, L'Aqua, GOClear, Gengiva | `/f/resina-3d-smartprint-bio-vitality` |
| 4 | Pós-impressão | Asiga Cure · ShapeCure D · Magna Box EDG · Pionext UV-02 · cuba ultrassônica · misturador de resinas | **NanoClean**, **NanoClean PoD™**, **GlazeON Splint** | `/f/equipamento-asiga-cure` |
| 5 | Caracterização | — | **SmartMake** (21 itens: shades A–D, stains, intensivos, Seal Glaze, SmartWash) e **SmartGum** (9 itens) | `/f/caracterizacao-smart-make` |
| 6 | Dentística, estética e ortodontia | — | **Cimento UNIKK Veneer** (14 itens) · **Resina composta ATOS** (45 itens: Body, Direta, Academic, Unichroma, Smart Ortho) | `/f/resina-composta-direta-atos` |
| 7 | Fresagem | *(linha em expansão — não prometa equipamento)* | **ATOS Block HT/LT** (11 blocos) | `/f/durr_cipro_tronado` |

Headline da seção (PT):

> ## Do escaneamento à instalação, **nenhuma etapa fica na mão de terceiros**
> Cada etapa tem o equipamento certo e o insumo que faz ele render. A maior parte desse insumo nós fabricamos — por isso o parâmetro, a resina e o acabamento conversam entre si.

Fecho da seção, em destaque `.sdi-glass`:

> **157 itens no catálogo. 7 etapas. Um fluxo só.**
> Equipamento é o começo: **79% do que fornecemos é insumo de recompra** — resina, caracterização, cimento, bloco, limpeza e acabamento.

---

## TAREFA 4 — Nova seção: "Prova" (Google + treinamentos + operação)

Logo abaixo do fluxo. Uma faixa `.sdi-glass` com quatro blocos. **Todos os números vêm de hook, nenhum hard-coded** (exceto os três últimos contadores da tabela abaixo, que são contagem estável de catálogo).

**Bloco A — Google (destaque, com o SVG colorido do logo do Google que já existe em `src/components/GoogleReviewsWidget.tsx`)**

```
★★★★★   5,0 no Google
206 avaliações de clientes reais
```
Fonte: `useSocialProof().google`. Linka para o perfil do Google Business da Smart Dent.

**Bloco B — Treinamentos**

```
4,9 / 5   na avaliação pós-treinamento
39 respostas verificadas · 100% dos alunos deram 4 ou 5
```
Fonte: `useSocialProof().treinamento` (`media_recomendacao`, `respostas`, `pct_satisfeitos`), formatado em pt-BR com vírgula decimal.

⚠️ **Escreva "avaliação pós-treinamento", nunca "NPS".** A pesquisa roda em escala 1–5, não na escala 0–10 do NPS clássico; chamar de NPS seria número errado com nome errado. Se um dia a pesquisa mudar para 0–10, a nomenclatura muda junto.

**Bloco C — Suporte pós-venda (contadores estáticos)**

```
260 combinações resina × impressora com parâmetro validado
22  resinas com ficha técnica e documentação
843 conteúdos técnicos em PT, EN e ES
203 depoimentos de clientes em vídeo
```

**Bloco D — CTA**

> Comprou nossa resina? Encontre o parâmetro validado da sua impressora.
> → `/base-conhecimento?tab=parametros`

Abaixo da faixa, reaproveite o **carrossel de reviews do Google que já existe** (`GoogleReviewsWidget`) — ele já lê `reviews_reputation.google_reviews_pt/en/es` e já é multilíngue. Importe o componente; **não duplique a lógica**. Se ele estiver muito shadcn/ui para o visual `sdi-*`, envolva-o em um `.sdi-glass` e neutralize o `Card` interno — sem reescrever o componente.

---

## TAREFA 5 — Nova seção: "O que a Smart Dent fabrica"

Faixa horizontal de marcas próprias, antes do bloco "Ciência aplicada à odontologia" que já existe:

**Smart Print Bio · Smart Print · SmartMake · SmartGum · NanoClean · GlazeON · UNIKK · ATOS · SmartSlicer I.A. · ChairSide Print**

Copy (PT):

> Somos fabricantes. Nascemos em 2009 em São Carlos como spin-off da EESC-USP, com pesquisa aplicada em materiais odontológicos financiada por FAPESP, CAPES e CNPq. Os equipamentos que integramos são das melhores marcas do mundo — **os materiais que rodam dentro deles são nossos.**

---

## TAREFA 6 — A porta do distribuidor

**6.1** No hero, adicione uma quarta CTA discreta ao lado de `Acessar parâmetros`, no estilo `.sdi-btn.gho`:
`Seja um distribuidor` → `/cadastro-distribuidor`

**6.2** Troque o eyebrow do hero (hoje `WORKFLOW DIGITAL END-TO-END`) por:
`FABRICANTE DE INSUMOS · INTEGRADORA DE EQUIPAMENTOS · DESDE 2009`

**6.3** Nova seção antes do FAQ, com quatro argumentos nesta ordem:

1. **Você distribui recompra, não equipamento.** 79% do catálogo é insumo — resina, SmartMake, SmartGum, UNIKK, ATOS, NanoClean. Ticket que volta todo mês.
2. **Você representa fabricante, não estoque de terceiro.** Marca própria, registro FDA nº 3027526455, ISO 13485, conformidade ANVISA e ISO 10993.
3. **Sua página oficial no nosso domínio.** Cada distribuidor aprovado ganha `/distribuidores/{país}/{empresa}` com schema `LocalBusiness`, vínculo Wikidata (Q138636902) e `makesOffer` das linhas autorizadas — Google, ChatGPT e Perplexity passam a apontar você como ponto de venda oficial da sua região.
4. **A Dra. L.I.A. indica você.** Quando um lead da sua região pergunta onde comprar, a IA responde com o seu contato.

Prova: **24 distribuidores oficiais em 10 países** — Brasil, Estados Unidos, Chile, Colômbia, Bolívia, Uruguai, Venezuela, Costa Rica, Panamá e República Dominicana.

CTAs: `Quero ser distribuidor` → `/cadastro-distribuidor` · `Ver a rede atual` → `/distribuidores`

---

## TAREFA 7 — Três perguntas novas no FAQ (nas 3 línguas)

- **"Vocês só vendem equipamento?"** → Não. 79% do nosso catálogo é insumo de recompra, e a maior parte é de fabricação própria: resinas Smart Print Bio, SmartMake, SmartGum, NanoClean, UNIKK e ATOS.
- **"Vocês fabricam ou revendem?"** → As duas coisas. Fabricamos os materiais e integramos equipamentos das melhores marcas do mundo (MEDIT, Asiga, Rayshape, exocad).
- **"Como me torno distribuidor Smart Dent?"** → Preencha o cadastro em `/cadastro-distribuidor`. Após a aprovação comercial, publicamos sua página oficial no nosso domínio, com selo, kit de divulgação e indicação pela Dra. L.I.A.

---

## TAREFA 8 — Schema.org e tracking

**8.1** Adicione ao `@graph` existente, dentro do nó `Organization` (não crie um segundo Organization):

```js
aggregateRating: {
  '@type': 'AggregateRating',
  ratingValue: google.rating,      // 5
  reviewCount: google.count,       // 206
  bestRating: 5,
},
brand: [
  'Smart Print Bio','Smart Print','SmartMake','SmartGum',
  'NanoClean','GlazeON','UNIKK','ATOS','SmartSlicer I.A.','ChairSide Print'
].map(n => ({ '@type': 'Brand', name: n })),
```

Renderize `aggregateRating` **somente** quando o hook trouxer valor — nunca com número fixo no código.

**8.2** Adicione um nó `OfferCatalog` com os 7 `itemListElement` das etapas e o `numberOfItems` de cada uma (11, 6, 27, 10, 30, 59, 11). É isso que faz ChatGPT e Perplexity responderem "sim, a Smart Dent fornece insumo para todo o fluxo".

**8.3** Tracking: cada card de etapa e cada CTA empurra no `dataLayer` (o GTM já está no projeto):

```js
dataLayer.push({ event: 'landing_stage_click', stage: '3_impressao_3d_resinas', surface: 'institucional_fluxo' });
```

Use o valor de `workflow_stage_target` correspondente à etapa. Não mexa no evento `generate_lead`, que já existe em `PublicFormPage.tsx`.

---

## CRITÉRIOS DE ACEITE

- [ ] Nenhuma string nova fora do objeto `C`; PT, EN e ES completos.
- [ ] Nenhum número de prova social hard-coded — Google e treinamento vêm do hook.
- [ ] `company_info` lido com `active = true` (senão a página mostra 156 avaliações, valor velho).
- [ ] `smartops_nps_responses` **não** é consultada do client; só a view agregada.
- [ ] O bloco de treinamento some se `respostas < 20`.
- [ ] Em nenhum lugar a palavra "NPS" aparece na interface pública.
- [ ] Visual indistinguível do restante da página: mesmas classes `sdi-*`, mesmos tokens, mesmo raio de borda, mesmo glass.
- [ ] Mobile: as 7 etapas viram scroll horizontal ou 1 coluna abaixo de 600px, sem quebrar o `.sdi-wrap`.
- [ ] `prefers-reduced-motion` respeitado (a regra já existe no CSS — as seções novas herdam).
- [ ] Nada do Smart Ops, do Revenue OS, do `LeadDetailPanel` ou das Edge Functions foi tocado.

## O QUE NÃO INVENTAR

Se faltar dado, **deixe a seção de fora e avise** — não preencha com número plausível. Especificamente, não temos fonte para: preço, margem de distribuidor, frequência de recompra, prazo de garantia por linha e número de clientes ativos. Nada disso pode aparecer na página.
