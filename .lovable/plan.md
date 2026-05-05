## Diagnóstico — HTTP 504 na Indexação Incremental

A função `index-embeddings` em modo `incremental` (sem `stage`) executa tudo em uma única requisição HTTP:

1. Coleta chunks de **6 fontes** (articles, videos, resins, parameters, company_kb, catalog_products) — incluindo um `fetch` ao endpoint `knowledge-base?format=ai_training`.
2. Faz `select chunk_text from agent_embeddings` **sem filtro nem paginação** (linha 899-901) — limitado a 1000 linhas pelo Supabase, então a dedup fica errada e ainda é cara.
3. Insere em lotes de 5 com `sleep(2000)` entre lotes.

Com ~800 artigos + vídeos + catálogo, o tempo total ultrapassa o limite de gateway (~60s no Supabase Edge), retornando **504**. Mesmo quando termina, dedup por `chunk_text` falha porque só lê os primeiros 1000 registros.

A indexação **Completa por stage** (botões individuais) já funciona porque processa apenas uma fonte por chamada.

## Plano de correção

### 1. Refatorar dedup do incremental (`supabase/functions/index-embeddings/index.ts`)

Substituir o `select chunk_text` global por dedup **dentro de cada stage**, paginando 1000 em 1000:

```ts
async function fetchExistingTexts(supabase, sourceType: string): Promise<Set<string>> {
  const set = new Set<string>();
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data } = await supabase
      .from("agent_embeddings")
      .select("chunk_text")
      .eq("source_type", sourceType)
      .range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    data.forEach(r => set.add(r.chunk_text));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return set;
}
```

Filtrar por `source_type` evita varrer toda a tabela.

### 2. Forçar `incremental` a rodar por stage no client

Em `src/components/AdminDraLIAStats.tsx` (`handleIndexing`), quando `mode === "incremental"`, **iterar pelas stages** sequencialmente e somar resultados, em vez de uma única chamada `mode=incremental&stage=all`:

```ts
const stages = ["articles","videos","resins","parameters","company_kb","catalog_products","authors"];
let totals = { indexed: 0, errors: 0, skipped: 0, total_chunks: 0 };
for (const s of stages) {
  const r = await fetch(`${url}/functions/v1/index-embeddings?mode=incremental&stage=${s}`, …);
  const j = await r.json();
  // acumula
}
```

Cada chamada fica < 60s. O usuário continua vendo um único botão "Indexação Incremental" com progresso ("Indexando articles… 3/7").

### 3. Suportar `mode=incremental&stage=<x>` na edge function

Hoje o filtro incremental (linha 896-907) só roda no final, mas a coleta de chunks já é segmentada por `stage`. Basta garantir que o `chunksToIndex` use `fetchExistingTexts(supabase, stageToSourceType[stage])` quando `stage !== "all"`. Quando `stage === "all"` + `incremental`, manter o comportamento atual mas paginando (fallback para uso programático).

### 4. Aumentar resiliência

- Reduzir `DELAY_MS` de 2000 → 500ms (cache de embeddings já evita rate-limit nos hits) ou removê-lo quando o batch tem hit-rate alto.
- Adicionar `EdgeRuntime.waitUntil` não é necessário porque agora cada stage cabe na janela de execução.

### 5. UI — feedback de progresso

No `AdminDraLIAStats`, exibir o stage atual durante o loop (`setIndexingResult({ stage: s, … })`) e um toast final consolidado.

## Arquivos afetados

- `supabase/functions/index-embeddings/index.ts` — dedup paginada por `source_type`; aceitar `incremental` em qualquer `stage`.
- `src/components/AdminDraLIAStats.tsx` — `handleIndexing("incremental")` itera pelas stages e agrega resultados; UI mostra stage corrente.

## Não muda

- Lógica de geração de chunks por fonte.
- Formato do retorno (mantém `{indexed, errors, skipped, total_chunks}`).
- Comportamento da "Indexação Completa" (botão único permanece, mas internamente também pode ser quebrado depois se necessário).

Posso prosseguir?
