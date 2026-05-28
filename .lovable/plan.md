## WA Group Scheduler — Backend (5 edge functions) + Migration + Frontend

Plano em 3 fases. Backend primeiro porque o frontend (já aprovado em `.lovable/plan.md`) depende de tabelas, view e funções que ainda não existem.

### Fase 1 — Migration de reconciliação (`supabase--migration`)

Aplico o `004_reconcile_wa_tables.sql` já discutido, com 3 ajustes obrigatórios para rodar no Postgres do projeto:

1. `ALTER TABLE ... ADD CONSTRAINT IF NOT EXISTS` → bloco `DO $$ IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_wa_groups_campaign') THEN ALTER TABLE ... END IF; $$`.
2. **GRANTs obrigatórios** para todas as tabelas novas em `public` (regra do projeto — sem isso PostgREST devolve 401/permission denied): `wa_campaigns`, `wa_message_queue`, `wa_send_log`, `wa_verify_queue` recebem `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated` + `GRANT ALL ... TO service_role`.
3. `pg_cron` com `<SERVICE_ROLE_KEY>` hardcoded → leitura via `vault.decrypted_secrets`. Se o secret não estiver no Vault, deixo os dois `cron.schedule` comentados no SQL e aviso para configurar manualmente.

Conteúdo da migration: rename PT-BR→EN em `wa_groups` (`nome→name`, `descricao→description`, `membros_count→member_count`, `regua_ativa→_regua_ativa_legacy`), novas colunas (`is_admin`, `instance_name`, `phone_number`, `picture_url`, `active_campaign_id`, `synced_at`), `wa_group_schedules → wa_group_schedules_legacy`, criação de `wa_campaigns` / `wa_message_queue` / `wa_send_log` / `wa_verify_queue`, colunas `wa_exists` + `wa_verified_at` em `lia_attendances` + trigger `fn_queue_wa_verify`, função `fn_check_group_send_cooldown`, view `v_wa_group_summary`, RLS.

### Fase 2 — 5 Edge Functions

Crio exatamente o código fornecido, com **4 correções obrigatórias** para compilar e funcionar contra o schema real:

```text
supabase/functions/_shared/evolution.ts          (novo, código verbatim)
supabase/functions/wa-sync-groups/index.ts       (novo + correção 1)
supabase/functions/wa-campaign-builder/index.ts  (novo, código verbatim)
supabase/functions/wa-dispatcher/index.ts        (novo, código verbatim)
supabase/functions/wa-verify-lead/index.ts       (novo + correções 2 e 3)
```

**Correções:**

1. **`wa-sync-groups`**: o código importa `EVO_INSTANCE`, mas o `_shared/evolution.ts` exporta `EVO_INST`. Renomeio os 3 usos no `wa-sync-groups` para `EVO_INST` (mantém o nome do shared).
2. **`wa-verify-lead` schema do `system_health_logs`**: o código usa o schema antigo (`service`/`status`/`message`/`logged_at`); o schema canônico do projeto (usado em `wa-dispatcher` e em todas as outras funções) é `function_name`/`severity`/`error_type`/`details`/`auto_remediated`/`resolved`. Padronizo o insert.
3. **`wa-verify-lead` filtro composto**: combinar `.is('merged_into', null)` com `.or('wa_phone.is.null,wa_phone.eq...')` quebra o filtro. Substituo por: (a) `SELECT` prévio do `wa_phone` atual do lead, (b) só inclui `wa_phone` no `updatePayload` se for `null`, (c) mantém apenas `.is('merged_into', null)` no `.update()`.
4. **`wa-sync-groups` CORS**: adicionar handler `OPTIONS` para o frontend conseguir chamar via `supabase.functions.invoke`.

**`supabase/config.toml`** — adiciono entradas com `verify_jwt = false` para as 4 funções públicas (chamadas pelo frontend ou pg_cron):

```toml
[functions.wa-sync-groups]
verify_jwt = false
[functions.wa-campaign-builder]
verify_jwt = false
[functions.wa-dispatcher]
verify_jwt = false
[functions.wa-verify-lead]
verify_jwt = false
```

**Secrets** — verifico via `secrets--fetch_secrets` e, se faltar, peço com `add_secret`:
- `EVOLUTION_API_URL`, `EVOLUTION_INSTANCE_NAME`, `EVOLUTION_API_KEY` (têm defaults hardcoded no shared, mas o ideal é em secret).
- `DEEPSEEK_API_KEY`, `GEMINI_API_KEY` — provavelmente já existem.

### Fase 3 — Frontend (spec aprovado em `.lovable/plan.md`, sem alterações)

```text
src/components/smart-ops/wa-groups/
  types.ts                       # ai_source_*, media_url, weekdays_only
  SmartOpsWaGroupCampaigns.tsx   # cards + Realtime
  WaGroupFlowBuilder.tsx         # builder 6 nós
  WaContentNodeSelector.tsx      # modal artigos/produtos/vídeos
  WaGroupFlowVisualizer.tsx      # timeline + countdown
src/pages/WaFlowVisualizerPage.tsx
```

Integração: nova `<TabsTrigger value="grupos-wa">` em `SmartOpsCampaigns.tsx` + rota `/smartops/wa-flow-visualizer` em `App.tsx`. Zero alteração em código existente. Tokens semânticos, sem cor hardcoded.

### Verificação por fase

- **Fase 1**: `SELECT * FROM v_wa_group_summary LIMIT 1` sem erro; `wa_groups` mostra `name`/`is_admin`/`active_campaign_id`.
- **Fase 2**: `supabase--curl_edge_functions` em `/wa-sync-groups` retorna `{ok:true, synced:N}`; logs via `supabase--edge_function_logs`.
- **Fase 3**: TS compila; aba "Grupos WA" renderiza; "Salvar e ativar" chama `wa-campaign-builder` e devolve `first_send`.

### Confirmação antes de prosseguir

Posso aplicar as 4 correções listadas no código das edge functions? Sem elas: `wa-sync-groups` não compila (import quebrado) e `wa-verify-lead` falha no insert de logs e no update do lead.
