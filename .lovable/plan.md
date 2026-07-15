## Problema

Na **Tabela de Preço** (2ª imagem) as variações aparecem fora de ordem e com unidades misturadas:
- `1kg` / `250g` / `500g` (fora de ordem, unidades diferentes)

Enquanto no **Catálogo de Produtos** (1ª imagem) a padronização já está correta:
- `1000 grs` / `500 grs` / `250 grs` (do maior para o menor, tudo em `grs`)

O `importCatalog` já normaliza corretamente para `grs` + qty em gramas (`1kg → 1000`, `500g → 500`, `250g → 250`), mas:
1. Linhas antigas (importadas antes da normalização) permaneceram com `1kg` / `500g` / `250g` no `presentation_qty` e com `presentation` variado (Kg/grs).
2. A ordenação atual dentro de um grupo de variações mantém a "ordem original de inserção", não ordena por quantidade.

## O que fazer (só frontend — `DealerPriceTable.tsx`)

**1. Sanear variações legadas ao carregar itens** (função pura, sem migration):
Após buscar `dealer_price_items`, reutilizar a mesma lógica `normalizeWeight` já existente para converter, apenas em memória e no que estiver dessincronizado, `presentation_qty` + `presentation` das linhas cujo `presentation` for `Kg`/`grs`:
- `"1kg"` + `Kg` → `"1000"` + `grs`
- `"500g"` + `grs` → `"500"` + `grs`
- `"250g"` + `grs` → `"250"` + `grs`

As linhas alteradas entram em `dirtyIds` (o usuário clica em **Salvar** para persistir) — não faz UPDATE silencioso no banco.

**2. Ordenar variações do mesmo produto por gramas DESC** (dentro do bloco `orderedRows.sort`):
No comparador atual, quando `ia === ib` (mesmo grupo/produto), em vez de `rows.indexOf(a) - rows.indexOf(b)`, ordenar pelo numérico de `presentation_qty` **descendente** (1000 → 500 → 250). Fallback para ordem original se não numérico.

## O que NÃO alterar

- Sem migration / sem alterar dados no banco automaticamente.
- Sem mudar `importCatalog` (já está correto).
- Sem tocar em `DealerCatalogGrid.tsx` nem em `types.ts`.
- Sem alterar layout de colunas, larguras, i18n.

## Resultado esperado

Tabela de Preço passa a exibir sempre, para qualquer produto de peso:

```text
Pres #   Pres
1000     grs
500      grs
250      grs
```

Ordem consistente com o Catálogo, unidades padronizadas em `grs`.
