## Objetivo

No card de produto (resinas) em `KbTabCatalogo.tsx`, alterar a renderização das "Apresentações (SKUs)" para mostrar **apenas** os 3 indicadores:

```
{label}g  ·  {print_type}  ·  {prints_per_bottle} imp/frasco
```

Remover preço (R$) e qualquer outro dado dos chips.

## Mudanças

**Arquivo único:** `src/components/knowledge/KbTabCatalogo.tsx`

1. **Interface `ResinPresentation`** — adicionar `print_type: string | null`, `grams_per_print: number | null`, `prints_per_bottle: number | null`. Manter `price`/`label` no tipo (usados em outros lugares se houver), mas não renderizar.

2. **Query `resin_presentations`** — incluir `print_type, grams_per_print, prints_per_bottle` no `select`.

3. **Filtro** — descartar linhas vazias (label vazio E grams_per_print=0 E prints_per_bottle=0).

4. **Dedup `presDeduped`** — chave passa a ser `label|print_type|prints_per_bottle` (já que mesmo `250g` pode ter múltiplos tipos de impressão, e cada um é uma apresentação distinta — ver dados: 250/Coroas/104, 250/Facetas/125, 250/Protocolos/20).

5. **Render do chip** — substituir conteúdo atual (`formatPresLabel + formatBRL(price)`) por:
   - `{label}g · {print_type} · {prints_per_bottle} imp/frasco`
   - Se algum campo faltar, omitir aquele segmento (sem mostrar "null" ou "0").
   - Manter estilo compacto atual (outline chip, fontSize 11px, max 3 inline + `+N`).

6. **Remover** `formatBRL` e `formatPresLabel` se não forem mais usados em nenhum outro lugar do arquivo (verificar antes de deletar).

## Fora de escopo

- Sem mudanças em queries de docs, no `KbResinDocsDialog`, no schema, ou em outros tipos de produto não-resina.
- Sem alteração no layout geral do card (linhas de botões Loja/FDS/IFU/📑 Documentos continuam iguais).
