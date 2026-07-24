## Objetivo
Ordenar categorias e subcategorias em **Distribuição — Tabelas de Preço & Propostas** de **1 → 7** pelo prefixo numérico (`1. SCAN`, `2. CAD`, `3. IMPRESSÃO 3D`, `4. PÓS-IMPRESSÃO`, `5. CARACTERIZAÇÃO`, `6. DENTÍSTICA…`, `7. Fresagem`), com subcategorias seguindo o mesmo critério (`3.1`, `3.2`, `3.3`…).

## Situação atual
`src/components/smartops/distributors/types.ts` define `CATEGORY_ORDER` com nomes antigos ("RESINAS 3D / BIOCOMPATÍVEIS", "CARACTERIZAÇÃO / SMARTMAKE", etc.) que já **não batem** com as categorias reais do catálogo. Isso faz `categoryRank`:
- devolver rank válido só para algumas subcategorias (ex.: "6. DENTÍSTICA / CIMENTOS" casa parcialmente),
- deixar as demais no fallback 9999,
- resultando em ordenação inconsistente entre Catálogo, Tabela, Proposta e exports.

## Mudança
Um único arquivo: `src/components/smartops/distributors/types.ts`.

Reescrever `categoryRank(cat, sub)` para ranquear pelo **prefixo numérico**:
- Extrair o número inicial de `cat` (`^\s*(\d+)\.`) → parte inteira.
- Extrair o `x.y` de `sub` (`^\s*\d+\.(\d+)`) → parte decimal.
- Retornar `intPart + decPart/100` (ex.: `3.1 RESINAS 3D` → `3.01`, `6.2 CIMENTOS` → `6.02`).
- Sem prefixo numérico → rank alto (`9999`) e ordena por `localeCompare` (fallback já existente nos call-sites).

Remover o array `CATEGORY_ORDER` (não é mais fonte de verdade). Manter a assinatura de `categoryRank` intacta — os 4 call-sites (`DealerCatalogGrid`, `DealerPriceTable`, `DealerProposalWizard` via `DealerProposalExport`, e o próprio export PDF/DOCX/XLSX) continuam funcionando sem mudança.

Normalização leve: aparar espaços e fazer o parse case-insensitive, tolerando variações como "5. Finalização" vs "5. CARACTERIZAÇÃO" (ambas ficam no bucket 5, subordenadas pelo `x.y`).

## Fora de escopo
- Não altero dados no banco, nem consolido as categorias duplicadas com casing diferente ("1.2 Scanner Bancada" vs "1.2 SCANNER BANCADA") — é só apresentação.
- Nenhuma mudança em lógica de negócio, RLS, ou fora da pasta `src/components/smartops/distributors/`.
- Ordenação de variações por peso (1000 → 500 → 250 → 100) e ordenação de produtos dentro da subcategoria permanecem como estão.

## Validação
- Abrir as 3 sub-abas (Catálogo, Tabela, Proposta) e conferir bandas em ordem 1 → 7 e subcategorias `x.1 → x.n`.
- Exportar uma proposta em PDF, DOCX e XLSX e conferir a mesma ordem.
