-- Reset the 17 leads contaminated by today's retry-cron sweep (2026-05-11 20:00–21:00 UTC).
-- These were Astron Academy students, e-commerce buyers, raw WhatsApp pings and
-- Dra. LIA chats with NO commercial form submission — none should have become
-- PipeRun Deals. We:
--   1. Clear `piperun_id` and related Deal fields so they no longer appear as
--      "Deal-having" leads in our system.
--   2. Mark `crm_creation_blocked = true` with the contamination reason so the
--      retry-cron and lia-assign guards never push them again.
--   3. Capture the orphan PipeRun Deal IDs into raw_payload.orphan_piperun_deal_id
--      so an operator can review and delete them manually in PipeRun.
-- The Deals themselves remain in PipeRun for manual reconciliation.

WITH contaminated AS (
  SELECT id, piperun_id
  FROM public.lia_attendances
  WHERE merged_into IS NULL
    AND piperun_id IS NOT NULL
    AND raw_payload->>'piperun_retry_succeeded_at' IS NOT NULL
    AND (raw_payload->>'piperun_retry_last_attempt_at')::timestamptz >= '2026-05-11 20:00:00+00'
    AND (form_name IS NULL OR form_name = '')
    AND source IN ('astron_postback','sync_astron_members','ecommerce_order','loja_integrada','wa_inbound','whatsapp_lia','dra-lia','dra_lia')
)
UPDATE public.lia_attendances l
SET
  crm_creation_blocked = true,
  crm_creation_blocked_reason = 'retry_cron_contamination_2026_05_11',
  piperun_id = NULL,
  piperun_title = NULL,
  piperun_pipeline_name = NULL,
  piperun_stage_name = NULL,
  piperun_status = NULL,
  raw_payload = COALESCE(l.raw_payload, '{}'::jsonb)
    || jsonb_build_object(
      'orphan_piperun_deal_id', c.piperun_id,
      'piperun_retry_skipped_at', now()::text,
      'piperun_retry_skipped_reason', 'retry_cron_contamination_2026_05_11',
      'piperun_retry_attempts', 999
    )
    - 'piperun_retry_succeeded_at'
FROM contaminated c
WHERE l.id = c.id;

-- Audit log entry (informational)
INSERT INTO public.system_health_logs (function_name, severity, error_type, details)
VALUES (
  'manual_repair',
  'warning',
  'retry_cron_contamination_repair',
  jsonb_build_object(
    'date', '2026-05-11',
    'description', 'Reset 17 non-commercial leads (Astron/eCommerce/WA/dra-lia) that the retry cron pushed to PipeRun. Orphan Deal IDs preserved in raw_payload.orphan_piperun_deal_id for manual reconciliation.'
  )
);