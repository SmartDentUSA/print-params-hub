ALTER TABLE public.smartops_automations
  ADD COLUMN IF NOT EXISTS email_assunto text,
  ADD COLUMN IF NOT EXISTS email_html text,
  ADD COLUMN IF NOT EXISTS email_remetente text DEFAULT 'Smart Dent | Fluxo Digital',
  ADD COLUMN IF NOT EXISTS sms_template text;

DROP INDEX IF EXISTS public.smartops_automation_runs_daily_uq;
CREATE UNIQUE INDEX IF NOT EXISTS smartops_automation_runs_daily_canal_uq
  ON public.smartops_automation_runs (automation_id, lead_id, canal, run_date)
  WHERE status <> 'erro';