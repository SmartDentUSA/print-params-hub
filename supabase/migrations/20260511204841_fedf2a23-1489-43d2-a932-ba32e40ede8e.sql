-- Reverte o estado de "succeeded_at" para os 3 leads que ficaram órfãos
-- (lia-assign retornou piperun_id mas o UPDATE silenciou por unique violation,
-- deixando piperun_id NULL no DB). Após este reset, o cron retry os reprocessará
-- com a guarda nova (strict-email-only + pre-check de unique conflict).
UPDATE public.lia_attendances
SET raw_payload = (raw_payload
    - 'piperun_retry_succeeded_at'
    - 'piperun_retry_last_error'
  ) || jsonb_build_object('piperun_retry_attempts', 0)
WHERE merged_into IS NULL
  AND piperun_id IS NULL
  AND email IN (
    'andreiaknip@gmail.com',
    'clinicaabascal_laboratorio@outlook.com',
    'dentistaamandamoura@outlook.com'
  );