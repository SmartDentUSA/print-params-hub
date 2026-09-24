# Blueprint da Landing Page Smart Dent
## Como construir a página para (a) quem procura scanner/impressora e (b) o distribuidor que precisa enxergar o catálogo inteiro

> Versão 1 · 24/09/2026 · Base: página atual `/institucional` (`src/components/knowledge/KbTabInstitucional.tsx`)
> Todos os números e nomes deste documento vieram de fonte interna nomeada — ver **FONTES CONSULTADAS** no fim.

---

## 1. Diagnóstico da página atual

O que já está certo e **não deve ser tocado**: hero com a tese de rentabilidade, bloco TL;DR (ótimo para IA), faixa FDA/ISO/UNC/USP, Organization + VideoObject schema, trilíngue com hreflang, CTA triplo (especialista / loja / parâmetros).

Os três buracos:

| # | Buraco | Consequência comercial |
|---|--------|------------------------|
| 1 | A página se organiza por **vitrine de 6 categorias**, não pelo **fluxo de trabalho** | O dentista que procura "scanner" não consegue se localizar: ele não sabe o que mais precisa comprar para o scanner virar peça entregue |
| 2 | Os produtos de marca própria aparecem misturados com produtos revendidos | Lido de fora, "Medit + Rayshape + exocad" = revenda. Some a única coisa que nenhum concorrente copia: **a Smart Dent fabrica o insumo** |
| 3 | Não existe superfície de catálogo — só 6 cards e um link para a loja | O distribuidor sai achando que o negócio é equipamento (venda única) e não vê os **124 SKUs de insumo recorrente** |

**O eixo da correção é um só**: a Smart Dent não vende a caixa, vende o fluxo — e o fluxo é o que gera recompra. Hoje **157 SKUs comerciais** estão no catálogo; **~23 são equipamento** e **~124 (79%) são insumo de recompra**. Essa proporção é o argumento tanto para o dentista (o equipamento é meio, não fim) quanto para o distribuidor (o contrato não é de equipamento, é de reposição).

---

## 2. A espinha dorsal: uma taxonomia só, as 7 etapas

A empresa já tem uma taxonomia oficial, usada em três lugares ao mesmo tempo:

- `system_a_catalog.product_category` — como o catálogo é classificado
- Workflow Portfolio 7×3 (`portfolio_json` em `lia_attendances`) — como o comercial lê o lead
- `smartops_forms.workflow_stage_target` — como o formulário grava o interesse

**A landing page deve usar exatamente essa mesma taxonomia.** Isso resolve três problemas de uma vez:

1. o dentista se localiza no fluxo ("estou na etapa 1, me falta 3 e 4");
2. o distribuidor vê a extensão real do portfólio, etapa por etapa;
3. cada clique na página já mapeia o lead numa célula do grid 7×3 — a landing vira **instrumento de captação estruturada**, não folheto.

