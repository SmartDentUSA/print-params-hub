
# Correção Pontual: Reindexar o Draft Auto-Heal Existente no RAG

## Diagnóstico confirmado pelos dados

O draft "FAQ Técnico SmartDent: Robô de Vendas e Odontologia Digital" (`f4b2dac7`) foi aprovado **antes** da implementação do novo paradigma. Ele tem:
- `status: approved` ✓
- `published_content_id: a5a6d438-511e-45b5-96aa-c9c048232ccd` → artigo que **não existe** em `knowledge_contents`
- **Zero chunks** com `origin: "auto-heal"` em `agent_embeddings`

Os dois testes confirmam: L.I.A. responde com fallback genérico porque o conteúdo do FAQ jamais chegou ao RAG.

## O que precisa ser feito

### Opção A — Botão "Re-indexar" na UI Admin (recomendado)

Adicionar na aba Auto-Heal, na linha de cada draft com `status: approved`, um botão **"Re-indexar na L.I.A."** que chama o mesmo endpoint `heal-knowledge-gaps?action=reindex` com o `draft_id`. Isso permite reindexar qualquer draft histórico sem precisar re-aprovar.

**Nova ação `reindex` em `supabase/functions/heal-knowledge-gaps/index.ts`:**
- Recebe `draft_id`
- Lê o draft existente (já tem `draft_faq`, `draft_title`, `draft_excerpt`, `draft_keywords`)
- Serializa as FAQs em `chunkText` (mesmo algoritmo do `approve`)
- Gera embedding e insere em `agent_embeddings` com `metadata.origin = "auto-heal"`
- **Não altera** o status do draft (já está `approved`)
- Retorna `{ success: true, indexed_to_rag: true }`

### Opção B — Re-aprovar pelo Admin (mais simples, porém destrutivo)

Resetar o status do draft para `pending`, voltar à aba Auto-Heal e clicar "Indexar na L.I.A." novamente. Funciona, mas perde o `reviewed_at` e `reviewed_by` originais.

---

## Implementação escolhida: Opção A

### Arquivo 1: `supabase/functions/heal-knowledge-gaps/index.ts`

Adicionar um novo bloco `else if (action === "reindex")` após o bloco `approve` (por volta da linha 415):

```typescript
} else if (action === "reindex") {
  const { draft_id } = body;
  if (!draft_id) return errorResponse("draft_id required", 400);

  // Buscar o draft
  const { data: draft, error: draftErr } = await adminSupabase
    .from("knowledge_gap_drafts")
    .select("*")
    .eq("id", draft_id)
    .single();
  if (draftErr || !draft) return errorResponse("Draft not found", 404);

  // Serializar FAQs
  const faqs = (draft.draft_faq || []) as { q: string; a: string }[];
  const keywords = (draft.draft_keywords || []) as string[];
  const faqText = faqs.map(f => `P: ${f.q} R: ${f.a}`).join(" | ");
  const chunkText = [draft.draft_title, draft.draft_excerpt, keywords.join(", "), faqText]
    .filter(Boolean)
    .join(" | ");

  // Gerar embedding e inserir no RAG
  const embedding = await generateEmbedding(chunkText, GOOGLE_AI_KEY);
  const { error: embError } = await adminSupabase
    .from("agent_embeddings")
    .insert({
      source_type: "article",
      chunk_text: chunkText,
      embedding,
      metadata: {
        title: draft.draft_title,
        excerpt: draft.draft_excerpt,
        keywords,
        origin: "auto-heal",
        is_internal: true,
        draft_id,
      },
      embedding_updated_at: new Date().toISOString(),
    });
  if (embError) throw embError;

  return new Response(
    JSON.stringify({ success: true, indexed_to_rag: true }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

### Arquivo 2: `src/components/AdminDraLIAStats.tsx`

**Adicionar handler `handleReindexDraft`** (próximo ao `handleApproveDraft`):
```typescript
const handleReindexDraft = async (draftId: string) => {
  try {
    const resp = await fetch(
      `${SUPABASE_URL}/functions/v1/heal-knowledge-gaps?action=reindex`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` },
        body: JSON.stringify({ draft_id: draftId }),
      }
    );
    if (!resp.ok) throw new Error(await resp.text());
    toast({ title: "✓ Re-indexado na L.I.A.", description: "O FAQ foi absorvido pela memória semântica." });
    fetchDrafts();
  } catch (e) {
    toast({ title: "Erro ao re-indexar", description: String(e), variant: "destructive" });
  }
};
```

**Na tabela de histórico** (seção que lista drafts aprovados), adicionar um botão **"Re-indexar"** ao lado de cada linha com `status === "approved"`:
```tsx
{draft.status === "approved" && (
  <Button
    size="sm"
    variant="outline"
    className="text-xs h-7 gap-1"
    onClick={() => handleReindexDraft(draft.id)}
  >
    <Brain className="w-3 h-3" />
    Re-indexar
  </Button>
)}
```

## Impacto

| Aspecto | Resultado |
|---|---|
| Draft histórico | Re-indexado sem alterar `reviewed_at` / `reviewed_by` |
| `agent_embeddings` | +1 chunk com `origin: "auto-heal"` e FAQ serializado |
| Status do draft | Permanece `approved` |
| Gaps relacionados | Permanecem `resolved` |
| L.I.A. após re-indexação | Responde "você está online?" e "como entrar em contato com comercial?" com base no FAQ real |

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/heal-knowledge-gaps/index.ts` | +ação `reindex` (novo bloco `else if`) |
| `src/components/AdminDraLIAStats.tsx` | +`handleReindexDraft` handler + botão "Re-indexar" na tabela de histórico |

Zero migrações SQL. O botão fica disponível para qualquer draft aprovado historicamente que precise ser re-injetado no RAG.
