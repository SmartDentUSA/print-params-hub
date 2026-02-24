-- 1. Delete trash knowledge gaps (< 10 chars)
DELETE FROM agent_knowledge_gaps WHERE LENGTH(question) < 10;

-- 2. Normalize historical top_similarity values > 1.0
UPDATE agent_interactions SET top_similarity = LEAST(top_similarity, 1.0) WHERE top_similarity > 1.0;

-- 3. Force re-evaluation of human_reviewed hallucinations (likely false positives)
UPDATE agent_interactions SET judge_evaluated_at = NULL, judge_score = NULL, judge_verdict = NULL WHERE human_reviewed = true AND judge_verdict = 'hallucination';