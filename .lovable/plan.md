# Módulo Distribuição — Tabela de Preços & Propostas

Adicionar em **Smart Ops → Distribuição** um módulo completo de gestão de tabela de preços e geração de propostas comerciais para representantes nacionais e internacionais.

## Estrutura de navegação

A aba `Distribuição` (`SmartOpsDistributors.tsx`) hoje mostra só o cadastro. Vamos convertê-la em um layout com sub-abas:

```text
Smart Ops → Distribuição
├── Distribuidores          (o cadastro atual)
├── Catálogo de Produtos    (grid visual com foto)
├── Tabela de Preço         (grid editável estilo planilha)
└── Gerar Proposta          (wizard + preview + export)
```

## 1. Aba "Catálogo de Produtos" (visual)

Grid de cards com foto do produto puxando de `system_a_catalog` (name, image_url, category, subcategory, price, currency, description).

- Filtro por Categoria / Subcategoria / busca por nome ou COD.
- Toggle idioma (PT / EN / ES) usando os campos `name_en`, `description_en` etc.
- Cada card: foto grande, nome, categoria, preço base, botão "Ver ficha" (abre modal com specs técnicas).
- Botão "Adicionar à tabela de preço" (envia o item para a tabela editável do distribuidor selecionado).

## 2. Aba "Tabela de Preço" (editável)

Nova tabela `public.dealer_price_lists` + `public.dealer_price_items` armazenando a tabela por distribuidor.

Colunas visíveis (todas editáveis inline):

| COD | Foto | Nome do produto | NCM/HS | GTIN/EAN | Variante | Descrição | Unid | Categoria | Subcategoria | Preço Tabela | % Desc. | Preço Dealer |

Regras:
- Seletor de distribuidor no topo (usa a lista de `distributors`).
- Botão "Importar catálogo completo" popula todos os produtos ativos de `system_a_catalog` com preço base.
- `Preço Dealer = Preço Tabela × (1 - %Desc/100)`. Editar qualquer campo recalcula os outros dois (edição do preço dealer recalcula o desconto).
- Agrupamento por Categoria → Subcategoria (colapsáveis, com checkbox de seleção em massa).
- Botões: Salvar, Duplicar tabela, Exportar XLSX, Exportar PDF, Exportar DOCX.
- Autosave por linha (debounced) + versionamento (campo `version` incremental na tabela mãe).

## 3. Aba "Gerar Proposta"

Wizard em 3 etapas:

1. **Selecionar distribuidor** → puxa dados de cadastro (empresa, razão social, contato, e-mail, país) para o cabeçalho da proposta.
2. **Selecionar categorias e produtos** → árvore em duas colunas (categoria → subcategoria → itens) com checkbox e ajuste de quantidade.
3. **Preview da proposta** → renderiza documento com layout do PDF anexo:
   - Cabeçalho: logo Smart Dent, endereços BR/USA, certificações (FDA, ISO, ANSM, TrinovaBiochem), timestamp.
   - Bloco de dados do distribuidor (empresa, razão social, comprador, e-mail, país) editável.
   - Tabela **Price Table** com colunas: `COD | PRODUCT (foto + nome) | VARIANT | GTIN/EAN | NCM/HS | PRICE | DISCOUNT | PRICE DEALER`.
   - Todos os campos permanecem editáveis no preview (input inline).
   - Recalculo automático de desconto/preço dealer conforme o usuário edita.
   - Rodapé com WWW.SMARTDENT.COM.BR.

Ações do preview: **Salvar Proposta**, **Exportar PDF**, **Exportar XLSX**, **Exportar DOCX**, **Enviar por e-mail** (envia PDF anexo pelo Gmail/Resend já usado no projeto).

Propostas salvas ficam em `public.dealer_proposals` e listadas com status (rascunho, enviada, aceita, expirada) e histórico de versões.

## Detalhes técnicos

**Backend (migração Supabase):**

