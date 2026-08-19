UPDATE public.training_testimonials
SET status = 'transcribed',
    auto_process = true,
    auto_attempts = 0,
    auto_locked_at = NULL,
    auto_next_attempt_at = NULL,
    auto_last_error = NULL
WHERE id IN (
  '4eff8525-5d03-4f66-a6ba-4f48758e4438',
  '43c285be-67b5-48e5-92a8-74358e1894ec',
  '232454bd-c274-4dbe-97ca-db4529ca7ce2'
);