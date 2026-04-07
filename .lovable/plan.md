

## Fix: L.I.A. prioriza artigos da base de conhecimento sobre vídeos soltos

### Problema

Quando o lead pergunta "quais vídeos de protocolo vocês têm?", o RAG segue este caminho:
1. Vector search — falha (similarity < 0.65)
2. FTS — falha ou fraco
3. **Keyword fallback on videos** (linha 460-493) — encontra vídeos como `Aula_Dr.FERNANDO.mp4` e `protocolo.mp4` que NÃO têm `content_id` → retorna `VIDEO_SEM_PAGINA`
4. Como o fallback retornou resultados, o fluxo para aqui — **nunca chega ao `searchContentDirect`** que encontraria o artigo "Protocolos Impressos em 24h na Odontologia Digital"

O artigo existe em `/base-conhecimento/d/protocolos-impressos-em-24h-na-odontologia-digital` mas a L.I.A. nunca o vê porque o keyword fallback retorna vídeos soltos antes.

### Solução

**Arquivo: `supabase/functions/_shared/lia-rag.ts`**

**1. No keyword fallback de vídeos (linhas 460-493), adicionar busca paralela de artigos**

Junto com a busca de vídeos por keyword, buscar também artigos em `knowledge_contents` com os mesmos keywords. Artigos com URL interna devem ter prioridade (similarity boost) sobre vídeos sem página.

```text
Lógica:
- Buscar knowledge_contents com ILIKE nos mesmos keywords (já existe searchByILIKE)
- Se encontrar artigos, incluí-los nos resultados com similarity >= 0.50
- Vídeos SEM content_id (sem página interna) recebem similarity cap de 0.40
- Resultado: artigos com página interna aparecem ANTES de vídeos soltos
```

**2. Penalizar vídeos sem página interna no keyword fallback**

Atualmente, vídeos sem `content_id` recebem similarity até 0.70 (linha 486). Reduzir o cap para 0.40 quando `!mapped` (sem página interna), garantindo que artigos e vídeos com página sempre apareçam primeiro.

```typescript
// Linha 486, dentro do cálculo de similarity:
const baseSimilarity = Math.min(0.30 + (matchCount / Math.max(keywords.length, 1)) * 0.35, 0.70);
// Penalizar vídeos sem página interna
return mapped ? baseSimilarity : Math.min(baseSimilarity, 0.40);
```

**3. Incluir artigos ILIKE no fallback de keywords**

Após buscar vídeos por keyword (linha 466), buscar artigos via `searchByILIKE` e mergear:

```typescript
// Após os vídeos, buscar artigos com os mesmos keywords
const articleResults = await searchByILIKE(supabase, query, siteBaseUrl);
if (articleResults.length > 0) {
  results.push(...articleResults.map(a => ({ ...a, similarity: Math.max(a.similarity, 0.50) })));
}
```

**Arquivo: `supabase/functions/dra-lia/index.ts`**

**4. Garantir que `searchContentDirect` roda mesmo quando knowledgeResult tem vídeos fracos**

Linha 3314: a condição `!hasMediaInResults` impede o `searchContentDirect` de rodar se já existem vídeos nos resultados — mesmo que sejam `VIDEO_SEM_PAGINA`. Ajustar para considerar apenas vídeos COM página interna como "media relevante":

```typescript
// Antes: qualquer vídeo conta como "media"
const hasMediaInResults = allResults.some(r => ["video", "article"].includes(r.source_type));

// Depois: só vídeos com página interna contam
const hasRelevantMedia = allResults.some(r => 
  r.source_type === "article" || 
  (r.source_type === "video" && r.metadata?.url_interna)
);
if (userRequestedContent && (!hasRelevantMedia || topSimilarity < 0.5)) {
```

### Escopo

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/_shared/lia-rag.ts` | Penalizar vídeos sem página (1 linha), adicionar artigos ILIKE no keyword fallback (~8 linhas) |
| `supabase/functions/dra-lia/index.ts` | Ajustar condição de `hasMediaInResults` para considerar apenas media com página interna (~3 linhas) |

### Resultado
- Artigo "Protocolos Impressos em 24h" aparece com prioridade sobre vídeos soltos
- Vídeos COM página interna continuam com prioridade normal
- Vídeos SEM página interna aparecem como complemento, não como resultado principal
- `searchContentDirect` roda como fallback mesmo quando só há vídeos soltos

