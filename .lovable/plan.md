## Objetivo

Criar as 2 edge functions tl;dv que faltam, validar o sync histórico em `dry_run` e depois rodar real, conferindo logs e dados nas tabelas `tldv_*`.

## Status atual

- **Schema:** `tldv_meetings`, `tldv_meeting_participants`, `tldv_meeting_intelligence`, `tldv_webhook_log` — já existem.
- **Secret:** `TLDV_API_KEY` cadastrada no Supabase Dashboard.
- **Edge functions:** `smart-ops-tldv-webhook` e `smart-ops-tldv-sync` **NÃO existem** em `supabase/functions/`. Precisam ser criadas do zero.

## Etapas

### 1. Criar `supabase/functions/smart-ops-tldv-webhook/index.ts`
Recebe eventos do tl;dv (`TranscriptReady`):
- Loga payload bruto em `tldv_webhook_log`.
- Insere/upsert em `tldv_meetings` (id externo do tl;dv, título, data, transcript bruto, status).
- Identifica participantes: cruza email com `team_members` e com `lia_attendances` (respeitando `merged_into IS NULL`) e popula `tldv_meeting_participants`.
- Roda DeepSeek (já temos `DEEPSEEK_API_KEY`) com tool calling para extrair JSON estruturado: `products_mentioned`, `competitors`, `current_equipment`, `objections[]`, `interest_level`, `meeting_score`, `next_steps`. Salva em `tldv_meeting_intelligence`.
- Se identificar lead: enriquece `lia_attendances` apenas com campos confirmados (equip_scanner, equip_impressora, etc.) seguindo o `Form Enrichment ALWAYS_UPDATE` para equipamentos e respeitando `Person Origin Frozen` (não sobrescreve `origem_primeiro_contato`).
- Logs com prefixo `[tldv-webhook]` e `logAIUsage` da DeepSeek.
- `verify_jwt = false` em `supabase/config.toml`.

### 2. Criar `supabase/functions/smart-ops-tldv-sync/index.ts`
Sync histórico paginado:
- Body: `{ since: "2025-01-01", limit: 10, dry_run: true, reprocess: false }`.
- Chama API tl;dv `GET /v1alpha1/meetings?from=...&page=...` usando `TLDV_API_KEY` (Bearer header).
- Para cada meeting: pula se já existe em `tldv_meetings` (a menos que `reprocess=true`).
- Em `dry_run`: retorna lista do que seria processado, sem gravar.
- Caso real: encadeia POST para `smart-ops-tldv-webhook` com payload normalizado (fire-and-forget para não estourar timeout).
- Retorna `{ found, skipped, queued, dry_run }`.
- `verify_jwt = false`.

### 3. Registrar config
Adicionar em `supabase/config.toml`:
```
[functions.smart-ops-tldv-webhook]
verify_jwt = false

[functions.smart-ops-tldv-sync]
verify_jwt = false
```

### 4. Validação ao vivo (eu rodo após deploy)
1. `dry_run: true` com `since=2025-01-01`, `limit=5` → conferir lista retornada.
2. Inspecionar logs de `smart-ops-tldv-sync` (deve mostrar quantos achou na API tl;dv).
3. Rodar real (`dry_run: false`, `limit=5`) → conferir logs do webhook, contar linhas em `tldv_meetings`, `tldv_meeting_participants`, `tldv_meeting_intelligence`.
4. Se OK, rodar lote maior (`limit=50`).

### 5. Memória
Salvar `mem://integration/tldv-meeting-intelligence` com a arquitetura final (webhook + sync + identidade por email + DeepSeek tool calling) e referenciar no índice.

## Fora de escopo

- UI no admin para visualizar reuniões (sugiro depois, em request separado).
- Renderização de objeções no card do lead Kanban.
- Configuração do webhook no painel tl;dv (você faz manual após o deploy).
