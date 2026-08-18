ALTER TABLE public.training_testimonials
  ADD COLUMN IF NOT EXISTS auto_process boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_next_attempt_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS auto_last_error text,
  ADD COLUMN IF NOT EXISTS auto_locked_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_training_testimonials_auto_queue
  ON public.training_testimonials (auto_next_attempt_at)
  WHERE auto_process = true
    AND status IN ('uploaded','awaiting_identification','transcribed','transcribing','generating');

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
        AND status IN ('uploaded','awaiting_identification','transcribed')
        AND (auto_next_attempt_at IS NULL OR auto_next_attempt_at <= now())
        AND (auto_locked_at IS NULL OR auto_locked_at < now() - interval '15 minutes')
      ORDER BY auto_next_attempt_at NULLS FIRST
      LIMIT GREATEST(1, LEAST(_limit, 5))
      FOR UPDATE SKIP LOCKED
   )
  RETURNING t.*;
$$;

REVOKE ALL ON FUNCTION public.fn_claim_testimonial_auto_jobs(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_claim_testimonial_auto_jobs(integer) TO service_role;