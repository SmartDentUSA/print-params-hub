ALTER TABLE public.agent_interactions
  ADD COLUMN IF NOT EXISTS judge_score_ds integer,
  ADD COLUMN IF NOT EXISTS judge_verdict_ds text,
  ADD COLUMN IF NOT EXISTS judge_reason_ds text,
  ADD COLUMN IF NOT EXISTS judge_reason text;