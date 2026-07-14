## Objetivo

Corrigir 4 problemas nos documentos gerados (PDF/DOCX) da Distribuição e padronizar a ordem de categorias em todo o módulo.

## 1. Ordem canônica de categorias (compartilhada)

Criar um helper único em `src/components/smartops/distributors/types.ts`:

```ts
export const CATEGORY_ORDER: string[] = [
  "RESINAS 3D / BIOCOMPATÍVEIS",
  "RESINAS 3D / USO GERAL",
  "PÓS-IMPRESSÃO / ACABAMENTO E FINALIZAÇÃO",
  "CARACTERIZAÇÃO / SMARTMAKE",
  "CARACTERIZAÇÃO / SMARTGUM",
  "DENTÍSTICA, ESTÉTICA E ORTODONTIA / ADESIVOS",
  "DENTÍSTICA, ESTÉTICA E ORTODONTIA / CIMENTOS",
  "DENTÍSTICA, ESTÉTICA E ORTODONTIA / RESINAS COMPOSTAS",
  "INSUMOS LABORATÓRIO / CERÔMERO",
];
export function categoryRank(cat?: string|null, sub?: string|null): number { /* match "CAT / SUB" or "CAT" prefix; unknown → 999 */ }
```

Aplicar em:
- **`DealerCatalogGrid.tsx`**: ordenar `items` por `categoryRank(product_category, product_subcategory)` antes do render; ordenar o `Select` de categorias na mesma ordem.
- **`DealerPriceTable.tsx`**: no `grouped` memo (linha 388), ordenar grupos por `categoryRank`.
- **`DealerProposalExport.ts`**: alterar `groupItemsByCategory` para ordenar categorias e subcategorias na sequência canônica antes de emitir bandas (afeta PDF e DOCX).

## 2. PDF — Cabeçalho cortado e imagens dos produtos

Em `DealerProposalExport.ts / exportPriceTablePdf`:

- **Cabeçalho**: recalibrar coordenadas do overlay (`drawPageChrome`) para bater com o PNG de fundo (`proposal-bg`). Ajustar `tableTop` para começar somente após o bloco de cabeçalho do fundo (verificar altura real do PNG e mover para ~230pt se necessário), e reduzir `fontSize` dos campos longos com truncamento inteligente.
- **Coluna Imagem**: adicionar 1ª coluna "Foto" (~40pt) exibindo miniatura. Carregar `it.image_url` via `fetch → dataURL` (com cache Map), converter para `PNG/JPEG` e desenhar no `didDrawCell` do autoTable (jsPDF `addImage`). Fallback: célula vazia quando URL ausente ou falha.
- Reajustar `columnStyles` para caber em `contentW = 539pt` com a nova coluna (reduzir "Produto" e "Variante").

## 3. DOCX — Imagens dos produtos

Em `exportPriceTableDocx`:
- Adicionar 1ª coluna "Foto" (largura 900 DXA; recalcular soma para 14838).
- Pré-carregar imagens (mesmo cache do PDF) e inserir `ImageRun` (60×60px) por linha; célula vazia quando ausente.

## 4. Rodapé de totais (PDF e DOCX)

Adicionar abaixo da última tabela três linhas alinhadas à direita:
- **Preço de tabela**: soma de `price_base`
- **Valor de desconto**: `price_base - price_dealer` total (com % médio ponderado entre parênteses)
- **Preço Dealer**: soma de `price_dealer` (destaque em bold)

Substituir o atual `Total dealer` único por esse bloco de 3 linhas, em ambos os exportadores.

## Detalhes técnicos

- Fetch de imagens: helper `imageToDataUrl(url)` com `Map<string, Promise<string|null>>`; timeout de 5s; ignora erros silenciosamente.
- `getStorageImageUrl(url, { width: 120, quality: 70 })` para reduzir payload.
- Nenhuma mudança de schema/DB necessária.

## Arquivos alterados

- `src/components/smartops/distributors/types.ts` (export `CATEGORY_ORDER`, `categoryRank`)
- `src/components/smartops/distributors/DealerCatalogGrid.tsx` (ordenação)
- `src/components/smartops/distributors/DealerPriceTable.tsx` (ordenação de `grouped`)
- `src/components/smartops/distributors/DealerProposalExport.ts` (ordem + imagens PDF/DOCX + rodapé totais + cabeçalho alinhado)

## Fora do escopo

- Alterar dados no banco, resins, `products_catalog`.
- Redesenhar o PNG de fundo da proposta.
