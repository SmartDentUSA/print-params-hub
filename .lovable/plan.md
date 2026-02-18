
# Dra. L.I.A. — Links de Vídeo Internos (Landing Pages do Site)

## Diagnóstico do Problema

### O que acontece hoje
A Regra 2 do system prompt instrui o Gemini a gerar links diretos para o player do PandaVideo:

```
2. Ao encontrar um VÍDEO com VIDEO_EMBED: forneça o título e um link Markdown [▶ Assistir](VIDEO_EMBED_URL)
```

E no builder de contexto (linha 407), o `embed_url` é passado como `VIDEO_EMBED`:
```typescript
if (meta.embed_url) part += ` | VIDEO_EMBED: ${meta.embed_url}`;
```

O resultado: o Gemini gera links como:
`[▶ Assistir](https://player-vz-004839ee-19a.tv.pandavideo.com.br/embed/?v=xxx)`

Esse link não funciona pois o PandaVideo bloqueia iframes em domínios externos — e mesmo que funcionasse, tiraria o usuário do site.

### A solução correta
Cada vídeo associado a um artigo (`content_id IS NOT NULL`) tem uma **landing page interna** no formato:
```
/base-conhecimento/{category_letter}/{content_slug}
```

A query já traz `content_id` para os vídeos. Basta buscar o `category_letter` e `slug` do artigo associado para montar a URL interna.

---

## O que será mudado

Apenas **1 arquivo**: `supabase/functions/dra-lia/index.ts`

### Mudança 1 — Busca de vídeos inclui category_letter e slug do artigo

No `searchKnowledge`, a busca por keyword de vídeos (linhas 226–254) precisa trazer `content_id` e, em seguida, buscar o `slug` e `category_letter` do artigo associado:

**Antes:**
```typescript
const { data: videos } = await supabase
  .from("knowledge_videos")
  .select("id, title, description, embed_url, thumbnail_url, content_id")
  ...

// metadata gerado:
metadata: {
  title: v.title,
  embed_url: v.embed_url,
  thumbnail_url: v.thumbnail_url,
  video_id: v.id,
}
```

**Depois:**
```typescript
const { data: videos } = await supabase
  .from("knowledge_videos")
  .select("id, title, description, embed_url, thumbnail_url, content_id, pandavideo_id")
  ...

// Para vídeos com content_id, busca o slug e category_letter do artigo
const contentIds = videos.filter(v => v.content_id).map(v => v.content_id);
let contentMap: Record<string, { slug: string; category_letter: string }> = {};

if (contentIds.length > 0) {
  const { data: contents } = await supabase
    .from("knowledge_contents")
    .select("id, slug, knowledge_categories(letter)")
    .in("id", contentIds);

  contentMap = Object.fromEntries(
    (contents || []).map(c => [c.id, {
      slug: c.slug,
      category_letter: c.knowledge_categories?.letter?.toLowerCase() || '',
    }])
  );
}

// metadata gerado:
const contentInfo = v.content_id ? contentMap[v.content_id] : null;
const internalUrl = contentInfo
  ? `/base-conhecimento/${contentInfo.category_letter}/${contentInfo.slug}`
  : null;

metadata: {
  title: v.title,
  embed_url: v.embed_url,         // mantido para contexto interno
  thumbnail_url: v.thumbnail_url,
  video_id: v.id,
  url_interna: internalUrl,       // nova: URL da landing page no site
  has_internal_page: !!internalUrl,
}
```

### Mudança 2 — Context builder passa URL interna em vez de embed_url

**Antes (linha 407):**
```typescript
if (meta.embed_url) part += ` | VIDEO_EMBED: ${meta.embed_url}`;
```

**Depois:**
```typescript
if (meta.url_interna) {
  part += ` | VIDEO_INTERNO: ${meta.url_interna}`;
} else if (meta.embed_url) {
  // vídeo sem artigo associado — só menciona o título, sem link
  part += ` | VIDEO_SEM_PAGINA: sem página interna disponível`;
}
```

### Mudança 3 — Regra 2 do system prompt atualizada

**Antes:**
```
2. Ao encontrar um VÍDEO com VIDEO_EMBED: forneça o título e um link Markdown [▶ Assistir](VIDEO_EMBED_URL)
```

**Depois:**
```
2. Ao encontrar um VÍDEO:
   - Se tiver VIDEO_INTERNO: gere um link Markdown [▶ Assistir no site](VIDEO_INTERNO_URL) 
     apontando para a página interna do site. NUNCA use o embed_url do PandaVideo como link.
   - Se tiver VIDEO_SEM_PAGINA: mencione apenas o título do vídeo ("Encontrei o vídeo: [título]")
     sem gerar nenhum link clicável.
   Motivo: os vídeos só funcionam dentro do site — links externos são bloqueados pelo player.
```

### Também: mesma lógica para vídeos retornados pelo RAG (embeddings)

O `searchKnowledge` por vector/fulltext retorna chunks da tabela `agent_embeddings` que já têm `url_publica` no metadata (para artigos). Para vídeos retornados por esse caminho, o metadata pode ter `embed_url`. Adicionar também verificação: se `source_type === "video"` e tiver `url_publica`, usar essa URL interna.

---

## Comportamento Esperado Após a Mudança

| Situação | Antes | Depois |
|---|---|---|
| Vídeo com artigo associado (content_id) | `[▶ Assistir](player.pandavideo.com/...)` — link bloqueado | `[▶ Assistir no site](/base-conhecimento/c/nanoclean-pod-limpeza...)` — funciona |
| Vídeo sem artigo associado | Link pandavideo quebrado | Apenas menciona o título sem link |
| Pergunta sobre limpeza | Link externo ao pandavideo | Link interno para o artigo da categoria C |

---

## Seção Técnica

A query de `knowledge_contents` com join em `knowledge_categories` é leve — só é executada quando há resultados de vídeo com `content_id`. O `contentMap` é montado em memória apenas dentro do escopo da busca.

Vídeos sem `content_id` são tratados de forma degradada: a Dra. L.I.A. menciona o título mas não gera link — evitando links quebrados. No futuro, associar esses vídeos a artigos os tornará linkáveis automaticamente.

Nenhuma mudança no banco de dados ou nas rotas do React é necessária — as landing pages já existem.
