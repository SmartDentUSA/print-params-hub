
-- Re-trigger Judge evaluation for 31 human_reviewed without verdict
-- The trigger fires when agent_response changes from NULL to non-NULL
-- So we need to: set judge_evaluated_at = NULL, then touch agent_response
UPDATE agent_interactions 
SET judge_evaluated_at = NULL,
    judge_verdict = NULL,
    judge_score = NULL
WHERE human_reviewed = true 
  AND judge_verdict IS NULL;
