-- Clear PipeRun identifiers on all merged-away leads to honour
-- "Piperun Merge Prev" memory rule and unblock unique-constraint collisions
-- that prevent the webhook from updating canonical leads.
UPDATE public.lia_attendances
   SET piperun_id = NULL,
       pessoa_piperun_id = NULL,
       empresa_piperun_id = NULL
 WHERE merged_into IS NOT NULL
   AND (piperun_id IS NOT NULL
        OR pessoa_piperun_id IS NOT NULL
        OR empresa_piperun_id IS NOT NULL);