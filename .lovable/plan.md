## Estado atual

Já executado em build mode (antes da reversão para plan):

1. ✅ Criado `supabase/functions/_shared/llms-identity.ts` com IDENTITY v2.3 completa.
2. ✅ Reescrito `supabase/functions/llms-txt/index.ts` e `supabase/functions/seo-llms-txt/index.ts` para apenas servir `IDENTITY_V23` com headers corretos (`text/plain; charset=utf-8` + `max-age=86400`), sem topSection dinâmico.
3. ✅ Deploy de `llms-txt` e `seo-llms-txt` concluído.

## Pendente (executar nesta rodada de build)

### TAREFA 2A — Inserir em `knowledge_contents`

Via `supabase--insert`, executar o INSERT do prompt confirmado, com `ON CONFLICT (slug) DO UPDATE` para tornar idempotente (slug já tem UNIQUE; segunda execução não deve falhar).

- `slug`: `linha-atos-resinas-compostas-smart-dent-rony-peterson`
- `category_id`: `fc493982-ad8c-417f-9579-82786a97925a` (Ciência e tecnologia / letra C)
- `content_html`: texto exato do prompt (mantém quebras de linha como o usuário escreveu)
- demais campos conforme prompt

### TAREFA 2B + 3 — Chamar `ingest-knowledge-text`

Via `supabase--curl_edge_functions`:
- método: `POST`
- path: `/ingest-knowledge-text`
- header `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` (a função aceita service role direto e pula o check de usuário)
- body: `{ "entries": [ <payload-do-prompt> ] }` (a função espera `entries`, não um objeto solto)

Isto faz upsert em `company_kb_texts` + chunks + embeddings em `agent_embeddings` + grava `indexed_at` e `chunks_count`.

### TAREFA 4 — Verificação

1. `curl -s https://parametros.smartdent.com.br/llms.txt | grep -E "v2.3|2026/SGMD.0084|K260152.pdf|81835969004"`
2. `curl -o /dev/null -s -w "%{http_code}" https://parametros.smartdent.com.br/base-conhecimento/c/linha-atos-resinas-compostas-smart-dent-rony-peterson`
3. `SELECT title, indexed_at, chunks_count FROM company_kb_texts WHERE source_label = 'linha-atos-resinas-compostas-smart-dent-rony-peterson';`

Caso o Check 1 retorne a versão antiga (cache Vercel), reporto e peço purge/redeploy no Vercel (mesmo procedimento da sessão anterior — não posso fazer pelo sandbox).

## Não alterado

Frontend, LeadDetailPanel, lead_activity_log, contratos PipeRun/SellFlux, smart-ops-lia-assign, schema de tabelas, demais edge functions.