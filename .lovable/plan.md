## Contexto

- `smartops_forms.product_catalog_id` → `system_a_catalog.id` (produto do formulário já selecionado).
- Dados ricos do produto vivem em `system_a_catalog` (nome, descrição, preços, `technical_specs`, `clinical_indications`, imagens, CTAs, etc.) e `products_catalog` (via `product_id` = `system_a_product_id`): `sales_pitch`, `benefits`, `features`, `target_audience`, `applications`, `faq`, `competitor_comparison`, `technical_specifications`.
- `LandingPageBuilderModal` hoje tem abas IA / Briefing / Playbook (JSON manual) / Editar. `PremiumLandingTemplate` renderiza uma seção somente se o campo existir em `content`.

## Objetivos

1. **Botão "Usar toda a RAG do produto"** — puxa automaticamente dados do produto ligado ao form (não precisa colar JSON).
2. **Habilitar/desabilitar seções** por switch no editor.
3. **Imagens e vídeos** em vez de só ícones nos cards de benefícios/módulos/how-it-works.
4. **Nova seção "Tabela comparativa"**.

## Mudanças

### 1. Backend — nova rota da mesma edge function `landing-page-generator`
- Aceitar `mode: "rag"` com apenas `form_id` (sem `input`).
- Carrega form → `product_catalog_id` → une `system_a_catalog` + `products_catalog` (por `system_a_product_id`) → monta um "playbook resumido" idêntico ao `mode: "playbook"` atual, mais `competitor_comparison` e `clinical_indications`.
- Se o form não tem `product_catalog_id`, responde `no_product_linked`.
- Reaproveita todo o prompt e cascade já existentes.

### 2. `LandingPageBuilderModal.tsx`
- Na aba **Playbook do Produto** adicionar botão destacado no topo: **"Usar toda a RAG do produto (Rayshape Edge Mini)"** — mostra o nome do produto ligado; desabilitado se `product_catalog_id` for null (tooltip explica).
- Ao clicar, chama `landing-page-generator` com `mode: "rag"` (sem input). Guarda `mode: "rag"` no registro; regenerar refaz o mesmo fetch.
- Estado carrega `product_catalog_id` + nome via join no `useEffect` inicial.

### 3. Habilitar/desabilitar seções (editor)
- No `EditorSidebar` cada `Section` ganha um `Switch` "Mostrar nesta LP".
- Estado gravado em `LPContent.sectionsEnabled: Record<SectionKey, boolean>` (novo campo opcional).
- `PremiumLandingTemplate` passa a checar `sectionsEnabled[key] !== false` antes de renderizar cada bloco (positioning, howItWorks, price, conditions, modules, regionalRules, implementation, benefits, comparison, testimonials, faq, finalCta).
- Default `true` para tudo — compatível com LPs existentes.

### 4. Imagens/vídeos em cards
- Extender tipos no `PremiumLandingTemplate`:
  - `benefits.items[i]` → `{ icon?, title, desc, mediaUrl?, mediaType?: "image"|"video", mediaAlt? }`.
  - `howItWorks.items[i]` → mesmos campos opcionais.
  - `modules.items[i]` → `{ name, application, mediaUrl?, mediaType? }`.
- Renderização: se `mediaUrl` presente, mostra `<img>` ou `<video controls>` acima/dentro do card; senão mantém ícone atual.
- Editor: em cada item adicionar botão **"Imagem/Vídeo"** que abre um `CoverImageUpload`-style (usa bucket já existente `smartops-media` ou o mesmo do `hero_image_url`; se não houver, aceita URL colada). Botão "Remover mídia".
- Sem novas migrations: tudo mora no JSON `content`.

### 5. Nova seção **Tabela comparativa**
- Novo campo em `LPContent`:
  ```ts
  comparison?: {
    title?: string;
    subtitle?: string;
    columns: string[];              // ex.: ["Recurso", "Rayshape Edge Mini", "Concorrente A", "Concorrente B"]
    rows: { cells: string[] }[];    // cada row = 1 linha alinhada com columns
    footnote?: string;
  }
  ```
- Renderização no template como `<table>` responsiva com estilo Smart Dent (header em gradiente, linhas zebra, primeira coluna em negrito). Anchor `#comparativo`.
- Auto-preenche pela RAG quando `products_catalog.competitor_comparison` estiver disponível.
- Editor: seção com botões "Adicionar coluna / linha", campos editáveis, e switch habilitar/desabilitar.

## Fora de escopo
- Sem alterações no email, envio de campanha, ou template de outras páginas.
- Sem migração de schema — tudo persiste em `smartops_form_landing_pages.content` (jsonb).
- Sem novo bucket de storage (usa o já existente para hero image).

## Validação
1. Form Rayshape Edge Mini → abrir LP → botão "Usar toda a RAG do produto" gera preenchendo hero/positioning/benefits/modules/comparativo direto do banco.
2. Toggle cada seção → prévia esconde/mostra em tempo real; salvar; publicar; conferir na URL pública.
3. Trocar ícone por imagem em 1 benefício e por vídeo em 1 módulo → publicar → conferir renderização.
4. Editar tabela comparativa → adicionar coluna/linha → publicar → verificar responsividade mobile.
