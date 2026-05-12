## Contexto

A `TLDV_API_KEY` autentica em `/health` (200 ok) mas falha com 401 em `/meetings`. Você confirmou que só existe um usuário no tl;dv (mesmo dono das reuniões e da chave), então não é problema de scope/ownership.

Hipóteses prováveis (em ordem):

1. **Whitespace/quebra de linha na chave** — a chave tem 74 chars; tl;dv normalmente é ~64 hex. Trim resolve se houver `\n` ou espaço.
2. **Pageamento errado** — doc oficial usa `?page=1&pageSize=10`; nossa chamada está passando `pageSize=50` (talvez exceda limite e retorne 401 em vez de 400, comportamento estranho do tl;dv).
3. **Header case-sensitive ou conflito** — Deno fetch as vezes normaliza headers; vale tentar variações.
4. **API key tipo errado** — tl;dv tem chaves "User API key" vs "Workspace key" e só uma delas funciona em `/meetings`.

## Plano de debug

### Passo 1 — adicionar debug profundo na sync function
Estender o modo `?debug=health` para incluir `?debug=meetings` que:
- Faz trim na chave (`TLDV_API_KEY.trim()`)
- Tenta 3 variações em sequência e devolve status+body de cada:
  - A: `GET /meetings` (sem params)
  - B: `GET /meetings?page=1&pageSize=10`
  - C: `GET /meetings?page=1`
- Retorna `{ key_len_raw, key_len_trimmed, attempts: [{url, status, body_preview}] }`

### Passo 2 — aplicar trim em todas as chamadas tl;dv
Se Passo 1 mostrar diferença entre `key_len_raw` e `key_len_trimmed`, aplicar `.trim()` no header de ambas funções (`smart-ops-tldv-sync` e `smart-ops-tldv-webhook`).

### Passo 3 — ajustar paginação para o formato da doc
Trocar `pageSize=50` por `pageSize=10` (limite seguro da doc). Se Passo 1 mostrar que sem params retorna 200, manter sem `pageSize`.

### Passo 4 — validar e rodar dry_run
Após fix, chamar `dry_run: true, limit: 5` e mostrar a lista das primeiras reuniões retornadas pelo tl;dv.

### Passo 5 — rodar real (limit=5)
Se dry_run OK, processar 5 reuniões reais → conferir contagem em `tldv_meetings`, `tldv_meeting_participants`, `tldv_meeting_intelligence`.

### Passo 6 — lote completo + memória
Se 5 OK, rodar `limit=200`. Salvar `mem://integration/tldv-meeting-intelligence` com a arquitetura final.

## Detalhes técnicos

- Arquivos afetados: `supabase/functions/smart-ops-tldv-sync/index.ts`, `supabase/functions/smart-ops-tldv-webhook/index.ts`.
- Nenhuma alteração de schema/banco.
- Nenhuma alteração de UI.

## Fora de escopo

- Tela de visualização das reuniões no admin (request separado depois).
- Integração de objeções com Kanban.
- Configuração do webhook no painel tl;dv (manual após sync funcionar).
