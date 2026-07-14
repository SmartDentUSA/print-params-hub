## Objetivo
Refletir as **variações** do `system_a_catalog.extra_data.variations` (SKU/GTIN/NCM/peso/dimensões) no Catálogo, na Tabela de Preço e nos documentos gerados (PDF/DOCX/XLSX), consolidando produtos multivariante em uma única linha de Foto/Produto com sub-linhas por variação.

## Fonte de dados
`system_a_catalog.extra_data.variations` = array com:
- `sku`, `name`, `gtin13`, `ncm`, `weight_kg`, `depth_cm`, `width_cm`, `height_cm`

Regra:
- 0 ou 1 variação → linha simples (comportamento atual)
- ≥ 2 variações → 1 linha "pai" (Foto | Produto), com N sub-linhas de variação exibindo `Pres # | Pres | NCM/HS | GTIN/EAN | Unid (×) | Preço tabela (Unit) | % Desc. | Preço dealer (Unit) | Preço dealer`

## Mudanças

### 1. `types.ts`
Adicionar tipo `DealerPriceVariation` e campo opcional `variations` em `DealerPriceItem`:
```ts
type DealerPriceVariation = {
  sku: string | null; name: string | null;
  gtin_ean: string | null; ncm_hs: string | null;
  weight_kg?: number|null; depth_cm?: number|null; width_cm?: number|null; height_cm?: number|null;
  presentation_qty?: number|null; presentation?: PresentationType|null;
  quantity_multiplier?: number|null;
  price_base: number; discount_pct: number; price_dealer: number;
};
```
Persistência: guardar `variations` em `dealer_price_items.extra_data.variations` (JSON) — sem migração de schema, usando coluna JSON existente (a criar apenas se não existir). Alternativa mais simples: persistir em campo `variations jsonb` novo em `dealer_price_items` via migração.

### 2. `DealerPriceTable.tsx` — `importCatalog`
Ao importar do catálogo, para cada produto do `system_a_catalog`:
- Se `extra_data.variations.length ≤ 1`: mantém uma linha simples e herda `ncm/gtin/weight/dimensions` da (única) variação quando os campos do produto pai estiverem vazios.
- Se `≥ 2`: cria uma linha "pai" com `variations: []` populadas a partir do array; cada variação inicial recebe `price_base = preço do pai` (na moeda alvo), `discount_pct = 0`, `price_dealer = price_base` e `quantity_multiplier = 1`.

`saveAll` estende para persistir `variations` (JSON).

### 3. Renderização da tabela (`DealerPriceTable.tsx`)
- Cabeçalho ganha colunas: `Pres # | Pres | NCM/HS | GTIN/EAN | Unid (×) | Preço tabela (Unit) | % Desc. | Preço dealer (Unit) | Preço dealer` (a maioria já existe).
- Item sem variações → 1 `<TableRow>` como hoje.
- Item com variações → 1 `<TableRow>` "pai" com `rowSpan={n}` em Foto/COD/Produto/Status, seguido de N-1 rows contendo apenas as células das variações. Edição inline (`price_base`, `discount_pct`, `price_dealer`) atua na variação; recálculo automático mantém o mesmo `recalcDealerPrice/recalcDiscount`.
- Total do produto (última coluna "Preço dealer") = soma de `price_dealer` das variações.

### 4. `DealerCatalogGrid.tsx` (somente-leitura)
Espelhar a mesma renderização de sub-linhas para produtos com >1 variação, exibindo SKU/GTIN/NCM/Pres/Peso da variação.

### 5. `DealerProposalExport.ts` (PDF/DOCX/XLSX)
- Aplainar `items` para exportação: cada variação vira uma linha com o "Produto" e "Foto" repetidos (ou usar `rowSpan` no DOCX / desenhar imagem só na primeira linha do grupo no PDF).
- XLSX: emitir uma linha por variação, mantendo `Produto` idêntico em cada uma.
- Totais no rodapé permanecem: soma de `price_base` e `price_dealer` de todas as variações.

### 6. Migração Supabase
```sql
ALTER TABLE public.dealer_price_items
  ADD COLUMN IF NOT EXISTS variations jsonb;
```
(sem novas policies — herda as existentes.)

## Fora do escopo
- Edição manual de dimensões/peso das variações (vem sempre do catálogo mestre).
- Sincronização retroativa de linhas já importadas: usuário deve rodar "Recalcular preços do catálogo" ou reimportar para popular as variações.

## Arquivos alterados
- `src/components/smartops/distributors/types.ts`
- `src/components/smartops/distributors/DealerPriceTable.tsx`
- `src/components/smartops/distributors/DealerCatalogGrid.tsx`
- `src/components/smartops/distributors/DealerProposalExport.ts`
- Migração: coluna `variations jsonb` em `dealer_price_items`
