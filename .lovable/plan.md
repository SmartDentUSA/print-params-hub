
## Diagnóstico Completo: Links Errados de Produtos e Vídeos

### Problema 1 — Links de produtos da loja (resinas)

**Causa raiz:** No `index-embeddings/index.ts`, linha 213, as resinas são indexadas com:
```typescript
url_publica: r.slug ? `/resinas/${r.slug}` : null,
```

Mas no `dra-lia/index.ts`, o system prompt (linha 1244) instrui a IA:
```
Ao encontrar RESINA com link de compra: inclua um link [Ver produto](URL).
```

O campo enviado para o contexto é `cta_1_url` (linha 1213):
```typescript
if (meta.cta_1_url) part += ` | COMPRA: ${meta.cta_1_url}`;
```

O `cta_1_url` é a URL direta da loja (ex: `https://loja.smartdent.com.br/produto/xyz`). Porém, **quando os embeddings chegam via busca vetorial** (`match_agent_embeddings`), o campo `title` no metadata não tem `cta_1_url` explicitado como campo separado — ele chega no objeto `metadata` mas o campo `title` para resinas está sendo gerado como `name` (sem prefixo `title`), causando inconsistência na exibição.

**O problema real é diferente dependendo do caminho:**

- **Caminho via `searchProcessingInstructions`** (perguntas de protocolo): O `cta_1_url` **funciona corretamente** — é buscado direto do banco (linha 650) e enviado como `meta.cta_1_url` no contexto (linha 1213).
- **Caminho via busca vetorial** (RAG): O metadata indexado (linha 208-215) inclui `cta_1_url`, mas o campo `title` está como `name` em vez de `title`, então a IA pode não encontrar o link da forma esperada.

Mas o **maior problema** é o `url_publica` das resinas no RAG:
```
/resinas/{slug}   ← URL inexistente no app
```

A rota correta no app é `/resina/{slug}` (sem "s"). Verificando o App.tsx:

### Verificação das rotas

Preciso confirmar as rotas corretas do app para resinas, vídeos e parâmetros.

---

### Problema 2 — Links de vídeos

**Causa raiz no indexador (`index-embeddings/index.ts`, linhas 143-184):**

Os vídeos são indexados **sem `url_interna`** no metadata. Apenas `embed_url` (URL do PandaVideo) e `thumbnail_url` são salvos. O campo `url_interna` que aponta para `/base-conhecimento/{letra}/{slug}` **só é calculado em runtime** (no fallback de busca por palavras-chave, linhas 856-903) — mas **não é salvo no embedding**.

Portanto, quando um vídeo é encontrado via **busca vetorial** (o caminho principal com RAG funcionando), o metadata retornado tem:
- `embed_url`: URL do PandaVideo (que a IA é proibida de usar como link)
- `thumbnail_url`: OK
- `url_interna`: **ausente** → a IA cai no caso `VIDEO_SEM_PAGINA` e menciona apenas o título sem link

O system prompt (linha 1241) é claro:
```
Se tiver VIDEO_INTERNO, gere um link [▶ Assistir no site](VIDEO_INTERNO_URL)
Se tiver VIDEO_SEM_PAGINA, mencione apenas o título sem gerar link
```

Logo, **a IA está seguindo as regras corretamente, mas os dados estão incompletos** na indexação.

---

### As 3 correções necessárias

**Correção 1 — `index-embeddings/index.ts`: Adicionar `url_interna` nos embeddings de vídeo**

Para cada vídeo que tem `content_id`, buscar o slug e a letra da categoria da tabela `knowledge_contents` e salvar a `url_interna` no metadata do embedding. Isso requer uma query adicional antes de montar os chunks.

**Correção 2 — `index-embeddings/index.ts`: Corrigir `url_publica` das resinas**

Linha 213:
```typescript
// ANTES (rota inexistente)
url_publica: r.slug ? `/resinas/${r.slug}` : null,

// DEPOIS (rota correta)
url_publica: r.slug ? `/resina/${r.slug}` : null,
```

