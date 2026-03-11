

# Plano: Busca Visual Cross-Modal (Fase 3 — Multimodal RAG)

## Visão Geral

Implementar busca visual na Dra. LIA onde imagens enviadas pelo lead (via web ou WhatsApp) são embeddadas diretamente com `gemini-embedding-2-preview` e cruzadas no mesmo espaço vetorial com o acervo técnico (catálogo, vídeos, resinas, PDFs).

## Pré-requisitos (Fases 1 e 2)

Antes desta Fase 3, precisamos:

1. **Fase 1** — `_shared/generate-embedding.ts` centralizado (ainda não existe — 5 funções duplicam o código)
2. **Fase 2** — Re-indexar os ~2000+ chunks com `gemini-embedding-2-preview` (Matryoshka 768 dims) para unificar o espaço vetorial

Sem a Fase 2, os vetores de imagem não teriam correspondência com os vetores de texto atuais (modelo diferente = espaço diferente).

## Arquitetura da Fase 3

```text
Lead envia imagem (WhatsApp ou Web Chat)
  │
  ▼
GATEKEEPER: Classificar intenção da imagem
  ├─ "print de tela / meme / genérico" → ignorar, responder normalmente
  └─ "peça clínica / falha de impressão / projeto CAD" → prosseguir
  │
  ▼
EMBED: gemini-embedding-2-preview (Matryoshka 768)
  content: { parts: [{ inline_data: { mime_type, data: base64 } }] }
  │
  ▼
MATCH: match_agent_embeddings(query_embedding, 0.60, 8)
  ├─ Resultados tipo "catalog_product" → Recomendação de material
  ├─ Resultados tipo "video" → Tutorial específico (com timestamp se indexado)
  └─ Resultados tipo "resin" / "processing_protocol" → Instruções técnicas
  │
  ▼
INJECT no system prompt como contexto RAG visual
  │
  ▼
LLM gera resposta contextualizada (Gemini 2.5 Flash — já suporta imagens)
```

## Implementação — 5 Mudanças

### 1. `_shared/generate-embedding.ts` (Fase 1 — pré-requisito)

Centralizar toda lógica de embedding numa única shared function com suporte a texto e imagem:

```typescript
interface EmbedInput {
  text?: string;
  image?: { mimeType: string; base64Data: string };
}

async function generateEmbedding(input: EmbedInput): Promise<number[] | null> {
  const model = "gemini-embedding-2-preview"; // ou config env
  const parts = [];
  if (input.text) parts.push({ text: input.text });
  if (input.image) parts.push({ inline_data: { mime_type: input.image.mimeType, data: input.image.base64Data } });
  // ... call API com outputDimensionality: 768
}
```

### 2. Migration SQL — Coluna `vector_v2` (Shadow Indexing, Fase 2)

Adicionar coluna temporária para re-indexação sem downtime:

```sql
ALTER TABLE agent_embeddings ADD COLUMN IF NOT EXISTS vector_v2 vector(768);
ALTER TABLE agent_embeddings ADD COLUMN IF NOT EXISTS embedding_model text DEFAULT 'embedding-001';
CREATE INDEX idx_embeddings_v2 ON agent_embeddings USING hnsw (vector_v2 vector_cosine_ops);
```

Quando a re-indexação estiver completa, a query da LIA aponta para `vector_v2` e depois renomeia.

### 3. `dra-lia/index.ts` — Aceitar e processar imagens

**Request body** ganha campo opcional `image_data`:

```typescript
const { message, history, lang, session_id, topic_context, 
        image_data } = await req.json();
// image_data: { mime_type: "image/jpeg", base64: "..." } | null
```

**Gatekeeper** — Classificar a imagem antes de embeddar (evitar custos desnecessários):

```typescript
async function classifyImageIntent(base64: string, mimeType: string): Promise<"clinical" | "troubleshooting" | "generic"> {
  // Chamada rápida ao Gemini Flash com prompt curto:
  // "Classifique: é uma peça clínica/projeto CAD, uma falha de impressão 3D, ou genérica?"
  // Retorna enum simples — custo mínimo (~50 tokens)
}
```

Se `clinical` ou `troubleshooting`:
- Gerar embedding multimodal da imagem
- Buscar no `match_agent_embeddings`
- Injetar resultados no contexto RAG
- Enviar imagem inline ao LLM para resposta contextualizada

### 4. Frontend (`DraLIA.tsx`) — Upload de imagem no chat

- Adicionar botão de upload de imagem (câmera/arquivo) ao input do chat
- Converter a imagem para base64 (máx 4MB, resize se necessário)
- Enviar no body: `{ message, image_data: { mime_type, base64 } }`
- Exibir preview da imagem na mensagem do usuário

### 5. WhatsApp — Roteamento de mídia

O `smart-ops-wa-inbox-webhook` já recebe `media_url` e `media_type`. Quando `media_type === "image"`:
- Baixar a imagem da `media_url`
- Converter para base64
- Encaminhar para a Dra. LIA com `image_data`

## Gatekeeper — Controle de Custos

| Tipo de imagem | Ação | Custo estimado |
|---|---|---|
| Print de tela, meme, emoji | Ignorar | 0 |
| Peça clínica, projeto CAD | Embed + RAG | ~$0.003/query |
| Falha de impressão | Embed + RAG + vídeo match | ~$0.003/query |

O Gatekeeper usa Gemini Flash Lite (~$0.0001) para classificar antes de gastar no embedding multimodal.

## Indexação de Conteúdo Visual (Fase 2.5)

Para o cross-modal funcionar, o acervo precisa ter embeddings visuais:

- **Thumbnails de vídeo** (`knowledge_videos.panda_thumbnail_url`) — embeddadas junto com título/descrição
- **Imagens de produtos** (`system_a_catalog.image_url`) — embeddadas com nome/descrição
- **Capas de PDFs** — primeira página dos documentos técnicos

Isso é feito no re-indexador da Fase 2, adicionando `inline_data` ao conteúdo que já é indexado.

## Ordem de Execução Recomendada

1. **Fase 1**: Criar `_shared/generate-embedding.ts`, refatorar as 5 edge functions
2. **Fase 2**: Re-indexar com `embedding-2-preview` (Matryoshka 768) via shadow indexing
3. **Fase 2.5**: Indexar thumbnails e imagens de produtos como conteúdo multimodal
4. **Fase 3a**: Gatekeeper + embedding de imagem na LIA (backend)
5. **Fase 3b**: Upload de imagem no frontend (`DraLIA.tsx`)
6. **Fase 3c**: Roteamento de imagem do WhatsApp para a LIA

## Arquivos Modificados

| Arquivo | Fase | Mudança |
|---------|------|---------|
| `supabase/functions/_shared/generate-embedding.ts` | 1 | Nova shared function (texto + imagem) |
| 5 edge functions (dra-lia, index-*, heal-*, ingest-*) | 1 | Importar shared function |
| Migration SQL | 2 | `vector_v2`, `embedding_model`, índice HNSW |
| `supabase/functions/index-embeddings/index.ts` | 2.5 | Incluir thumbnails/imagens no embed |
| `supabase/functions/dra-lia/index.ts` | 3a | Gatekeeper + embed imagem + RAG visual |
| `src/components/DraLIA.tsx` | 3b | Upload de imagem no chat |
| `supabase/functions/smart-ops-wa-inbox-webhook/index.ts` | 3c | Roteamento de mídia para LIA |

Quer que eu comece pela **Fase 1** (centralizar `generate-embedding.ts` e refatorar as 5 edge functions)?

