## Objetivo

Transformar **Gestão de Catálogo de Produtos** (`AdminCatalog.tsx`) em concentrador oficial, replicando o layout tabular e edição inline de **Distribuição — Tabelas de Preço & Propostas** (`DealerPriceTable.tsx`), **sem alterar** o core do produto e **sem quebrar** a rota/documentos de Resinas.

## Fonte de dados (política Canonical Mirror preservada)

- **Core produtos gerais**: `system_a_catalog` (id, name, slug, product_category, product_subcategory, image_url, active, approved, visible_in_ui, extra_data, workflow_stages). **Não modificar.**
- **Core resinas**: `public.resins` continua canônico (Configurações do Sistema → Resinas). **Rota, documentos (`resin_documents`) e edição intactos.**
- **Espelho de resinas** no listing: linhas de resinas aparecem em `system_a_catalog` (product_category ILIKE '%resina%') via mirror já existente. Aqui só **lemos** — nenhuma edição na linha grava em `resins`; um botão "Editar em Resinas" abre a página canônica.
- **Documentos (contagem unificada por card)**: soma `catalog_documents.product_id = system_a_catalog.id` + `resin_documents.resin_id = <resin match>` (match por slug idêntico ao mirror existente). Cards como *Bite Flex* que têm docs só em `catalog_documents` continuam funcionando; resinas com docs só em `resin_documents` também. Nenhum dado é apagado ou movido.
- **Variações**: `catalog_product_variations` (já existe) por produto (`catalog_product_id`). Adicionar campo `color text` via migration mínima.

## Novo layout da tabela

Uma linha por **variação** do produto (produtos sem variação → 1 linha "padrão"). Colunas:

| Status (ativo) | COD Sistema | SKU | Etapa Flow | Categoria | Subcategoria | Nome | Variação | Pres | **Cor** | **Fabricante** | NCM/HS | GTIN/EAN | Peso (kg) | Dimensões (cm) | Preço | Visível | **IDs Correlação** | **Docs (nº)** | Status | Ações |

- **Status (1ª col.)**: switch `active` do core.
- **COD Sistema**: `system_a_catalog.product_id` (read-only, monospace).
- **SKU / NCM / GTIN / Peso / Dimensões / Pres / Variação / Cor**: inputs inline gravando em `catalog_product_variations`. `presentation` usa `PRESENTATION_OPTIONS`. Autosave `onBlur` com toast (padrão DealerPriceTable).
- **Etapa Flow**: badge derivada de `workflow_stages` (read-only por ora).
- **Categoria / Subcategoria / Nome**: read-only na linha; abrir modal para editar core.
- **Fabricante**: lê de `extra_data.manufacturer` ou `system_a_catalog.brand` (o que existir); editável inline para produtos gerais; **read-only** para linhas espelhadas de resinas (fonte = `resins`).
- **Preço**: BRL principal inline; USD/EUR em popover ("Ver moedas"). Grava em `catalog_product_variations.price_brl/usd/eur`.
- **Visível**: checkbox `visible_in_ui` do core (mantém).
- **IDs Correlação**: célula compacta mostrando três chips read-only:
  - `Loja: {extra_data.loja_integrada_id ?? '—'}`
  - `Sist A: {external_id ?? '—'}`
  - `ID: {id.slice(0,8)}` (uuid curto do `system_a_catalog`)
  Copia ao clicar (clipboard).
- **Docs (nº)**: badge com **total unificado** (`catalog_documents` + `resin_documents` quando aplicável). Tooltip discrimina "Catálogo: X · Resinas: Y".
- **Status (penúltima)**: badges Ativo/Aprovado.
- **Ações**:
  - Produtos gerais: Editar core (AdminModal) · + Variação · Excluir.
  - Resinas espelhadas: Editar em Resinas (link `/admin` → aba Configurações do Sistema → Resinas com anchor) · + Variação (grava em `catalog_product_variations` do espelho, sem tocar em `resins`) · **sem excluir** (protegido).

## Ferramentas reaproveitadas de DealerPriceTable

- Ordenação por `categoryRank(category, subcategory)` (função de `distributors/types.ts`).
- Autosave por célula com debounce, toast sonner, header sticky, filtros idênticos + novo filtro "Origem: Todos / Gerais / Resinas".
- Ícones de status (Ativo/Aprovado) + `Cor` renderizada como swatch (`<div style={{backgroundColor: color}}>` fallback texto).

## Arquivos

**Novos**
- `src/components/AdminCatalogTable.tsx` — tabela com layout completo (linhas = variações + linha default para produtos sem variação).
- `src/hooks/useCatalogVariations.ts` — CRUD `catalog_product_variations` (list por produto, upsert de célula, insert, delete).
- `src/hooks/useCatalogDocCounts.ts` — soma unificada `catalog_documents` + `resin_documents` por `system_a_catalog.id` (join por slug → resin_id, mesma regra do mirror).

**Alterados**
- `src/components/AdminCatalog.tsx` — trocar bloco `<Table>` atual por `<AdminCatalogTable />`. Header, filtros e `AdminModal` do core permanecem. Adicionar filtro "Origem" (Gerais/Resinas) e nova coluna de contagem.

**Migration mínima**
- `ALTER TABLE public.catalog_product_variations ADD COLUMN IF NOT EXISTS color text;`
- Nenhuma outra mudança de schema, RLS ou grants — `resins`, `resin_documents`, `catalog_documents`, `system_a_catalog` **inalterados**.

## Garantias explícitas (o que NÃO muda)

- `public.resins` e sua UI em Configurações do Sistema → Resinas: intactas.
- `resin_documents` e `catalog_documents`: nenhum dado apagado, movido ou unificado; apenas **somados** para exibição.
- Rotas de resinas (`/resinas/*`, `/base-conhecimento/*`), Canonical Mirror job e mirror job COALESCE: sem alterações.
- Cards com docs só no core do produto (ex.: Bite Flex) continuam expondo os docs de `catalog_documents` normalmente.

## Fora do escopo

- Editor de `workflow_stages` inline.
- Escrita cross-source (linha espelhada de resina não escreve em `resins`).
- Deduplicação de documentos entre `catalog_documents` e `resin_documents`.
- Reescrita do `AdminModal` do core.

## Aceitação

- Linhas de resinas aparecem com os campos preenchidos vindos de `system_a_catalog` (espelho de `resins`) — sem editar `resins`.
- Contagem "Docs" mostra soma correta e cards como Bite Flex (docs no catálogo) exibem número > 0.
- Colunas Cor, Fabricante e IDs Correlação (Loja/Sist A/ID) presentes e populadas quando dado existir.
- Edição inline de SKU/NCM/GTIN/Peso/Dimensões/Preço/Pres/Cor grava em `catalog_product_variations` sem sair da linha.
- Nenhuma escrita ocorre em `resins` a partir desta tabela.
