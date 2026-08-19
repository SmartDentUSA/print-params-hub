CREATE OR REPLACE FUNCTION public.fn_claim_testimonial_auto_jobs(_limit integer DEFAULT 3)
RETURNS SETOF public.training_testimonials
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.training_testimonials t
     SET auto_locked_at = now(),
         auto_attempts = t.auto_attempts + 1,
         auto_next_attempt_at = now() + interval '20 minutes'
   WHERE t.id IN (
     SELECT id FROM public.training_testimonials
      WHERE auto_process = true
        AND auto_attempts < 3
        AND (
          status IN ('uploaded','awaiting_identification','transcribed')
          OR (status IN ('rag_available','published') AND social_story_post_id IS NULL)
        )
        AND (auto_next_attempt_at IS NULL OR auto_next_attempt_at <= now())
        AND (auto_locked_at IS NULL OR auto_locked_at < now() - interval '15 minutes')
      ORDER BY auto_next_attempt_at NULLS FIRST
      LIMIT GREATEST(1, LEAST(_limit, 5))
      FOR UPDATE SKIP LOCKED
   )
  RETURNING t.*;
$$;