```sql
-- dealer_price_lists: uma tabela de preço "vigente" por distribuidor
CREATE TABLE public.dealer_price_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id uuid NOT NULL REFERENCES public.distributors(id) ON DELETE CASCADE,
  name text NOT NULL,
  currency text NOT NULL DEFAULT 'BRL',
  language text NOT NULL DEFAULT 'pt',
  version int NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.dealer_price_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_list_id uuid NOT NULL REFERENCES public.dealer_price_lists(id) ON DELETE CASCADE,
  catalog_product_id uuid REFERENCES public.system_a_catalog(id) ON DELETE SET NULL,
  cod text,
  name text NOT NULL,
  image_url text,
  category text,
  subcategory text,
  variant text,
  ncm_hs text,
  gtin_ean text,
  unidade text DEFAULT 'UN',
  description text,
  price_base numeric(14,2) NOT NULL DEFAULT 0,
  discount_pct numeric(6,3) NOT NULL DEFAULT 0,
  price_dealer numeric(14,2) NOT NULL DEFAULT 0,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.dealer_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id uuid NOT NULL REFERENCES public.distributors(id) ON DELETE CASCADE,
  price_list_id uuid REFERENCES public.dealer_price_lists(id) ON DELETE SET NULL,
  proposal_number text UNIQUE,
  language text DEFAULT 'pt',
  currency text DEFAULT 'BRL',
  header_data jsonb,        -- empresa, razão social, comprador, e-mail, país
  items jsonb NOT NULL,     -- snapshot dos itens no momento da proposta
  totals jsonb,             -- subtotal, desconto total, total
  status text DEFAULT 'draft',
  pdf_url text,
  sent_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

Todas com `GRANT` para `authenticated`/`service_role`, RLS habilitada, políticas amarradas a `has_role(auth.uid(),'admin')` ou `has_role(auth.uid(),'distribuidor')` para leitura/edição só da própria tabela (via join em `distributors.owner_email`).

**Frontend (novos arquivos):**

```text
src/components/smartops/distributors/
├── DistributorsTabs.tsx           # wrapper com as 4 sub-abas
├── DealerCatalogGrid.tsx          # aba "Catálogo de Produtos"
├── DealerPriceTable.tsx           # aba "Tabela de Preço" (editável)
├── DealerPriceTableRow.tsx        # linha inline-editável
├── DealerProposalWizard.tsx       # aba "Gerar Proposta" (3 steps)
├── DealerProposalPreview.tsx      # template visual do PDF
├── DealerProposalExport.ts        # geradores XLSX / PDF / DOCX
└── hooks/
    ├── useDealerPriceList.ts
    ├── useDealerProposals.ts
    └── useSystemACatalog.ts
```

`SmartOpsDistributors.tsx` passa a renderizar `DistributorsTabs` com o cadastro atual como a primeira sub-aba.

**Exportadores:**
- XLSX: `xlsx` (SheetJS) já instalado — respeita as skill rules de fontes/cores e usa fórmulas para desconto e preço dealer.
- PDF: `@react-pdf/renderer` (novo) reutilizando o mesmo template React do preview.
- DOCX: `docx` npm package com tabela dupla-largura (colunas somando ao content width).

**Permissões:**
- Admin: acesso total.
- Distribuidor (role criada anteriormente): vê só sua própria tabela de preço e suas propostas.

## Considerações estratégicas (sugestões extras)

Para tornar a ferramenta útil para representantes internacionais:

1. **Multi-moeda com câmbio manual**: campo de cotação por tabela (BRL/USD/EUR) com data de referência, para propostas em qualquer moeda.
2. **Multi-idioma da proposta**: seletor PT/EN/ES aproveitando os campos já traduzidos em `system_a_catalog`.
3. **Kits/Bundles**: permitir salvar combos (ex.: "Kit Iniciante Distribuidor") como preset selecionável no wizard.
4. **Regra por escopo**: usar `distributors.authorized_scope` para filtrar quais categorias aparecem para cada representante.
5. **Histórico de versões**: cada `Salvar` da tabela cria uma revisão, permitindo comparar preços vigentes vs. anteriores.
6. **Link público read-only** da proposta (short_link) para o distribuidor abrir sem login.
7. **Assinatura eletrônica** (fase 2): campo "Aceite" com IP + timestamp para converter proposta em pedido.

## O que NÃO muda

- Cadastro atual de distribuidores (`SmartOpsDistributors.tsx`) permanece intacto, apenas movido para dentro da primeira sub-aba.
- Papel `distribuidor` (role) e sidebar já criados continuam válidos.
- Nenhuma alteração em `products_catalog`, `resins` ou fluxos de PipeRun/CRM — a tabela de preço é uma camada comercial nova e isolada.
