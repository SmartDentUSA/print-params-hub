## Diagnóstico

O badge "Cérebro defasado vs CRM" está comparando fontes diferentes:

- **Cérebro** (R$ 2.604.537 · 432 ganhos) lê de `lia_attendances.piperun_deals_history` (JSONB canônico, mesma fonte usada pelo `vw_vendas_ganhas` recriado).
- **"CRM ao vivo"** na função `check_copilot_brain_drift` lê de `public.deals` (R$ 2.252.998 · 347 ganhos) — a tabela defasada que já identificamos na investigação anterior, e que motivou recriar o `vw_vendas_ganhas`.

Ou seja: o Cérebro está **correto** e alinhado ao PipeRun (R$ 2,5M). Quem está errado é o comparador — está usando a fonte que sabidamente perde ~85 deals/mês.

## Correção

Atualizar `public.check_copilot_brain_drift()` para usar a **mesma fonte canônica** que o Cérebro:

- Trocar `FROM public.deals d WHERE d.status = 'ganha' ...` por leitura do `vw_vendas_ganhas` (que já filtra mês corrente SP, exclui pipelines não-comerciais, e usa `DISTINCT ON (deal_id)` sobre o JSONB).
- Manter o mesmo retorno JSON (campos `brain_receita`, `live_receita`, `brain_deals`, `live_deals`, `diff_pct`, `last_refresh`, `age_minutes`).
- Manter regra de alerta (`diff_pct > 5%` ou snapshot > 30min) e os inserts em `system_health_logs` / `brain_alerts`.

Resultado esperado: diff cai para <1% (Cérebro e view leem o mesmo JSONB; única diferença será latência do refresh do snapshot).

## O que NÃO mudar

- `vw_vendas_ganhas` (já está certo).
- `copilot_brain.refresh_all()` e cron de 5min.
- Componente `CopilotBrainHealthCard` (continua consumindo o mesmo RPC).
- Tabela `public.deals` — separadamente vale diagnosticar por que o `piperun-full-sync` não atualiza essa tabela, mas isso é independente do alerta e fica fora deste plano.

## Entregável

Uma migration que recria `public.check_copilot_brain_drift()` lendo de `vw_vendas_ganhas`.
