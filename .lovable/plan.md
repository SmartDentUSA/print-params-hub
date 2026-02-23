

# Plano: Fazer a Dra. L.I.A. Encontrar e Compartilhar Videos do Playbook

## Problema Identificado

Tres causas raiz impediram a L.I.A. de mostrar os videos da Edge Mini:

1. **Embeddings nao indexados**: As 5 entradas do Brain Feeder (`playbook-edge-mini`) tem `indexed_at = null` e `chunks_count = 0`. A busca vetorial nao encontra nada.
2. **Videos do playbook nao foram inseridos**: O playbook tinha 13 videos (YouTube + Instagram), mas nenhum foi salvo no banco -- nem no `company_kb_texts`, nem na tabela `knowledge_videos`.
3. **Busca de video ignora contexto da conversa**: Quando o usuario pede "preciso ver videos dela funcionando", a busca de keyword na tabela `knowledge_videos` usa apenas as palavras da mensagem atual ("preciso", "videos", "funcionando"), sem considerar que "Edge Mini" foi mencionada antes no historico.

## Solucao em 3 Partes

### Parte 1: Adicionar Videos do Playbook ao Brain Feeder

Criar uma nova entrada `company_kb_texts` com categoria `videos` e `source_label = 'playbook-edge-mini'` contendo os links dos 13 videos do playbook em formato narrativo otimizado para RAG:

```
Edge Mini — Videos e Demonstracoes

Videos de demonstracao da Rayshape Edge Mini:
- Unboxing e primeiras impressoes: https://youtube.com/...
- Impressao de guias cirurgicas: https://youtube.com/...
- (etc. - todos os 13 videos do playbook)
```

Isso garante que, apos indexacao, a busca vetorial encontre "video edge mini" e retorne os links.

### Parte 2: Inserir Videos na Tabela `knowledge_videos`

Para cada video YouTube do playbook, inserir na tabela `knowledge_videos` com:
- `title`: titulo descritivo do video
- `url`: URL do YouTube
- `video_type`: 'youtube'
- `product_id`: ID da Edge Mini (`faa43292-9ceb-4441-afc5-4757e88fed3b`)
- `product_category`: 'IMPRESSAO 3D'

Isso permite que a busca de keyword na tabela `knowledge_videos` tambem encontre os videos.

### Parte 3: Corrigir Busca de Video para Usar Contexto da Conversa

Na edge function `dra-lia/index.ts`, alterar a busca de keyword de videos (linha ~1332) para incluir o historico recente da conversa, nao apenas a mensagem atual:

**Antes:**
```typescript
const keywords = query.split(" ").filter((w) => w.length > 3).slice(0, 4);
```

**Depois:**
```typescript
// Incluir historico recente para capturar nome do produto mencionado antes
const recentContext = history.slice(-6).map(h => h.content).join(' ');
const fullText = `${recentContext} ${query}`;
const keywords = fullText.split(/\s+/).filter(w => w.length > 3).slice(0, 6);
```

Isso resolve o problema de "preciso ver videos" quando "Edge Mini" foi mencionada em mensagens anteriores.

### Parte 4: Indexar Embeddings

Chamar a edge function `index-embeddings` para as entradas do Brain Feeder com `source_label = 'playbook-edge-mini'` (incluindo a nova entrada de videos), gerando os chunks vetoriais no `agent_embeddings`.

## Detalhes Tecnicos

### Migracao SQL
- INSERT de 1 novo registro em `company_kb_texts` (videos do playbook)
- INSERT de ~10 registros em `knowledge_videos` (videos YouTube do playbook -- Instagram embeds nao funcionam como links diretos)

### Alteracao na Edge Function
- `supabase/functions/dra-lia/index.ts`: Modificar a funcao `searchKnowledge` na secao de busca por keyword em videos (~linha 1332) para usar `history` como contexto adicional na extracao de keywords

### Indexacao
- Chamar `index-embeddings` para reindexar as 6 entradas do Brain Feeder (5 existentes + 1 nova de videos)

## Resultado Esperado

Apos a implementacao, quando o usuario pedir "quero ver videos da Edge Mini":
1. A busca vetorial encontrara a entrada "Edge Mini — Videos e Demonstracoes" no Brain Feeder
2. A busca de keyword encontrara os videos na tabela `knowledge_videos` pelo contexto da conversa
3. A L.I.A. respondera com links diretos para os videos do YouTube conforme as regras do system prompt

