
# Alimentador de Cérebro da L.I.A. — Implementação Completa

## Visão geral do que será feito

4 componentes implementados em sequência lógica:

```text
[1] Migration SQL → tabela company_kb_texts (persistência dos blocos)
[2] Edge function → ingest-knowledge-text (ingestão + split + embedding)
[3] index-embeddings → adicionar leitura de company_kb_texts (linha 654)
[4] AdminApostilaImporter → duas abas (Apostila JSON + Cérebro da L.I.A.)
```

---

## Componente 1 — Migration SQL: `company_kb_texts`

Nova tabela simples com RLS restrita a admins:

```sql
CREATE TABLE company_kb_texts (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title        text NOT NULL,
  category     text NOT NULL
    CHECK (category IN ('sdr','comercial','workflow','suporte','faq','objecoes','onboarding','geral')),
  source_label text,
  content      text NOT NULL,
  active       boolean DEFAULT true,
  chunks_count integer DEFAULT 0,
  indexed_at   timestamptz,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE company_kb_texts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage kb texts"
  ON company_kb_texts FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));
```

---

## Componente 2 — Nova edge function: `supabase/functions/ingest-knowledge-text/index.ts`

Endpoint POST dedicado que:
1. Recebe `{ entries: Array<{title, category, source_label, content}> }`
2. Salva cada entrada na tabela `company_kb_texts` (upsert por title+source_label)
3. Divide cada `content` em chunks de 900 chars com overlap de 150
4. Gera embedding Gemini (`gemini-embedding-001`, 768 dims) para cada chunk — igual ao padrão do `index-embeddings`
5. Deleta chunks antigos do mesmo kb_text_id antes de re-indexar (idempotência)
6. Salva em `agent_embeddings` como `source_type: "company_kb"`
7. Atualiza `chunks_count` e `indexed_at` na tabela `company_kb_texts`
8. Retorna `{ saved, chunks_created, indexed, errors }`

Função de split (mesma lógica usada para vídeos no `index-embeddings`, linhas 527-530):
```typescript
function splitIntoChunks(text: string, size = 900, overlap = 150): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size - overlap) {
    chunks.push(text.slice(i, i + size));
    if (i + size >= text.length) break;
  }
  return chunks;
}
```

Formato do `chunk_text` (padrão já usado pelo sistema):
```
[SDR] Perfil ICP — Comprador BLZ (parte 1/2) | 91,3% dos compradores são clínicos...
```

Adicionar no `supabase/config.toml`:
```toml
[functions.ingest-knowledge-text]
verify_jwt = true
```

---

## Componente 3 — Atualização do `index-embeddings` (linha 654)

No bloco do estágio `company_kb` (linha 652-657), após `fetchExternalKBChunks()`, adicionar leitura da nova tabela:

```typescript
// ── 5. EXTERNAL KB (company_kb) ──────────────────────────────
if (stage === "all" || stage === "company_kb") {
  const externalChunks = await fetchExternalKBChunks();
  console.log(`[external-kb] ${externalChunks.length} chunks from ai_training endpoint`);
  chunks.push(...externalChunks);

  // ── NOVO: Ler blocos de experiência humana da company_kb_texts ──
  const { data: kbTexts, error: kbError } = await supabase
    .from("company_kb_texts")
    .select("id, title, category, source_label, content")
    .eq("active", true);

  if (kbError) console.warn("[company-kb-texts] query error:", kbError.message);

  for (const kb of kbTexts || []) {
    const parts = splitIntoChunks(kb.content, 900, 150);
    parts.forEach((slice, i) => {
      chunks.push({
        source_type: "company_kb",
        chunk_text: `[${kb.category.toUpperCase()}] ${kb.title}${parts.length > 1 ? ` (parte ${i+1}/${parts.length})` : ""} | ${slice}`,
        metadata: {
          title: kb.title,
          category: kb.category,
          source_label: kb.source_label,
          kb_text_id: kb.id,
          chunk_part: i + 1,
          total_parts: parts.length,
        },
      });
    });
  }
  console.log(`[company-kb-texts] ${(kbTexts || []).length} blocos de experiência humana processados`);
} // end if company_kb
```

