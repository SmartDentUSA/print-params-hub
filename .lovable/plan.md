

# Plano: Corrigir Busca RAG para Perguntas Contextuais (Follow-up)

## Problema Diagnosticado

A pergunta "Quanto tempo eu ganho perto do que eu faço hoje, limpopeças 1 a 1" falha em TODAS as 4 camadas de busca:

1. **Vector search**: A query conversacional gera um embedding muito distante dos chunks tecnicos do NanoClean (similarity < 0.65)
2. **FTS (search_knowledge_base)**: So busca em `knowledge_contents` e `knowledge_videos` -- os dados do NanoClean estao em `company_kb_texts`
3. **ILIKE (searchByILIKE)**: So busca em `knowledge_contents` -- nunca toca `company_kb_texts` ou `system_a_catalog`
4. **Keyword video**: "limpopeças" nao bate com nenhum titulo de video

O dado EXISTE no RAG (35 chunks indexados com a tabela comparativa mostrando "1 a 1" vs "35 elementos por vez"), mas a busca nao encontra porque:
- A mensagem do usuario nao menciona "NanoClean" explicitamente
- O historico da conversa menciona "NanoClean PoD" mas so e usado no keyword video fallback, nao nas buscas principais

## Causa Raiz

A funcao `searchKnowledge` (linha 1259) recebe `history` como parametro mas so o usa no ultimo fallback (keyword video search, linha 1335). As buscas vetorias e FTS usam APENAS a mensagem atual, ignorando o contexto da conversa.

## Solucao: Enriquecer Query com Contexto do Historico

### Alteracao 1: Augmentar query vetorial com nomes de produto do historico

Na funcao `searchKnowledge`, antes de chamar `generateEmbedding(query)`, extrair nomes de produtos/termos-chave do historico recente e concatenar a query:

```text
Antes:
  query = "Quanto tempo eu ganho perto do que eu faço hoje, limpopeças 1 a 1"

Depois (com augmentacao):
  query = "NanoClean PoD Quanto tempo eu ganho perto do que eu faço hoje, limpopeças 1 a 1"
```

Implementacao no `searchKnowledge` (apos linha 1265):

```typescript
// Augment query with product/brand names from recent history for better vector matching
let augmentedQuery = query;
if (history && history.length > 0) {
  const recentText = history.slice(-4).map(h => h.content).join(' ');
  // Extract product names: capitalized multi-word phrases or known patterns
  const productMentions = recentText.match(
    /\b(NanoClean[^.!?\n]{0,20}|Edge Mini[^.!?\n]{0,15}|Vitality[^.!?\n]{0,15}|ShapeWare[^.!?\n]{0,15}|Rayshape[^.!?\n]{0,15}|Scanner BLZ[^.!?\n]{0,15}|Asiga[^.!?\n]{0,15}|Chair Side[^.!?\n]{0,15})/gi
  );
  if (productMentions && productMentions.length > 0) {
    const uniqueProducts = [...new Set(productMentions.map(p => p.trim().slice(0, 30)))];
    augmentedQuery = `${uniqueProducts.join(' ')} ${query}`;
  }
}
const embedding = await generateEmbedding(augmentedQuery);
```

### Alteracao 2: Buscar tambem em `company_kb_texts` via ILIKE quando a busca principal falha

Adicionar uma funcao `searchCompanyKB` que faz ILIKE em `company_kb_texts` usando palavras-chave do historico + query:

```typescript
async function searchCompanyKB(
  supabase: ReturnType<typeof createClient>,
  query: string,
  history: Array<{ role: string; content: string }>
) {
  const combinedText = `${history.slice(-4).map(h => h.content).join(' ')} ${query}`;
  const words = combinedText.toLowerCase()
    .replace(/[?!.,;:]/g, '')
    .split(/\s+/)
    .filter(w => w.length >= 4 && !STOPWORDS_PT.includes(w))
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 6);

  if (!words.length) return [];

  const orFilter = words.map(w => `title.ilike.%${w}%,content.ilike.%${w}%`).join(',');

  const { data } = await supabase
    .from('company_kb_texts')
    .select('id, title, content, category, source_label')
    .eq('active', true)
    .or(orFilter)
    .limit(3);

  if (!data?.length) return [];

  return data.map(d => ({
    id: d.id,
    source_type: 'company_kb',
    chunk_text: `${d.title} | ${d.content.slice(0, 800)}`,
    metadata: { title: d.title, source_label: d.source_label },
    similarity: 0.55,
  }));
}
```

### Alteracao 3: Integrar `searchCompanyKB` no fluxo principal

Na linha 1749-1755 (busca paralela), adicionar `searchCompanyKB` quando o vetor falha:

```typescript
// Se knowledge retornou vazio E tem historico, tentar company_kb como fallback
if (knowledgeResult.results.length === 0 && history && history.length > 0) {
  const companyKBResults = await searchCompanyKB(supabase, message, history);
  if (companyKBResults.length > 0) {
    allResults.push(...companyKBResults);
  }
}
```

### Alteracao 4: Tambem rodar `searchCatalogProducts` fora da rota comercial quando historico menciona produto

Atualmente, `searchCatalogProducts` so roda quando `topic_context === "commercial"` (linha 1753). Mas o usuario esta conversando sobre NanoClean em rota nao-comercial. Alterar para tambem rodar quando o historico menciona um produto do catalogo:

```typescript
const historyMentionsProduct = history?.some(h =>
  /nanoclean|edge mini|rayshape|scanner blz|asiga|vitality|chair side/i.test(h.content)
) || false;

const shouldSearchCatalog = isCommercial || historyMentionsProduct;
```

## Detalhes Tecnicos

### Arquivo alterado
- `supabase/functions/dra-lia/index.ts`:
  - Linhas 1266-1268: Augmentar query vetorial com nomes de produto do historico
  - Nova funcao `searchCompanyKB` (inserir apos linha 305)
  - Linhas 1749-1755: Adicionar fallback `searchCompanyKB`
  - Linha 1753: Expandir condicao de `searchCatalogProducts`

### Resultado esperado

Com a augmentacao do historico:
1. "NanoClean PoD" do historico e concatenado a query → embedding vetorial mais proximo dos chunks → vector search encontra os 35 chunks da tabela comparativa
2. Se vetor falhar, `searchCompanyKB` encontra pelo ILIKE em `company_kb_texts` com "nanoclean" do historico
3. `searchCatalogProducts` tambem roda, trazendo o produto NanoClean PoD com `extra_data` enriquecido

A L.I.A. responderia algo como: "Com o NanoClean PoD voce lava ate 35 pecas por ciclo em 60 segundos, enquanto na lavagem manual com IPA voce lava 1 a 4 pecas por vez com multiplas etapas. O ganho de tempo e significativo."
