
# Dra. L.I.A. — Artigos não encontrados pelo fulltext caem em vídeos irrelevantes

## Causa Raiz Confirmada

A `search_knowledge_base` (PostgreSQL FTS com `plainto_tsquery`) retornou **apenas 1 resultado irrelevante** para a pergunta "comparativo entre resinas de outras marcas e a Vitality" — um artigo de parâmetros com relevância `0.19`.

O artigo correto (`Comparativo entre resinas principais marcas...`, slug: `comparativo-resinas`) **existe no banco** e foi confirmado com score de similaridade `0.27` via `pg_trgm`. Porém, o FTS com `plainto_tsquery('portuguese', ...)` não o indexou adequadamente para essa query.

Como o fulltext retornou apenas 1 resultado de baixa relevância com `similarity: 0.19` (acima do `MIN_SIMILARITY: 0.05`), o sistema **parou na 2ª camada** e entregou esse resultado. O vídeo retornado (`Indicação de Resinas 3D`) era o único resultado fulltext com relevância suficiente.

```text
Busca:  "você tem algum comparativo entre resinas de outras marcas e a Vitality?"
         │
         ├─ pgvector → null (sem GOOGLE_AI_KEY)
         │
         ├─ search_knowledge_base (FTS) → 1 resultado: parâmetros Anycubic (irrelevante)
         │   ↑ Min 0.05 atingido → busca PARA AQUI com resultado errado
         │
         └─ keyword em vídeos → NÃO EXECUTADO (porque FTS "achou algo")

Artigo correto: existe no banco, não encontrado pelo FTS
```

---

## Solução: Busca ILIKE como camada intermediária

Adicionar uma **4ª estratégia de busca** entre o FTS e o keyword-in-videos: busca direta por `ILIKE` nas colunas `title`, `excerpt` e `keywords` da tabela `knowledge_contents`, usando as palavras-chave extraídas da mensagem.

Isso garante que artigos com títulos como "Comparativo entre resinas..." sejam encontrados mesmo que o FTS não os indexe corretamente.

### Mudança 1 — Adicionar busca ILIKE em `knowledge_contents`

Uma nova função `searchByKeyword(supabase, query, lang)` será criada dentro do `searchKnowledge`, executada **quando o FTS retornar poucos resultados ou resultados de baixa qualidade** (ex: apenas 1 resultado com relevância < 0.3):

```typescript
// Se FTS retornou resultados mas todos de baixa qualidade (< 0.25 ou apenas 1 resultado),
// complementar com busca ILIKE nos títulos e excertos

async function searchByILIKE(supabase, query, langCode) {
  const words = query
    .toLowerCase()
    .replace(/[?!.,;]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 4 && !STOPWORDS_PT.includes(w))
    .slice(0, 5);

  if (!words.length) return [];

  const orFilter = words.map(w => `title.ilike.%${w}%,excerpt.ilike.%${w}%`).join(',');

  const { data } = await supabase
    .from('knowledge_contents')
    .select('id, title, slug, excerpt, category_id, knowledge_categories:knowledge_categories(letter)')
    .eq('active', true)
    .or(orFilter)
    .limit(5);

  return (data || []).map(a => ({
    id: a.id,
    source_type: 'article',
    chunk_text: `${a.title} | ${a.excerpt}`,
    metadata: {
      title: a.title,
      slug: a.slug,
      category_letter: a.knowledge_categories?.letter?.toLowerCase() || '',
      url_publica: `/base-conhecimento/${a.knowledge_categories?.letter?.toLowerCase()}/${a.slug}`,
    },
    similarity: 0.3, // Relevância intermediária
  }));
}
```

### Mudança 2 — Lógica de cascata com complemento ILIKE

A cascata de busca passa a ser:

```text
1. pgvector (se GOOGLE_AI_KEY disponível)
2. search_knowledge_base FTS
   2b. Se FTS retornou 0 ou 1 resultado com relevância < 0.25 → executa ILIKE complementar
       e mescla os resultados (prioridade para ILIKE se artigo não estava no FTS)
3. Keyword search em vídeos (apenas se 1+2+2b retornaram vazio)
```

Critério de qualidade do FTS:
```typescript
const ftsIsWeak = !articles || articles.length === 0 || 
  (articles.length <= 2 && articles[0]?.relevance < 0.25);

if (ftsIsWeak) {
  const ilikeResults = await searchByILIKE(supabase, query, langCode);
  // Mescla ILIKE com eventuais resultados FTS, priorizando ILIKE
  const merged = [...ilikeResults, ...ftsResults.filter(f => f.similarity >= 0.15)];
  if (merged.length > 0) {
    return { results: merged, method: "ilike", topSimilarity: merged[0].similarity };
  }
}
```

### Stopwords PT para evitar ruído

```typescript
const STOPWORDS_PT = [
  'você', 'voce', 'tem', 'algum', 'alguma', 'entre', 'para', 'sobre',
  'como', 'qual', 'quais', 'esse', 'essa', 'este', 'esta', 'isso',
  'uma', 'uns', 'umas', 'que', 'com', 'por', 'mais', 'muito',
  'outras', 'outros', 'quando', 'onde', 'seria', 'tenho', 'temos',
];
```

---

## Comportamento Esperado Após a Mudança

| Pergunta | Antes | Depois |
|---|---|---|
| "comparativo entre resinas de outras marcas e a Vitality?" | Vídeo irrelevante (Indicação de Resinas 3D) | Artigo "Comparativo entre resinas principais marcas..." com link /base-conhecimento/c/comparativo-resinas |
| "Tem guia técnico de restaurações de longa duração?" | Resultado aleatório do FTS | Artigo correto encontrado via ILIKE no título |
| "Quais são as propriedades mecânicas da Vitality?" | FTS retorna algo aleatório | Artigo específico encontrado pelo match em título e excerpt |

---

## Sistema de Prioridade Final

Após a mudança, o contexto entregue ao Gemini será ordenado por:

```text
1. Protocolos de processamento (similarity: 0.95) — somente se isProtocolQuestion
2. Resultados pgvector (similarity: 0.65–1.0) — somente se GOOGLE_AI_KEY
3. Resultados FTS de alta qualidade (relevance >= 0.25)
4. Resultados ILIKE (similarity: 0.30) — novo
5. Resultados FTS de baixa qualidade (relevance 0.05–0.25) — complemento
6. Vídeos por keyword — apenas quando tudo acima for vazio
```

---

## Arquivo Modificado

Apenas `supabase/functions/dra-lia/index.ts`:

| Mudança | Descrição |
|---|---|
| `STOPWORDS_PT` (constante global) | Lista de palavras irrelevantes para filtrar da query antes do ILIKE |
| `searchByILIKE(supabase, query)` | Nova função que busca diretamente por ILIKE em `knowledge_contents.title` e `excerpt` |
| `searchKnowledge()` — bloco FTS | Após FTS, verifica qualidade. Se fraco, executa ILIKE e mescla |
| Method label | Passa `"ilike"` como method quando usada, para ser exibido no system prompt (Regra 10) |

---

## Seção Técnica

A busca ILIKE é executada apenas quando necessário (FTS fraco), não em toda chamada — não há impacto de performance na maioria dos casos.

A extração de palavras-chave usa filtro por `length > 4` e remoção de stopwords para evitar ILIKE em "você", "tem", "algum" — que batem em quase todos os artigos e degradariam a relevância.

Sem mudanças no banco de dados. Sem migrações necessárias.