A função `splitIntoChunks` também será declarada no topo do arquivo `index-embeddings` (antes do `serve`), substituindo a lógica inline de split que já existe na seção de vídeos (linhas 527-530).

---

## Componente 4 — Transformação do `AdminApostilaImporter.tsx`

O componente ganha visualmente o título **"Alimentador de Cérebro da L.I.A."** e passa de layout único para duas abas usando o componente `Tabs` existente no projeto (`src/components/ui/tabs.tsx`).

### Aba 1 — "Apostila JSON"
O conteúdo existente completo (upload JSON + 3 passos: importar, enriquecer, indexar) é movido para dentro do `TabsContent` desta aba — **zero alteração no comportamento**.

### Aba 2 — "Cérebro da L.I.A."
Nova aba com 3 seções:

**Seção A — Inserção de Bloco Único**
- Campo `Título` (Input)
- Select `Categoria`: SDR / Comercial / Workflow / Suporte / FAQ / Objeções / Onboarding / Geral
- Campo `Fonte` (Input, ex: "PDF Chair Side Print 4.0")
- Textarea para o conteúdo (até 5.000 chars, sem limite artificial — o split é automático)
- Botão `+ Adicionar à fila`
- Lista da fila: cada item mostra título, categoria, tamanho do conteúdo, botão remover
- Botão `Indexar na L.I.A.` → chama `ingest-knowledge-text`, mostra progresso e resultado por item com badges de chunks gerados

**Seção B — Importação via JSON em Lote**
- Upload de arquivo `.json` com o array no formato padrão `[{title, category, source_label, content}]`
- Preview após parse: "N blocos detectados" com breakdown por categoria
- Botão `Indexar todos` → envia para `ingest-knowledge-text`, mostra progresso

**Seção C — Diagnóstico do Cérebro**
Painel que consulta `agent_embeddings` para mostrar o status real do `company_kb`:
- Consulta: `SELECT metadata->>'category', COUNT(*) FROM agent_embeddings WHERE source_type = 'company_kb' GROUP BY category`
- Barra de progresso visual em direção à meta de 200 chunks
- Lista de chunks por categoria com badges
- Data da última indexação
- Botão `Atualizar diagnóstico`

**Guia de formato** (Accordion colapsável no topo da aba):
```json
[
  {
    "title": "Ex: Comparativo de tempo — Placas Miorrelaxantes",
    "category": "workflow",
    "source_label": "Comparativo Fluxos Chair Side Print v1",
    "content": "Texto corrido em linguagem natural..."
  }
]
```
Com um exemplo por categoria (sdr, comercial, workflow, objecoes).

---

## Arquivos criados/modificados

| Arquivo | Ação | Risco |
|---|---|---|
| `supabase/migrations/XXXXXX_company_kb_texts.sql` | Criar tabela + RLS | Zero — nova tabela |
| `supabase/functions/ingest-knowledge-text/index.ts` | Criar nova function | Zero — nova function |
| `supabase/config.toml` | Adicionar `[functions.ingest-knowledge-text]` | Zero — nova entrada |
| `supabase/functions/index-embeddings/index.ts` | Adicionar ~20 linhas no bloco company_kb (linha 654) + declarar splitIntoChunks no topo | Baixo — adição somente, nada removido |
| `src/components/AdminApostilaImporter.tsx` | Envolver conteúdo existente em Tabs + adicionar segunda aba | Baixo — conteúdo existente inalterado |

**Zero alteração na `dra-lia`.** Os chunks novos entram como `source_type: "company_kb"` e automaticamente recebem o peso 2.0x na rota comercial sem nenhuma mudança no pipeline RAG.
