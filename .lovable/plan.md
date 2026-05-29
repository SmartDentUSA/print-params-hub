
# Copilot como Bibliotecário + Autor da Smart Dent

Dois fluxos no mesmo Copilot, alimentando a **mesma RAG** (`smartdent_method_docs`):

```text
[VOCÊ anexa PDF/DOCX/MD/TXT]
        ↓
   ingest_method_doc  ──► extrai → chunk → embed (gemini-embedding-001, 768d)
        ↓                                          ↓
   smartdent_method_docs (pgvector HNSW) ◄────────┘
        ↑                          ↑
        │                          │
   match_method_docs        match_method_docs
        │                          │
   [Briefing estratégico]   [draft_knowledge_article]
                                   ↓
                            knowledge_contents (status=draft)
                                   ↓
                            publish_knowledge_article
                                   ↓
                            /base-conhecimento/{letra}/{slug}
```

---

## Frente A — Ingestão (Copilot aprende)

### A1. Tabela `smartdent_method_docs`

| coluna | tipo | nota |
|---|---|---|
| `id` | uuid PK | |
| `source_doc_id` | uuid | agrupa chunks do mesmo arquivo |
| `chunk_index` | int | ordem |
| `title` | text | nome do documento original |
| `slug` | text | normalizado |
| `doc_type` | text | `icp_positive` / `icp_negative` / `workflow_stage` / `product_positioning` / `competitor_play` / `methodology` / `script` / `outro` |
| `target_audience` | text[] | `protodontista`, `radiologista`, `clínica`, etc. (LLM classifica) |
| `target_products` | text[] | `rayshape-edge-mini`, `phrozen-sonic-mini-8k`, etc. |
| `body_md` | text | chunk de 1000 chars / overlap 150 |
| `embedding` | vector(768) | `gemini-embedding-001`, reaproveita `_shared/generate-embedding.ts` |
| `tokens` | int | |
| `active` | bool default true | |
| `uploaded_by` | uuid | quem mandou via Copilot |
| `created_at` / `updated_at` | timestamptz | |

- Índice HNSW cosine em `embedding`.
- Índice GIN em `target_audience` e `target_products`.
- RLS: `SELECT` autenticado, mutações só `service_role` (Copilot via edge function).
- GRANTs explícitos (anon **não** lê).

### A2. RPC `match_method_docs(query_embedding, audience?, product?, doc_type?, match_count default 8)`

Retorna `id, title, body_md, doc_type, target_audience, target_products, similarity`. Filtro opcional por audience/product/doc_type, threshold ≥ 0.55.

### A3. Tool Copilot `ingest_method_doc`

Input: `{ source_url | text_inline, title?, doc_type?, target_audience?, target_products?, replace_existing? }`

Fluxo:
1. Baixa (Supabase Storage / URL externa) ou usa texto inline.
2. Extrai: PDF (`pdf-parse` via npm), DOCX (`mammoth`), MD/TXT direto.
3. Normaliza → chunks 1000c / overlap 150.
4. LLM (Gemini 3 Flash) classifica `doc_type`, `target_audience`, `target_products` se não vierem.
5. Batch embed cada chunk via `generate-embedding.ts` (já tem cache SHA256).
6. Upsert na tabela; se `replace_existing` → soft-delete chunks antigos do mesmo `source_doc_id`.
7. Devolve: `{ source_doc_id, chunks: N, doc_type, audience, products, preview }`.

### A4. Tools de gerência

- `list_method_docs(filters?)`
- `search_method_docs(query, filters?)` — debug humano via Copilot
- `delete_method_doc(source_doc_id)`
- `update_method_doc_metadata(source_doc_id, { doc_type?, audience?, products?, active? })`

### A5. Bucket de storage

`smartdent-method-docs` (privado). RLS: upload só `service_role`, download via signed URL.

---

## Frente B — Autoria (Copilot publica usando o que aprendeu)

### B1. Schema delta em `knowledge_contents`

Adiciona (não-quebra):
- `created_by text default 'human'` — valores `human` / `copilot`
- `source_method_docs uuid[]` — IDs dos chunks RAG usados (auditoria)
- `draft_metadata jsonb` — briefing, prompt, modelo, tokens

### B2. Tools Copilot

