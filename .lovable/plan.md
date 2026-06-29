## Diagnóstico

A versão **correta** vinha de `products_catalog.technical_specifications` (15 specs em PT). A versão **errada atual** mostra `resins.technical_specs` (4 campos snake_case) porque:

- `products_catalog` tem RLS `deny_anon` → na rota pública `/base-conhecimento?tab=catalogo` o `select` retorna 0 linhas → `docMap` vazio → cai no fallback de resina.
- A coluna `extra_data.system_a_live.technical_specs` (que o card já lê como segundo fallback) está **vazia** em todos os 14 cards de resina — o snapshot do Sistema A nunca foi populado.

A infra de sync já existe e o Sistema A expõe os dados certos:

```text
GET https://pgfgripuanuwwolmtknn.supabase.co/functions/v1/get-product-data?product_id=<external_id>
→ data.technical_specifications: [{label, value}, …]   # +Flex retorna 15 rows
```

O Sistema B já tem:
- `_shared/system-a-live.ts` que mapeia o payload → `LiveProductDossier.technical_specs`
- `smart-ops-refresh-system-a-cache` que faz upsert em `system_a_catalog.extra_data.system_a_live`
- `KbTabCatalogo.tsx:664` que lê `extra_data?.system_a_live?.technical_specs` como fallback

Faltam 3 ajustes pequenos.

## Plano

**1. Subir o cap de specs (`supabase/functions/_shared/system-a-live.ts`)**

`asSpecArr(v, max = 12)` corta em 12 → +Flex perde 3 specs. Mudar para `max = 60` (cobre o maior payload conhecido com folga).

**2. Backfill imediato — popular todos os 14 cards de resina**

Chamar a função existente em batch:

```text
GET /functions/v1/smart-ops-refresh-system-a-cache?all=true&limit=200
```

Isso percorre `system_a_catalog` (active=true, external_id NOT NULL), busca cada produto no Sistema A, e grava `extra_data.system_a_live` com `technical_specs` mais 10+ campos extras (features, benefits, applications, document_extracts, workflow_stages, anti_hallucination, etc.).

Validação: após rodar, conferir que `Bio Bite Splint +Flex` retorna 15 rows em `extra_data.system_a_live.technical_specs`.

**3. Cron diário (sync automático)**

Agendar via `pg_cron` (`supabase--insert`, conforme regra de jobs):

```text
'sync-system-a-catalog-daily', '0 4 * * *'  -- 04:00 BRT diariamente
```

Para o sync apanhar novos produtos e atualizações de Indicação Clínica / Certificação ANVISA / etc. sem intervenção manual.

## Resultado esperado

- Anon em `/base-conhecimento?tab=catalogo` vê a tabela rica PT (15 rows) servida via `system_a_catalog.extra_data.system_a_live.technical_specs` (anon-readable).
- Independente do estado RLS de `products_catalog`.
- Atualiza diariamente.

## Fora de escopo

- Não mexer em RLS de `products_catalog` (mantém bloqueado para anon).
- Não tocar no código de match `resinExact`/`resinFuzzy`.
- Não alterar `resins`, `resin_documents`, `resin_presentations`.
- Não mexer em traduções EN/ES (nem invalidar cache).

## Detalhes técnicos

- Arquivo editado: `supabase/functions/_shared/system-a-live.ts` (uma linha: `max = 60`).
- Sem migration de schema (extra_data já é JSONB).
- Sem novo edge function — reaproveita `smart-ops-refresh-system-a-cache`.
- Cron: `supabase--insert` com `cron.schedule(...)` chamando `net.http_post` para `…/functions/v1/smart-ops-refresh-system-a-cache?all=true&limit=200`.
- Frontend: nenhuma mudança em `KbTabCatalogo.tsx` — o fallback `fromLive` já existe (linha 664).
