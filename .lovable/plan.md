
# Correção: Dra. L.I.A. não encontra "Atos Ortho" / resposta incorreta

## Diagnóstico confirmado

Pergunta do usuário: **"O que é a resina Atos Ortho?"**

A função `searchByILIKE` na edge function processa as palavras da query assim:

```
"resina Atos Ortho"
  → split por espaços
  → filtrar apenas palavras com length > 4  ← BUG AQUI
  
  "resina" (6) ✓  →  incluída
  "Atos"   (4) ✗  →  DESCARTADA (4 não é > 4)
  "Ortho"  (5) ✓  →  incluída
```

O ILIKE roda com `%resina%` e `%ortho%`, retornando 10 artigos — entre eles: Atos Academic, NanoClean, Comparativo de resinas. Eles ficam primeiro porque têm mais ocorrências de "resina". O artigo correto (`Smart Ortho: Adesivo Ortodôntico 3 em 1`) entra em 8ª posição como último do slice de 5 (`.limit(5)`).

O AI recebe o contexto errado e gera uma resposta sobre Atos Academic e Atos Unichroma.

**Problema secundário confirmado:** a função `search_knowledge_base` retorna `[]` para "Atos Ortho" — o FTS (Full Text Search) também não encontra porque `"Atos Ortho"` não tem correspondência por trigrama ou FTS em nenhum artigo que use essas palavras exatamente juntas.

## Solução — dois ajustes na edge function

### Ajuste 1 — Corrigir filtro de tamanho de palavra: `> 4` → `>= 3`

Linha 68 de `supabase/functions/dra-lia/index.ts`:

```typescript
// Antes (bugado):
.filter((w) => w.length > 4 && !STOPWORDS_PT.includes(w))

// Depois (correto):
.filter((w) => w.length >= 3 && !STOPWORDS_PT.includes(w))
```

Com isso, `"Atos"` (4 chars) e outras palavras curtas importantes como nomes de marcas passam pelo filtro.

### Ajuste 2 — Melhorar ordenação do ILIKE: priorizar match no título sobre match no excerpt

Atualmente a query ILIKE retorna até 5 resultados sem ordenação por relevância. Artigos que têm "resina" apenas no excerpt aparecem antes de artigos com "ortho" no título.

A fix é ordenar os resultados do ILIKE por número de palavras-chave encontradas no título (maior relevância primeiro) antes de fatiar `.slice(0, 5)`:

```typescript
// Após receber data do Supabase, antes de mapear:
const sorted = (data || []).sort((a, b) => {
  const scoreA = words.filter(w => a.title.toLowerCase().includes(w)).length;
  const scoreB = words.filter(w => b.title.toLowerCase().includes(w)).length;
  return scoreB - scoreA;  // maior score primeiro
});

return sorted.map((a) => { ... });
```

Isso garante que "Smart Ortho: Adesivo Ortodôntico 3 em 1" (título tem "ortho") aparece antes de "Resina Atos Academic" (título tem "resina" mas não "ortho").

### Ajuste 3 — Também buscar por `ai_context` no ILIKE (sinônimos e termos alternativos)

O campo `ai_context` existe na tabela `knowledge_contents` e serve exatamente para isso: guardar contexto adicional de busca/IA. Se o admin tiver cadastrado "Atos Ortho" como sinônimo no `ai_context` do artigo `Smart Ortho`, a busca vai encontrar.

Adicionar `ai_context` no filtro ILIKE da query:

```typescript
// Antes:
const orFilter = words.map((w) => `title.ilike.%${w}%,excerpt.ilike.%${w}%`).join(',');

// Depois:
const orFilter = words.map((w) => `title.ilike.%${w}%,excerpt.ilike.%${w}%,ai_context.ilike.%${w}%`).join(',');
```

E no select, incluir `ai_context` para poder usá-lo:

```typescript
.select('id, title, slug, excerpt, ai_context, category_id, knowledge_categories:knowledge_categories(letter)')
```

## Por que isso resolve

Com os três ajustes:

1. `"Atos"` passa pelo filtro (4 >= 3 ✓)
2. ILIKE busca com `%atos%`, `%resina%`, `%ortho%`
3. Artigos com "ATOS" ou "ortho" no título recebem score alto e aparecem primeiro
4. Resultado esperado:
   - 1º: **ATOS Smart Ortho: Adesivo Ortodôntico para Bráquetes** (título tem "atos" + "ortho")
   - 2º: **Smart Ortho: Adesivo Ortodôntico 3 em 1** (título tem "ortho")
   - 3º: **Atos Unichroma** (título tem "atos")

5. O AI recebe esses artigos como contexto e responde corretamente sobre o produto Ortho da linha Atos.

## Arquivo modificado

| Arquivo | Mudanças |
|---|---|
| `supabase/functions/dra-lia/index.ts` | 1. Mudar `> 4` para `>= 3` na filtragem de palavras do ILIKE; 2. Adicionar ordenação por relevância no título antes do slice; 3. Incluir `ai_context` no filtro e select do ILIKE |

## Seção Técnica

- O campo `ai_context` já existe na tabela `knowledge_contents` (confirmado no schema). Buscá-lo não requer migração de banco.
- O threshold `>= 3` evita stopwords de 1-2 letras mas captura siglas e nomes de marcas curtos como "Atos" (4), "Bio" (3), "3D" (2 — ficaria de fora mas não é relevante).
- A ordenação por score de título é O(n log n) sobre no máximo 50 resultados — custo desprezível.
- Deploy da edge function é necessário. Nenhuma mudança no banco ou no frontend.
