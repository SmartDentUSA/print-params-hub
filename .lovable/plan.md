## Causa

A `description` de 6 resinas (de 16 ativas) está com HTML cru (`<p>`, `<ul>`, `<section style=...>`). Origem:

1. A função `enrich-resins-from-apostila` copia `product.sales_pitch || product.description` diretamente do JSON da apostila do Sistema A — que vem com o HTML da loja (Loja Integrada / e-commerce).
2. O card em `KbTabCatalogo.tsx` (linha 452) renderiza como texto: `<p className="kb-excerpt">{p.description}</p>` — então as tags aparecem visíveis em vez de formatadas.

Resinas afetadas hoje: Bio Denture Translúcida, Smart Print Gengiva, Try-in Calcinável, Model Plus, Bio Temp B1, e ~1 outra.

## Correção (3 frentes)

### 1. Render seguro no card (frontend)
`src/components/knowledge/KbTabCatalogo.tsx`:
- Criar helper `stripHtml(s)` que: remove tags, decodifica entidades (`&nbsp;`, `&lt;`), colapsa espaços, e trunca em ~180 chars.
- Aplicar em `p.description` antes de renderizar no `<p className="kb-excerpt">`.
- Também aplicar no filtro de busca (linha 340) para que termos casem com texto limpo.

Isso resolve imediatamente o visual sem depender do banco.

### 2. Cleanup do banco (migration)
Migration única que normaliza `resins.description` quando contém HTML:
- `regexp_replace(description, '<[^>]+>', ' ', 'g')` → strip tags
- `regexp_replace(..., '&nbsp;', ' ', 'g')` e entidades comuns
- `regexp_replace(..., '\s+', ' ', 'g')` → colapsa espaços
- `trim()` + `WHERE description ~ '<[a-z]+'`

Mantém o conteúdo, só remove markup.

### 3. Hardening no enrichment (edge function)
`supabase/functions/enrich-resins-from-apostila/index.ts`:
- Antes de gravar `updates.description = newDescription`, passar por `stripHtml()` equivalente.
- Evita regressão quando a apostila for re-importada.

## Fora do escopo

- Não mexer em `processing_instructions` (já tratado por parser próprio).
- Não mexer em `ai_context`/`meta_description` (já vêm limpos da apostila).
- Não alterar layout/CSS dos cards.