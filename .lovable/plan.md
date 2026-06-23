## Escopo

Sistema B (`okeogjgqijbfkudfjadz`) — apenas edge functions, banco e RAG. Nada de frontend.

---

## TAREFA 1 — Atualizar `llms-txt` para v2.3

Arquivo: `supabase/functions/llms-txt/index.ts`

1. Substituir o conteúdo da constante `IDENTITY` (linhas 17–431) pelo texto v2.3 completo fornecido pelo usuário.
2. Remover o append dinâmico de `topSection` (a v2.3 já traz seção `## Pages` curada) — `body = IDENTITY` apenas. Mantém o fallback `catch` retornando `IDENTITY`.
3. Headers já estão corretos: `Content-Type: text/plain; charset=utf-8` + `Cache-Control: public, max-age=86400`.
4. Replicar a mesma `IDENTITY` em `supabase/functions/seo-llms-txt/index.ts` (esta é a função que o domínio `parametros.smartdent.com.br/llms.txt` consome via Vercel — já configurado em sessões anteriores).
5. Deploy de `llms-txt` e `seo-llms-txt`.

---

## TAREFA 2 — Artigo "Linha ATOS"

Duas inserções (ambas necessárias):

**A) `knowledge_contents`** — necessária para o Check 2 (URL `/base-conhecimento/c/linha-atos-...` precisa responder 200).

Migration insert:
- `slug`: `linha-atos-resinas-compostas-smart-dent-rony-peterson`
- `category_id`: `fc493982-ad8c-417f-9579-82786a97925a` (Ciência e tecnologia — letra C)
- `title`: `Linha ATOS: Resinas Compostas Smart Dent desenvolvidas por Doutor USP`
- `excerpt`, `meta_description`: resumo curto a partir do "Resumo Técnico para Citação"
- `content_html`: corpo do artigo convertido de Markdown → HTML (mantendo frontmatter como bloco de metadados no topo)
- `keywords`: array do frontmatter
- `created_by`: `Dr. Rony Peterson Alves Rodrigues`
- `active`: true

**B) `company_kb_texts`** — necessária para o Check 3 (`indexed_at` preenchido) e para o RAG da Dra. LIA / Copilot.

Os campos reais da tabela são apenas: `title, category, source_label, content, active, chunks_count, indexed_at`. Os outros campos do frontmatter (slug, autor, idioma, allow_indexing…) não existem nessa tabela — ficam apenas como metadados dentro de `content` e na linha de `knowledge_contents`.

Inserção via chamada à edge function `ingest-knowledge-text` (que já faz upsert + embeddings + atualiza `indexed_at` em uma única operação):
- `title`: `Linha ATOS: Resinas Compostas Smart Dent desenvolvidas por Doutor USP`
- `category`: `geral` (categorias válidas em company_kb_texts são `sdr|comercial|workflow|suporte|faq|objecoes|onboarding|geral|leads|clientes|campanhas|pos_venda` — `"c"` não é aceita; "geral" é o fit técnico)
- `source_label`: `linha-atos-resinas-compostas-smart-dent-rony-peterson`
- `content`: artigo completo em Markdown (frontmatter + corpo)

---

## TAREFA 3 — Reindexar RAG

A função `reindex-pending-kb` não existe neste projeto. O equivalente é o próprio `ingest-knowledge-text`, que já:
1. Gera embeddings (Google `embedding-001`) e insere em `agent_embeddings` com `source_type='company_kb'`.
2. Atualiza `chunks_count` e `indexed_at` em `company_kb_texts`.

Logo, a chamada da Tarefa 2-B cumpre Tarefa 3 sem passo extra.

---

## TAREFA 4 — Verificação

**Check 1** — `curl https://parametros.smartdent.com.br/llms.txt`
- status 200
- contém `v2.3`, `2026/SGMD.0084`, `K260152.pdf`, `81835969004`
- (se o Vercel ainda servir cache antigo, replicar purge como na sessão anterior)

**Check 2** — `curl -I https://parametros.smartdent.com.br/base-conhecimento/c/linha-atos-resinas-compostas-smart-dent-rony-peterson` → 200

**Check 3** — `SELECT title, indexed_at, chunks_count FROM company_kb_texts WHERE source_label = 'linha-atos-resinas-compostas-smart-dent-rony-peterson';` → `indexed_at NOT NULL`.

---

## O que NÃO será alterado

Frontend, `LeadDetailPanel`, `lead_activity_log`, contratos PipeRun/SellFlux, `smart-ops-lia-assign`, schema de tabelas existentes (apenas INSERTs), nenhuma outra edge function.

---

## Pontos de atenção / desvios do prompt

1. **`reindex-pending-kb` não existe** → uso `ingest-knowledge-text` que faz tudo (upsert + embed + indexed_at).
2. **`company_kb_texts` não tem coluna `slug/autor/status/idioma/allow_indexing`** → esses metadados ficam no corpo do artigo e na linha de `knowledge_contents`. `categoria='c'` vira `category='geral'` (única forma de passar pela validação da função).
3. **Artigo precisa de linha em `knowledge_contents`** para o Check 2 (URL) funcionar — o prompt só citou `company_kb_texts`, mas sem isso o Check 2 falha.

Confirmar antes de implementar?