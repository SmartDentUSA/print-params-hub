## Diagnóstico

Cruzei os 20 e-mails únicos do CSV (`leads_2.csv`, 21 linhas / 20 e-mails únicos — Antonio Adriano aparece 2x) com `lia_attendances`:

**16 leads JÁ estão no CDP:**
- **11 foram ingeridos HOJE** (07/10) via `smart-ops-meta-lead-webhook` — todos com `source='meta_lead_ads'`, `platform_form_id` populado e `piperun_id` criado. Exemplos: keniacristinac, drheldershany, francielly-18, silvanojose05, gutogac, contato@drstanko, drgustavobucomaxilo, mcnetto245, sauloferraz, tecormack, luisfederighi.
- **5 são reentregas antigas** (Fev, Mar, Jun, Set, Dez) que o `HARD_DEDUPE` / `REDELIVERY_GUARD` bloqueou hoje corretamente — o Meta re-exportou no CSV mas o CDP já tinha o canonical. Exemplos: antonio.adriano (Fev/26), joaopaulo_vix (Fev/26), caioitaobim2 (Dez/25), clarkc_jc (Set/25), pcbcustodio (Mar/26).

**4 leads do CSV NÃO entraram hoje** (nem via webhook, nem via pull):
- `elenilcefalcao@gmail.com` — Marcio Carvalho Portela — 12:48pm — # - Impresoras
- `mj_siqueira@hotmail.com` — Juliana Siqueira — 11:46am — # - Impresoras
- `renanbmoreira@icloud.com` — Renan Balsanelli — 3:59am — BLZ
- `tatadoriso1@gmail.com` — Maurício Do Riso — 2:24am — BLZ

## Causa raiz

1. **`meta-lead-ads-pull` está em loop de erro há mais de 30min.** `system_health_logs` mostra `RateLimitError: Rate limit exceeded for trace ... Retry after ~25s` a cada 5min para os form_ids `4309081142703799` (# - Impresoras), `1853424102139156` (BLZ), `994460442184175` e `1789308268708562`. É rate-limit do runtime Supabase (não do Meta/BUC). Consequência: quando o webhook do Meta atrasa/perde um lead, o pull não consegue reconciliar.

2. **Janela do cron está mal dimensionada.** Cron `*/5` envia `since_minutes: 3`, mas o round-robin serializado (1 form/invocação, 4 forms) faz cada form ser consultado apenas a cada **20 minutos**. Resultado: cada form pega uma janela de 3min a cada 20min → **17min de buraco por ciclo por form**. Lead que caiu no buraco fica órfão até o próximo hit — e como o pull está em RateLimitError, hoje ficou órfão de vez.

3. **Cron fantasma:** `meta-lead-recovery-30min` chama `smart-ops-meta-lead-recovery`, função que **não existe** no repositório. 404 a cada 30min, sem alerta.

## Ações propostas

### 1. Backfill imediato dos 4 leads que ficaram fora
Chamar `smart-ops-meta-csv-backfill` (função existente) com os 4 leads do CSV. Injeta como `source='meta_lead_ads'` com o `form_name` correto → passa por `smart-ops-ingest-lead` → dispara `lia-assign` → cria Deal PipeRun.

### 2. Aumentar a janela do cron para cobrir o round-robin
Alterar `cron.job` jobid=75 de `since_minutes: 3` para `since_minutes: 60`. Motivo: com 4 forms × 5min = 20min por form, a janela precisa ser ≥ 20min. Uso 60min para dar margem em caso de rate-limit (perdeu 2 ciclos → recupera no 3º). Dedupe universal (`HARD_DEDUPE` + `FAMILY_KEY`) protege contra reprocessamento.

### 3. Investigar o `RateLimitError` do runtime Supabase no pull
O erro vem do próprio edge runtime, não do Meta. Adicionar no `meta-lead-ads-pull`:
- Retry-once com backoff quando o fetch do Graph API devolve `RateLimitError` do runtime (esperar 25s conforme `Retry-After` e tentar novamente na mesma invocação).
- Se falhar 2x, marcar `cron_state.meta_pull_backoff_until = now()+2min` para não amplificar.
- Log `severity='error'` estruturado com `error_type='meta_pull_runtime_rate_limit'` (hoje só loga como `meta_pull_exception` genérico).

### 4. Corrigir cron fantasma
Remover o cron `meta-lead-recovery-30min` (jobid=90) OU criar a função `smart-ops-meta-lead-recovery` que faça reconciliação diária dos últimos 60min via CSV backfill. Recomendo **remover** — o pull `*/5` corrigido no item 2 já cobre o caso.

## Detalhes técnicos

- Não mexer no webhook (`smart-ops-meta-lead-webhook`) — está saudável e entregou 11 leads hoje.
- Não mexer no `smart-ops-ingest-lead` — dedupe está funcionando (silenciou 5 reentregas corretamente).
- Migrações necessárias: 1 pra alterar cron jobid=75 (`SELECT cron.alter_job(75, command:='...since_minutes:60...')`) e 1 pra remover jobid=90 (`SELECT cron.unschedule(90)`).
- Edge function edit: `supabase/functions/meta-lead-ads-pull/index.ts` — adicionar retry local em `RateLimitError` do runtime.
- Backfill: `curl` no `smart-ops-meta-csv-backfill` com os 4 registros, ou usar a UI de import de CSV se existir.

## O que NÃO vai mudar

- Contrato do webhook, `ingest-lead`, `lia-assign`, `piperun-webhook`.
- Guardas de dedupe, `REDELIVERY_GUARD`, `commercial-intent-guard`, `test-pipeline-guard`.
- Round-robin serializado (1 form por invocação) — só a janela `since_minutes` muda.
