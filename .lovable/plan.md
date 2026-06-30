## 1) Tech sheet aparece em PT mesmo em `/en`

**Causa raiz** (`src/components/knowledge/KbTabCatalogo.tsx`, função `rawSpecs` linhas 697-745):

Quando o produto tem `manually_edited_at` (caso do Bio Vitality e dos 42 itens enriquecidos via planilha) e ainda **não** existe `technical_specs_en/_es` populado, o branch `if (manuallyEdited)` retorna direto o `live` em PT — nunca cai no fluxo de fallback nem dispara a tradução. Resultado: em `/en?tab=catalogo` a Tabela técnica fica em português indefinidamente, porque nada agenda a tradução on-demand.

`translate-card-row` já sabe ler `extra_data.system_a_live.technical_specs` como fonte, mas ele só é chamado quando o admin edita a descrição PT (via `useCatalogCRUD`). Não há gatilho quando o usuário simplesmente acessa a página em outro idioma.

**Correção (frontend apenas):**

- Em `KbTabCatalogo.tsx`, após resolver `rawSpecs` para cada card, detectar:
  - `specLang !== 'pt'` **E** `liveTr` ausente **E** existe `live` (ou `d?.technical_specifications`) em PT.
- Para cada produto nessa condição, enfileirar (dedupe por id+lang em um `Set` no componente) uma chamada fire-and-forget a `translate-card-row` com `{ table: 'system_a_catalog', id, target_lang: specLang }` (e, se for `products_catalog` doc, mesma chamada para essa tabela).
- Após o `await Promise.allSettled(...)`, invalidar a query (`refetch` do `useQuery` do catálogo) — assim, no carregamento subsequente, `technical_specs_en/_es` já existe e o card mostra traduzido. Enquanto a tradução roda, o card continua exibindo PT (degradação aceitável, sem flicker).
- Throttle: máximo 4 traduções em paralelo; persistir os IDs já solicitados em `sessionStorage` (`tech-spec-tr:{lang}:{id}`) para não re-disparar na mesma sessão.

**Backend:** confirmar que `translate-card-row` faz upsert de `technical_specs_en/_es` em ambas `system_a_catalog` e `products_catalog` quando recebe `table`. Se hoje só cobre uma, estender para suportar o parâmetro (sem mudar contrato existente).

Nenhuma alteração em RLS, schema, ou nos dados manualmente editados.

## 2) "Reformatar HTML de Artigos com IA" — aplicar automaticamente na geração

**Como funciona hoje** (`supabase/functions/reformat-article-html/index.ts`):
- Recebe `{ contentId, previewOnly? }`.
- Lê `content_html` / `content_html_en` / `content_html_es` de `knowledge_contents`.
- Para cada idioma presente, chama Lovable AI Gateway com prompt anti-alucinação que: detecta tabelas em texto corrido → `<table>`, normaliza hierarquia de headings, converte URLs soltas em `<a>`, aplica classes Tailwind padrão. Preserva 100% do texto/links originais.
- Persiste de volta nos campos `content_html*` (ou retorna preview se `previewOnly=true`).
- Hoje é disparado **manualmente** no Painel Administrativo (`AdminViewSupabase.tsx` / `AdminViewSecure.tsx`, ~linha 146/288).

**Aplicar automaticamente quando o conteúdo é gerado/publicado:**

Disparar `reformat-article-html` como pós-processamento **uma única vez por artigo**, no momento certo, sem bloquear o fluxo do autor.

- Ponto de injeção: `supabase/functions/copilot-publish-knowledge-article/index.ts`, logo após `update({ active: true })` ser bem-sucedido (linhas 60-64). Antes de retornar `success`, fazer um `fetch` fire-and-forget para `reformat-article-html` com `{ contentId: draft_id }` usando `SERVICE_ROLE_KEY` no header.
- Razões para ser no `publish` e não no `draft`:
  - Evita reformatar rascunhos que o autor ainda está iterando (custo de tokens repetido).
  - Garante que a versão final/canônica é a reformatada.
  - O HTML reformatado fica salvo, então leituras subsequentes não pagam custo de IA.
- Idempotência: adicionar coluna `content_html_reformatted_at timestamptz` em `knowledge_contents` via migração. A função `reformat-article-html` passa a:
  - Checar `content_html_reformatted_at` no início; se preenchido e `force !== true`, retornar `{ skipped: true }`.
  - Após sucesso, setar `content_html_reformatted_at = now()`.
  - O botão manual do Painel Admin envia `force: true` para permitir re-reformatação sob demanda.
- Tratamento de erro: o publish **não falha** se a reformatação falhar — apenas loga em `system_health_logs` (function_name=`reformat-article-html`, severity `warn`). O artigo já está publicado; reformatação é melhoria, não bloqueio.
- Custos: cada publish dispara 1-3 chamadas LLM (uma por idioma presente). Aceitável dado que publish é evento raro.

**Não alterar:**
- Comportamento do botão manual além de passar `force: true`.
- Prompt anti-alucinação (já validado).
- Lógica de geração inicial (`copilot-draft-knowledge-article`).

## Resumo das mudanças

| Arquivo | Mudança |
|---|---|
| `src/components/knowledge/KbTabCatalogo.tsx` | On-demand translate-card-row para tech specs em EN/ES com dedupe por sessão |
| `supabase/functions/translate-card-row/index.ts` | Aceitar `table` opcional (system_a_catalog / products_catalog), upsert dos campos `technical_specs_en/_es` correspondentes |
| `supabase/functions/copilot-publish-knowledge-article/index.ts` | Fire-and-forget para `reformat-article-html` após publish bem-sucedido |
| `supabase/functions/reformat-article-html/index.ts` | Skip se `content_html_reformatted_at` set e `force !== true`; marcar timestamp após sucesso |
| `src/pages/AdminViewSupabase.tsx` / `AdminViewSecure.tsx` | Botão manual passa `force: true` |
| Migration | `ALTER TABLE knowledge_contents ADD COLUMN content_html_reformatted_at timestamptz` |
