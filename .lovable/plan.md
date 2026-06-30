## Diagnóstico

Em `/en/knowledge-base?tab=catalogo` (e `/es/...`) os produtos somem porque o hook de tradução está sobrescrevendo o campo usado para filtrar.

Fluxo em `src/components/knowledge/KbTabCatalogo.tsx`:

1. `useCardTranslations('system_a_catalog', rowsRaw, ['name','description','product_category','product_subcategory','cta_1_label','cta_2_label'])` substitui `r.product_category` pela versão `_en`/`_es` (ex.: "3D RESINS", "POST-PROCESSING").
2. Em seguida o filtro chama `normCat(r.product_category)`, que só conhece os rótulos canônicos em PT (`'RESINAS 3D'`, `'PÓS-IMPRESSÃO'`, etc.). Para qualquer valor traduzido, retorna `null`.
3. `filtered` descarta todas as linhas (`if (!canon) return false`) → grid vazio (`KbEmptyState`).

Em PT funciona porque o hook é no-op (`lang === null`), então `product_category` permanece em PT canônico.

Os chips já usam i18n próprio (`CATEGORY_I18N_KEY` + `t()`), portanto não há necessidade de traduzir `product_category`/`product_subcategory` no nível da linha — a categoria precisa permanecer canônica em PT para o matching funcionar.

## Correção (cirúrgica, 1 arquivo)

`src/components/knowledge/KbTabCatalogo.tsx` — remover `product_category` e `product_subcategory` da lista de campos passados ao `useCardTranslations`:

```ts
const translatedRows = useCardTranslations(
  'system_a_catalog',
  rowsRaw,
  ['name', 'description', 'cta_1_label', 'cta_2_label']  // ← sem product_category / product_subcategory
);
```

Efeitos:
- `normCat()` volta a casar e o grid renderiza em EN/ES.
- Chips de categoria continuam exibindo o rótulo traduzido (já vêm de `t(c.tk)` no `CHIP_KEYS`).
- Subcategorias (`subChips`) continuam mostrando o valor PT — se quiser traduzi-las depois, fazemos via `t()` separado sem afetar o filtro.

Nada mais é alterado (sem migração, sem mexer no hook, sem mexer em outras telas).

## Validação
- Abrir `/en/knowledge-base?tab=catalogo` e `/es/base-conocimiento?tab=catalogo` → cards aparecem.
- PT continua igual.
- Filtro por chip (Resinas, Impressão, etc.) continua funcionando.