| tool | função |
|---|---|
| `draft_knowledge_article` | Gera rascunho usando `match_method_docs` + catálogo de produtos + `knowledge_contents` existentes (FTS p/ não canibalizar). Modelo: `google/gemini-3.1-pro-preview`, max 4500 tokens. Retorna preview no chat (título, meta, primeiros 400c, FAQs). **Não publica.** Salva como `status='draft'`, `active=false`, `created_by='copilot'`. |
| `revise_draft` | Recebe `draft_id` + instrução ("encurta intro", "troca título por X") → reescreve preservando slug. |
| `publish_knowledge_article` | `active=true`, dispara pipeline OG banner existente, reindexa FTS, sync System A↔B (`system-a-b-resilient-assets`). Retorna URL canônica. |
| `list_my_drafts` | Lista drafts pendentes do Copilot. |
| `unpublish_knowledge_article` | `active=false` (não deleta). |

### B3. Validators (guardrails)

`_shared/article-validators.ts`:
- **No-price guard** (regex `R\$|\$\s?\d|preço|valor|custa`) — bloqueia publicação.
- **No-spec-invention**: cada spec numérica/técnica do body deve ter substring match em pelo menos 1 chunk de `source_method_docs` OU no catálogo de produtos.
- **Canonical links**: link interno deve casar `/base-conhecimento/{a-f}/{slug}` (`knowledge-base-url-integrity`).
- **Slug único**: reaproveita `useSlugGeneration` / `cleanSlugSanitization`.
- **Categoria válida**: A-F (taxonomia existente).

### B4. System prompt do Copilot — delta

Adiciona regras:
- Antes de gerar artigo: **obrigatório** chamar `match_method_docs` + `search_knowledge_content` (já existe).
- Proibido: inventar specs, citar preços, prometer prazo, copiar concorrente.
- Sempre devolver preview → aguardar "publica" → só então `publish_knowledge_article`.
- Tom: técnico-consultivo, primeira pessoa Smart Dent, CTA WhatsApp ao fim.
- Estrutura: H1 → dor/contexto → solução → diferenciais → workflow 7×3 (quando aplicável) → FAQ → CTA.

---

## Arquivos

**Novos:**
- Migração: tabela `smartdent_method_docs` + RPC `match_method_docs` + GRANTs + RLS + bucket + extensão de `knowledge_contents`.
- `supabase/functions/copilot-ingest-method-doc/index.ts`
- `supabase/functions/copilot-draft-knowledge-article/index.ts`
- `supabase/functions/copilot-publish-knowledge-article/index.ts`
- `supabase/functions/_shared/method-docs-rag.ts` (chunking, embed, match)
- `supabase/functions/_shared/article-validators.ts` (price/spec/link/slug)
- `supabase/functions/_shared/knowledge-article-generator.ts` (pipeline RAG → LLM → validate)

**Editados:**
- Orquestrador do Copilot (registra 9 novas tools: 5 ingestão + 4 publicação)
- System prompt do Copilot
- Memórias: `mem://smart-ops/copilot-rag-access-v1` (incluir `match_method_docs`), `mem://architecture/content-generation-policy-no-prices-v2` (Copilot como autor)

**Não muda:** Knowledge Base UI, slugs canônicos, pipeline OG banner, System A↔B sync, taxonomia A-F, Frente A independente da B, `lia-assign`, Smart Merge, `copilot_brain`.

---

## Fluxo final

```text
você → anexa "Manual_Rayshape_v3.pdf"
Copilot → ingest_method_doc → "✅ 14 chunks indexados (product_positioning, rayshape-edge-mini, protodontista)"

você → "escreve artigo Rayshape Edge Mini para protodontistas"
Copilot → match_method_docs + search_knowledge_content + draft_knowledge_article
       → "📝 Rascunho: 'Rayshape Edge Mini: autonomia total para protodontistas'
          1.240 palavras · categoria D · 4 FAQs · fontes: 8 chunks
          [preview...]
          Publicar?"

você → "troca o título por 'Protodontia digital sem laboratório'"
Copilot → revise_draft → novo preview

você → "publica"
Copilot → publish_knowledge_article →
       "🚀 /base-conhecimento/p/protodontia-digital-sem-laboratorio"
```

---

## Perguntas antes de implementar

1. **Limite de upload**: 20 MB / 50 páginas por doc (acima disso, paginar)?
2. **Aprovação humana sempre obrigatória** antes de publicar, ou aceita flag `auto_publish=true` em temas específicos?
3. **Rascunhos visíveis no site público** (com badge "rascunho") ou totalmente ocultos até `publish`?
