-- Round 2 contamination repair (2026-05-11):
-- Found via PipeRun CSV oportunidades-11-05-2026 — 14 deals from non-commercial
-- sources slipped through before the lia-assign guard was effective.
-- Strategy: clear piperun_id, mark blocked, preserve orphan IDs.

WITH targets AS (
  SELECT id, piperun_id
  FROM public.lia_attendances
  WHERE merged_into IS NULL
    AND piperun_id IS NOT NULL
    AND piperun_id::text = ANY(ARRAY[
      '59695743','59696055','59696131','59696165','59696282','59693403',
      '59696317','59696323','59696329','59696335','59696361','59696367',
      '59696370','59696393'
    ])
)
UPDATE public.lia_attendances l
SET
  crm_creation_blocked = true,
  crm_creation_blocked_reason = COALESCE(l.crm_creation_blocked_reason, 'retry_cron_contamination_2026_05_11_round2'),
  piperun_id = NULL,
  piperun_title = NULL,
  piperun_pipeline_name = NULL,
  piperun_stage_name = NULL,
  piperun_status = NULL,
  pessoa_piperun_id = NULL,
  raw_payload = COALESCE(l.raw_payload, '{}'::jsonb)
    || jsonb_build_object(
      'orphan_piperun_deal_id', t.piperun_id,
      'piperun_retry_skipped_at', now()::text,
      'piperun_retry_skipped_reason', 'retry_cron_contamination_2026_05_11_round2',
      'piperun_retry_attempts', 999
    )
    - 'piperun_retry_succeeded_at'
FROM targets t
WHERE l.id = t.id;

-- Watillas T. Santos duplicate: keep the older Person (46857333 / deal 59696290),
-- mark the newer one (46857336 / deal 59696291) as duplicate to clean up in PipeRun.
UPDATE public.lia_attendances l
SET
  crm_creation_blocked = true,
  crm_creation_blocked_reason = 'duplicate_person_debounce_2026_05_11',
  piperun_id = NULL,
  pessoa_piperun_id = NULL,
  raw_payload = COALESCE(l.raw_payload, '{}'::jsonb) || jsonb_build_object(
    'orphan_piperun_deal_id', '59696291',
    'orphan_pessoa_piperun_id', '46857336',
    'duplicate_of_pessoa_piperun_id', '46857333',
    'duplicate_of_piperun_deal_id', '59696290'
  )
WHERE merged_into IS NULL
  AND piperun_id::text = '59696291';

INSERT INTO public.system_health_logs (function_name, severity, error_type, details)
VALUES (
  'manual_repair',
  'warning',
  'retry_cron_contamination_repair_round2',
  jsonb_build_object(
    'date', '2026-05-11',
    'description', 'Round 2: cleaned 14 non-commercial deals from PipeRun + 1 duplicate Person (Watillas T. Santos). Orphan Deal IDs preserved in raw_payload.orphan_piperun_deal_id.',
    'orphan_deal_ids', ARRAY['59695743','59696055','59696131','59696165','59696282','59693403','59696317','59696323','59696329','59696335','59696361','59696367','59696370','59696393','59696291'],
    'orphan_pessoa_ids_to_delete', ARRAY['46857336']
  )
);