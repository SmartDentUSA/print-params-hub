
# Implementação: approve → RAG Direto (sem knowledge_contents)

## Resumo da mudança

Dois arquivos, alterações cirúrgicas. Zero migrações SQL.

---

## Arquivo 1: `supabase/functions/heal-knowledge-gaps/index.ts`

### Ação `approve` — linhas 309–413 (reescrita completa do bloco)

**O que sai:**
- Linha 311: `category_id` do destructuring do body
- Linhas 336–356: geração de slug (loop de checagem de unicidade)
- Linhas 358–375: insert em `knowledge_contents`
- Linha 382: `published_content_id: newContent.id` no update do draft
- Linhas 392: referência ao `newContent.slug` na resolution note
- Linhas 396–407: chamada externa ao `index-embeddings`
- Linhas 409–412: retorno com `content_id` e `slug`

**O que entra (novo fluxo em ordem sequencial):**

1. Destructuring sem `category_id` — linha 311:
```typescript
const { draft_id, title, excerpt, faqs, keywords } = body;
```

2. Após verificar que o draft existe (linha 334), construir o `chunkText`:
```typescript
const finalTitle    = title    || draft.draft_title;
const finalExcerpt  = excerpt  || draft.draft_excerpt;
const finalFaqs     = (faqs    || draft.draft_faq    || []) as { q: string; a: string }[];
const finalKeywords = (keywords || draft.draft_keywords || []) as string[];

const faqText = finalFaqs
  .map(f => `P: ${f.q} R: ${f.a}`)
  .join(" | ");

const chunkText = [finalTitle, finalExcerpt, finalKeywords.join(", "), faqText]
  .filter(Boolean)
  .join(" | ");
```

3. Gerar embedding (reutiliza `generateEmbedding` já declarada no topo do arquivo):
```typescript
const embedding = await generateEmbedding(chunkText, GOOGLE_AI_KEY);
```

4. Inserir diretamente em `agent_embeddings`:
```typescript
const { error: embError } = await adminSupabase
  .from("agent_embeddings")
  .insert({
    source_type: "article",
    chunk_text: chunkText,
    embedding,
    metadata: {
      title: finalTitle,
      excerpt: finalExcerpt,
      keywords: finalKeywords,
      origin: "auto-heal",
      is_internal: true,
      draft_id,
    },
    embedding_updated_at: new Date().toISOString(),
  });
if (embError) throw embError;
```

5. Atualizar o draft (sem `published_content_id`):
```typescript
await adminSupabase
  .from("knowledge_gap_drafts")
  .update({
    status: "approved",
    reviewed_at: new Date().toISOString(),
    reviewed_by: user.email ?? user.id,
  })
  .eq("id", draft_id);
```

6. Marcar gaps como resolvidos:
```typescript
if (draft.gap_ids && draft.gap_ids.length > 0) {
  await adminSupabase
    .from("agent_knowledge_gaps")
    .update({ status: "resolved", resolution_note: "Auto-healed → RAG indexado diretamente" })
    .in("id", draft.gap_ids);
}
```

7. Retorno limpo:
```typescript
return new Response(
  JSON.stringify({ success: true, indexed_to_rag: true }),
  { headers: { ...corsHeaders, "Content-Type": "application/json" } }
);
```

---

## Arquivo 2: `src/components/AdminDraLIAStats.tsx`

### Mudança A — State + fetchCategories (linhas 190–191 e 361–368)

Remover o state `categories` e `selectedCategoryIds` (linha 190–191) pois não são mais necessários.
Remover o `fetchCategories` callback (linhas 361–368) e sua chamada em `useEffect` (linha 488).

### Mudança B — `handleApproveDraft` (linhas 429–445)

Remover `category_id` do body (linha 435).
Atualizar o toast de sucesso — trocar mensagem e remover referência a `result.slug`:
```typescript
toast({
  title: "✓ Conhecimento indexado na L.I.A.",
  description: "O FAQ foi absorvido pela memória semântica da Dra. L.I.A.",
});
```

### Mudança C — Título e descrição do card (linhas 1261–1268)

Linha 1261: trocar `"Gerador de Rascunhos por IA"` → `"Curadoria de Memória da L.I.A."`

Linha 1268: trocar texto descritivo para:
```
Analisa as <strong>{stats.pendingGapsCount}</strong> lacunas pendentes, agrupa semanticamente e gera rascunhos de FAQ para revisão e indexação direta na memória semântica da Dra. L.I.A.
```

### Mudança D — Contador de absorção (novo bloco após linha 1268)

Adicionar um novo state `autoHealCount` (número de embeddings com `origin = "auto-heal"`) e buscá-lo dentro de `fetchDrafts` em paralelo com a query de drafts:
```typescript
const { count } = await supabase
  .from("agent_embeddings" as never)
  .select("id", { count: "exact", head: true })
  .eq("metadata->>origin" as never, "auto-heal");
setAutoHealCount(count ?? 0);
```

Exibir no card antes do botão de gerar, quando `autoHealCount > 0`:
```tsx
<div className="flex items-center gap-2 p-2 rounded-lg bg-chart-2/5 border border-chart-2/20">
  <Brain className="w-4 h-4 text-chart-2 shrink-0" />
  <p className="text-xs text-chart-2 font-medium">
    A L.I.A. já absorveu <strong>{autoHealCount}</strong> tópico(s) técnico(s) via Auto-Heal
  </p>
</div>
```

### Mudança E — Remover Select de Categoria (linhas 1395–1413)

Remover completamente o bloco `<div className="space-y-1">` que contém o label "Categoria da Base de Conhecimento" e o `<Select>` (linhas 1395–1413).

### Mudança F — Botão "Aprovar e Publicar" (linha 1427)

Trocar texto `"Aprovar e Publicar"` → `"Indexar na L.I.A."`.

### Mudança G — Histórico: badge e link externo (linhas 1466–1485)

Linha 1474: trocar `'✓ Publicado'` → `'✓ Memória L.I.A.'`

Remover completamente o bloco do link externo (linhas 1476–1485) — o artigo público não existe mais.

---

## Tabela de impacto

| Aspecto | Resultado |
|---|---|
| `knowledge_contents` | Não tocado |
| `agent_embeddings` | +1 chunk por draft aprovado (com `origin: "auto-heal"`) |
| `knowledge_gap_drafts` | Status `approved`, `published_content_id` permanece `null` |
| `agent_knowledge_gaps` | `resolved` com note "RAG indexado diretamente" |
| Feed público do site | Zero artigos novos criados |
| Dra. L.I.A. (RAG) | Conhecimento disponível imediatamente após aprovação |
| Outros módulos | Zero impacto |

Zero migrações SQL. O campo `published_content_id` é nullable por padrão na tabela — simplesmente fica `null` para os aprovados pelo novo fluxo.
