# Fix: Perda silenciosa de leads no Meta Lead Ads pull

Contexto: no deploy anterior desta função eu já subi `sinceMinutes` para **45** e adicionei o "Gap Detector". Você agora está pedindo especificamente **30 minutos** como padrão. Este plano ajusta esse valor e confirma o restante.

## Mudanças

### 1. `supabase/functions/meta-lead-ads-pull/index.ts`
- Alterar o default de `sinceMinutes` de `45` para **`30`** (cobre com folga o ciclo real de ~19min por form).
- Manter o **Gap Detector** já existente: antes de buscar leads de um `formId`, consulta `system_health_logs` pelo último `meta_pull_ok` daquele form; se o gap `now - last_ok > sinceMinutes`, grava um `warning` com `error_type='meta_pull_window_gap_detected'` incluindo `form_id`, `gap_minutes` e `configured_window_minutes`.
- **Não** alterar: encaminhamento para `smart-ops-ingest-lead`, `claim_next_meta_pull_form`, backoff de rate-limit, `FORM_ID_TO_NAME`, dedup, nenhuma outra branch.

### 2. Cron job (`pg_cron`)
- Atualizar o schedule que invoca `meta-lead-ads-pull` para passar `"since_minutes": 30` no body (hoje está `45` desde o último deploy). Feito via `supabase--insert` executando `cron.unschedule` + `cron.schedule` — sem tocar em outros jobs.

### 3. Deploy
- Deploy apenas de `meta-lead-ads-pull`.

## Fora do escopo (passo separado, quando você mandar a lista)
- Backfill manual dos 20 leads perdidos de hoje via `smart-ops-ingest-lead` (você já tem nome/e-mail/telefone/form_id).

## Detalhes técnicos

- Diff efetivo em `index.ts`: uma linha (`const sinceMinutes = body.since_minutes ?? 45` → `?? 30`).
- SQL do cron será executado com `supabase--insert` (contém a anon key do projeto e URL da função, por isso não vai em migration).
- Nenhum schema muda; nenhuma tabela é criada.
