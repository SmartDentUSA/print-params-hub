-- 1. node_id obrigatório em wa_message_queue
-- Backfill obrigatório: SET NOT NULL valida linhas existentes, então as 36 linhas
-- legado (mai–jul, pré-correção do wa-group-blast) recebem um node_id determinístico.
UPDATE public.wa_message_queue
SET node_id = 'legacy:' || id::text
WHERE node_id IS NULL;

ALTER TABLE public.wa_message_queue ALTER COLUMN node_id SET NOT NULL;

-- 2. wa_followup_queue morta, sem escritores — remover
DROP TABLE IF EXISTS public.wa_followup_queue;

-- 3. remover constraint UNIQUE duplicada em email_sequence_dispatches
ALTER TABLE public.email_sequence_dispatches
  DROP CONSTRAINT IF EXISTS email_sequence_dispatches_unique_step;