**Correção 3 — `index-embeddings/index.ts`: Corrigir `title` das resinas**

O metadata das resinas usa `name` em vez de `title`, o que cria inconsistência com os outros tipos de chunk (artigos e vídeos usam `title`). O sistema prompt e o contexto esperam `title`:

```typescript
// ANTES
metadata: {
  name: r.name,          ← inconsistente
  manufacturer: r.manufacturer,
  ...
}

// DEPOIS
metadata: {
  title: `${r.manufacturer} ${r.name}`,  ← consistente com artigos/vídeos
  name: r.name,           ← mantido para retrocompatibilidade
  manufacturer: r.manufacturer,
  ...
}
```

---

### Alterações técnicas detalhadas

**Arquivo: `supabase/functions/index-embeddings/index.ts`**

**Mudança A (linhas 125-185):** Antes do loop de vídeos, fazer uma query para buscar os slugs + letras de categoria de todos os `content_id`s dos vídeos, e montar um `contentMap`. Então usar esse map para adicionar `url_interna` no metadata de cada chunk de vídeo.

```typescript
// Query adicional antes do loop de vídeos
const videoContentIds = (videos || []).filter(v => v.content_id).map(v => v.content_id);
let videoContentMap: Record<string, { slug: string; category_letter: string }> = {};

if (videoContentIds.length > 0) {
  const { data: contents } = await supabase
    .from("knowledge_contents")
    .select("id, slug, category_id, knowledge_categories:knowledge_categories(letter)")
    .in("id", videoContentIds);
  
  if (contents) {
    for (const c of contents) {
      const letter = c.knowledge_categories?.letter?.toLowerCase() || "";
      if (letter) {
        videoContentMap[c.id] = { slug: c.slug, category_letter: letter };
      }
    }
  }
}
```

Então em cada chunk de vídeo, adicionar:
```typescript
metadata: {
  title: v.title,
  embed_url: v.embed_url,
  thumbnail_url: v.thumbnail_url,
  pandavideo_id: v.pandavideo_id,
  video_id: v.id,
  url_interna: v.content_id && videoContentMap[v.content_id]
    ? `/base-conhecimento/${videoContentMap[v.content_id].category_letter}/${videoContentMap[v.content_id].slug}`
    : null,
}
```

**Mudança B (linha 213):** Corrigir `/resinas/` → `/resina/`

**Mudança C (linhas 208-215):** Adicionar campo `title` nas resinas

---

### Impacto após as correções + re-indexação

| Problema | Antes | Depois |
|---|---|---|
| Links de vídeos | Aparece apenas título, sem link | Link `[▶ Assistir no site](/base-conhecimento/A/slug)` |
| Links de produtos (resinas) | URL `/resinas/slug` (404) | URL `/resina/slug` (correta) |
| Consistência de título | Resinas sem campo `title` | Todas as fontes com `title` padronizado |

### Sequência após o deploy

1. Deploy automático de `index-embeddings`
2. Re-indexação completa (mode=full) — obrigatória para aplicar as correções de metadata
3. Testar a Dra. L.I.A. pedindo um vídeo e um produto para confirmar os links corretos

### Resumo das alterações

| Arquivo | Local | Mudança |
|---|---|---|
| `index-embeddings/index.ts` | Antes do loop de vídeos | Query para buscar `content_id → slug + category_letter` |
| `index-embeddings/index.ts` | Metadata de cada chunk de vídeo | Adicionar campo `url_interna` |
| `index-embeddings/index.ts` | Linha 213 | `/resinas/` → `/resina/` |
| `index-embeddings/index.ts` | Linhas 208-214 | Adicionar campo `title` nas resinas |

Nenhuma migração de banco. Nenhuma alteração no `dra-lia/index.ts` — as regras do system prompt já estão corretas e funcionarão assim que o metadata dos embeddings for corrigido. Re-indexação completa necessária após o deploy.
