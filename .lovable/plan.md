## Diagnóstico

Os 58 leads recém-reingeridos foram enviados ao PipeRun com apenas **3 custom_fields** (telefone, produto_interesse, país). Consultei a linha do `sidineimiguel@hotmail.com` (piperun_id 62065110) e confirmei:

- `area_atuacao`, `especialidade`, `tem_scanner`, `tem_impressora` estão **NULL** no CDP e no PipeRun.
- `form_data` está **vazio** ({}) e `raw_payload` também.
- Motivo: o CSV do PipeRun (`leads_4.csv`) contém apenas nome, email, telefone, formulário e origem — não traz as respostas do formulário do Meta. O `smart-ops-ingest-lead` só recebeu o que existia no CSV; por isso não havia área/especialidade/equipamentos para mapear.

A fonte original dessas respostas é a Meta Lead Ads API (`field_data`). O buffer `meta_lead_event_buffer` já foi purgado, mas a Graph API mantém os leads por ~90 dias e o `meta-lead-ads-pull` já sabe traduzir `field_data` → colunas do CDP + custom_fields do PipeRun.

## Plano

1. **Nova edge function `meta-lead-ads-backfill`** (one-shot, sem cursor):
   - Aceita `{ form_ids: string[], since_minutes: number, dry_run?: boolean }`.
   - Para cada form_id, chama Graph API `/{form_id}/leads?since=...&fields=id,form_id,created_time,field_data,platform` com paginação (mesma URL que `meta-lead-ads-pull` linha 182).
   - Encaminha cada lead ao `smart-ops-ingest-lead` com o mesmo payload usado hoje (payload Meta com `raw_field_data`), o que já dispara `smart-ops-lia-assign` e envia todos os custom fields via `mapAttendanceToDealCustomFields`.
   - Idempotência garantida pelo merge por email/telefone: os canônicos existentes serão **enriquecidos** (não duplicados), e o PUT em `deals/{piperun_id}` atualizará os custom_fields.

2. **Descobrir os form_ids** que cobrem os 58 leads a partir do CSV (`Formulário` = "# - Impresoras - Smart Dent", etc.). Cruzar com `cron_state.meta_pull_forms` + `form_name` já registrados em `system_health_logs`/`meta_lead_ingestion_log` para mapear `form_name` → `form_id`.

3. **Execução em dois passos**:
   - `dry_run: true` — retorna quantos leads a Graph API devolve por form_id nos últimos 30 dias e mostra amostra do `field_data`.
   - `dry_run: false` (após validar) — encaminha para `smart-ops-ingest-lead`, com `since_minutes` alto o suficiente para cobrir a data dos 58 leads (o mais antigo é de 2026-07-01 → ~30 dias).

4. **Validação pós-run** (via `supabase--read_query`):
   - Contagem de leads com `piperun_custom_fields` com ≥ 6 campos entre os 58.
   - Preenchimento de `area_atuacao`, `especialidade`, `tem_scanner`, `tem_impressora`, `form_data` nos registros canônicos.
   - Amostra de 3 leads confirmando que o PipeRun recebeu os novos custom_fields (via PUT log em `system_health_logs`).

5. **Se a Graph API não retornar algum lead** (janela > 90 dias ou form desativado):
   - Registrar em `system_health_logs.error_type='meta_backfill_leads_not_found'` com lista de emails/leadgen_ids ausentes.
   - Reportar ao usuário para decisão manual (enriquecer via formulário interno ou pular).

## Detalhes técnicos

**Arquivos afetados:**
- `supabase/functions/meta-lead-ads-backfill/index.ts` — nova função (fora do cursor rotativo, sem tocar em `cron_state`).
- `supabase/config.toml` — registrar a nova função com `verify_jwt = false`.

**Sem alterações em:**
- `meta-lead-ads-pull`, `smart-ops-ingest-lead`, `smart-ops-lia-assign`, `piperun-field-map.ts`. Reutilizamos toda a régua atual, garantindo que os custom_fields (549058 produto, 549150 telefone, 621083 país, 673900 área, 445631 especialidade, 549141/549142 scanner/impressora, 772727/772728 texto scanner/impressora, etc.) sejam enviados exatamente como já ocorre no fluxo normal.

**Riscos e mitigações:**
- Rate limit da Graph API → respeitar o BUC como `meta-lead-ads-pull` já faz (bail se `x-business-use-case-usage > 80%`).
- Reprocessamento pode gerar “Ganho novamente” ou eventos no PipeRun → não; `smart-ops-lia-assign` só faz PUT nos custom_fields quando o deal já existe (não recria).
- Pessoas com origem congelada → mantido; `updatePersonFields` não sobrescreve `origin_id` (memória `person-origin-frozen`).
