---
name: Meta Lead Ads pull — round-robin serializado
description: 1 form_id por invocação, cursor com FOR UPDATE SKIP LOCKED, backoff adaptativo por X-Business-Use-Case-Usage; fallback hardcoded emite severity='error'
type: feature
---
**Problema:** cron `*/5` puxava 4 form_ids em paralelo → estourava rate-limit por `app_id` do Meta (871 RateLimitError em 24h, funil orgânico Meta parou).

**Solução em `supabase/functions/meta-lead-ads-pull/index.ts`:**

1. **Round-robin serializado.** Cada invocação processa **1 form_id**. Lista em `cron_state.meta_pull_forms.meta.form_ids` (jsonb array). Cadência por form = `total_forms × cron_interval` (hoje 4 × 5min = 20min).
2. **Cursor com lock atômico** via RPC `claim_next_meta_pull_form()` que faz `SELECT ... FROM cron_state WHERE key='meta_pull_form_idx' FOR UPDATE SKIP LOCKED`. Se outra invocação segura o lock, retorna vazio e a função sai. Zero risco de processar o mesmo form 2x nem pular forms.
3. **Fallback hardcoded emite `severity='error'`** (`error_type='meta_pull_hardcoded_fallback_used'`). Se `cron_state.meta_pull_forms` ficar vazio/inválido, alerta explícito nos health logs. Não é bomba-relógio silenciosa.
4. **Backoff adaptativo por BUC.** Parseia header `X-Business-Use-Case-Usage` do Meta. `pct >= 75` OU HTTP 429 → escreve `cron_state.meta_pull_backoff_until = now()+30min`. Próximas invocações checam esse gate antes de gastar chamada. `pct >= 60` → warning log (sem bloquear).
5. **Guardrails de execução:** máx 3 páginas por invocação, timeout 45s. Cada lead vai para `smart-ops-ingest-lead` (mesmo contrato do webhook) → dedupe universal (`HARD_DEDUPE` + `FAMILY_KEY` + `REDELIVERY_GUARD`) filtra reentrega.

**Migração:** `20260710170000_*` cria `claim_next_meta_pull_form()` (SECURITY DEFINER, `FOR UPDATE SKIP LOCKED`) e faz seed de `meta_pull_forms` / `meta_pull_form_idx` em `cron_state`.

**Limite conhecido — cadência linear:** cada form novo aumenta o intervalo por-form em `cron_interval` minutos. 5 forms = 25min, 6 = 30min, 10 = 50min. Quando o volume crescer e essa cadência ficar apertada, opções: (a) reduzir cron para `*/3`, (b) processar 2 forms por invocação (só quando BUC estiver <40%), (c) migrar 100% pro webhook e descontinuar o pull (o pull hoje só existe como fallback de reconciliação — o canal primário é `smart-ops-meta-lead-webhook`).

**Como adicionar/remover form_id:** `UPDATE public.cron_state SET meta = jsonb_set(meta, '{form_ids}', '[...]'::jsonb) WHERE key='meta_pull_forms';` — a próxima invocação já usa a nova lista.

**Validação:** `SELECT * FROM system_health_logs WHERE function_name='meta-lead-ads-pull' ORDER BY created_at DESC LIMIT 20;` — esperado `meta_pull_ok` alternando entre os 4 form_ids. Nenhum `RateLimitError`. Se aparecer `meta_pull_hardcoded_fallback_used` (severity=error), corrigir `cron_state.meta_pull_forms` imediatamente.