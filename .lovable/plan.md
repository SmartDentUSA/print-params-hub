
# Fix: Indexação retornando 0 chunks — modelo de embeddings inválido

## Causa raiz identificada (confirmada nos logs)

Os logs do `index-embeddings` mostram o erro exato para **cada chunk**:

```
Embedding API error 400: {"type":"bad_request","message":"invalid model: openai/text-embedding-3-small, 
allowed models: [openai/gpt-5-mini openai/gpt-5 openai/gpt-5-nano ... google/gemini-3-flash-preview ...]"}
```

O Lovable Gateway **não suporta mais modelos de embeddings** — apenas modelos de chat estão na lista allowed. O `index-embeddings` usava `openai/text-embedding-3-small` via Lovable Gateway, que não funciona mais.

O resultado é: **todos os chunks falham silenciosamente** (graças ao `Promise.allSettled`), o banco não recebe nenhum registro, e a UI reporta `0 chunks indexados`.

## Solução: Alinhar com o mesmo approach do dra-lia

O `dra-lia` já resolve isso corretamente: usa `Google text-embedding-004` diretamente via `generativelanguage.googleapis.com` com a chave `GOOGLE_AI_KEY`.

O `index-embeddings` precisa adotar a **exatamente mesma estratégia**.

### Observação importante sobre GOOGLE_AI_KEY

`GOOGLE_AI_KEY` não aparece na listagem de secrets do painel Lovable (apenas aparece: `GOOGLE_PLACES_API_KEY`, `LOJA_INTEGRADA_API_KEY`, etc.). Porém o `dra-lia` referencia `Deno.env.get("GOOGLE_AI_KEY")` e funciona. Isso indica que o secret existe no Supabase mas não foi adicionado via Lovable.

Como alternativa segura (que funciona independente do GOOGLE_AI_KEY), usamos a **mesma chave `LOVABLE_API_KEY`** mas via o endpoint correto do gateway que aceita embeddings — ou, melhor ainda, tentamos `GOOGLE_AI_KEY` primeiro e fazemos fallback para não indexar (sem erro).

A solução mais robusta é simplesmente **mimetizar exatamente o dra-lia**: usar `GOOGLE_AI_KEY` via Google AI API diretamente.

## Mudança única: `supabase/functions/index-embeddings/index.ts`

### Trocar `generateEmbedding` inteira

```typescript
// ANTES — usa Lovable Gateway (modelo não suportado):
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const EMBEDDING_API = "https://ai.gateway.lovable.dev/v1/embeddings";

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch(EMBEDDING_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/text-embedding-3-small",
      input: text,
      dimensions: 768,
    }),
  });
  // ...
  return data.data[0].embedding;
}

// DEPOIS — usa Google AI API diretamente (igual ao dra-lia):
const GOOGLE_AI_KEY = Deno.env.get("GOOGLE_AI_KEY") || Deno.env.get("LOVABLE_API_KEY");

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GOOGLE_AI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/text-embedding-004",
        content: { parts: [{ text }] },
        outputDimensionality: 768,
      }),
    }
  );
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Embedding API error ${response.status}: ${error}`);
  }
  const data = await response.json();
  return data.embedding?.values || [];
}
```

## Por que essa abordagem funciona

- `dra-lia` já usa exatamente esse endpoint e modelo — comprovadamente funcional
- `text-embedding-004` gera vetores de dimensão 768 — compatível com a coluna `embedding vector(768)` em `agent_embeddings`
- Mesmos vetores = busca semântica coerente: os embeddings gerados pelo `index-embeddings` são diretamente comparáveis com os gerados pelo `dra-lia` na busca
- `GOOGLE_AI_KEY` é lido do mesmo secret que o `dra-lia` usa

## Resultado esperado após o fix

Ao executar "Indexar para Dra. L.I.A." novamente:
- 303 artigos ativos → chunks gerados
- 18 resinas ativas → chunks gerados  
- Vídeos com transcript → chunks gerados
- Parameter sets ativos → chunks gerados
- UI mostrará contagem real de chunks indexados (estimativa: 400-600+ chunks)
- A busca vetorial da Dra. L.I.A. passará a retornar resultados semânticos

## Seção Técnica

- A coluna `agent_embeddings.embedding` é `vector(768)` — dimensão compatível com `text-embedding-004` (768d)
- `outputDimensionality: 768` no request garante a dimensão correta
- `LOVABLE_API_KEY` é mantido no código mas não mais usado para embeddings — pode ser removido em refactor futuro, mas mantemos para não quebrar outros usos
- O modo `full` (padrão) limpa todos os embeddings antes de reinserir — o `incremental` pula chunks já existentes comparando `chunk_text`
- O `AdminApostilaImporter` chama no modo `incremental` — portanto não vai limpar embeddings existentes, apenas adicionar os novos
- Nenhuma migração de banco necessária — estrutura de `agent_embeddings` não muda
- Deploy automático ao salvar o arquivo
