## Problema
Nos cards do Catálogo, o badge de categoria (`RESINAS 3D`, `PÓS-IMPRESSÃO`, `CARACTERIZAÇÃO`, `DENTÍSTICA, ESTÉTICA E ORTODONTIA`, `SOFTWARES`, `SCANNERS 3D`, `IMPRESSÃO 3D`) é renderizado direto da coluna `system_a_catalog.product_category` (string em PT). Ao trocar de idioma, esse texto não muda.

As traduções já existem em `kb.chips.*` (`resinas`, `pos_impressao`, `caracterizacao`, `dentistica`, `softwares`, `scanners`, `impressao`) nos três locales.

## Alteração
Em `src/components/knowledge/KbTabCatalogo.tsx`:

1. Adicionar um helper `categoryLabel(canon: string, t)` que mapeia a categoria canônica para a chave de tradução:
   ```
   'RESINAS 3D'                          -> t('kb.chips.resinas')
   'PÓS-IMPRESSÃO'                       -> t('kb.chips.pos_impressao')
   'CARACTERIZAÇÃO'                      -> t('kb.chips.caracterizacao')
   'DENTÍSTICA, ESTÉTICA E ORTODONTIA'   -> t('kb.chips.dentistica')
   'SOFTWARES'                           -> t('kb.chips.softwares')
   'SCANNERS 3D'                         -> t('kb.chips.scanners')
   'IMPRESSÃO 3D'                        -> t('kb.chips.impressao')
   default                               -> canon
   ```
2. Trocar a linha 526 — `{canon}` — por `{categoryLabel(canon, t)}`.

Os chips de filtro no topo já usam `t()` (`kb.chips.*`), então só o badge dentro do card está faltando.

## Observação sobre `product_subcategory` (badge "special")
O `special` (linha 528) vem de regex `SPECIAL` aplicado a subcategoria livre do DB — sem dicionário fechado. Não dá pra traduzir sem mapeamento. Fora do escopo desta correção; manter como está.

## Arquivos afetados
- `src/components/knowledge/KbTabCatalogo.tsx`