| Etapa | O que o cliente compra **uma vez** | O que ele recompra **todo mês** | SKUs no catálogo |
|-------|-----------------------------------|----------------------------------|------------------|
| 1 · Captura digital | Scanner intraoral (MEDIT i600/i700/i700 Wireless/i900, BLZ INO200, BLZ Leap 500), bancada (Medit T310, BLZ LS100) | Acessórios, ponteiras, ioConnect TruAbutment, BLZ Dental DMC | 11 |
| 2 · CAD | exocad DentalCAD, exoplan | Assinatura RMS, Crédito exocad I.A., terceirização de projetos | 6 |
| 3 · Impressão 3D | Rayshape Edge Mini, Asiga MAX 2, Asiga Ultra, MiiCraft Alpha, Elegoo Mars 5 Ultra, SmartSlicer I.A. | **Resinas Smart Print Bio** (Vitality, Denture, Bite Splint Clear/+Flex, Temp B1, Hybrid A2, GOWhite, Direct Aligner, Clear Guide, Try-In Calcinável) e **Smart Print** modelo (Precision, Model Plus, Universal, Ocre, L'Aqua, GOClear, Gengiva) | 27 (21 são resina) |
| 4 · Pós-impressão | Asiga Cure, ShapeCure D, Magna Box EDG, Pionext UV-02, cuba ultrassônica, misturador de resinas | **NanoClean**, **NanoClean PoD™**, **GlazeON Splint** | 10 |
| 5 · Caracterização | — | **SmartMake** (21 itens: Shades A–D, Stains, Intensivos, Seal Glaze, SmartWash, kits) e **SmartGum** (9 itens) | 30 |
| 6 · Dentística/Estética/Orto | — | **Cimento UNIKK Veneer** (14), **Resina composta ATOS** (45: Body, Direta, Academic, Unichroma, Smart Ortho) | 59 |
| 7 · Fresagem | Equipamentos (linha em expansão) | **ATOS Block HT/LT** (11 blocos) | 11 |
| + Cursos | Imersão 3 dias ChairSide Print (presencial) | Curso on-line / Smart Dent Academy | 2 |

> Repare no formato da tabela: **duas colunas — compra uma vez / recompra sempre**. Esse é literalmente o argumento do distribuidor renderizado em HTML. Ele deve aparecer na página com essa mesma estrutura visual.

---

## 3. Arquitetura da página (seção a seção, com copy)

### 3.0 Hero — manter, ajustar duas coisas
Mantém `O fluxo digital mais seguro, potente e lucrativo do mercado.` (bom, testado, já indexado).

Trocar apenas o eyebrow para marcar as duas naturezas da empresa:

```
FABRICANTE DE INSUMOS · INTEGRADORA DE EQUIPAMENTOS · DESDE 2009
```

E adicionar uma quarta CTA discreta, ao lado de "Acessar parâmetros":

```
Seja um distribuidor  →  /cadastro-distribuidor
```

*Por quê:* o distribuidor que chega pelo topo hoje não tem porta. Ele cai no funil do dentista.

### 3.1 Barra "Onde você está no fluxo?" (nova — logo abaixo do hero)
Três botões grandes, antes de qualquer produto. É o roteador da página:

| Botão | Copy | Destino |
|-------|------|---------|
| Ainda não digitalizei | "Quero começar: scanner + impressora + treinamento no meu consultório" | `/f/chairside_ai_pro` |
| Já escaneio, quero imprimir | "Tenho scanner. Quero produzir dentro da clínica/laboratório" | `/f/impressora-3d-rayshape-edge-mini` |
| Já imprimo, quero rentabilizar | "Tenho o equipamento. Quero resina, caracterização e acabamento melhores" | `/f/resina-3d-smartprint-bio-vitality` |

*Por quê:* essa barra faz o trabalho que a página inteira não faz hoje — qualifica antes de vender e grava o lead na célula certa do 7×3 via `workflow_stage_target` do formulário.

### 3.2 **O Fluxo Digital Smart Dent** (nova — é o coração da página)
Substitui o bloco "Nossas soluções" de 6 cards por uma faixa horizontal de 7 etapas numeradas (1 SCAN → 7 FRESAGEM), cada uma abrindo um painel com:

- ícone + número da etapa
- **Equipamento** (com marcas reais)
- **Insumo Smart Dent** — destacado em `#DE6E37`, com selo `FABRICAÇÃO PRÓPRIA` quando for
- 2 links: `Ver no catálogo` (`/categorias/<slug>`) e `Falar com especialista` (`/f/<slug>` da etapa)

Headline da seção:

> ## Do escaneamento à instalação, **nenhuma etapa fica na mão de terceiros**
> Cada etapa tem o equipamento certo e o insumo que faz ele render. A maior parte desse insumo nós fabricamos — por isso o parâmetro, a resina e o acabamento conversam entre si.

*Por quê:* é o que faz o visitante que veio por "scanner intraoral preço" entender que está falando com quem resolve o problema inteiro, e não com mais uma revenda.

### 3.3 **O que a Smart Dent fabrica** (nova)
Faixa de marcas próprias — a linha divisória entre Smart Dent e qualquer revendedor:

**Smart Print Bio · Smart Print · SmartMake · SmartGum · NanoClean · GlazeON · UNIKK · ATOS · SmartSlicer I.A. · ChairSide Print**

Copy:

> Somos fabricantes. Nascemos em 2009 em São Carlos como spin-off da EESC-USP, com pesquisa aplicada em materiais odontológicos financiada por FAPESP, CAPES e CNPq. Os equipamentos que integramos são das melhores marcas do mundo — **os materiais que rodam dentro deles são nossos**.

*Por quê:* resolve o buraco nº 2 e é o único ativo que nenhum concorrente consegue replicar comprando estoque.

### 3.4 Prova operacional (nova — números reais, verificáveis)
Quatro contadores + uma frase cada. **Todos existem no banco hoje:**

| Número | Frase |
|--------|-------|
| **260** | combinações resina × impressora com parâmetro validado e publicado |
| **22** | resinas com ficha técnica, documentação e apresentações |
| **843** | conteúdos técnicos na Base de Conhecimento (PT/EN/ES) |
| **203** | depoimentos em vídeo de clientes reais |

Com CTA: `Comprou nossa resina? Encontre o parâmetro da sua impressora → /base-conhecimento?tab=parametros`

*Por quê:* isso é suporte pós-venda provado com dado, não promessa. É o argumento decisivo contra o concorrente que vende a impressora e some.

### 3.5 Calculadora de ROI (já existe — só precisa aparecer)
Bloco com CTA direta para `/base-conhecimento/calculadora-roi`.

> Antes de decidir, calcule. Quanto sua hora clínica passa a valer quando a peça sai no mesmo dia?

*Por quê:* quem pesquisa scanner/impressora está em avaliação de investimento. A ferramenta existe, está escondida, e é o melhor ímã de lead qualificado da casa.

### 3.6 **Catálogo completo** (nova — a resposta direta ao pedido do distribuidor)
Página própria em `/catalogo`, renderizada a partir de `system_a_catalog` (só as categorias comerciais da allowlist: `product`, `resin`, `Resinas`, `consumables`, `Serviços` — ver `docs/CATALOG_PRODUCT_GOVERNANCE.md`), agrupada pelas 7 etapas, com filtro **Equipamento / Insumo** e busca.

Headline:

> ## **157 itens.** 7 etapas. Um fluxo só.
> Equipamento é o começo. **79% do nosso catálogo é insumo de recompra** — resina, caracterização, cimento, bloco, limpeza e acabamento.

Na landing entra apenas o teaser da seção: os 7 chips com a contagem de SKUs por etapa + botão `Ver catálogo completo`.

*Por quê:* é exatamente o pedido — "quando um distribuidor entrar no site, que ele não pense que só vendemos equipamento". A contagem por etapa faz esse trabalho em 3 segundos, sem ninguém precisar ler.

### 3.7 **Seja um distribuidor Smart Dent** (nova — a segunda porta)
Seção própria no fim da landing + página `/parceiros`. Quatro argumentos, nessa ordem:

1. **Você distribui recompra, não equipamento.** 79% do catálogo é insumo — resina, SmartMake, SmartGum, UNIKK, ATOS, NanoClean. Ticket que volta todo mês.
2. **Você vende fabricante, não estoque de terceiro.** Marca própria, registro FDA nº 3027526455, ISO 13485, conformidade ANVISA e ISO 10993.
3. **Sua página oficial no nosso domínio.** Cada distribuidor aprovado ganha `/distribuidores/{país}/{empresa}` com schema `LocalBusiness`, vínculo Wikidata (Q138636902) e `makesOffer` das linhas autorizadas — Google, ChatGPT e Perplexity passam a te apontar como ponto de venda oficial da região.
4. **A Dra. L.I.A. te indica.** Quando um lead da sua região pergunta onde comprar, a IA responde com o seu contato.

Prova: **24 distribuidores em 10 países** (Brasil, EUA, Chile, Colômbia, Bolívia, Uruguai, Venezuela, Costa Rica, Panamá, República Dominicana).

CTA: `Quero ser distribuidor → /cadastro-distribuidor` · `Ver a rede atual → /distribuidores`

*Por quê:* hoje o programa existe, está documentado e rodando (`docs/PITCH_DISTRIBUIDORES_FABIO.md`), mas não tem entrada pela landing.

### 3.8 Como funciona + Ciência aplicada + EUA + FAQ
Manter como estão. Apenas adicionar 3 perguntas ao FAQ:

- **"Vocês só vendem equipamento?"** → Não. 79% do catálogo é insumo de recompra, e a maior parte é de fabricação própria.
- **"Vocês fabricam ou revendem?"** → As duas coisas: fabricamos resinas e materiais (Smart Print Bio, SmartMake, SmartGum, NanoClean, UNIKK, ATOS) e integramos equipamentos das melhores marcas (MEDIT, Asiga, Rayshape, exocad).
- **"Como me torno distribuidor?"** → Cadastro em `/cadastro-distribuidor`, aprovação comercial e publicação da sua página oficial.

*Por quê:* essas três perguntas são exatamente as objeções do enunciado — e em FAQ elas também alimentam os LLMs (a Base já é indexada por IA via `llms.txt`).

---

## 4. Ordem de implementação (menor esforço → maior impacto)

| # | Entrega | Esforço | Impacto |
|---|---------|---------|---------|
| 1 | CTA "Seja um distribuidor" no hero + seção 3.7 no fim | baixo | resolve metade do pedido no mesmo dia |
| 2 | Seção 3.2 (fluxo 7 etapas) no lugar dos 6 cards | médio | resolve o posicionamento do dentista |
| 3 | Barra 3.1 + bloco 3.4 (contadores) + CTA ROI 3.5 | baixo | conversão e qualificação |
| 4 | Faixa 3.3 (marcas próprias) + 3 FAQs novos | baixo | diferenciação e AI readiness |
| 5 | Página `/catalogo` data-driven + teaser 3.6 | alto | resolve a outra metade do pedido, definitivamente |

---

## 5. SEO / AI readiness da nova página

- Adicionar ao `@graph` existente um **`OfferCatalog`** com os 7 `itemListElement` das etapas, cada um com `numberOfItems` real vindo do banco — é assim que ChatGPT/Perplexity passam a responder "a Smart Dent vende insumo?" com "sim, 124 itens em 7 etapas".
- Manter `speakable` e o bloco TL;DR; **estender o TL;DR** para citar fabricação própria e o programa de distribuidores (hoje ele só cita fornecimento).
- Registrar a página `/catalogo` no `sitemap-index.xml` e no `llms.txt`.
- `Organization.brand` com as marcas próprias (Smart Print Bio, SmartMake, SmartGum, NanoClean, GlazeON, UNIKK, ATOS) — hoje não existe e é o que ensina a IA que a Smart Dent é fabricante.

## 6. Tracking

Cada card de etapa e cada CTA deve empurrar `dataLayer` com a célula 7×3 correspondente, para o Revenue OS ler a origem:

```js
dataLayer.push({ event: 'landing_stage_click', stage: '3_impressao_3d_resinas', surface: 'institucional_fluxo' });
```

O `generate_lead` já existe no `PublicFormPage.tsx` — nada a mudar lá.

---

## FONTES CONSULTADAS

| Fonte | O que forneceu |
|-------|----------------|
| `system_a_catalog` (Supabase `okeogjgqijbfkudfjadz`, consulta 24/09/2026, allowlist `product`/`resin`/`Resinas`/`consumables`/`Serviços`) | 157 SKUs comerciais, nomes reais de produto, categorias e subcategorias, contagem por etapa |
| `parameter_sets` / `resins` | 260 combinações de parâmetro, 22 resinas |
| `knowledge_contents` / `knowledge_videos` | 843 conteúdos, 626 vídeos |
| `system_a_catalog` (`category='video_testimonial'`) | 203 depoimentos em vídeo |
| `distributors` | 24 distribuidores, 10 países |
| `smartops_forms` (ativos, `form_purpose='sdr_captacao'`) | slugs reais de formulário e `workflow_stage_target` de cada um |
| `src/components/knowledge/KbTabInstitucional.tsx` | conteúdo, copy e schema da página atual |
| `src/App.tsx` | rotas públicas reais (`/institucional`, `/catalogo` a criar, `/base-conhecimento/calculadora-roi`, `/distribuidores`, `/cadastro-distribuidor`, `/f/:slug`, `/categorias/:slug`) |
| `docs/PITCH_DISTRIBUIDORES_FABIO.md` | mecânica do programa de distribuidores, contrapartidas, página `LocalBusiness`, Wikidata Q138636902 |
| `docs/SKILL_SMARTDENT_REVENUE_OS.md` | taxonomia 7×3, `workflow_stage_target`, governança de catálogo, dados de FDA/GTM |
| `docs/CATALOG_PRODUCT_GOVERNANCE.md` (referenciado) | allowlist de tipos comerciais |

## LACUNAS (declaradas, não inventadas)

1. **Margem, preço e frequência de recompra do distribuidor** — nada disso está em fonte interna acessível. A seção 3.7 foi escrita com argumento de mix (79% de insumo), não de margem. Se Fábio/Exportação tiver a tabela, o argumento fica muito mais forte.
2. **Taxonomia divergente no catálogo** — `product_category` usa dois esquemas ao mesmo tempo: `5. CARACTERIZAÇÃO` + `6. DENTÍSTICA, ESTÉTICA E ORTODONTIA` + `6. Cursos` convivem, enquanto o Workflow 7×3 define 5 = Finalização, 6 = Cursos, 7 = Fresagem. Uma página `/catalogo` dirigida por esse campo vai renderizar duas etapas "6". **Precisa ser normalizado antes do item 5 do roadmap.**
3. **`workflow_stage_target` inconsistente nos formulários ativos** — convivem `1_captura_digital__scanner_intraoral` (underscore duplo) e `1_captura_digital_scanner_intraoral` (simples), além de `6_cursos_presecial` (typo) e `5_finalizacao_academic` (não consta nas 25 células válidas). Qualquer roteamento da landing por essa chave herda o erro.
4. **Etapa 7 (Fresagem)** tem insumo no catálogo (11 blocos ATOS) mas nenhum equipamento cadastrado — a página não deve prometer fresadora enquanto não houver SKU.
5. **Preços e condições de financiamento** — a FAQ atual afirma "parcelamento facilitado" sem fonte auditável neste repositório; mantido como está, não ampliado.
